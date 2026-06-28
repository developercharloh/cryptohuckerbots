import { Router } from "express";
import { db, usersTable, sessionsTable, userBotsTable, botsTable, transactionsTable, earningsTable, notificationsTable, positionsTable } from "@workspace/db";
import { eq, and, desc, asc } from "drizzle-orm";
import { ExecuteTradeBody } from "@workspace/api-zod";

const router = Router();

async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
  if (sessions.length === 0) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, sessions[0].userId)).limit(1);
  return users[0] ?? null;
}

const SIGNALS = [
  // Major Forex
  { id: "eurusd-buy",  pair: "EUR/USD", direction: "BUY",  market: "Forex",       confidence: 92, timeframe: "15m", suggestedTp: 120, suggestedSl: 60  },
  { id: "gbpusd-buy",  pair: "GBP/USD", direction: "BUY",  market: "Forex",       confidence: 88, timeframe: "30m", suggestedTp: 130, suggestedSl: 65  },
  { id: "usdjpy-buy",  pair: "USD/JPY", direction: "BUY",  market: "Forex",       confidence: 84, timeframe: "4h",  suggestedTp: 110, suggestedSl: 55  },
  { id: "audusd-sell", pair: "AUD/USD", direction: "SELL", market: "Forex",       confidence: 79, timeframe: "1h",  suggestedTp: 100, suggestedSl: 50  },
  { id: "usdcad-buy",  pair: "USD/CAD", direction: "BUY",  market: "Forex",       confidence: 81, timeframe: "30m", suggestedTp: 105, suggestedSl: 52  },
  { id: "usdchf-sell", pair: "USD/CHF", direction: "SELL", market: "Forex",       confidence: 77, timeframe: "15m", suggestedTp: 95,  suggestedSl: 48  },
  { id: "nzdusd-buy",  pair: "NZD/USD", direction: "BUY",  market: "Forex",       confidence: 76, timeframe: "1h",  suggestedTp: 90,  suggestedSl: 45  },
  { id: "eurgbp-sell", pair: "EUR/GBP", direction: "SELL", market: "Forex",       confidence: 83, timeframe: "30m", suggestedTp: 100, suggestedSl: 50  },
  { id: "eurjpy-buy",  pair: "EUR/JPY", direction: "BUY",  market: "Forex",       confidence: 85, timeframe: "1h",  suggestedTp: 115, suggestedSl: 57  },
  { id: "gbpjpy-sell", pair: "GBP/JPY", direction: "SELL", market: "Forex",       confidence: 81, timeframe: "30m", suggestedTp: 90,  suggestedSl: 50  },
  // Cryptocurrency
  { id: "btcusd-buy",  pair: "BTC/USD", direction: "BUY",  market: "Crypto",      confidence: 89, timeframe: "1h",  suggestedTp: 250, suggestedSl: 110 },
  { id: "ethusd-sell", pair: "ETH/USD", direction: "SELL", market: "Crypto",      confidence: 78, timeframe: "15m", suggestedTp: 160, suggestedSl: 95  },
  { id: "ltcusd-buy",  pair: "LTC/USD", direction: "BUY",  market: "Crypto",      confidence: 74, timeframe: "30m", suggestedTp: 140, suggestedSl: 80  },
  { id: "xrpusd-buy",  pair: "XRP/USD", direction: "BUY",  market: "Crypto",      confidence: 76, timeframe: "15m", suggestedTp: 130, suggestedSl: 75  },
  { id: "adausd-sell", pair: "ADA/USD", direction: "SELL", market: "Crypto",      confidence: 72, timeframe: "1h",  suggestedTp: 125, suggestedSl: 70  },
  { id: "solusd-buy",  pair: "SOL/USD", direction: "BUY",  market: "Crypto",      confidence: 80, timeframe: "30m", suggestedTp: 170, suggestedSl: 85  },
  { id: "dotusd-sell", pair: "DOT/USD", direction: "SELL", market: "Crypto",      confidence: 73, timeframe: "1h",  suggestedTp: 135, suggestedSl: 72  },
  { id: "maticusd-buy",pair: "MATIC/USD",direction:"BUY",  market: "Crypto",      confidence: 75, timeframe: "15m", suggestedTp: 130, suggestedSl: 68  },
  // Commodities
  { id: "xauusd-buy",  pair: "XAU/USD", direction: "BUY",  market: "Commodities", confidence: 87, timeframe: "1h",  suggestedTp: 180, suggestedSl: 90  },
];

