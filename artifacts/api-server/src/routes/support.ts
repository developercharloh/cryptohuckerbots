import { Router } from "express";
import {
  db,
  supportTicketsTable,
  faqTable,
  chatMessagesTable,
  chatAttachmentsTable,
  notificationsTable,
  supportChatThreadsTable,
} from "@workspace/db";
import { and, eq, desc, inArray } from "drizzle-orm";
import { CreateSupportTicketBody } from "@workspace/api-zod";
import { getRequestToken, getUserForSession } from "../lib/session";
import { submitUserDepositTxid, syncBinanceDeposits } from "../lib/binance-deposits";
import { sendPushToAllAdmins } from "../lib/webPush";
import {
  confirmUploadedAttachments,
  cleanupUploadedAttachments,
  createAttachmentUploadSession,
  handleChatAttachmentUpload,
  isAttachmentStorageFailure,
  recordAttachmentStorageFailure,
  streamPrivateAttachment,
  validateAttachmentInputs,
} from "../lib/chat-attachments";

const router = Router();

async function getUserFromToken(token: string | undefined) {
  return getUserForSession(token);
}

async function getOrCreateThread(userId: number) {
  const [existing] = await db.select().from(supportChatThreadsTable)
    .where(eq(supportChatThreadsTable.userId, userId))
    .limit(1);
  if (existing) return existing;
  const [created] = await db.insert(supportChatThreadsTable).values({ userId }).returning();
  return created;
}

function categoryFromMessage(message: string): string | null {
  const value = message.toLowerCase();
  if (
    value.includes("live support") ||
    value.includes("support team") ||
    value.includes("talk to a person") ||
    value.includes("speak to a human") ||
    value.includes("human agent") ||
    value.includes("real person")
  ) return "live_support";
  if (value.includes("deposit") || value.includes("txid") || value.includes("transaction")) return "delayed_deposit";
  if (value.includes("kyc") || value.includes("verification") || value.includes("verify my identity")) return "pending_kyc";
  if (value.includes("technical") || value.includes("bug") || value.includes("error") || value.includes("not working")) return "technical";
  if (value.includes("other")) return "other";
  return null;
}

function firstNameFrom(fullName: string | null | undefined) {
  return fullName?.trim().split(/\s+/)[0] || "there";
}

function botWelcomeMessage(fullName?: string | null) {
  return `Hello ${firstNameFrom(fullName)}, welcome to VIXUS Support. I’m here to help with deposits, verification, withdrawals, account access, and technical questions. Choose a topic below, or connect with our live Support Team at any time.`;
}

function botMessageForCategory(category: string | null): string {
  if (category === "delayed_deposit") {
    return "I understand that your deposit has not appeared yet. I can help submit it for verification. Please paste the full BNB Smart Chain (BEP-20) transaction hash (TxID) from your wallet or exchange. It starts with 0x.";
  }
  if (category === "pending_kyc") {
    return "I can help with your verification review. What best describes the issue: a pending review, a document upload problem, a rejected verification, or trouble opening the verification page?";
  }
  if (category === "technical") {
    return "I’m ready to help troubleshoot that. What is not working: login, email or verification code, the app or page, deposits or withdrawals, or trading and bots?";
  }
  if (category === "other") {
    return "Of course. Tell me what you need help with in one sentence. I’ll try to guide you first, then you can connect with Support if it needs account-level attention.";
  }
  if (category === "live_support") {
    return "Absolutely — I’m connecting you with the VIXUS Support Team now. Please leave any useful details below while a support specialist joins this private conversation.";
  }
  return botWelcomeMessage();
}

function isExplicitSupportRequest(message: string) {
  const lower = message.toLowerCase();
  return [
    "live support",
    "support team",
    "talk to support",
    "contact support",
    "support agent",
    "human agent",
    "real person",
    "connect me",
  ].some((phrase) => lower.includes(phrase));
}

async function addBotMessage(userId: number, message: string) {
  return db.insert(chatMessagesTable).values({
    userId,
    sender: "bot",
    message,
  }).returning();
}

