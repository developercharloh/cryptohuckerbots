import { Router } from "express";
import { db, supportTicketsTable, faqTable, chatMessagesTable, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { CreateSupportTicketBody } from "@workspace/api-zod";
import { getUserForSession } from "../lib/session";

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

  return res.json(messages.map(m => ({
    id: m.id,
    sender: m.sender,
    message: m.message,
    createdAt: m.createdAt.toISOString(),
  })));
});

router.post("/support/chat", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { message } = req.body as { message?: string };
  const trimmedMessage = typeof message === "string" ? message.trim() : "";
  if (!trimmedMessage) {
    return res.status(400).json({ error: "message is required" });
  }
  if (trimmedMessage.length > 2000) {
    return res.status(400).json({ error: "message must be 2000 characters or fewer" });
  }

  const [latestMessage] = await db.select({
    sender: chatMessagesTable.sender,
  }).from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, user.id))
    .orderBy(desc(chatMessagesTable.createdAt), desc(chatMessagesTable.id))
    .limit(1);

  const msg = await db.transaction(async (tx) => {
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
      message: trimmedMessage,
    }).returning();
    return createdMessage;
  });

  return res.status(201).json({
    id: msg.id,
    sender: msg.sender,
    message: msg.message,
    createdAt: msg.createdAt.toISOString(),
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