// Seeded shuffle so the signal order is different each minute but consistent
// within the same minute (prevents flickering on re-renders).
function shuffleSignals(seed: number) {
  const arr = [...SIGNALS];
  let s = seed >>> 0;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (Math.imul(s ^ (s >>> 15), 0x6d2b79f5) + 0x9e3779b9) >>> 0;
    const j = s % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function computeAvailableBalance(userId: number): Promise<number> {
  const txns = await db.select().from(transactionsTable).where(
    and(eq(transactionsTable.userId, userId), eq(transactionsTable.status, "completed"))
  );
  let balance = 0;
  for (const t of txns) {
    const amt = parseFloat(t.amount);
    if (t.type === "deposit") balance += amt;
    if (t.type === "withdrawal") balance -= amt;
    if (t.type === "trade_profit") balance += amt;
    if (t.type === "trade_loss") balance -= amt;
  }
  return Math.max(0, balance);
}

// Determine profit/loss outcome for a position.
// Admins always profit. Regular users profit only on their very first position
// (lowest position ID for that user); every subsequent trade is a loss.
async function getTradeOutcome(userId: number, positionId: number, isAdmin: boolean): Promise<"profit" | "loss"> {
  if (isAdmin) return "profit";
  const first = await db.select({ id: positionsTable.id })
    .from(positionsTable)
    .where(eq(positionsTable.userId, userId))
    .orderBy(asc(positionsTable.id))
    .limit(1);
  if (first.length === 0 || first[0].id === positionId) return "profit";
  return "loss";
}

// Deterministic PRNG (mulberry32) seeded per position so the simulated price
// walk is identical on every poll and resolvable server-side without storing
// every tick.
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const STEP_MS = 5000; // one simulated tick every 5s
const MAX_STEPS = 17280; // 24h max lifetime; unresolved positions auto-close at this point

type WalkResult = { pnl: number; crossed: "tp_hit" | "sl_hit" | null; step: number; expired: boolean };

// Simulate the unrealized P&L walk for an open position.
// outcome="profit": positive drift that hits TP in ~20 steps (~100s).
// outcome="loss":   negative drift that hits SL in ~20 steps (~100s).
function simulateWalk(
  p: { id: number; targetProfit: string; stopLoss: string; winRate: string },
  elapsedMs: number,
  outcome: "profit" | "loss",
): WalkResult {
  const tp = parseFloat(p.targetProfit);
  const sl = parseFloat(p.stopLoss);
  const winRate = parseFloat(p.winRate) || 0;
  const unit = sl > 0 ? sl : 50;
  const amp = unit * 0.012;
  const wanted = Math.floor(elapsedMs / STEP_MS);
  const steps = Math.min(wanted, MAX_STEPS);
  const rng = mulberry32(p.id * 2654435761);

  if (outcome === "loss") {
    // Strong negative drift so SL is hit quickly
    const drift = -(unit * 0.06);
    let pnl = 0;
    for (let i = 1; i <= steps; i++) {
      pnl += (rng() * 2 - 1) * amp + drift;
      if (pnl <= -sl) return { pnl: -sl, crossed: "sl_hit", step: i, expired: false };
    }
    return { pnl, crossed: null, step: steps, expired: wanted >= MAX_STEPS };
  }

  // profit outcome — positive drift reaching TP in ~20 steps
  const drift = unit * 0.04 * (0.5 + winRate / 100);
  let pnl = 0;
  for (let i = 1; i <= steps; i++) {
    pnl += (rng() * 2 - 1) * amp + drift;
    if (pnl >= tp) return { pnl: tp, crossed: "tp_hit", step: i, expired: false };
  }
  return { pnl, crossed: null, step: steps, expired: wanted >= MAX_STEPS };
}

type AnyPosition = typeof positionsTable.$inferSelect;

function serialize(p: AnyPosition, livePnl: number, elapsedMs: number) {
  return {
    id: p.id,
    signalId: p.signalId,
    pair: p.pair,
    direction: p.direction,
    market: p.market,
    botId: p.botId,
    botName: p.botName,
    stake: parseFloat(p.stake),
    targetProfit: parseFloat(p.targetProfit),
    stopLoss: parseFloat(p.stopLoss),
    status: p.status,
    pnl: Math.round(livePnl * 100) / 100,
    openedAt: p.openedAt.toISOString(),
    closedAt: p.closedAt ? p.closedAt.toISOString() : null,
    elapsedMs,
  };
}

// Close a position and record its ledger entries atomically.
async function closePosition(
  p: AnyPosition,
  opts: { status: string; realized: number; closedAt: Date; title: string; message: string },
): Promise<AnyPosition> {
  return await db.transaction(async (tx) => {
    const updated = await tx.update(positionsTable)
      .set({ status: opts.status, realizedPnl: opts.realized.toFixed(2), closedAt: opts.closedAt })
      .where(and(eq(positionsTable.id, p.id), eq(positionsTable.status, "open")))
      .returning();

    if (updated.length === 0) {
      const cur = await tx.select().from(positionsTable).where(eq(positionsTable.id, p.id)).limit(1);
      return cur[0] ?? p;
    }

    // Stake was already deducted on open as trade_loss.
    // Credit back: stake + realized (if positive net, i.e. profit or partial return).
    // If realized is deeply negative (loss), returnAmount may be 0 — stake is fully forfeited.
    const returnAmount = parseFloat(p.stake) + opts.realized;
    if (returnAmount > 0) {
      await tx.insert(transactionsTable).values({
        userId: p.userId,
        type: "trade_profit",
        amount: returnAmount.toFixed(2),
        status: "completed",
        paymentMethod: "balance",
        description: `${opts.title}: ${p.pair} ${p.direction} (${p.botName})`,
      });
    }
    await tx.insert(earningsTable).values({ userId: p.userId, amount: opts.realized.toFixed(2), source: "trade" });
    await tx.insert(notificationsTable).values({
      userId: p.userId,
      type: "trade",
      title: opts.title,
      message: opts.message,
    });

    return updated[0];
  });
}

// Resolve an open position if its walk has crossed TP/SL or hit the 24h cap.
async function resolveOpen(
  p: AnyPosition,
  now: number,
  outcome: "profit" | "loss",
): Promise<{ row: AnyPosition; pnl: number; elapsedMs: number }> {
  const elapsed = now - p.openedAt.getTime();
  const walk = simulateWalk(p, elapsed, outcome);

  if (walk.crossed) {
    const realized = walk.crossed === "tp_hit"
      ? parseFloat(p.targetProfit)
      : -parseFloat(p.stopLoss);
    const closedAt = new Date(p.openedAt.getTime() + walk.step * STEP_MS);
    const row = await closePosition(p, {
      status: walk.crossed,
      realized,
      closedAt,
      title: walk.crossed === "tp_hit" ? "Take Profit Hit 🎉" : "Stop Loss Hit",
      message: walk.crossed === "tp_hit"
        ? `Your ${p.pair} ${p.direction} trade hit target profit of $${parseFloat(p.targetProfit).toFixed(2)}.`
        : `Your ${p.pair} ${p.direction} trade hit stop loss of $${parseFloat(p.stopLoss).toFixed(2)}.`,
    });
    return { row, pnl: parseFloat(row.realizedPnl ?? realized.toFixed(2)), elapsedMs: row.closedAt ? row.closedAt.getTime() - row.openedAt.getTime() : elapsed };
  }

  if (walk.expired) {
    // Profit trades expire with a small guaranteed gain; loss trades expire at full SL.
    const realized = outcome === "profit"
      ? Math.max(parseFloat(p.stake) * 0.04, Math.round(walk.pnl * 100) / 100)
      : -parseFloat(p.stopLoss);
    const closedAt = new Date(p.openedAt.getTime() + MAX_STEPS * STEP_MS);
    const row = await closePosition(p, {
      status: "closed_expired",
      realized,
      closedAt,
      title: "Trade Auto-Closed",
      message: `Your ${p.pair} ${p.direction} trade auto-closed after 24h at ${realized >= 0 ? "+" : "-"}$${Math.abs(realized).toFixed(2)}.`,
    });
    return { row, pnl: parseFloat(row.realizedPnl ?? realized.toFixed(2)), elapsedMs: row.closedAt ? row.closedAt.getTime() - row.openedAt.getTime() : elapsed };
  }

  return { row: p, pnl: walk.pnl, elapsedMs: elapsed };
}

// List AI trading signals — shuffled per-minute so the "best" signal rotates
router.get("/trade/signals", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const minuteSeed = Math.floor(Date.now() / 60_000) ^ (user.id * 2654435761);
  return res.json(shuffleSignals(minuteSeed));
});