async function escalateToSupport(userId: number, category: string, userMessage: string) {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx.update(supportChatThreadsTable)
      .set({ mode: "admin", status: "escalated", updatedAt: now })
      .where(eq(supportChatThreadsTable.userId, userId));
    const [existingTicket] = await tx.select({ id: supportTicketsTable.id })
      .from(supportTicketsTable)
      .where(and(eq(supportTicketsTable.userId, userId), eq(supportTicketsTable.status, "open")))
      .limit(1);
    if (!existingTicket) {
      await tx.insert(supportTicketsTable).values({
        userId,
        subject: `Live chat escalation: ${category.replace("_", " ")}`,
        message: userMessage,
        category,
        status: "open",
      });
    }
  });
  void sendPushToAllAdmins({
    title: "Support escalation",
    body: `A user needs help with ${category.replace("_", " ")}.`,
    tag: "vixus-support-escalation",
    data: { type: "support_escalation", userId },
  }).catch(() => {});
}

async function setBotState(userId: number, botState: string) {
  await db.update(supportChatThreadsTable)
    .set({ botState, updatedAt: new Date() })
    .where(eq(supportChatThreadsTable.userId, userId));
}

async function offerSupportAfterGuidance(userId: number, message: string) {
  await setBotState(userId, "offer_support");
  await addBotMessage(userId, `${message} If you still need account-specific help, choose “Talk to Support” below and I’ll send this conversation to the team.`);
}

