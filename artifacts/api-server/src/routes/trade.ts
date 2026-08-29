import { Router } from "express";
import { db, usersTable, sessionsTable, userBotsTable, botsTable, transactionsTable, earningsTable, notificationsTable, positionsTable, settingsTable, signalOpportunitiesTable, signalClaimsTable } from "@workspace/db";
import { eq, and, desc, asc, gte, lt, inArray, sql } from "drizzle-orm";
import { ExecuteTradeBody } from "@workspace/api-zod";
import { getRequestToken, isUserSessionExpired } from "../lib/session";

const router = Router();
const SIGNAL_EXECUTION_AMOUNT = 2.5;
const DEFAULT_SIGNAL_TIMES = ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00", "23:00"];
const LEGACY_DEFAULT_SIGNAL_TIMES = ["19:00", "21:00", "23:00"];
const VIP_TIERS = [
  { level: 1, minimumDeposit: 500, dailySignals: 3 },
  { level: 2, minimumDeposit: 1_000, dailySignals: 4 },
  { level: 3, minimumDeposit: 2_000, dailySignals: 5 },
  { level: 4, minimumDeposit: 4_000, dailySignals: 6 },
  { level: 5, minimumDeposit: 8_000, dailySignals: 7 },
  { level: 6, minimumDeposit: 16_000, dailySignals: 8 },
  { level: 7, minimumDeposit: 32_000, dailySignals: 9 },
] as const;

async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
  if (sessions.length === 0) return null;
  if (isUserSessionExpired(sessions[0].createdAt)) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, sessions[0].id));
    return null;
  }
  const users = await db.select().from(usersTable).where(eq(usersTable.id, sessions[0].userId)).limit(1);
  return users[0] ?? null;
}

function getLocalParts(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return { year: Number(values.year), month: Number(values.month), day: Number(values.day), hour: Number(values.hour), minute: Number(values.minute) };
}

function localDateKey(date: Date, timeZone: string) {
  const p = getLocalParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, "0")}-${String(p.day).padStart(2, "0")}`;
}

function addLocalDays(dateKey: string, days: number) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

// Convert a wall-clock time in the configured IANA timezone into an instant.
// The two correction passes also handle DST transitions without a dependency.
function zonedTimeToUtc(dateKey: string, time: string, timeZone: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  for (let i = 0; i < 2; i++) {
    const p = getLocalParts(new Date(guess), timeZone);
    const observed = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
    guess += target - observed;
  }
  return new Date(guess);
}

function getSignalSettings(row: typeof settingsTable.$inferSelect) {
  const timezone = row.signalsTimezone || "Africa/Nairobi";
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }); } catch { throw new Error("Invalid signal timezone configured"); }
  const times = Array.from(new Set((Array.isArray(row.signalTimes) ? row.signalTimes : []).filter((t): t is string => /^\d{2}:\d{2}$/.test(t) && Number(t.slice(0, 2)) < 24 && Number(t.slice(3)) < 60))).sort();
  return {
    enabled: row.signalsEnabled && !row.signalsEmergencyStop,
    timezone,
    times: times.length > 0 ? times : DEFAULT_SIGNAL_TIMES,
    dailyLimit: Math.min(20, Math.max(1, row.signalDailyLimit || 9)),
    spacingMinutes: Math.min(24 * 60, Math.max(30, row.signalSpacingMinutes || 120)),
    maxStakePercent: Math.min(100, Math.max(1, Number(row.signalMaxStakePercent || 10))),
  };
}

type VipAccess = {
  level: number;
  minimumDeposit: number;
  totalDeposited: number;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  signalAmount: number;
  nextLevel: number | null;
  nextLevelDeposit: number | null;
  timezone: string;
  dayStart: Date;
  nextDayStart: Date;
};

function getVipTier(totalDeposited: number) {
  let tier: typeof VIP_TIERS[number] | null = null;
  for (const candidate of VIP_TIERS) {
    if (totalDeposited >= candidate.minimumDeposit) tier = candidate;
  }
  return tier;
}

async function getVipAccess(userId: number, config: ReturnType<typeof getSignalSettings>): Promise<VipAccess> {
  const [depositTotal] = await db.select({
    total: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)`,
  }).from(transactionsTable).where(and(
    eq(transactionsTable.userId, userId),
    eq(transactionsTable.type, "deposit"),
    eq(transactionsTable.status, "completed"),
  ));
  const totalDeposited = Number(depositTotal?.total ?? 0);
  const tier = getVipTier(totalDeposited);
  const todayKey = localDateKey(new Date(), config.timezone);
  const dayStart = zonedTimeToUtc(todayKey, "00:00", config.timezone);
  const nextDayStart = zonedTimeToUtc(addLocalDays(todayKey, 1), "00:00", config.timezone);
  const claims = await db.select({ id: signalClaimsTable.id }).from(signalClaimsTable).where(and(
    eq(signalClaimsTable.userId, userId),
    gte(signalClaimsTable.createdAt, dayStart),
    lt(signalClaimsTable.createdAt, nextDayStart),
  ));
  const dailyLimit = tier?.dailySignals ?? 0;
  const nextTier = VIP_TIERS.find((candidate) => candidate.level === (tier?.level ?? 0) + 1);
  return {
    level: tier?.level ?? 0,
    minimumDeposit: tier?.minimumDeposit ?? 0,
    totalDeposited: Math.round(totalDeposited * 100) / 100,
    dailyLimit,
    usedToday: claims.length,
    remainingToday: Math.max(0, dailyLimit - claims.length),
    signalAmount: SIGNAL_EXECUTION_AMOUNT,
    nextLevel: nextTier?.level ?? null,
    nextLevelDeposit: nextTier?.minimumDeposit ?? null,
    timezone: config.timezone,
    dayStart,
    nextDayStart,
  };
}

