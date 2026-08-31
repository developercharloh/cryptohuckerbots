import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { and, eq, desc } from "drizzle-orm";
import { getUserForSession } from "../lib/session";

const router = Router();

async function getUserFromToken(token: string | undefined) {
  return getUserForSession(token);
}

router.get("/notifications", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const notifications = await db.select().from(notificationsTable)
    .where(eq(notificationsTable.userId, user.id))
    .orderBy(desc(notificationsTable.createdAt));

  return res.json(notifications.map(n => ({
    id: n.id,
    type: n.type,
    title: n.title,
    message: n.message,
    isRead: n.isRead,
    createdAt: n.createdAt.toISOString(),
  })));
});

router.delete("/notifications/:id", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  await db.delete(notificationsTable).where(
    and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.id))
  );

  return res.json({ message: "Notification deleted" });
});

router.post("/notifications/:id/read", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  await db.update(notificationsTable).set({ isRead: true }).where(
    and(eq(notificationsTable.id, id), eq(notificationsTable.userId, user.id))
  );

  return res.json({ message: "Notification marked as read" });
});

router.post("/notifications/read-all", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  await db.update(notificationsTable).set({ isRead: true }).where(eq(notificationsTable.userId, user.id));

  return res.json({ message: "All notifications marked as read" });
});

export default router;