async function handleBotTurn(
  userId: number,
  thread: typeof supportChatThreadsTable.$inferSelect,
  message: string,
  requestedCategory?: string,
  fullName?: string | null,
) {
  const explicitSupport = requestedCategory === "live_support" || (!requestedCategory && isExplicitSupportRequest(message));
  const category = explicitSupport ? "live_support" : requestedCategory || thread.category || categoryFromMessage(message);
  const categoryChanged = Boolean(category && category !== thread.category);
  if (categoryChanged) {
    await db.update(supportChatThreadsTable)
      .set({
        category,
        botState: category === "delayed_deposit"
          ? "awaiting_txid"
          : category === "pending_kyc"
            ? "awaiting_kyc_issue"
            : category === "technical"
              ? "awaiting_technical_issue"
              : category === "other"
                ? "awaiting_other_details"
                : "awaiting_details",
        updatedAt: new Date(),
      })
      .where(eq(supportChatThreadsTable.userId, userId));
  }

  if (!category) {
    await db.update(supportChatThreadsTable)
      .set({ botState: "choose_category", updatedAt: new Date() })
      .where(eq(supportChatThreadsTable.userId, userId));
    await addBotMessage(userId, botWelcomeMessage(fullName));
    return;
  }

  if (category === "live_support") {
    await addBotMessage(userId, botMessageForCategory(category));
    await escalateToSupport(userId, category, message);
    return;
  }

  if (category === "delayed_deposit") {
    if (categoryChanged) {
      await addBotMessage(userId, botMessageForCategory(category));
      return;
    }
    const txid = message.match(/0x[a-fA-F0-9]{64}/)?.[0];
    if (!txid) {
      await addBotMessage(userId, botMessageForCategory(category));
      return;
    }

    try {
      await syncBinanceDeposits();
    } catch {
      // The submitted TxID remains visible to admins even if the poller is unavailable.
    }
    const result = await submitUserDepositTxid(userId, txid);
    if (result.outcome === "matched" || result.outcome === "matching") {
      await addBotMessage(userId, "Thanks. I received your TxID and sent the deposit for review. Support will update you here after the account check.");
      return;
    }
    await addBotMessage(userId, "Thanks. I received your TxID, but it needs a Support review before it can be confirmed. We will update you here.");
    await escalateToSupport(userId, category, message);
    return;
  }

  const lower = message.toLowerCase();
  if (category === "pending_kyc") {
    if (categoryChanged) {
      await addBotMessage(userId, botMessageForCategory(category));
      return;
    }
    if (lower.includes("not started") || lower.includes("haven't started") || lower.includes("have not started")) {
      await offerSupportAfterGuidance(userId, "You can start verification from the KYC section in your account. Follow each step carefully and use a clear, valid document.");
      return;
    }
    if (lower.includes("pending") || lower.includes("waiting") || lower.includes("how long") || lower.includes("status")) {
      await offerSupportAfterGuidance(userId, "Your documents are reviewed by the verification team. Keep the account details consistent and leave this conversation open while the review is in progress.");
      return;
    }
    if (lower.includes("upload") || lower.includes("document") || lower.includes("photo")) {
      await offerSupportAfterGuidance(userId, "For upload issues, use a clear image with all document edges visible, check your connection, and try again from the latest version of the app or browser.");
      return;
    }
    if (lower.includes("reject") || lower.includes("failed") || lower.includes("declined")) {
      await offerSupportAfterGuidance(userId, "Please review the rejection reason shown in the KYC screen and submit a clearer, valid document if requested. Do not send sensitive document numbers in chat.");
      return;
    }
    if (lower.includes("access") || lower.includes("open") || lower.includes("page")) {
      await offerSupportAfterGuidance(userId, "Try signing out and back in, then open the KYC section again. If the page still will not open, tell us what you see or attach a screenshot.");
      return;
    }
    await addBotMessage(userId, "Please choose the verification issue that best matches your situation, or describe the exact step and message you see.");
    await setBotState(userId, "awaiting_kyc_issue");
    return;
  }

  if (category === "technical") {
    if (categoryChanged) {
      await addBotMessage(userId, botMessageForCategory(category));
      return;
    }
    if (lower.includes("login") || lower.includes("password") || lower.includes("sign in")) {
      await offerSupportAfterGuidance(userId, "For login or password problems, use Forgot password on the sign-in screen. If the reset email does not arrive, check spam and then tell us what happened.");
      return;
    }
    if (lower.includes("email") || lower.includes("code") || lower.includes("verify")) {
      await offerSupportAfterGuidance(userId, "Check your inbox and spam folder for the verification email or code. If the link has expired, open the verification screen again to request a fresh code.");
      return;
    }
    if (lower.includes("load") || lower.includes("blank") || lower.includes("error") || lower.includes("page") || lower.includes("app")) {
      await offerSupportAfterGuidance(userId, "Please tell us the exact error, what you were trying to do, and whether you are using the app or a browser. A screenshot can help Support investigate quickly.");
      return;
    }
    if (lower.includes("deposit") || lower.includes("withdraw")) {
      await offerSupportAfterGuidance(userId, "Tell us whether this concerns a deposit or withdrawal, what status you see, and the approximate amount. Never share a password or private key.");
      return;
    }
    if (lower.includes("trading") || lower.includes("trade") || lower.includes("bot")) {
      await offerSupportAfterGuidance(userId, "Tell us which bot or trading pair is affected, what you expected to happen, and the exact message or status you see.");
      return;
    }
    await offerSupportAfterGuidance(userId, "Please describe what you were trying to do, what happened instead, and any exact error message. You can also attach a screenshot.");
    return;
  }

  if (category === "other") {
    if (categoryChanged) {
      await addBotMessage(userId, botMessageForCategory(category));
      return;
    }
    const detectedTopic = categoryFromMessage(message);
    if (detectedTopic === "live_support") {
      await addBotMessage(userId, botMessageForCategory("live_support"));
      await escalateToSupport(userId, "live_support", message);
      return;
    }
    if (detectedTopic === "delayed_deposit") {
      await db.update(supportChatThreadsTable)
        .set({ category: "delayed_deposit", botState: "awaiting_txid", updatedAt: new Date() })
        .where(eq(supportChatThreadsTable.userId, userId));
      await addBotMessage(userId, botMessageForCategory("delayed_deposit"));
      return;
    }
    if (detectedTopic === "pending_kyc" || detectedTopic === "technical") {
      await db.update(supportChatThreadsTable)
        .set({ category: detectedTopic, botState: detectedTopic === "pending_kyc" ? "awaiting_kyc_issue" : "awaiting_technical_issue", updatedAt: new Date() })
        .where(eq(supportChatThreadsTable.userId, userId));
      await addBotMessage(userId, botMessageForCategory(detectedTopic));
      return;
    }
    await offerSupportAfterGuidance(userId, "Thanks for explaining that. I have captured the details you shared and can keep helping here.");
    return;
  }

  await offerSupportAfterGuidance(userId, "I have captured the details you shared.");
}

router.get("/support/tickets", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const tickets = await db.select().from(supportTicketsTable)
    .where(eq(supportTicketsTable.userId, user.id))
    .orderBy(desc(supportTicketsTable.createdAt));

  return res.json(tickets.map(t => ({
    id: t.id,
    subject: t.subject,
    message: t.message,
    status: t.status,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  })));
});

