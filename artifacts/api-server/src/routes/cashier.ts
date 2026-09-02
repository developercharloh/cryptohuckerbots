import { Router } from "express";
import { db, transactionsTable, depositSessionsTable, notificationsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { getRequestToken, getUserForSession } from "../lib/session";
import { CreateWithdrawalBody } from "@workspace/api-zod";
import { sendPushToAllAdmins } from "../lib/webPush";
import { notifyAdminTransaction } from "../lib/loginAlarm";
import { getAvailableBalance } from "../utils/balance.js";
import { BSC_PAYMENT_METHOD, validateBscWithdrawal } from "../lib/payment-methods";

const router = Router();

async function getUserFromToken(token: string | undefined) {
  return getUserForSession(token);
}

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
    cryptoAsset: s.cryptoAsset ?? null,
    cryptoAmount: s.cryptoAmount ? parseFloat(s.cryptoAmount) : null,
    conversionRate: s.conversionRate ? parseFloat(s.conversionRate) : null,
    expiresAt: s.expiresAt.toISOString(),
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

// ── Deposit session endpoints ────────────────────────────────────────────────

router.post("/cashier/deposit/session", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { amount, paymentMethodId } = req.body as { amount?: unknown; paymentMethodId?: unknown };
  if (typeof paymentMethodId !== "string") return res.status(400).json({ error: "Payment method is required" });

  const method = paymentMethodId === BSC_PAYMENT_METHOD.id ? BSC_PAYMENT_METHOD : undefined;
  if (!method) return res.status(400).json({ error: "Invalid payment method" });

  let numAmount: number;
  // USDT is a stable-value deposit: amount entered is already USD-equivalent.
  numAmount = Number(amount);
  if (!numAmount || numAmount < 10) return res.status(400).json({ error: "Minimum deposit is $10" });

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
    cryptoAsset: null,
    cryptoAmount: null,
    conversionRate: null,
    expiresAt,
  }).returning();

  return res.status(201).json(mapSession(session));
});

router.get("/cashier/deposit/session/:id", async (req, res) => {
  const token = getRequestToken(req);
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
  const token = getRequestToken(req);
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
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const { amount, paymentMethod } = req.body as Record<string, unknown>;
  if (paymentMethod !== BSC_PAYMENT_METHOD.name && paymentMethod !== BSC_PAYMENT_METHOD.id) {
    return res.status(400).json({ error: "Only USDT on BNB Smart Chain (BEP-20) is supported" });
  }

  const [txn] = await db.insert(transactionsTable).values({
    userId: user.id,
    type: "deposit",
    amount: String(amount ?? 0),
    status: "pending",
    paymentMethod: BSC_PAYMENT_METHOD.name,
    walletAddress: BSC_PAYMENT_METHOD.depositAddress,
    description: `Deposit via ${BSC_PAYMENT_METHOD.name}`,
  }).returning();

  // Notify admin via SSE (browser alarm) + Push (background/offline)
  notifyAdminTransaction({
    type: "deposit",
    name: user.fullName,
    email: user.email,
    userId: user.id,
    amount: parseFloat(String(amount ?? 0)).toFixed(2),
    paymentMethod: BSC_PAYMENT_METHOD.name,
    txId: txn.id,
  });
  void sendPushToAllAdmins({
    title: "💰 Deposit Request",
    body: `${user.fullName} · $${parseFloat(String(amount ?? 0)).toFixed(2)} via ${BSC_PAYMENT_METHOD.name} · ${BSC_PAYMENT_METHOD.depositAddress}`,
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
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const parsed = CreateWithdrawalBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { amount, paymentMethod, walletAddress, cryptoAmount, cryptoAsset, conversionRate } = parsed.data;
  if (amount <= 0) return res.status(400).json({ error: "Amount must be greater than 0" });
  const policyError = validateBscWithdrawal(paymentMethod, walletAddress);
  if (policyError) return res.status(400).json({ error: policyError });

  const available = await getAvailableBalance(user.id);
  if (amount > available) {
    return res.status(400).json({ error: `Insufficient balance. Available: $${available.toFixed(2)}.` });
  }

  const [txn] = await db.insert(transactionsTable).values({
    userId: user.id,
    type: "withdrawal",
    amount: amount.toString(),
    status: "pending",
    paymentMethod: BSC_PAYMENT_METHOD.name,
    walletAddress,
    description: `Withdrawal via ${BSC_PAYMENT_METHOD.name}`,
    cryptoAmount: cryptoAmount != null ? cryptoAmount.toString() : null,
    cryptoAsset: cryptoAsset ?? null,
    conversionRate: conversionRate != null ? conversionRate.toString() : null,
  }).returning();

  await db.insert(notificationsTable).values({
    userId: user.id,
    type: "withdrawal",
    title: "Withdrawal Requested",
    message: `Your withdrawal of $${amount.toFixed(2)} via ${BSC_PAYMENT_METHOD.name} has been submitted and is pending review.`,
  });

  // Notify admin via SSE (browser alarm) + Push (background/offline)
  notifyAdminTransaction({
    type: "withdrawal",
    name: user.fullName,
    email: user.email,
    userId: user.id,
    amount: amount.toFixed(2),
    paymentMethod: BSC_PAYMENT_METHOD.name,
    txId: txn.id,
  });
  void sendPushToAllAdmins({
    title: "💸 Withdrawal Request",
    body: `${user.fullName} · $${amount.toFixed(2)} via ${BSC_PAYMENT_METHOD.name} · ${walletAddress}`,
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
    cryptoAmount: txn.cryptoAmount ? parseFloat(txn.cryptoAmount) : null,
    cryptoAsset: txn.cryptoAsset,
    conversionRate: txn.conversionRate ? parseFloat(txn.conversionRate) : null,
  });
});

// ── Transactions & payment methods ───────────────────────────────────────────

router.get("/cashier/transactions", async (req, res) => {
  const token = getRequestToken(req);
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
    cryptoAmount: t.cryptoAmount ? parseFloat(t.cryptoAmount) : null,
    cryptoAsset: t.cryptoAsset,
    conversionRate: t.conversionRate ? parseFloat(t.conversionRate) : null,
  })));
});

router.get("/cashier/payment-methods", async (_req, res) => {
  return res.json([BSC_PAYMENT_METHOD]);
});

export default router;
