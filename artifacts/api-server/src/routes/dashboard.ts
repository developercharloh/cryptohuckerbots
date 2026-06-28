import { Router } from "express";
import { db, usersTable, sessionsTable, userBotsTable, botsTable, transactionsTable, earningsTable } from "@workspace/db";
import { eq, desc, and, gte, sql } from "drizzle-orm";
import { format, subDays, subMonths, subYears, startOfDay, startOfWeek, startOfMonth, startOfYear, eachDayOfInterval, eachMonthOfInterval, eachHourOfInterval } from "date-fns";

const router = Router();

async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
  if (sessions.length === 0) return null;
  const users = await db.select().from(usersTable).where(eq(usersTable.id, sessions[0].userId)).limit(1);
  return users[0] ?? null;
}

// Seeded random for deterministic chart data per (userId, date)
function seededRand(seed: number): number {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

router.get("/dashboard/summary", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const userBots = await db.select().from(userBotsTable).where(eq(userBotsTable.userId, user.id));
  const activeBots = userBots.filter(b => b.status === "running");

  const txns = await db.select().from(transactionsTable).where(eq(transactionsTable.userId, user.id));

  let balance = 0;
  let pendingOut = 0;
  for (const t of txns) {
    const amt = parseFloat(t.amount);
    if (t.status === "completed") {
      if (t.type === "deposit" || t.type === "trade_profit") balance += amt;
      if (t.type === "withdrawal" || t.type === "trade_loss" || t.type === "bot_purchase") balance -= amt;
    }
    if (t.status === "pending" && (t.type === "withdrawal" || t.type === "bot_purchase")) {
      pendingOut += amt;
    }
  }

  const availableBalance = Math.max(0, balance - pendingOut);
  const todayProfit = activeBots.reduce((sum, b) => sum + parseFloat(b.profitToday), 0);
  const totalEarnings = userBots.reduce((sum, b) => sum + parseFloat(b.profitTotal), 0);
  const totalTrades = userBots.reduce((sum, b) => sum + (b.totalTrades ?? 0), 0);
  const winRate = userBots.length > 0 ? 72 + (user.id % 20) : 0; // deterministic per user

  // Compute ROI as totalEarnings / totalDeposited * 100
  const totalDeposited = txns.filter(t => t.type === "deposit" && t.status === "completed").reduce((s, t) => s + parseFloat(t.amount), 0);
  const roi = totalDeposited > 0 ? (totalEarnings / totalDeposited) * 100 : 0;

  return res.json({
    totalBalance: Math.max(0, balance + totalEarnings),
    availableBalance,
    todayProfit,
    todayProfitPercent: todayProfit > 0 ? 5.3 : 0,
    totalEarnings,
    totalProfit: totalEarnings,
    earningsChangePercent: totalEarnings > 0 ? 18.7 : 0,
    activeBots: activeBots.length,
    totalBots: userBots.length,
    winRate: Math.round(winRate * 10) / 10,
    roi: Math.round(roi * 10) / 10,
    totalTrades,
  });
});

