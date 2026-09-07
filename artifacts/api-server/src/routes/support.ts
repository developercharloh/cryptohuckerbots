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
    return "I can help with your verification review. If you have already submitted your documents, please tell me whether you are waiting for approval, unable to upload a document, or seeing an error. You can also connect directly with live Support.";
  }
  if (category === "technical") {
    return "I’m ready to help troubleshoot that. Tell me what you were trying to do, what happened instead, and any exact error message you saw. I’ll guide you through the next step or connect you with Support.";
  }
  if (category === "other") {
    return "Of course. Tell me what you need help with and I’ll point you in the right direction. If it needs account-level attention, I can connect you with live Support.";
  }
  if (category === "live_support") {
    return "Absolutely — I’m connecting you with the VIXUS Support Team now. Please leave any useful details below while a support specialist joins this private conversation.";
  }
  return botWelcomeMessage();
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

async function handleBotTurn(
  userId: number,
  thread: typeof supportChatThreadsTable.$inferSelect,
  message: string,
  requestedCategory?: string,
  fullName?: string | null,
) {
  const category = requestedCategory || thread.category || categoryFromMessage(message);
  if (category && category !== thread.category) {
    await db.update(supportChatThreadsTable)
      .set({ category, botState: category === "delayed_deposit" ? "awaiting_txid" : "awaiting_details", updatedAt: new Date() })
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
  if (category === "technical" && (lower.includes("login") || lower.includes("password"))) {
    await addBotMessage(userId, "For login or password problems, use Forgot password on the sign-in screen. If the reset email does not arrive, check spam and then reply here so Support can investigate.");
    return;
  }
  if (category === "technical" && (lower.includes("email") || lower.includes("verify"))) {
    await addBotMessage(userId, "Please check your inbox and spam folder for the verification email. If the link has expired, open the verification screen again to request a fresh code.");
    return;
  }
  if (category === "pending_kyc" && (lower.includes("how long") || lower.includes("status"))) {
    await addBotMessage(userId, "Your documents are reviewed by the verification team. Keep this conversation open and Support will message you here if anything else is required.");
    return;
  }

  await addBotMessage(userId, "I could not resolve that automatically, so I sent it to Support. A team member will reply in this conversation.");
  await escalateToSupport(userId, category || "other", message);
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
      .set({ status: "open", mode: "bot", botState: "choose_category", updatedAt: new Date(), userLastSeenAt: new Date() })
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