router.post("/support/tickets", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const parsed = CreateSupportTicketBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { subject, message, category } = parsed.data;

  const [ticket] = await db.insert(supportTicketsTable).values({
    userId: user.id,
    subject,
    message,
    category,
    status: "open",
  }).returning();

  return res.status(201).json({
    id: ticket.id,
    subject: ticket.subject,
    message: ticket.message,
    status: ticket.status,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
  });
});

// ---- Live Chat ----
router.get("/support/chat", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const thread = await getOrCreateThread(user.id);
  await db.update(supportChatThreadsTable)
    .set({ userLastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(supportChatThreadsTable.id, thread.id));
  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, user.id))
    .orderBy(chatMessagesTable.createdAt);
  const messageIds = messages.map((message) => message.id);
  const attachments = messageIds.length
    ? await db.select().from(chatAttachmentsTable).where(inArray(chatAttachmentsTable.messageId, messageIds))
    : [];
  const attachmentsByMessage = new Map<number, typeof attachments>();
  for (const attachment of attachments) {
    const existing = attachmentsByMessage.get(attachment.messageId) ?? [];
    existing.push(attachment);
    attachmentsByMessage.set(attachment.messageId, existing);
  }

  return res.json(messages.map(m => ({
    id: m.id,
    sender: m.sender,
    message: m.message,
    createdAt: m.createdAt.toISOString(),
    attachments: (attachmentsByMessage.get(m.id) ?? []).map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      downloadUrl: `/api/support/attachments/${attachment.id}`,
    })),
  })));
});

router.get("/support/chat/state", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserForSession(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const thread = await getOrCreateThread(user.id);
  const adminOnline = thread.adminTypingUntil != null && thread.adminTypingUntil.getTime() > Date.now();
  return res.json({
    category: thread.category,
    mode: thread.mode,
    status: thread.status,
    botState: thread.botState,
    adminTyping: adminOnline,
    adminOnline,
  });
});

router.post("/support/chat/typing", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserForSession(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const thread = await getOrCreateThread(user.id);
  await db.update(supportChatThreadsTable)
    .set({ userLastSeenAt: new Date(), updatedAt: new Date() })
    .where(eq(supportChatThreadsTable.id, thread.id));
  return res.json({ ok: true });
});

router.post("/support/attachments/session", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserForSession(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  return res.json(createAttachmentUploadSession("user", user.id, user.id));
});

router.post("/support/attachments/upload", async (req, res) => {
  try {
    // The signed, short-lived upload proof is the capability for this direct
    // upload request. Browsers cannot reliably send HttpOnly API cookies from
    // the Blob client's cross-origin token request.
    return res.json(await handleChatAttachmentUpload(req, req.body, "user"));
  } catch (error) {
    if (isAttachmentStorageFailure(error)) {
      req.log?.error({ err: error }, "Support attachment storage upload failed");
      await recordAttachmentStorageFailure(req.path);
      return res.status(503).json({ error: "File upload is temporarily unavailable. Please try again shortly." });
    }
    return res.status(400).json({ error: "The upload could not be prepared. Please try again shortly." });
  }
});

router.get("/support/attachments/:attachmentId", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserForSession(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const attachmentId = Number(req.params.attachmentId);
  if (!Number.isInteger(attachmentId)) return res.status(400).json({ error: "Invalid attachment id." });
  const [attachment] = await db.select().from(chatAttachmentsTable)
    .where(eq(chatAttachmentsTable.id, attachmentId))
    .limit(1);
  if (!attachment || attachment.userId !== user.id) return res.status(404).json({ error: "Attachment not found." });
  try {
    return await streamPrivateAttachment(res, attachment.pathname, attachment.filename);
  } catch (error) {
    if (isAttachmentStorageFailure(error)) {
      req.log?.error({ err: error }, "Support attachment storage download failed");
      await recordAttachmentStorageFailure(req.path);
      return res.status(503).json({ error: "File download is temporarily unavailable. Please try again shortly." });
    }
    return res.status(404).json({ error: "Attachment not found." });
  }
});