router.get("/dashboard/earnings-chart", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const period = (req.query.period as string) || "this_week";
  const now = new Date();
  const uid = user.id;

  let intervals: Date[] = [];
  let labelFn: (d: Date) => string;
  let keyFn: (d: Date) => string;
  let offset = 0; // date offset for seeded rand

  switch (period) {
    case "today": {
      const start = startOfDay(now);
      // 6 buckets: 12AM, 4AM, 8AM, 12PM, 4PM, 8PM
      intervals = [0, 4, 8, 12, 16, 20].map(h => { const d = new Date(start); d.setHours(h); return d; });
      labelFn = (d) => format(d, "ha");
      keyFn = (d) => format(d, "HH");
      offset = 0;
      break;
    }
    case "yesterday": {
      const yStart = startOfDay(subDays(now, 1));
      // 6 buckets: 12AM, 4AM, 8AM, 12PM, 4PM, 8PM
      intervals = [0, 4, 8, 12, 16, 20].map(h => { const d = new Date(yStart); d.setHours(h); return d; });
      labelFn = (d) => format(d, "ha");
      keyFn = (d) => format(d, "HH");
      offset = 1000;
      break;
    }
    case "last_week": {
      const weekStart = startOfWeek(subDays(now, 7), { weekStartsOn: 1 });
      intervals = eachDayOfInterval({ start: weekStart, end: subDays(weekStart, -6) });
      labelFn = (d) => format(d, "EEE'\n'MMM d");
      keyFn = (d) => format(d, "yyyy-MM-dd");
      offset = 2000;
      break;
    }
    case "this_month": {
      const monthStart = startOfMonth(now);
      intervals = eachDayOfInterval({ start: monthStart, end: now });
      labelFn = (d) => format(d, "MMM d");
      keyFn = (d) => format(d, "yyyy-MM-dd");
      offset = 3000;
      break;
    }
    case "last_month": {
      const lmStart = startOfMonth(subMonths(now, 1));
      const lmEnd = subDays(startOfMonth(now), 1);
      intervals = eachDayOfInterval({ start: lmStart, end: lmEnd });
      labelFn = (d) => format(d, "MMM d");
      keyFn = (d) => format(d, "yyyy-MM-dd");
      offset = 4000;
      break;
    }
    case "this_year": {
      const yearStart = startOfYear(now);
      intervals = eachMonthOfInterval({ start: yearStart, end: now });
      labelFn = (d) => format(d, "MMM");
      keyFn = (d) => format(d, "yyyy-MM");
      offset = 5000;
      break;
    }
    case "last_year": {
      const lyStart = startOfYear(subYears(now, 1));
      const lyEnd = subDays(startOfYear(now), 1);
      intervals = eachMonthOfInterval({ start: lyStart, end: lyEnd });
      labelFn = (d) => format(d, "MMM");
      keyFn = (d) => format(d, "yyyy-MM");
      offset = 6000;
      break;
    }
    case "all_time": {
      intervals = eachMonthOfInterval({ start: subMonths(now, 11), end: now });
      labelFn = (d) => format(d, "MMM yy");
      keyFn = (d) => format(d, "yyyy-MM");
      offset = 7000;
      break;
    }
    default: { // "this_week"
      const weekStart = startOfWeek(now, { weekStartsOn: 1 });
      intervals = eachDayOfInterval({ start: weekStart, end: now });
      labelFn = (d) => format(d, "EEE'\n'MMM d");
      keyFn = (d) => format(d, "yyyy-MM-dd");
      offset = 8000;
      break;
    }
  }

  const points: { date: string; label: string; profit: number; cumulative: number }[] = [];
  let cumulative = 0;

  // Check if user has any earnings; if so scale up values
  const userBots = await db.select().from(userBotsTable).where(eq(userBotsTable.userId, uid));
  const hasActivity = userBots.some(b => parseFloat(b.profitTotal) > 0);
  const scale = hasActivity ? parseFloat(userBots.reduce((m, b) => m + parseFloat(b.profitTotal), 0).toFixed(2)) / 1200 : 1;

  for (let i = 0; i < intervals.length; i++) {
    const d = intervals[i];
    const seed = uid * 31 + offset + i;
    const profit = Math.round((seededRand(seed) * 120 + 30) * scale * 100) / 100;
    cumulative = Math.round((cumulative + profit) * 100) / 100;
    points.push({ date: keyFn(d), label: labelFn(d), profit, cumulative });
  }

  return res.json(points);
});

router.get("/dashboard/profit-by-bot", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const userBots = await db
    .select({ ub: userBotsTable, b: botsTable })
    .from(userBotsTable)
    .innerJoin(botsTable, eq(userBotsTable.botId, botsTable.id))
    .where(eq(userBotsTable.userId, user.id));

  const COLORS = ["#7C3AED", "#22C55E", "#F97316", "#3B82F6", "#EC4899", "#14B8A6"];
  const totalProfit = userBots.reduce((s, r) => s + parseFloat(r.ub.profitTotal), 0);

  if (totalProfit === 0) return res.json([]);

  const items = userBots
    .filter(r => parseFloat(r.ub.profitTotal) > 0)
    .sort((a, b) => parseFloat(b.ub.profitTotal) - parseFloat(a.ub.profitTotal))
    .map((r, i) => {
      const profit = parseFloat(r.ub.profitTotal);
      return {
        botId: r.ub.id,
        botName: r.b.name,
        profit: Math.round(profit * 100) / 100,
        percentage: Math.round((profit / totalProfit) * 1000) / 10,
        color: COLORS[i % COLORS.length],
      };
    });

  return res.json(items);
});

router.get("/dashboard/recent-activity", async (req, res) => {
  const token = req.headers.authorization?.replace("Bearer ", "");
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const txns = await db.select().from(transactionsTable)
    .where(eq(transactionsTable.userId, user.id))
    .orderBy(desc(transactionsTable.createdAt))
    .limit(10);

  return res.json(txns.map(t => ({
    id: t.id,
    type: t.type,
    description: t.description || t.type.charAt(0).toUpperCase() + t.type.slice(1),
    amount: parseFloat(t.amount),
    status: t.status,
    createdAt: t.createdAt.toISOString(),
  })));
});

export default router;
