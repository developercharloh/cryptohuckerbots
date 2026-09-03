import { Router } from "express";
import { db, supportTicketsTable, faqTable, chatMessagesTable, chatAttachmentsTable, notificationsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { CreateSupportTicketBody } from "@workspace/api-zod";
import { getRequestToken, getUserForSession } from "../lib/session";
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

  const { message, attachments: rawAttachments } = req.body as { message?: string; attachments?: unknown };
  const trimmedMessage = typeof message === "string" ? message.trim() : "";
  if (!trimmedMessage && (!Array.isArray(rawAttachments) || rawAttachments.length === 0)) {
    return res.status(400).json({ error: "message or attachment is required" });
  }
  if (trimmedMessage.length > 2000) {
    return res.status(400).json({ error: "message must be 2000 characters or fewer" });
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
