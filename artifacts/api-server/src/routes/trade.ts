import { Router } from "express";
import { db, usersTable, sessionsTable, userBotsTable, botsTable, transactionsTable, vipPackagePurchasesTable, vipInvestmentCapitalTable, earningsTable, notificationsTable, positionsTable, settingsTable, signalOpportunitiesTable, signalClaimsTable } from "@workspace/db";
import { eq, and, desc, asc, gte, lt, inArray, sql } from "drizzle-orm";
import { ExecuteTradeBody } from "@workspace/api-zod";
import { getRequestToken } from "../lib/session";
import { calculateVaultCapital, calculateWalletBalance, getAvailableBalance, getVaultCapitalSnapshot, getWalletSnapshot } from "../utils/balance.js";

const router = Router();
const SIGNAL_EXECUTION_AMOUNT = 2.5;
const SIGNAL_REWARD_AMOUNT = 2.5;
const SIGNAL_COOLDOWN_MS = 24 * 60 * 60_000;
const MANUAL_SIGNAL_PREFIX = "manual-signal";
const DEFAULT_SIGNAL_TIMES = ["07:00", "09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00", "23:00"];
const LEGACY_DEFAULT_SIGNAL_TIMES = ["19:00", "21:00", "23:00"];
const VIP_TIERS = [
  { level: 1, price: 500, dailySignals: 3 },
  { level: 2, price: 1_000, dailySignals: 4 },
  { level: 3, price: 2_000, dailySignals: 5 },
  { level: 4, price: 4_000, dailySignals: 6 },
  { level: 5, price: 8_000, dailySignals: 7 },
  { level: 6, price: 16_000, dailySignals: 8 },
  { level: 7, price: 32_000, dailySignals: 9 },
] as const;

async function getUserFromToken(token: string | undefined) {
  if (!token) return null;
  const sessions = await db.select().from(sessionsTable).where(eq(sessionsTable.token, token)).limit(1);
  if (sessions.length === 0) return null;
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
  hasPackage: boolean;
  packagePrice: number | null;
  vaultCapital: number;
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  signalAmount: number;
  nextLevel: number | null;
  nextLevelDeposit: number | null;
  nextLevelAmountDue: number | null;
  timezone: string;
  dayStart: Date;
  nextDayStart: Date;
  cooldownUntil: Date | null;
};

