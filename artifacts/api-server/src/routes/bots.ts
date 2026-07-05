import { Router } from "express";
import {
  db,
  usersTable,
  sessionsTable,
  userBotsTable,
  botsTable,
  transactionsTable,
  positionsTable,
  earningsTable,
  notificationsTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { getAvailableBalance } from "../utils/balance.js";

const router = Router();

async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
  if (sessions.length === 0) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, sessions[0].userId)).limit(1);
  return users[0] ?? null;
}

const TRADE_INTERVAL_MS = 24 * 60 * 60 * 1000; // every bot must trade exactly once every 24h

const AUTO_PAIRS = [
  { pair: "EUR/USD", direction: "BUY", market: "Forex" },
  { pair: "GBP/USD", direction: "SELL", market: "Forex" },
  { pair: "USD/JPY", direction: "BUY", market: "Forex" },
  { pair: "BTC/USD", direction: "BUY", market: "Crypto" },
  { pair: "ETH/USD", direction: "SELL", market: "Crypto" },
  { pair: "XAU/USD", direction: "BUY", market: "Commodities" },
];

// Deterministic pick so the same bot/day combination is stable if called twice.
function pickSignal(seed: number) {
  const idx = Math.abs(seed) % AUTO_PAIRS.length;
  return AUTO_PAIRS[idx];
}

// Execute the mandatory scheduled trade for a running bot that is due.
// Every scheduled trade is a guaranteed win — never a loss.
async function runScheduledTrade(ub: typeof userBotsTable.$inferSelect, bot: typeof botsTable.$inferSelect, now: Date) {
  const minInvestment = parseFloat(bot.minInvestment) || 0;
  const stake = Math.max(minInvestment, 25);
  const winRate = parseFloat(bot.winRate) || 75;
  const profit = Math.round(stake * 0.04 * (0.8 + winRate / 200) * 100) / 100;

  const signal = pickSignal(ub.id * 2654435761 + Math.floor(now.getTime() / TRADE_INTERVAL_MS));

  await db.transaction(async (tx) => {
    await tx.insert(positionsTable).values({
      userId: ub.userId,
      botId: bot.id,
      botName: bot.name,
      signalId: `auto-${ub.id}-${now.getTime()}`,
      pair: signal.pair,
      direction: signal.direction,
      market: signal.market,
      winRate: bot.winRate,
      stake: stake.toFixed(2),
      targetProfit: profit.toFixed(2),
      stopLoss: profit.toFixed(2),
      status: "tp_hit",
      realizedPnl: profit.toFixed(2),
      openedAt: now,
      closedAt: now,
    });

    await tx.insert(transactionsTable).values({
      userId: ub.userId,
      type: "trade_profit",
      amount: profit.toFixed(2),
      status: "completed",
      paymentMethod: "balance",
      description: `Scheduled trade win: ${signal.pair} ${signal.direction} (${bot.name})`,
    });

    await tx.insert(earningsTable).values({ userId: ub.userId, amount: profit.toFixed(2), source: "trade" });

    await tx.insert(notificationsTable).values({
      userId: ub.userId,
      type: "trade",
      title: "Bot Trade Won 🎉",
      message: `${bot.name} executed its scheduled 24h trade on ${signal.pair} ${signal.direction} and won +$${profit.toFixed(2)}.`,
    });

    await tx.update(userBotsTable).set({
      profitToday: (parseFloat(ub.profitToday) + profit).toFixed(2),
      profitTotal: (parseFloat(ub.profitTotal) + profit).toFixed(2),
      totalTrades: ub.totalTrades + 1,
      nextTradeAt: new Date(now.getTime() + TRADE_INTERVAL_MS),
    }).where(eq(userBotsTable.id, ub.id));
  });
}

// Lazily runs the scheduled trade for a running bot if it's due, and ensures
// every running bot always has a nextTradeAt scheduled. Called on every read
// so bots trade exactly once per 24h even without a background scheduler.
async function ensureScheduledTrade(
  ub: typeof userBotsTable.$inferSelect,
  bot: typeof botsTable.$inferSelect,
): Promise<typeof userBotsTable.$inferSelect> {
  if (ub.status !== "running") return ub;

  const now = new Date();

  if (!ub.nextTradeAt) {
    const nextTradeAt = new Date(now.getTime() + TRADE_INTERVAL_MS);
    await db.update(userBotsTable).set({ nextTradeAt }).where(eq(userBotsTable.id, ub.id));
    return { ...ub, nextTradeAt };
  }

  if (ub.nextTradeAt.getTime() <= now.getTime()) {
    await runScheduledTrade(ub, bot, now);
    const refreshed = await db.select().from(userBotsTable).where(eq(userBotsTable.id, ub.id)).limit(1);
    return refreshed[0] ?? ub;
  }

  return ub;
}