// Open a trade position on a signal using an owned bot
router.post("/trade/execute", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const parsed = ExecuteTradeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { signalId, botId, targetProfit, stopLoss, stake } = parsed.data;

  const signal = SIGNALS.find((s) => s.id === signalId);
  if (!signal) return res.status(400).json({ error: "Signal not found" });

  if (targetProfit <= 0) return res.status(400).json({ error: "Target profit must be greater than 0" });
  if (stopLoss <= 0) return res.status(400).json({ error: "Stop loss must be greater than 0" });
  if (stake <= 0) return res.status(400).json({ error: "Stake must be greater than 0" });

  // Must own the bot
  const rows = await db.select({ ub: userBotsTable, bot: botsTable })
    .from(userBotsTable)
    .innerJoin(botsTable, eq(userBotsTable.botId, botsTable.id))
    .where(and(eq(userBotsTable.userId, user.id), eq(userBotsTable.id, botId)))
    .limit(1);

  if (rows.length === 0) return res.status(400).json({ error: "You don't own this bot. Purchase it first." });

  const { ub, bot } = rows[0];

  const available = await computeAvailableBalance(user.id);
  if (stake > available) return res.status(400).json({ error: "Insufficient balance for this stake" });

  const guaranteedTp = Math.round(stake * 0.045 * 100) / 100;
  const guaranteedSl = Math.round(stake * 0.040 * 100) / 100;

  const inserted = await db.insert(positionsTable).values({
    userId: user.id,
    botId: bot.id,
    botName: bot.name,
    signalId: signal.id,
    pair: signal.pair,
    direction: signal.direction,
    market: signal.market,
    winRate: bot.winRate,
    stake: stake.toFixed(2),
    targetProfit: guaranteedTp.toFixed(2),
    stopLoss: guaranteedSl.toFixed(2),
    status: "open",
  }).returning();

  // Deduct stake immediately; returned (with realized P&L) when position closes
  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "trade_loss",
    amount: stake.toFixed(2),
    status: "completed",
    paymentMethod: "balance",
    description: `Trade stake: ${signal.pair} ${signal.direction} (${bot.name})`,
  });

  await db.update(userBotsTable).set({ totalTrades: ub.totalTrades + 1 }).where(eq(userBotsTable.id, ub.id));

  return res.json(serialize(inserted[0], 0, 0));
});