function slotRank(opportunity: typeof signalOpportunitiesTable.$inferSelect, opportunities: typeof signalOpportunitiesTable.$inferSelect[], timezone: string) {
  const dateKey = localDateKey(opportunity.scheduledAt, timezone);
  return opportunities
    .filter((candidate) => localDateKey(candidate.scheduledAt, timezone) === dateKey)
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .findIndex((candidate) => candidate.id === opportunity.id);
}

function getVipEligibleOpportunities(
  opportunities: typeof signalOpportunitiesTable.$inferSelect[],
  access: VipAccess,
) {
  if (access.level === 0) return [];
  return opportunities.filter((opportunity) => slotRank(opportunity, opportunities, access.timezone) < access.dailyLimit);
}

class SignalRuleError extends Error {
  constructor(public code: string, message: string, public statusCode = 429) {
    super(message);
  }
}

async function getOrCreateSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length > 0) {
    const current = rows[0];
    const isLegacyDefault = current.signalDailyLimit === 3 &&
      Array.isArray(current.signalTimes) &&
      current.signalTimes.length === LEGACY_DEFAULT_SIGNAL_TIMES.length &&
      current.signalTimes.every((time, index) => time === LEGACY_DEFAULT_SIGNAL_TIMES[index]);
    if (isLegacyDefault) {
      const [upgraded] = await db.update(settingsTable)
        .set({ signalTimes: DEFAULT_SIGNAL_TIMES, signalDailyLimit: 9 })
        .where(eq(settingsTable.id, current.id))
        .returning();
      return upgraded;
    }
    return current;
  }
  const [created] = await db.insert(settingsTable).values({
    signalTimes: DEFAULT_SIGNAL_TIMES,
    signalDailyLimit: 9,
  }).returning();
  return created;
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
    if (t.type === "trade_profit" || t.type === "trade_loss_return") balance += amt;
    if (t.type === "trade_loss" || t.type === "reserved_stake" || t.type === "trade_fee" || t.type === "bot_purchase") balance -= amt;
  }
  return Math.max(0, balance);
}