function secondsUntil(nextTradeAt: Date | null): number | null {
  if (!nextTradeAt) return null;
  return Math.max(0, Math.round((nextTradeAt.getTime() - Date.now()) / 1000));
}

// List user's bots
router.get("/bots", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const userBots = await db.select({
    ub: userBotsTable,
    bot: botsTable,
  }).from(userBotsTable)
    .innerJoin(botsTable, eq(userBotsTable.botId, botsTable.id))
    .where(eq(userBotsTable.userId, user.id));

  const resolved = await Promise.all(userBots.map(async ({ ub, bot }) => ({
    ub: await ensureScheduledTrade(ub, bot),
    bot,
  })));

  return res.json(resolved.map(({ ub, bot }) => ({
    id: ub.id,
    name: bot.name,
    status: ub.status,
    profitToday: parseFloat(ub.profitToday),
    winRate: parseFloat(bot.winRate),
    totalTrades: ub.totalTrades,
    iconUrl: bot.iconUrl,
    category: bot.category,
    nextTradeAt: ub.nextTradeAt ? ub.nextTradeAt.toISOString() : null,
    secondsUntilNextTrade: secondsUntil(ub.nextTradeAt),
  })));
});

// Get bot detail
router.get("/bots/:id", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const rows = await db.select({ ub: userBotsTable, bot: botsTable })
    .from(userBotsTable)
    .innerJoin(botsTable, eq(userBotsTable.botId, botsTable.id))
    .where(and(eq(userBotsTable.id, id), eq(userBotsTable.userId, user.id)))
    .limit(1);

  if (rows.length === 0) return res.status(404).json({ error: "Bot not found" });

  const { bot } = rows[0];
  const ub = await ensureScheduledTrade(rows[0].ub, bot);
  return res.json({
    id: ub.id,
    name: bot.name,
    status: ub.status,
    profitToday: parseFloat(ub.profitToday),
    profitTotal: parseFloat(ub.profitTotal),
    winRate: parseFloat(bot.winRate),
    totalTrades: ub.totalTrades,
    iconUrl: bot.iconUrl,
    category: bot.category,
    description: bot.description,
    performance: parseFloat(bot.winRate),
    nextTradeAt: ub.nextTradeAt ? ub.nextTradeAt.toISOString() : null,
    secondsUntilNextTrade: secondsUntil(ub.nextTradeAt),
  });
});

// Toggle bot status
router.post("/bots/:id/toggle", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const id = parseInt(req.params.id);
  const rows = await db.select({ ub: userBotsTable, bot: botsTable })
    .from(userBotsTable)
    .innerJoin(botsTable, eq(userBotsTable.botId, botsTable.id))
    .where(and(eq(userBotsTable.id, id), eq(userBotsTable.userId, user.id)))
    .limit(1);

  if (rows.length === 0) return res.status(404).json({ error: "Bot not found" });

  const { ub, bot } = rows[0];
  const newStatus = ub.status === "running" ? "paused" : "running";
  const startingNow = newStatus === "running";
  const nextTradeAt = startingNow ? new Date(Date.now() + TRADE_INTERVAL_MS) : ub.nextTradeAt;

  await db.update(userBotsTable).set({
    status: newStatus,
    startedAt: startingNow ? new Date() : undefined,
    nextTradeAt: startingNow ? nextTradeAt : ub.nextTradeAt,
  }).where(eq(userBotsTable.id, id));

  return res.json({
    id: ub.id,
    name: bot.name,
    status: newStatus,
    profitToday: parseFloat(ub.profitToday),
    winRate: parseFloat(bot.winRate),
    totalTrades: ub.totalTrades,
    iconUrl: bot.iconUrl,
    category: bot.category,
    nextTradeAt: nextTradeAt ? nextTradeAt.toISOString() : null,
    secondsUntilNextTrade: secondsUntil(nextTradeAt),
  });
});

