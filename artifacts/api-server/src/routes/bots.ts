import { Router } from "express";
import {
  db,
  userBotsTable,
  botsTable,
  positionsTable,
  transactionsTable,
} from "@workspace/db";
import { eq, and, gte, lte, isNotNull } from "drizzle-orm";
import { eachDayOfInterval, eachMonthOfInterval, format, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays, subMonths, subYears } from "date-fns";
import { getAvailableBalance } from "../utils/balance.js";
import { getRequestToken, getUserForSession } from "../lib/session";

const router = Router();

async function getUserFromToken(token: string | undefined) {
  return getUserForSession(token);
}

// List user's bots
router.get("/bots", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const userBots = await db.select({
    ub: userBotsTable,
    bot: botsTable,
  }).from(userBotsTable)
    .innerJoin(botsTable, eq(userBotsTable.botId, botsTable.id))
    .where(eq(userBotsTable.userId, user.id));

  return res.json(userBots.map(({ ub, bot }) => ({
    id: ub.id,
    name: bot.name,
    status: ub.status,
    profitToday: parseFloat(ub.profitToday),
    winRate: parseFloat(bot.winRate),
    totalTrades: ub.totalTrades,
    iconUrl: bot.iconUrl,
    category: bot.category,
    nextTradeAt: null,
    secondsUntilNextTrade: null,
  })));
});

// Get bot detail
router.get("/bots/:id", async (req, res) => {
  const token = getRequestToken(req);
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
  const ub = rows[0].ub;
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
    nextTradeAt: null,
    secondsUntilNextTrade: null,
  });
});

// Toggle bot status
router.post("/bots/:id/toggle", async (req, res) => {
  const token = getRequestToken(req);
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
  await db.update(userBotsTable).set({
    status: newStatus,
    startedAt: newStatus === "running" ? new Date() : undefined,
    nextTradeAt: null,
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
    nextTradeAt: null,
    secondsUntilNextTrade: null,
  });
});

// Bot analytics chart
router.get("/bots/:id/analytics/:period", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const botId = parseInt(req.params.id);
  const period = req.params.period || "daily";

  if (!Number.isFinite(botId)) return res.status(400).json({ error: "Invalid bot id" });
  const [ownedBot] = await db.select({ botId: userBotsTable.botId })
    .from(userBotsTable)
    .where(and(eq(userBotsTable.id, botId), eq(userBotsTable.userId, user.id)))
    .limit(1);
  if (!ownedBot) return res.status(404).json({ error: "Bot not found" });

  const now = new Date();
  let intervals: Date[];
  let rangeStart: Date;
  let labelFn: (date: Date) => string;
  let keyFn: (date: Date) => string;

  if (period === "weekly") {
    rangeStart = startOfWeek(subDays(now, 11 * 7), { weekStartsOn: 1 });
    intervals = eachDayOfInterval({ start: rangeStart, end: now })
      .filter((date) => date.getDay() === 1 || date.getTime() === rangeStart.getTime());
    labelFn = (date) => `W${format(date, "w")}\n${format(date, "MMM")}`;
    keyFn = (date) => format(startOfWeek(date, { weekStartsOn: 1 }), "yyyy-MM-dd");
  } else if (period === "monthly") {
    rangeStart = startOfMonth(subMonths(now, 11));
    intervals = eachMonthOfInterval({ start: rangeStart, end: now });
    labelFn = (date) => format(date, "MMM yy");
    keyFn = (date) => format(date, "yyyy-MM");
  } else if (period === "yearly") {
    rangeStart = startOfYear(subYears(now, 4));
    intervals = eachMonthOfInterval({ start: rangeStart, end: now })
      .filter((date) => date.getMonth() === 0 || date.getTime() === rangeStart.getTime());
    labelFn = (date) => format(date, "yyyy");
    keyFn = (date) => format(date, "yyyy");
  } else {
    rangeStart = startOfDay(subDays(now, 13));
    intervals = eachDayOfInterval({ start: rangeStart, end: now });
    labelFn = (date) => format(date, "MMM d");
    keyFn = (date) => format(date, "yyyy-MM-dd");
  }

  const settledPositions = await db.select({
    realizedPnl: positionsTable.realizedPnl,
    closedAt: positionsTable.closedAt,
  }).from(positionsTable).where(and(
    eq(positionsTable.userId, user.id),
    eq(positionsTable.botId, ownedBot.botId),
    isNotNull(positionsTable.closedAt),
    gte(positionsTable.closedAt, rangeStart),
    lte(positionsTable.closedAt, now),
  ));

  const points: { date: string; label: string; profit: number; cumulative: number }[] = [];
  let cumulative = 0;
  for (let i = 0; i < intervals.length; i++) {
    const interval = intervals[i];
    const profit = settledPositions.reduce((sum, position) => {
      if (!position.closedAt || keyFn(position.closedAt) !== keyFn(interval)) return sum;
      const pnl = Number(position.realizedPnl ?? 0);
      return Number.isFinite(pnl) ? sum + pnl : sum;
    }, 0);
    const roundedProfit = Math.round(profit * 100) / 100;
    cumulative = Math.round((cumulative + roundedProfit) * 100) / 100;
    points.push({
      date: keyFn(interval),
      label: labelFn(interval),
      profit: roundedProfit,
      cumulative,
    });
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