// This remains a deterministic simulation because live broker execution is out
// of scope. It deliberately allows losses and never guarantees an outcome.
async function getTradeOutcome(_userId: number, positionId: number, _isAdmin: boolean): Promise<"profit" | "loss"> {
  const bucket = Math.abs(Math.imul(positionId, 1103515245) + 12345) % 100;
  return bucket < 62 ? "profit" : "loss";
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

  // Positive scenario — reaching TP is possible, not promised.
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
    fee: Math.round(parseFloat(p.stake) * 0.001 * 100) / 100,
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
    const fee = Math.round(parseFloat(p.stake) * 0.001 * 100) / 100;
    const netRealized = Math.round((opts.realized - fee) * 100) / 100;
    const updated = await tx.update(positionsTable)
      .set({ status: opts.status, realizedPnl: netRealized.toFixed(2), closedAt: opts.closedAt })
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
        type: opts.realized < 0 ? "trade_loss_return" : "trade_profit",
        amount: returnAmount.toFixed(2),
        status: "completed",
        paymentMethod: "balance",
        description: `${opts.title}: ${p.pair} ${p.direction} (${p.botName})`,
      });
    }
    if (fee > 0) {
      await tx.insert(transactionsTable).values({
        userId: p.userId,
        type: "trade_fee",
        amount: fee.toFixed(2),
        status: "completed",
        paymentMethod: "balance",
        description: `AI Signal execution fee: ${p.pair} (${p.botName})`,
      });
    }
    await tx.insert(earningsTable).values({ userId: p.userId, amount: netRealized.toFixed(2), source: "trade" });
    await tx.insert(notificationsTable).values({
      userId: p.userId,
      type: "trade",
      title: opts.title,
       message: `${opts.message} Net realized P&L after a ${fee.toFixed(2)} fee: ${netRealized >= 0 ? "+" : "-"}$${Math.abs(netRealized).toFixed(2)}.`,
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
    const realized = Math.max(-parseFloat(p.stopLoss), Math.min(parseFloat(p.targetProfit), Math.round(walk.pnl * 100) / 100));
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

async function syncSignalOpportunities(settings: typeof settingsTable.$inferSelect) {
  const config = getSignalSettings(settings);
  const today = localDateKey(new Date(), config.timezone);
  const keys = config.times.flatMap((time) => [-1, 0, 1].map((offset) => {
    const dateKey = addLocalDays(today, offset);
    return { dateKey, time, scheduleKey: `${dateKey}|${time}`, scheduledAt: zonedTimeToUtc(dateKey, time, config.timezone) };
  }));

  for (const item of keys) {
    const signal = SIGNALS[Math.abs([...item.scheduleKey].reduce((n, c) => n + c.charCodeAt(0), 0)) % SIGNALS.length];
    await db.insert(signalOpportunitiesTable).values({
      scheduleKey: item.scheduleKey,
      scheduledAt: item.scheduledAt,
      expiresAt: new Date(item.scheduledAt.getTime() + config.spacingMinutes * 60_000),
      signalId: signal.id,
      pair: signal.pair,
      direction: signal.direction,
      market: signal.market,
      confidence: signal.confidence.toFixed(2),
      timeframe: signal.timeframe,
      suggestedTp: signal.suggestedTp.toFixed(2),
      suggestedSl: signal.suggestedSl.toFixed(2),
    }).onConflictDoNothing({ target: signalOpportunitiesTable.scheduleKey });
  }

  const now = new Date();
  const opportunities = await db.select().from(signalOpportunitiesTable)
    .where(inArray(signalOpportunitiesTable.scheduleKey, keys.map((k) => k.scheduleKey)))
    .orderBy(asc(signalOpportunitiesTable.scheduledAt));
  for (const opportunity of opportunities) {
    const nextStatus = !config.enabled ? "disabled" :
      now.getTime() < opportunity.scheduledAt.getTime() ? "scheduled" :
      now.getTime() < opportunity.expiresAt.getTime() ? "available" : "missed";
    if (opportunity.status !== nextStatus) {
      await db.update(signalOpportunitiesTable).set({ status: nextStatus, updatedAt: now }).where(eq(signalOpportunitiesTable.id, opportunity.id));
      opportunity.status = nextStatus;
    }
  }
  return { config, opportunities };
}

// ── Manual trade ────────────────────────────────────────────────────────────
router.post("/trade/manual", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  return res.status(400).json({
    code: "SIGNAL_REQUIRED",
    error: "Choose a currently available AI Signal, review its risk parameters, and confirm consent before execution.",
  });
});

// List server-owned AI Signal opportunities. Future slots are visible as
// scheduled, but cannot be executed until their scheduled time.
router.get("/trade/signals", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const settings = await getOrCreateSettings();
  const { config, opportunities } = await syncSignalOpportunities(settings);
  const access = await getVipAccess(user.id, config);
  const eligibleOpportunities = getVipEligibleOpportunities(opportunities, access);
  const claims = eligibleOpportunities.length === 0 ? [] : await db.select().from(signalClaimsTable)
    .where(and(eq(signalClaimsTable.userId, user.id), inArray(signalClaimsTable.opportunityId, eligibleOpportunities.map((o) => o.id))));
  const claimed = new Set(claims.map((claim) => claim.opportunityId));
  return res.json(eligibleOpportunities.map((o) => ({
    id: o.signalId,
    opportunityId: o.id,
    pair: o.pair,
    direction: o.direction,
    market: o.market,
    confidence: Number(o.confidence),
    timeframe: o.timeframe,
    suggestedTp: Number(o.suggestedTp),
    suggestedSl: Number(o.suggestedSl),
    scheduledAt: o.scheduledAt.toISOString(),
    expiresAt: o.expiresAt.toISOString(),
    status: claimed.has(o.id) ? "executed" : o.status,
    timezone: config.timezone,
    vipLevel: access.level,
    dailyLimit: access.dailyLimit,
    usedToday: access.usedToday,
    remainingToday: access.remainingToday,
    signalAmount: access.signalAmount,
  })));
});