// Bot analytics chart
router.get("/bots/:id/analytics/:period", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const botId = parseInt(req.params.id);
  const period = req.params.period || "daily";

  // seed based on bot + user so values are deterministic
  const seed = botId * 100 + user.id;
  const rng = (i: number, base: number) => {
    const x = Math.sin(seed + i + base) * 10000;
    return x - Math.floor(x);
  };

  const now = new Date();
  const points: { date: string; label: string; profit: number; cumulative: number }[] = [];

  if (period === "daily") {
    // last 14 days
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const profit = parseFloat(((rng(i, 0) * 80) - 10).toFixed(2));
      points.push({ date: d.toISOString().split("T")[0], label: d.toLocaleDateString("en", { month: "short", day: "numeric" }), profit, cumulative: 0 });
    }
  } else if (period === "weekly") {
    // last 12 weeks
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const profit = parseFloat(((rng(i, 500) * 200) - 20).toFixed(2));
      const weekNum = Math.ceil((d.getDate() + (new Date(d.getFullYear(), d.getMonth(), 1).getDay())) / 7);
      points.push({ date: d.toISOString().split("T")[0], label: `W${weekNum}\n${d.toLocaleDateString("en", { month: "short" })}`, profit, cumulative: 0 });
    }
  } else if (period === "monthly") {
    // last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const profit = parseFloat(((rng(i, 1000) * 500) - 50).toFixed(2));
      points.push({ date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`, label: d.toLocaleDateString("en", { month: "short", year: "2-digit" }), profit, cumulative: 0 });
    }
  } else {
    // yearly — last 5 years
    for (let i = 4; i >= 0; i--) {
      const yr = now.getFullYear() - i;
      const profit = parseFloat(((rng(i, 2000) * 2000) - 200).toFixed(2));
      points.push({ date: `${yr}`, label: `${yr}`, profit, cumulative: 0 });
    }
  }

  // compute cumulative
  let cum = 0;
  for (const p of points) {
    cum = parseFloat((cum + p.profit).toFixed(2));
    p.cumulative = cum;
  }

  return res.json(points);
});

// Marketplace bots
router.get("/marketplace/bots", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const marketplaceBots = await db.select().from(botsTable).where(eq(botsTable.isMarketplace, true));

  // Get user's purchased bot IDs
  const userBots = await db.select().from(userBotsTable).where(eq(userBotsTable.userId, user.id));
  const purchasedBotIds = new Set(userBots.map(ub => ub.botId));

  return res.json(marketplaceBots.map(bot => ({
    id: bot.id,
    name: bot.name,
    price: parseFloat(bot.price),
    winRate: parseFloat(bot.winRate),
    category: bot.category,
    riskLevel: bot.riskLevel,
    description: bot.description,
    iconUrl: bot.iconUrl,
    isPurchased: purchasedBotIds.has(bot.id),
  })));
});

// Purchase marketplace bot
router.post("/marketplace/bots/:id/purchase", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const botId = parseInt(req.params.id);
  const bots = await db.select().from(botsTable).where(eq(botsTable.id, botId)).limit(1);
  if (bots.length === 0) return res.status(404).json({ error: "Bot not found" });

  // Check if already purchased
  const existing = await db.select().from(userBotsTable)
    .where(and(eq(userBotsTable.userId, user.id), eq(userBotsTable.botId, botId)))
    .limit(1);
  if (existing.length > 0) return res.status(400).json({ error: "Bot already purchased" });

  const bot = bots[0];
  const price = parseFloat(bot.price);

  if (price > 0) {
    const available = await getAvailableBalance(user.id);
    if (available < price) {
      return res.status(400).json({ error: `Insufficient balance. You need $${price.toFixed(2)} but have $${available.toFixed(2)}.` });
    }
  }

  await db.insert(userBotsTable).values({
    userId: user.id,
    botId,
    status: "paused",
    profitToday: "0",
    profitTotal: "0",
    totalTrades: 0,
  });

  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "bot_purchase",
    amount: bot.price,
    status: "completed",
    paymentMethod: "balance",
    description: `Bot Purchase: ${bot.name}`,
  });

  return res.json({ message: "Bot purchased successfully" });
});

export default router;