function getVipAmountDue(activeLevel: number, targetPrice: number): number {
  const activeTier = VIP_TIERS.find((candidate) => candidate.level === activeLevel);
  return Math.max(0, targetPrice - (activeTier?.price ?? 0));
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
  const [purchase] = await db.select().from(vipPackagePurchasesTable).where(and(
    eq(vipPackagePurchasesTable.userId, userId),
    eq(vipPackagePurchasesTable.status, "completed"),
  )).orderBy(desc(vipPackagePurchasesTable.vipLevel)).limit(1);
  const capital = await getVaultCapitalSnapshot(userId);
  const tier = VIP_TIERS.find((candidate) => candidate.level === purchase?.vipLevel) ?? null;
  const todayKey = localDateKey(new Date(), config.timezone);
  const dayStart = zonedTimeToUtc(todayKey, "00:00", config.timezone);
  const nextDayStart = zonedTimeToUtc(addLocalDays(todayKey, 1), "00:00", config.timezone);
  const [claims, [latestClaim]] = await Promise.all([
    db.select({ id: signalClaimsTable.id }).from(signalClaimsTable).where(and(
      eq(signalClaimsTable.userId, userId),
      gte(signalClaimsTable.createdAt, dayStart),
      lt(signalClaimsTable.createdAt, nextDayStart),
    )),
    db.select({ createdAt: signalClaimsTable.createdAt })
      .from(signalClaimsTable)
      .where(eq(signalClaimsTable.userId, userId))
      .orderBy(desc(signalClaimsTable.createdAt))
      .limit(1),
  ]);
  const dailyLimit = tier?.dailySignals ?? 0;
  let cooldownUntil: Date | null = null;
  if (tier && latestClaim) {
    const latestClaimDayKey = localDateKey(latestClaim.createdAt, config.timezone);
    const latestClaimDayStart = zonedTimeToUtc(latestClaimDayKey, "00:00", config.timezone);
    const latestClaimNextDayStart = zonedTimeToUtc(addLocalDays(latestClaimDayKey, 1), "00:00", config.timezone);
    const latestDayClaims = await db.select({ id: signalClaimsTable.id })
      .from(signalClaimsTable)
      .where(and(
        eq(signalClaimsTable.userId, userId),
        gte(signalClaimsTable.createdAt, latestClaimDayStart),
        lt(signalClaimsTable.createdAt, latestClaimNextDayStart),
      ));
    const candidateCooldownUntil = new Date(latestClaim.createdAt.getTime() + SIGNAL_COOLDOWN_MS);
    if (latestDayClaims.length >= dailyLimit && candidateCooldownUntil.getTime() > Date.now()) {
      cooldownUntil = candidateCooldownUntil;
    }
  }
  const cooldownActive = cooldownUntil !== null;
  const nextTier = VIP_TIERS.find((candidate) => candidate.level === (tier?.level ?? 0) + 1);
  return {
    level: tier?.level ?? 0,
    minimumDeposit: tier?.price ?? 0,
    totalDeposited: Math.round(totalDeposited * 100) / 100,
    hasPackage: Boolean(purchase),
    packagePrice: tier?.price ?? null,
    vaultCapital: capital.vaultCapital,
    dailyLimit,
    usedToday: claims.length,
    remainingToday: cooldownActive ? 0 : Math.max(0, dailyLimit - claims.length),
    signalAmount: SIGNAL_EXECUTION_AMOUNT,
    nextLevel: nextTier?.level ?? null,
    nextLevelDeposit: nextTier?.price ?? null,
    nextLevelAmountDue: nextTier ? getVipAmountDue(tier?.level ?? 0, nextTier.price) : null,
    timezone: config.timezone,
    dayStart,
    nextDayStart,
    cooldownUntil,
  };
}

function getVipEligibleOpportunities(
  opportunities: typeof signalOpportunitiesTable.$inferSelect[],
  access: VipAccess,
) {
  if (access.level === 0) return [];
  if (access.cooldownUntil) return [];
  if (access.remainingToday <= 0) return [];
  return opportunities.filter((opportunity) => opportunity.status === "available");
}

class SignalRuleError extends Error {
  constructor(public code: string, message: string, public statusCode = 429) {
    super(message);
  }
}