// List the user's positions, resolving any that have crossed TP/SL on read
router.get("/trade/positions", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const rows = await db.select().from(positionsTable)
    .where(eq(positionsTable.userId, user.id))
    .orderBy(desc(positionsTable.openedAt))
    .limit(100);

  const now = Date.now();
  const out = [];
  for (const p of rows) {
    if (p.status === "open") {
      const outcome = await getTradeOutcome(user.id, p.id, user.isAdmin ?? false);
      const { row, pnl, elapsedMs } = await resolveOpen(p, now, outcome);
      out.push(serialize(row, pnl, elapsedMs));
    } else {
      const elapsed = p.closedAt ? p.closedAt.getTime() - p.openedAt.getTime() : 0;
      out.push(serialize(p, parseFloat(p.realizedPnl ?? "0"), elapsed));
    }
  }

  return res.json(out);
});

// Manually close an open position at its current simulated P&L
router.post("/trade/positions/:id/close", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id, 10);
  if (!Number.isFinite(id)) return res.status(400).json({ error: "Invalid position id" });

  const rows = await db.select().from(positionsTable)
    .where(and(eq(positionsTable.id, id), eq(positionsTable.userId, user.id)))
    .limit(1);
  if (rows.length === 0) return res.status(400).json({ error: "Position not found" });

  const p = rows[0];
  if (p.status !== "open") {
    const elapsed = p.closedAt ? p.closedAt.getTime() - p.openedAt.getTime() : 0;
    return res.json(serialize(p, parseFloat(p.realizedPnl ?? "0"), elapsed));
  }

  const now = Date.now();
  const outcome = await getTradeOutcome(user.id, p.id, user.isAdmin ?? false);
  const elapsed = now - p.openedAt.getTime();
  const walk = simulateWalk(p, elapsed, outcome);

  // If it already crossed TP/SL or expired, finalize that outcome
  if (walk.crossed || walk.expired) {
    const { row, pnl, elapsedMs } = await resolveOpen(p, now, outcome);
    return res.json(serialize(row, pnl, elapsedMs));
  }

  let realized: number;
  if (outcome === "profit") {
    // Guarantee at least 4% of stake on early manual cash-out
    const rawPnl = Math.round(walk.pnl * 100) / 100;
    const minProfit = Math.round(parseFloat(p.stake) * 0.04 * 100) / 100;
    realized = Math.max(rawPnl, minProfit);
  } else {
    // Loss trade: manual close loses the full SL amount
    realized = -parseFloat(p.stopLoss);
  }

  const row = await closePosition(p, {
    status: "closed_manual",
    realized,
    closedAt: new Date(now),
    title: realized >= 0 ? "Position Closed" : "Stop Loss Hit",
    message: realized >= 0
      ? `You closed your ${p.pair} ${p.direction} trade at +$${realized.toFixed(2)}.`
      : `Your ${p.pair} ${p.direction} trade closed at -$${Math.abs(realized).toFixed(2)}.`,
  });

  return res.json(serialize(row, parseFloat(row.realizedPnl ?? realized.toFixed(2)), row.closedAt ? row.closedAt.getTime() - row.openedAt.getTime() : elapsed));
});

export default router;