router.post("/support/chat", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { message, category, attachments: rawAttachments } = req.body as { message?: string; category?: string; attachments?: unknown };
  const trimmedMessage = typeof message === "string" ? message.trim() : "";
  if (!trimmedMessage && (!Array.isArray(rawAttachments) || rawAttachments.length === 0)) {
    return res.status(400).json({ error: "message or attachment is required" });
  }
  if (trimmedMessage.length > 2000) {
    return res.status(400).json({ error: "message must be 2000 characters or fewer" });
  }
  const thread = await getOrCreateThread(user.id);
  if (thread.status === "closed") {
    await db.update(supportChatThreadsTable)
      .set({
        status: "open",
        mode: "bot",
        category: null,
        botState: "choose_category",
        updatedAt: new Date(),
        userLastSeenAt: new Date(),
      })
      .where(eq(supportChatThreadsTable.id, thread.id));
  }
  let attachments;
  try {
    attachments = await confirmUploadedAttachments(
      validateAttachmentInputs(rawAttachments, "user", user.id, user.id),
    );
  } catch (error) {
    if (isAttachmentStorageFailure(error)) {
      req.log?.error({ err: error }, "Support attachment storage confirmation failed");
      await recordAttachmentStorageFailure(req.path);
      return res.status(503).json({ error: "File upload is temporarily unavailable. Please try again shortly." });
    }
    return res.status(400).json({ error: "One or more attachments could not be added. Please try again shortly." });
  }

  const [latestMessage] = await db.select({
    sender: chatMessagesTable.sender,
  }).from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, user.id))
    .orderBy(desc(chatMessagesTable.createdAt), desc(chatMessagesTable.id))
    .limit(1);

  let msg;
  try {
    msg = await db.transaction(async (tx) => {
      // A system marker closes the previous thread. The first user message after
      // that marker starts a new private conversation without deleting history.
      if (latestMessage?.sender === "system") {
        await tx.insert(chatMessagesTable).values({
          userId: user.id,
          sender: "system",
          message: "New conversation started.",
        });
      }

      const [createdMessage] = await tx.insert(chatMessagesTable).values({
        userId: user.id,
        sender: "user",
        message: trimmedMessage || "Sent an attachment.",
      }).returning();
      if (attachments.length > 0) {
        await tx.insert(chatAttachmentsTable).values(attachments.map((attachment) => ({
          messageId: createdMessage.id,
          userId: user.id,
          pathname: attachment.pathname,
          blobUrl: attachment.blobUrl,
          filename: attachment.filename,
          contentType: attachment.contentType,
          sizeBytes: attachment.sizeBytes,
        })));
      }
      return createdMessage;
    });
  } catch (error) {
    await cleanupUploadedAttachments(attachments).catch(() => undefined);
    throw error;
  }
  const savedAttachments = attachments.length
    ? await db.select().from(chatAttachmentsTable).where(eq(chatAttachmentsTable.messageId, msg.id))
    : [];

  const requestedCategory = typeof category === "string" && ["delayed_deposit", "pending_kyc", "technical", "other", "live_support"].includes(category)
    ? category
    : undefined;
  let currentThread = await getOrCreateThread(user.id);
  if (requestedCategory && currentThread.mode !== "bot") {
    await db.update(supportChatThreadsTable)
      .set({
        mode: "bot",
        status: "open",
        category: null,
        botState: "choose_category",
        updatedAt: new Date(),
      })
      .where(eq(supportChatThreadsTable.userId, user.id));
    currentThread = await getOrCreateThread(user.id);
  }
  if (currentThread.mode === "bot" || requestedCategory) {
    await handleBotTurn(user.id, currentThread, trimmedMessage, requestedCategory, user.fullName);
  }

  return res.status(201).json({
    id: msg.id,
    sender: msg.sender,
    message: msg.message,
    createdAt: msg.createdAt.toISOString(),
    attachments: savedAttachments.map((attachment) => ({
      id: attachment.id,
      filename: attachment.filename,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
      downloadUrl: `/api/support/attachments/${attachment.id}`,
    })),
  });
});

router.get("/support/faq", async (req, res) => {
  const faqs = await db.select().from(faqTable);
  return res.json(faqs.map(f => ({
    id: f.id,
    question: f.question,
    answer: f.answer,
    category: f.category,
  })));
});

export default router;
