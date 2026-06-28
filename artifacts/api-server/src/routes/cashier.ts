import { Router } from "express";
import { db, usersTable, sessionsTable, transactionsTable, depositSessionsTable, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { CreateWithdrawalBody } from "@workspace/api-zod";
import { sendPushToAllAdmins } from "../lib/webPush";
import { notifyAdminTransaction } from "../lib/loginAlarm";
import { getAvailableBalance } from "../utils/balance.js";

const router = Router();

async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
  if (sessions.length === 0) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, sessions[0].userId)).limit(1);
  return users[0] ?? null;
}

const PAYMENT_METHODS = [
  {
    id: "usdt_trc20",
    name: "USDT (TRC20)",
    icon: "usdt",
    type: "crypto",
    network: "TRC20",
    depositAddress: "TRFX5YtttkLGynC9ujNvfqzF4w4xz7xHvB",
    requiredConfirmations: 20,
    processingTime: "1–5 minutes",
  },
  {
    id: "usdt_erc20",
    name: "USDT (ERC20)",
    icon: "usdt",
    type: "crypto",
    network: "ERC20",
    depositAddress: "0x7d7496c03b90d5df7670ec55c431af47903c2248",
    requiredConfirmations: 12,
    processingTime: "3–10 minutes",
  },
  {
    id: "bitcoin",
    name: "Bitcoin (BTC)",
    icon: "btc",
    type: "crypto",
    network: "Bitcoin",
    depositAddress: "bc1q6j499uy5wrghm4nz6sv7jxraq96h4jg443fpzz",
    requiredConfirmations: 6,
    processingTime: "10–60 minutes",
  },
];

function mapSession(s: typeof depositSessionsTable.$inferSelect) {
  return {
    id: s.id,
    status: s.status,
    amount: parseFloat(s.amount),
    paymentMethodId: s.paymentMethodId,
    paymentMethodName: s.paymentMethodName,
    network: s.network,
    depositAddress: s.depositAddress,
    txid: s.txid ?? null,
    confirmations: s.confirmations,
    requiredConfirmations: s.requiredConfirmations,
    expiresAt: s.expiresAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// ── Deposit session endpoints ────────────────────────────────────────────────

router.post("/cashier/deposit/session", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { amount, paymentMethodId } = req.body as { amount?: unknown; paymentMethodId?: unknown };
  const numAmount = Number(amount);
  if (!numAmount || numAmount < 10) return res.status(400).json({ error: "Minimum deposit is $10" });
  if (typeof paymentMethodId !== "string") return res.status(400).json({ error: "Payment method is required" });

  const method = PAYMENT_METHODS.find((m) => m.id === paymentMethodId);
  if (!method) return res.status(400).json({ error: "Invalid payment method" });

  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  const [session] = await db.insert(depositSessionsTable).values({
    userId: user.id,
    status: "waiting_payment",
    amount: numAmount.toFixed(2),
    paymentMethodId: method.id,
    paymentMethodName: method.name,
    network: method.network,
    depositAddress: method.depositAddress,
    requiredConfirmations: method.requiredConfirmations,
    expiresAt,
  }).returning();

  return res.status(201).json(mapSession(session));
});

router.get("/cashier/deposit/session/:id", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const sessions = await db.select().from(depositSessionsTable)
    .where(and(eq(depositSessionsTable.id, id), eq(depositSessionsTable.userId, user.id)))
    .limit(1);

  if (!sessions[0]) return res.status(404).json({ error: "Deposit session not found" });
  return res.json(mapSession(sessions[0]));
});

router.post("/cashier/deposit/session/:id/txid", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { txid } = req.body as { txid?: unknown };
  if (typeof txid !== "string" || !txid.trim()) return res.status(400).json({ error: "TXID is required" });

  const sessions = await db.select().from(depositSessionsTable)
    .where(and(eq(depositSessionsTable.id, id), eq(depositSessionsTable.userId, user.id)))
    .limit(1);

  if (!sessions[0]) return res.status(404).json({ error: "Not found" });
  if (!["waiting_payment", "payment_detected"].includes(sessions[0].status)) {
    return res.status(400).json({ error: "Cannot update TXID at this stage" });
  }

  const [updated] = await db.update(depositSessionsTable)
    .set({ txid: txid.trim(), status: "payment_detected", updatedAt: new Date() })
    .where(eq(depositSessionsTable.id, id))
    .returning();

  return res.json(mapSession(updated));
});