router.get("/trade/access", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const settings = await getOrCreateSettings();
  const { config, opportunities } = await syncSignalOpportunities(settings);
  const access = await getVipAccess(user.id, config);
  const eligible = getVipEligibleOpportunities(opportunities, access);
  const now = Date.now();
  const nextSignal = eligible.find((opportunity) =>
    opportunity.scheduledAt.getTime() >= now && opportunity.status !== "missed" && opportunity.status !== "disabled"
  );
  return res.json({
    vipLevel: access.level,
    minimumDeposit: access.minimumDeposit,
    totalDeposited: access.totalDeposited,
    dailyLimit: access.dailyLimit,
    usedToday: access.usedToday,
    remainingToday: access.remainingToday,
    signalAmount: access.signalAmount,
    nextLevel: access.nextLevel,
    nextLevelDeposit: access.nextLevelDeposit,
    timezone: access.timezone,
    nextSignalAt: nextSignal?.scheduledAt.toISOString() ?? null,
  });
});

// Open a trade position only from a current, unclaimed AI Signal opportunity.
router.post("/trade/execute", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const parsed = ExecuteTradeBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const { signalId, opportunityId, consent, clientRequestId } = parsed.data;
  if (!consent) return res.status(400).json({ code: "CONSENT_REQUIRED", error: "You must confirm the risk disclosure before execution." });

  const settings = await getOrCreateSettings();
  const { config, opportunities } = await syncSignalOpportunities(settings);
  const access = await getVipAccess(user.id, config);
  if (access.level === 0) {
    return res.status(403).json({
      code: "VIP_REQUIRED",
      error: "A completed deposit of at least $500 is required to access AI Signals.",
      minimumDeposit: VIP_TIERS[0].minimumDeposit,
      totalDeposited: access.totalDeposited,
    });
  }
  const eligibleOpportunities = getVipEligibleOpportunities(opportunities, access);
  const opportunity = eligibleOpportunities.find((o) => o.id === opportunityId);
  if (!config.enabled) return res.status(409).json({ code: "SIGNALS_DISABLED", error: "AI Signals are temporarily disabled by the administrator." });
  if (!opportunity || opportunity.signalId !== signalId) return res.status(400).json({ error: "Signal opportunity not found." });
  const now = Date.now();
  if (opportunity.status !== "available" || now < opportunity.scheduledAt.getTime() || now >= opportunity.expiresAt.getTime()) {
    return res.status(409).json({
      code: opportunity.status === "missed" ? "SIGNAL_MISSED" : "SIGNAL_NOT_AVAILABLE",
      error: opportunity.status === "missed" ? "This signal window has expired and will not execute automatically." : "This signal is not available yet.",
      scheduledAt: opportunity.scheduledAt.toISOString(),
      expiresAt: opportunity.expiresAt.toISOString(),
    });
  }

  // Signal execution uses one server-owned fixed amount. Legacy clients may
  // still send bot/risk fields, but they are intentionally ignored.
  const [bot] = await db.select().from(botsTable).limit(1);
  if (!bot) return res.status(503).json({ code: "SIGNAL_EXECUTION_UNAVAILABLE", error: "Signal execution is temporarily unavailable." });
  const stake = SIGNAL_EXECUTION_AMOUNT;
  // These bounds remain server-owned for the existing position/history model.
  // Users never choose them from the signal execution screen.
  const targetProfit = SIGNAL_EXECUTION_AMOUNT;
  const stopLoss = SIGNAL_EXECUTION_AMOUNT;

  const available = await computeAvailableBalance(user.id);
  if (stake > available) return res.status(400).json({ error: "Insufficient balance for this stake" });
  if (stake > available * (config.maxStakePercent / 100)) {
    return res.status(400).json({ error: `Stake exceeds the ${config.maxStakePercent}% maximum of available balance.` });
  }

  const dayClaims = await db.select().from(signalClaimsTable).where(and(
    eq(signalClaimsTable.userId, user.id),
    gte(signalClaimsTable.createdAt, access.dayStart),
    lt(signalClaimsTable.createdAt, access.nextDayStart),
  ));
  if (dayClaims.length >= access.dailyLimit) return res.status(429).json({ code: "DAILY_LIMIT", error: `You have reached today's ${access.dailyLimit}-signal limit.` });
  const latestClaim = await db.select().from(signalClaimsTable)
    .where(eq(signalClaimsTable.userId, user.id)).orderBy(desc(signalClaimsTable.createdAt)).limit(1);
  if (latestClaim[0] && latestClaim[0].createdAt.getTime() + config.spacingMinutes * 60_000 > now) {
    return res.status(429).json({ code: "SIGNAL_SPACING", error: "Please wait until the spacing window ends before taking another signal." });
  }

  try {
    const result = await db.transaction(async (tx) => {
      // Serialize claims per user so concurrent tabs cannot bypass the daily
      // quota or spacing check between the read above and the insert.
      await tx.execute(sql`select pg_advisory_xact_lock(${user.id})`);
      const [freshClaims, freshLatestClaim] = await Promise.all([
        tx.select().from(signalClaimsTable).where(and(
          eq(signalClaimsTable.userId, user.id),
          gte(signalClaimsTable.createdAt, access.dayStart),
          lt(signalClaimsTable.createdAt, access.nextDayStart),
        )),
        tx.select().from(signalClaimsTable)
          .where(eq(signalClaimsTable.userId, user.id))
          .orderBy(desc(signalClaimsTable.createdAt))
          .limit(1),
      ]);
      if (freshClaims.length >= access.dailyLimit) {
        throw new SignalRuleError("DAILY_LIMIT", `You have reached today's ${access.dailyLimit}-signal limit.`);
      }
      if (freshLatestClaim[0] && freshLatestClaim[0].createdAt.getTime() + config.spacingMinutes * 60_000 > Date.now()) {
        throw new SignalRuleError("SIGNAL_SPACING", "Please wait until the spacing window ends before taking another signal.");
      }
      const [claim] = await tx.insert(signalClaimsTable).values({
        userId: user.id,
        opportunityId: opportunity.id,
        consentAt: new Date(),
        clientRequestId: clientRequestId ?? null,
      }).returning();
      const [inserted] = await tx.insert(positionsTable).values({
        userId: user.id,
        botId: bot.id,
        botName: bot.name,
        signalId: opportunity.signalId,
        pair: opportunity.pair,
        direction: opportunity.direction,
        market: opportunity.market,
        winRate: bot.winRate,
        stake: stake.toFixed(2),
        targetProfit: targetProfit.toFixed(2),
        stopLoss: stopLoss.toFixed(2),
        status: "open",
      }).returning();
      await tx.update(signalClaimsTable).set({ positionId: inserted.id }).where(eq(signalClaimsTable.id, claim.id));
      await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "reserved_stake",
        amount: stake.toFixed(2),
        status: "completed",
        paymentMethod: "balance",
        description: `Reserved stake for AI Signal: ${opportunity.pair} ${opportunity.direction} (${bot.name})`,
      });
      return inserted;
    });
    return res.json(serialize(result, 0, 0));
  } catch (error) {
    if (error instanceof SignalRuleError) {
      return res.status(error.statusCode).json({ code: error.code, error: error.message });
    }
    // A unique claim conflict is an idempotent retry, not a second position.
    const existing = await db.select().from(signalClaimsTable).where(and(
      eq(signalClaimsTable.userId, user.id),
      eq(signalClaimsTable.opportunityId, opportunity.id),
    )).limit(1);
    if (existing[0]?.positionId) {
      const [position] = await db.select().from(positionsTable).where(eq(positionsTable.id, existing[0].positionId)).limit(1);
      if (position) return res.json(serialize(position, 0, 0));
    }
    throw error;
  }
});

// List the user's positions, resolving any that have crossed TP/SL on read
router.get("/trade/positions", async (req, res) => {
  const token = getRequestToken(req);
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
  const token = getRequestToken(req);
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

  const realized = Math.max(-parseFloat(p.stopLoss), Math.min(parseFloat(p.targetProfit), Math.round(walk.pnl * 100) / 100));

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