class VipPurchaseError extends Error {
  constructor(public code: string, message: string, public statusCode = 400) {
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

// Non-signal bot positions retain the deterministic simulation because live
// broker execution is out of scope. AI Signals use the disclosed fixed outcome.
async function getTradeOutcome(
  _userId: number,
  positionId: number,
  _isAdmin: boolean,
  isSignalPosition = false,
): Promise<"profit" | "loss"> {
  if (isSignalPosition) return "profit";
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
    const [signalClaim] = await tx.select({ id: signalClaimsTable.id })
      .from(signalClaimsTable)
      .where(eq(signalClaimsTable.positionId, p.id))
      .limit(1);
    const isSignalPosition = Boolean(signalClaim);
    const realized = isSignalPosition ? SIGNAL_REWARD_AMOUNT : opts.realized;
    const netRealized = Math.round((realized - fee) * 100) / 100;
    const updated = await tx.update(positionsTable)
      .set({
        status: isSignalPosition ? "tp_hit" : opts.status,
        realizedPnl: netRealized.toFixed(2),
        closedAt: opts.closedAt,
      })
      .where(and(eq(positionsTable.id, p.id), eq(positionsTable.status, "open")))
      .returning();

    if (updated.length === 0) {
      const cur = await tx.select().from(positionsTable).where(eq(positionsTable.id, p.id)).limit(1);
      return cur[0] ?? p;
    }

    // Stake was reserved from Vault Capital on open. Return the principal
    // portion to the vault. Signal outcomes are fixed at +$2.50 and credited
    // through the one-time signal reward below.
    const stake = parseFloat(p.stake);
    const vaultReturn = Math.max(0, stake + Math.min(realized, 0));
    if (vaultReturn > 0) {
      await tx.insert(transactionsTable).values({
        userId: p.userId,
        type: "vault_trade_return",
        amount: vaultReturn.toFixed(2),
        status: "completed",
        paymentMethod: "balance",
        description: `${opts.title}: Vault Capital principal return for ${p.pair} ${p.direction} (${p.botName})`,
      });
    }
    if (realized > 0 && !isSignalPosition) {
      await tx.insert(transactionsTable).values({
        userId: p.userId,
        type: "trade_profit",
        amount: realized.toFixed(2),
        status: "completed",
        paymentMethod: "balance",
        description: `${opts.title}: Main Wallet profit from ${p.pair} ${p.direction} (${p.botName})`,
      });
    }
    if (signalClaim) {
      await tx.insert(transactionsTable).values({
        userId: p.userId,
        type: "signal_reward",
        amount: SIGNAL_REWARD_AMOUNT.toFixed(2),
        status: "completed",
        paymentMethod: "balance",
        description: `AI Signal reward: Main Wallet credit reflected in Portfolio Wallet for ${p.pair} ${p.direction} (${p.botName})`,
      });
    }
    if (fee > 0) {
      await tx.insert(transactionsTable).values({
        userId: p.userId,
        type: "vault_trade_fee",
        amount: fee.toFixed(2),
        status: "completed",
        paymentMethod: "balance",
        description: `AI Signal Vault Capital fee: ${p.pair} (${p.botName})`,
      });
    }
    await tx.insert(earningsTable).values({ userId: p.userId, amount: netRealized.toFixed(2), source: "trade" });
    const notificationTitle = isSignalPosition ? "Signal Complete" : opts.title;
    const notificationMessage = isSignalPosition
      ? `Your ${p.pair} ${p.direction} AI Signal settled with the disclosed +$${SIGNAL_REWARD_AMOUNT.toFixed(2)} outcome.`
      : opts.message;
    const notificationSuffix = isSignalPosition
      ? " The outcome was credited to your Main Wallet and reflected in your Portfolio Wallet."
      : ` Net realized P&L after a ${fee.toFixed(2)} fee: ${netRealized >= 0 ? "+" : "-"}$${Math.abs(netRealized).toFixed(2)}.`;
    await tx.insert(notificationsTable).values({
      userId: p.userId,
      type: "trade",
      title: notificationTitle,
      message: `${notificationMessage}${notificationSuffix}`,
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
  const now = new Date();
  const todayKey = localDateKey(now, config.timezone);
  const keys = SIGNALS.map((signal) => ({
    signal,
    scheduleKey: `${MANUAL_SIGNAL_PREFIX}:${todayKey}:${signal.id}`,
  }));

  for (const item of keys) {
    const signal = item.signal;
    await db.insert(signalOpportunitiesTable).values({
      scheduleKey: item.scheduleKey,
      scheduledAt: now,
      expiresAt: new Date(now.getTime() + 365 * 24 * 60 * 60_000),
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

  const opportunities = await db.select().from(signalOpportunitiesTable)
    .where(inArray(signalOpportunitiesTable.scheduleKey, keys.map((k) => k.scheduleKey)))
    .orderBy(asc(signalOpportunitiesTable.id));
  for (const opportunity of opportunities) {
    const nextStatus = config.enabled ? "available" : "disabled";
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

// List server-owned AI Signal opportunities. Signals are available immediately;
// VIP daily limits, spacing, and emergency controls are enforced server-side.
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
  return res.json({
    vipLevel: access.level,
    minimumDeposit: access.minimumDeposit,
    totalDeposited: access.totalDeposited,
    hasPackage: access.hasPackage,
    packagePrice: access.packagePrice,
    vaultCapital: access.vaultCapital,
    lockedInvestmentCapital: access.vaultCapital,
    canExecute: access.level > 0 && !access.cooldownUntil,
    dailyLimit: access.dailyLimit,
    usedToday: access.usedToday,
    remainingToday: access.remainingToday,
    signalAmount: access.signalAmount,
    nextLevel: access.nextLevel,
    nextLevelDeposit: access.nextLevelDeposit,
    nextLevelAmountDue: access.nextLevelAmountDue,
    timezone: access.timezone,
    nextSignalAt: access.cooldownUntil?.toISOString() ?? null,
    cooldownUntil: access.cooldownUntil?.toISOString() ?? null,
    cooldownActive: access.cooldownUntil !== null,
  });
});

router.get("/trade/vip-packages", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });
  const settings = await getOrCreateSettings();
  const access = await getVipAccess(user.id, getSignalSettings(settings));
  return res.json(VIP_TIERS.map((tier) => ({
    level: tier.level,
    price: tier.price,
    dailySignals: tier.dailySignals,
    isActive: tier.level === access.level,
    isUpgrade: tier.level > access.level,
    isAvailable: tier.level > access.level,
    amountDue: tier.level > access.level ? getVipAmountDue(access.level, tier.price) : 0,
  })));
});

router.post("/trade/vip-packages/:level/purchase", async (req, res) => {
  const token = getRequestToken(req);
  const user = await getUserFromToken(token);
  if (!user) return res.status(401).json({ error: "Unauthorized" });

  const level = Number(req.params.level);
  const tier = VIP_TIERS.find((candidate) => candidate.level === level);
  if (!Number.isInteger(level) || !tier) {
    return res.status(400).json({ code: "INVALID_VIP_PACKAGE", error: "Choose a valid VIP package." });
  }

  try {
    const purchaseResult = await db.transaction(async (tx) => {
      await tx.execute(sql`select pg_advisory_xact_lock(${user.id})`);

      const [active] = await tx.select().from(vipPackagePurchasesTable).where(and(
        eq(vipPackagePurchasesTable.userId, user.id),
        eq(vipPackagePurchasesTable.status, "completed"),
      )).orderBy(desc(vipPackagePurchasesTable.vipLevel)).limit(1);
      if (active && active.vipLevel >= tier.level) {
        throw new VipPurchaseError(
          "VIP_PACKAGE_NOT_UPGRADABLE",
          active.vipLevel === tier.level
            ? `VIP ${tier.level} is already active on your account.`
            : `VIP ${tier.level} is below your active VIP ${active.vipLevel} package.`,
          409,
        );
      }

      const amountDue = getVipAmountDue(active?.vipLevel ?? 0, tier.price);
      const ledger = await tx.select({
        type: transactionsTable.type,
        amount: transactionsTable.amount,
      }).from(transactionsTable).where(and(
        eq(transactionsTable.userId, user.id),
        eq(transactionsTable.status, "completed"),
      ));
      const available = calculateWalletBalance(ledger);
      if (available < amountDue) {
        const shortfall = amountDue - available;
        throw new VipPurchaseError(
          "INSUFFICIENT_BALANCE",
          `Insufficient balance to purchase VIP ${tier.level}. Amount required: $${amountDue.toFixed(2)}. Available balance: $${available.toFixed(2)}. Short by $${shortfall.toFixed(2)}.`,
        );
      }

      const now = new Date();
      await tx.update(vipInvestmentCapitalTable)
        .set({ status: "replaced", replacedAt: now })
        .where(and(
          eq(vipInvestmentCapitalTable.userId, user.id),
          eq(vipInvestmentCapitalTable.status, "locked"),
        ));

      const [created] = await tx.insert(vipPackagePurchasesTable).values({
        userId: user.id,
        vipLevel: tier.level,
        amount: amountDue.toFixed(2),
        status: "completed",
      }).returning();
      await tx.insert(transactionsTable).values({
        userId: user.id,
        type: "vip_package_purchase",
        amount: amountDue.toFixed(2),
        status: "completed",
        paymentMethod: "balance",
        description: active
          ? `VIP ${tier.level} Upgrade ($${amountDue.toFixed(2)} difference)`
          : `VIP ${tier.level} Package Purchase`,
      });
      await tx.insert(vipInvestmentCapitalTable).values({
        userId: user.id,
        vipLevel: tier.level,
        amount: tier.price.toFixed(2),
        status: "locked",
        activatedAt: now,
      });
      return {
        purchase: created,
        amountDue,
        isUpgrade: Boolean(active),
      };
    });

    const [finalVaultCapital, finalWallet] = await Promise.all([
      getVaultCapitalSnapshot(user.id),
      getWalletSnapshot(user.id),
    ]);
    return res.status(201).json({
      message: purchaseResult.isUpgrade
        ? `VIP ${tier.level} activated with a $${purchaseResult.amountDue.toFixed(2)} upgrade payment.`
        : `VIP ${tier.level} activated with a $${purchaseResult.amountDue.toFixed(2)} package payment.`,
      package: {
        level: tier.level,
        price: tier.price,
        dailySignals: tier.dailySignals,
        purchasedAt: purchaseResult.purchase.createdAt.toISOString(),
      },
      amountPaid: purchaseResult.amountDue,
       vaultCapital: finalVaultCapital.vaultCapital,
       portfolioBalance: finalWallet.ledgerBalance + finalVaultCapital.vaultCapital,
       lockedInvestmentCapital: finalVaultCapital.vaultCapital,
       mainWalletBalance: finalWallet.ledgerBalance,
    });
  } catch (error) {
    if (error instanceof VipPurchaseError) {
      return res.status(error.statusCode).json({ code: error.code, error: error.message });
    }
    return res.status(409).json({ code: "VIP_PACKAGE_PURCHASE_FAILED", error: "The package could not be purchased. Please try again." });
  }
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
      error: "Purchase a VIP package to access AI Signals.",
      minimumDeposit: VIP_TIERS[0].price,
      totalDeposited: access.totalDeposited,
    });
  }
  if (access.cooldownUntil) {
    return res.status(429).json({
      code: "SIGNAL_COOLDOWN",
      error: "Your daily signal allowance is complete. Please wait until the 24-hour cooldown ends.",
      cooldownUntil: access.cooldownUntil.toISOString(),
    });
  }
  if (!config.enabled) return res.status(409).json({ code: "SIGNALS_DISABLED", error: "AI Signals are temporarily disabled by the administrator." });
  const eligibleOpportunities = getVipEligibleOpportunities(opportunities, access);
  const opportunity = eligibleOpportunities.find((o) => o.id === opportunityId);
  if (!opportunity || opportunity.signalId !== signalId) return res.status(400).json({ error: "Signal opportunity not found." });
  const now = Date.now();
  if (opportunity.status !== "available") {
    return res.status(409).json({
      code: "SIGNAL_NOT_AVAILABLE",
      error: "This signal is temporarily unavailable.",
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

  const vaultSnapshot = await getVaultCapitalSnapshot(user.id);
  if (stake > vaultSnapshot.vaultCapital) return res.status(400).json({ error: "Insufficient Vault Capital for this stake" });
  if (stake > vaultSnapshot.vaultCapital * (config.maxStakePercent / 100)) {
     return res.status(400).json({ error: `Stake exceeds the ${config.maxStakePercent}% maximum of Vault Capital.` });
  }

  const dayClaims = await db.select().from(signalClaimsTable).where(and(
    eq(signalClaimsTable.userId, user.id),
    gte(signalClaimsTable.createdAt, access.dayStart),
    lt(signalClaimsTable.createdAt, access.nextDayStart),
  ));
  if (dayClaims.length >= access.dailyLimit) return res.status(429).json({ code: "DAILY_LIMIT", error: `You have reached today's ${access.dailyLimit}-signal limit.` });

  try {
    const result = await db.transaction(async (tx) => {
      // Serialize claims per user so concurrent tabs cannot bypass the daily
      // quota check between the read above and the insert.
      await tx.execute(sql`select pg_advisory_xact_lock(${user.id})`);
      const [purchaseBaseline] = await tx.select({
        amount: sql<string>`coalesce(sum(${vipPackagePurchasesTable.amount}), 0)`,
      }).from(vipPackagePurchasesTable).where(and(
        eq(vipPackagePurchasesTable.userId, user.id),
        eq(vipPackagePurchasesTable.status, "completed"),
      ));
      const [legacyCapital] = await tx.select({
        amount: sql<string>`coalesce(sum(${vipInvestmentCapitalTable.amount}), 0)`,
      }).from(vipInvestmentCapitalTable).where(and(
        eq(vipInvestmentCapitalTable.userId, user.id),
        eq(vipInvestmentCapitalTable.status, "locked"),
      ));
      const vaultTransactions = await tx.select({
        type: transactionsTable.type,
        amount: transactionsTable.amount,
        status: transactionsTable.status,
      }).from(transactionsTable).where(eq(transactionsTable.userId, user.id));
      const purchasedCapital = Number(purchaseBaseline?.amount ?? 0);
      const initialCapital = purchasedCapital > 0 ? purchasedCapital : Number(legacyCapital?.amount ?? 0);
      const currentVaultCapital = calculateVaultCapital(initialCapital, vaultTransactions);
      if (stake > currentVaultCapital) {
        throw new SignalRuleError("INSUFFICIENT_VAULT_CAPITAL", "Insufficient Vault Capital for this stake.", 400);
      }
      if (stake > currentVaultCapital * (config.maxStakePercent / 100)) {
        throw new SignalRuleError("STAKE_LIMIT", `Stake exceeds the ${config.maxStakePercent}% maximum of Vault Capital.`, 400);
      }
      const freshClaims = await tx.select().from(signalClaimsTable).where(and(
        eq(signalClaimsTable.userId, user.id),
        gte(signalClaimsTable.createdAt, access.dayStart),
        lt(signalClaimsTable.createdAt, access.nextDayStart),
      ));
      if (freshClaims.length >= access.dailyLimit) {
        throw new SignalRuleError("DAILY_LIMIT", `You have reached today's ${access.dailyLimit}-signal limit.`);
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
        type: "vault_trade_stake",
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
  const signalClaims = rows.length === 0 ? [] : await db.select({ positionId: signalClaimsTable.positionId })
    .from(signalClaimsTable)
    .where(and(
      eq(signalClaimsTable.userId, user.id),
      inArray(signalClaimsTable.positionId, rows.map((row) => row.id)),
    ));
  const signalPositionIds = new Set(signalClaims.flatMap((claim) => claim.positionId === null ? [] : [claim.positionId]));
  for (const p of rows) {
    if (p.status === "open") {
      const outcome = await getTradeOutcome(user.id, p.id, user.isAdmin ?? false, signalPositionIds.has(p.id));
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
  const [signalClaim] = await db.select({ id: signalClaimsTable.id })
    .from(signalClaimsTable)
    .where(and(eq(signalClaimsTable.userId, user.id), eq(signalClaimsTable.positionId, p.id)))
    .limit(1);
  const outcome = await getTradeOutcome(user.id, p.id, user.isAdmin ?? false, Boolean(signalClaim));
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