// ── Legacy deposit endpoint (kept for backward compat) ──────────────────────

router.post("/cashier/deposit", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { amount, paymentMethod, walletAddress } = req.body as Record<string, unknown>;

  const [txn] = await db.insert(transactionsTable).values({
    userId: user.id,
    type: "deposit",
    amount: String(amount ?? 0),
    status: "pending",
    paymentMethod: String(paymentMethod ?? ""),
    walletAddress: typeof walletAddress === "string" ? walletAddress : null,
    description: `Deposit via ${paymentMethod}`,
  }).returning();

  // Notify admin via SSE (browser alarm) + Push (background/offline)
  notifyAdminTransaction({
    type: "deposit",
    name: user.fullName,
    email: user.email,
    userId: user.id,
    amount: parseFloat(String(amount ?? 0)).toFixed(2),
    paymentMethod: String(paymentMethod ?? ""),
    txId: txn.id,
  });
  void sendPushToAllAdmins({
    title: "💰 Deposit Request",
    body: `${user.fullName} · $${parseFloat(String(amount ?? 0)).toFixed(2)} via ${paymentMethod}${walletAddress ? ` · ${walletAddress}` : ""}`,
    tag: "vixus-deposit",
    data: { type: "deposit", userId: user.id, txId: txn.id },
  }).catch(() => {});

  return res.status(201).json({
    id: txn.id,
    type: txn.type,
    amount: parseFloat(txn.amount),
    status: txn.status,
    paymentMethod: txn.paymentMethod,
    createdAt: txn.createdAt.toISOString(),
    walletAddress: txn.walletAddress,
  });
});

// ── Withdrawal ───────────────────────────────────────────────────────────────

router.post("/cashier/withdraw", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const parsed = CreateWithdrawalBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { amount, paymentMethod, walletAddress } = parsed.data;
  if (amount <= 0) return res.status(400).json({ error: "Amount must be greater than 0" });

  const available = await getAvailableBalance(user.id);
  if (amount > available) {
    return res.status(400).json({ error: `Insufficient balance. Available: $${available.toFixed(2)}.` });
  }

  const [txn] = await db.insert(transactionsTable).values({
    userId: user.id,
    type: "withdrawal",
    amount: amount.toString(),
    status: "pending",
    paymentMethod,
    walletAddress,
    description: `Withdrawal via ${paymentMethod}`,
  }).returning();

  await db.insert(notificationsTable).values({
    userId: user.id,
    type: "withdrawal",
    title: "Withdrawal Requested",
    message: `Your withdrawal of $${amount.toFixed(2)} via ${paymentMethod} has been submitted and is pending review.`,
  });

  // Notify admin via SSE (browser alarm) + Push (background/offline)
  notifyAdminTransaction({
    type: "withdrawal",
    name: user.fullName,
    email: user.email,
    userId: user.id,
    amount: amount.toFixed(2),
    paymentMethod,
    txId: txn.id,
  });
  void sendPushToAllAdmins({
    title: "💸 Withdrawal Request",
    body: `${user.fullName} · $${amount.toFixed(2)} via ${paymentMethod} · ${walletAddress}`,
    tag: "vixus-withdrawal",
    data: { type: "withdrawal", userId: user.id, txId: txn.id },
  }).catch(() => {});

  return res.status(201).json({
    id: txn.id,
    type: txn.type,
    amount: parseFloat(txn.amount),
    status: txn.status,
    paymentMethod: txn.paymentMethod,
    createdAt: txn.createdAt.toISOString(),
    walletAddress: txn.walletAddress,
  });
});

// ── Transactions & payment methods ───────────────────────────────────────────

router.get("/cashier/transactions", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const type = (req.query.type as string) || "all";
  const txns = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, user.id))
    .orderBy(desc(transactionsTable.createdAt));

  const filtered = type !== "all" ? txns.filter(t => t.type === type) : txns;

  return res.json(filtered.map(t => ({
    id: t.id,
    type: t.type,
    amount: parseFloat(t.amount),
    status: t.status,
    paymentMethod: t.paymentMethod,
    createdAt: t.createdAt.toISOString(),
    walletAddress: t.walletAddress,
  })));
});

router.get("/cashier/payment-methods", async (_req, res) => {
  return res.json(PAYMENT_METHODS);
});

export default router;
