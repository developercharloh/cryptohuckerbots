import { Router, type Request, type Response, type NextFunction } from "express";
import { addSseClient, removeSseClient } from "../lib/loginAlarm";
import { VAPID_PUBLIC_KEY, sendPushToAllAdmins } from "../lib/webPush";
import {
  db,
  usersTable,
  botsTable,
  userBotsTable,
  transactionsTable,
  notificationsTable,
  kycTable,
  supportTicketsTable,
  userProfilesTable,
  settingsTable,
  signalScheduleAuditTable,
  chatMessagesTable,
  depositSessionsTable,
  broadcastsTable,
  adminLoginNotificationsTable,
  sessionsTable,
  positionsTable,
  signalClaimsTable,
  earningsTable,
  vipInvestmentCapitalTable,
  vipPackagePurchasesTable,
  referralsTable,
  technicalIncidentsTable,
  type PaymentMethod,
} from "@workspace/db";
import { eq, and, desc, sql, inArray, ilike, or, gte } from "drizzle-orm";
import crypto from "crypto";
import {
  calculateVaultCapital,
  calculateWalletSnapshot,
  composeAccountBalanceSnapshot,
  getAccountBalanceSnapshot,
} from "../utils/balance.js";
import {
  AdminSetUserStatusBody,
  AdminAdjustBalanceBody,
  AdminReviewKycBody,
  AdminCreateBotBody,
  AdminUpdateBotBody,
  AdminAssignBotBody,
  AdminReviewTransactionBody,
  AdminReplyTicketBody,
  AdminUpdateSettingsBody,
  AdminBroadcastBody,
} from "@workspace/api-zod";
import {
  ADMIN_SESSION_COOKIE,
  clearAdminSessionCookie,
  getRequestToken,
  revokeUserSessions,
  setAdminSessionCookie,
  ADMIN_SESSION_TTL_MS,
} from "../lib/session";
import { hashPassword, verifyPassword } from "../lib/password";
import { consumeRateLimit, recordSecurityEvent, rejectRateLimited, requestIp } from "../lib/security";
import { BSC_PAYMENT_METHOD_SETTINGS } from "../lib/payment-methods";

const router = Router();

const adminJwtSecret = process.env.ADMIN_JWT_SECRET?.trim();
const adminPanelPassword = process.env.ADMIN_PANEL_PASSWORD?.trim();
if (
  process.env.NODE_ENV === "production" &&
  (
    !adminJwtSecret ||
    adminJwtSecret.length < 32 ||
    adminJwtSecret === adminPanelPassword
  )
) {
  throw new Error(
    "ADMIN_JWT_SECRET must be a dedicated random secret of at least 32 characters in production.",
  );
}
const configuredJwtSecret = adminJwtSecret ?? adminPanelPassword;
// Development/test processes get an ephemeral secret rather than a guessable
// source-controlled fallback. It changes on restart, which is appropriate.
const JWT_SECRET = configuredJwtSecret ?? crypto.randomBytes(32).toString("hex");

function safeEqualStrings(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function createAdminToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    nonce: crypto.randomBytes(16).toString("hex"),
  })).toString("base64url");
  const sig = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
  return `${payload}.${sig}`;
}

function parseAdminToken(token: string | undefined): { userId: number; expiresAt: number } | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  const expectedSig = crypto.createHmac("sha256", JWT_SECRET).update(payload).digest("base64url");
  if (!safeEqualStrings(sig, expectedSig)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString()) as {
      userId?: unknown;
      expiresAt?: unknown;
    };
    if (
      typeof parsed.userId !== "number" ||
      !Number.isInteger(parsed.userId) ||
      typeof parsed.expiresAt !== "number"
    ) return null;
    if (Date.now() >= parsed.expiresAt) return null;
    return { userId: parsed.userId, expiresAt: parsed.expiresAt };
  } catch {
    return null;
  }
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // Allow the login endpoint through without a token.
  // Note: router.use("/admin", requireAdmin) strips the "/admin" prefix,
  // so req.path here is "/login", not "/admin/login".
  if (req.path === "/login" && req.method === "POST") return next();

  const token = getRequestToken(req, ADMIN_SESSION_COOKIE);
  const payload = parseAdminToken(token);
  if (!payload) {
    clearAdminSessionCookie(res);
    return res.status(401).json({ error: "Admin authentication required." });
  }

  const [session] = await db
    .select()
    .from(sessionsTable)
    .where(eq(sessionsTable.token, token!))
    .limit(1);
  if (!session || session.userId !== payload.userId) {
    clearAdminSessionCookie(res);
    return res.status(401).json({ error: "Admin authentication required." });
  }
  if (Date.now() - session.lastActive.getTime() > ADMIN_SESSION_TTL_MS) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
    clearAdminSessionCookie(res);
    return res.status(401).json({ error: "Admin authentication required." });
  }
  await db.update(sessionsTable)
    .set({ lastActive: new Date() })
    .where(eq(sessionsTable.id, session.id));

  const [admin] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(and(eq(usersTable.id, payload.userId), eq(usersTable.isAdmin, true), eq(usersTable.status, "active")))
    .limit(1);
  if (!admin) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, session.id));
    clearAdminSessionCookie(res);
    return res.status(401).json({ error: "Admin authentication required." });
  }
  return next();
}

router.use("/admin", requireAdmin);

router.get("/admin/session", async (req, res) => {
  const token = getRequestToken(req, ADMIN_SESSION_COOKIE);
  const payload = parseAdminToken(token);
  if (!payload) return res.status(401).json({ error: "Admin authentication required." });
  const [user] = await db.select({ fullName: usersTable.fullName }).from(usersTable)
    .where(eq(usersTable.id, payload.userId)).limit(1);
  return res.json({ authenticated: true, name: user?.fullName ?? "Admin" });
});

router.post("/admin/logout", async (req, res) => {
  const token = getRequestToken(req, ADMIN_SESSION_COOKIE);
  if (token) await db.delete(sessionsTable).where(eq(sessionsTable.token, token));
  clearAdminSessionCookie(res);
  return res.json({ message: "Logged out successfully" });
});

// ─── SSE: Login Alarm ────────────────────────────────────────────────────────
router.get("/admin/login-events", (req, res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  // Disable nginx/Render proxy buffering so events are flushed immediately
  res.setHeader("X-Accel-Buffering", "no");
  res.setHeader("Transfer-Encoding", "chunked");
  res.flushHeaders();

  // Send an immediate ping so the client knows the connection is live
  res.write(": connected\n\n");

  // Keep connection alive with a heartbeat every 20s
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { /* ignore */ }
  }, 20_000);

  addSseClient(res);

  req.on("close", () => {
    clearInterval(heartbeat);
    removeSseClient(res);
  });
});

// ─── Admin Login Notifications ───────────────────────────────────────────────
router.get("/admin/login-notifications", async (_req, res) => {
  const rows = await db
    .select()
    .from(adminLoginNotificationsTable)
    .orderBy(desc(adminLoginNotificationsTable.createdAt))
    .limit(200);
  return res.json(rows);
});

router.patch("/admin/login-notifications/:id/read", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db
    .update(adminLoginNotificationsTable)
    .set({ isRead: true })
    .where(eq(adminLoginNotificationsTable.id, id));
  return res.json({ ok: true });
});

router.post("/admin/login-notifications/read-all", async (_req, res) => {
  await db.update(adminLoginNotificationsTable).set({ isRead: true });
  return res.json({ ok: true });
});

router.delete("/admin/login-notifications/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db
    .delete(adminLoginNotificationsTable)
    .where(eq(adminLoginNotificationsTable.id, id));
  return res.json({ ok: true });
});

// ─── Technical Health ─────────────────────────────────────────────────────────
router.get("/admin/technical-health", async (req, res) => {
  const checkedAt = new Date().toISOString();
  let databaseStatus: "healthy" | "critical" = "healthy";
  let databaseMessage = "Database query completed successfully.";

  try {
    await db.execute(sql`select 1`);
  } catch (error) {
    databaseStatus = "critical";
    databaseMessage = "Database check failed.";
    req.log?.error({ err: error }, "Technical health database check failed");
  }

  const incidents = await db
    .select()
    .from(technicalIncidentsTable)
    .orderBy(desc(technicalIncidentsTable.lastSeenAt))
    .limit(100);
  const activeIncidents = incidents.filter((incident) => incident.status === "active");
  const criticalIncidentCount = activeIncidents.filter((incident) =>
    incident.lastStatusCode !== null && incident.lastStatusCode >= 500
  ).length;
  const startupReady = req.app.locals.startupReady === true;
  const overallStatus = databaseStatus === "critical" || !startupReady || criticalIncidentCount > 0
    ? "critical"
    : activeIncidents.length > 0
      ? "warning"
      : "healthy";

  return res.json({
    checkedAt,
    status: overallStatus,
    activeCount: activeIncidents.length,
    criticalCount: criticalIncidentCount,
    checks: [
      {
        key: "api",
        label: "API service",
        status: "healthy",
        message: "Admin health endpoint responded successfully.",
      },
      {
        key: "database",
        label: "Database",
        status: databaseStatus,
        message: databaseMessage,
      },
      {
        key: "startup",
        label: "Application readiness",
        status: startupReady ? "healthy" : "critical",
        message: startupReady ? "Startup checks are complete." : "Startup checks are still running.",
      },
    ],
    incidents,
  });
});

router.patch("/admin/technical-incidents/:id/resolve", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid incident id." });

  const token = getRequestToken(req, ADMIN_SESSION_COOKIE);
  const payload = parseAdminToken(token);
  const [incident] = await db
    .update(technicalIncidentsTable)
    .set({
      status: "resolved",
      resolvedAt: new Date(),
      resolvedBy: payload?.userId ?? null,
    })
    .where(eq(technicalIncidentsTable.id, id))
    .returning();

  if (!incident) return res.status(404).json({ error: "Technical incident not found." });
  return res.json(incident);
});

router.patch("/admin/technical-incidents/:id/reopen", async (req, res) => {
  const id = Number.parseInt(req.params.id, 10);
  if (!Number.isInteger(id)) return res.status(400).json({ error: "Invalid incident id." });

  const [incident] = await db
    .update(technicalIncidentsTable)
    .set({ status: "active", resolvedAt: null, resolvedBy: null, lastSeenAt: new Date() })
    .where(eq(technicalIncidentsTable.id, id))
    .returning();

  if (!incident) return res.status(404).json({ error: "Technical incident not found." });
  return res.json(incident);
});

const KYC_PENDING = ["pending", "submitted", "under_review"];

// ---------------- Overview ----------------
router.get("/admin/overview", async (_req, res) => {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const startOfSeries = new Date(startOfToday);
  startOfSeries.setDate(startOfSeries.getDate() - 13);

  // Revenue series: net deposits per day, last 14 days
  const series: { date: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(startOfToday);
    d.setDate(d.getDate() - i);
    const key = d.toISOString().split("T")[0];
    series.push({ date: key, value: 0 });
  }
  const seriesIndex = new Map(series.map((p, idx) => [p.date, idx]));

  const [
    [userCounts],
    [botCounts],
    [runningBotCounts],
    [financeCounts],
    [kycCounts],
    [ticketCounts],
    revenueRows,
    recentRows,
  ] = await Promise.all([
    db.select({
      totalUsers: sql<number>`count(*)::int`,
      activeUsers: sql<number>`count(*) filter (where ${usersTable.status} = 'active')::int`,
      suspendedUsers: sql<number>`count(*) filter (where ${usersTable.status} = 'suspended')::int`,
      newUsersToday: sql<number>`count(*) filter (where ${usersTable.createdAt} >= ${startOfToday})::int`,
    }).from(usersTable),
    db.select({ totalBots: sql<number>`count(*)::int` }).from(botsTable),
    db.select({ activeBotInstances: sql<number>`count(*)::int` })
      .from(userBotsTable)
      .where(eq(userBotsTable.status, "running")),
    db.select({
      totalDeposits: sql<string>`coalesce(sum(case when ${transactionsTable.type} = 'deposit' and ${transactionsTable.status} = 'completed' then ${transactionsTable.amount} else 0 end), 0)`,
      totalWithdrawals: sql<string>`coalesce(sum(case when ${transactionsTable.type} = 'withdrawal' and ${transactionsTable.status} = 'completed' then ${transactionsTable.amount} else 0 end), 0)`,
      pendingDeposits: sql<number>`count(*) filter (where ${transactionsTable.type} = 'deposit' and ${transactionsTable.status} = 'pending')::int`,
      pendingWithdrawals: sql<number>`count(*) filter (where ${transactionsTable.type} = 'withdrawal' and ${transactionsTable.status} = 'pending')::int`,
    }).from(transactionsTable),
    db.select({ pendingKyc: sql<number>`count(*)::int` })
      .from(kycTable)
      .where(inArray(kycTable.status, KYC_PENDING)),
    db.select({ openTickets: sql<number>`count(*)::int` })
      .from(supportTicketsTable)
      .where(eq(supportTicketsTable.status, "open")),
    db.select({
      day: sql<string>`to_char(date_trunc('day', ${transactionsTable.createdAt}), 'YYYY-MM-DD')`,
      value: sql<string>`coalesce(sum(${transactionsTable.amount}), 0)`,
    })
      .from(transactionsTable)
      .where(and(
        eq(transactionsTable.type, "deposit"),
        eq(transactionsTable.status, "completed"),
        gte(transactionsTable.createdAt, startOfSeries),
      ))
      .groupBy(sql`date_trunc('day', ${transactionsTable.createdAt})`),
    db.select({
      transaction: transactionsTable,
      userName: usersTable.fullName,
      userEmail: usersTable.email,
    })
      .from(transactionsTable)
      .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
      .orderBy(desc(transactionsTable.createdAt))
      .limit(10),
  ]);

  for (const row of revenueRows) {
    const idx = seriesIndex.get(row.day);
    if (idx !== undefined) series[idx].value = Number(row.value);
  }

  const totalDeposits = Number(financeCounts?.totalDeposits ?? 0);
  const totalWithdrawals = Number(financeCounts?.totalWithdrawals ?? 0);
  const recent = recentRows.map(({ transaction: t, userName, userEmail }) => ({
    id: t.id,
    userId: t.userId,
    userName: userName ?? "Unknown",
    userEmail: userEmail ?? "",
    type: t.type,
    amount: parseFloat(t.amount),
    status: t.status,
    paymentMethod: t.paymentMethod,
    walletAddress: t.walletAddress,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
    cryptoAmount: t.cryptoAmount ? parseFloat(t.cryptoAmount) : null,
    cryptoAsset: t.cryptoAsset,
    conversionRate: t.conversionRate ? parseFloat(t.conversionRate) : null,
  }));

  return res.json({
    totalUsers: Number(userCounts?.totalUsers ?? 0),
    activeUsers: Number(userCounts?.activeUsers ?? 0),
    suspendedUsers: Number(userCounts?.suspendedUsers ?? 0),
    newUsersToday: Number(userCounts?.newUsersToday ?? 0),
    totalBots: Number(botCounts?.totalBots ?? 0),
    activeBotInstances: Number(runningBotCounts?.activeBotInstances ?? 0),
    totalDeposits,
    totalWithdrawals,
    netRevenue: totalDeposits - totalWithdrawals,
    pendingDeposits: Number(financeCounts?.pendingDeposits ?? 0),
    pendingWithdrawals: Number(financeCounts?.pendingWithdrawals ?? 0),
    pendingKyc: Number(kycCounts?.pendingKyc ?? 0),
    openTickets: Number(ticketCounts?.openTickets ?? 0),
    revenueSeries: series,
    recentTransactions: recent,
  });
});

// ---------------- Users ----------------
router.get("/admin/users", async (req, res) => {
  const search = (req.query.search as string | undefined)?.trim().toLowerCase().slice(0, 100);
  const requestedLimit = Number.parseInt(String(req.query.limit ?? "100"), 10);
  const requestedOffset = Number.parseInt(String(req.query.offset ?? "0"), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 100;
  const offset = Number.isFinite(requestedOffset) ? Math.min(1_000_000, Math.max(0, requestedOffset)) : 0;
  const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&");
  const searchFilter = search
    ? or(
      ilike(usersTable.fullName, `%${escapeLike(search)}%`),
      ilike(usersTable.email, `%${escapeLike(search)}%`),
      ilike(usersTable.accountUid, `%${escapeLike(search)}%`),
    )
    : undefined;

  const [users, [{ total }]] = await Promise.all([
    db.select().from(usersTable)
      .where(searchFilter)
      .orderBy(desc(usersTable.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ total: sql<number>`count(*)::int` }).from(usersTable).where(searchFilter),
  ]);
  const userIds = users.map((u) => u.id);
  res.setHeader("X-Total-Count", String(Number(total ?? 0)));

  if (userIds.length === 0) return res.json([]);

  const [botRows, txnRows, profiles, purchaseRows, legacyCapitalRows] = await Promise.all([
    db.select({
      userId: userBotsTable.userId,
      totalBots: sql<number>`count(*)::int`,
    }).from(userBotsTable).where(inArray(userBotsTable.userId, userIds)).groupBy(userBotsTable.userId),
    db.select({
      userId: transactionsTable.userId,
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      status: transactionsTable.status,
    }).from(transactionsTable).where(inArray(transactionsTable.userId, userIds)),
    db.select().from(userProfilesTable).where(inArray(userProfilesTable.userId, userIds)),
    db.select({
      userId: vipPackagePurchasesTable.userId,
      amount: sql<string>`coalesce(sum(${vipPackagePurchasesTable.amount}), 0)`,
    }).from(vipPackagePurchasesTable)
      .where(and(
        inArray(vipPackagePurchasesTable.userId, userIds),
        eq(vipPackagePurchasesTable.status, "completed"),
      ))
      .groupBy(vipPackagePurchasesTable.userId),
    db.select({
      userId: vipInvestmentCapitalTable.userId,
      amount: sql<string>`coalesce(sum(${vipInvestmentCapitalTable.amount}), 0)`,
    }).from(vipInvestmentCapitalTable)
      .where(and(
        inArray(vipInvestmentCapitalTable.userId, userIds),
        eq(vipInvestmentCapitalTable.status, "locked"),
      ))
      .groupBy(vipInvestmentCapitalTable.userId),
  ]);

  const profileMap = new Map(profiles.map((p) => [p.userId, p]));
  const botMap = new Map(botRows.map((row) => [row.userId, row]));
  const purchaseMap = new Map(purchaseRows.map((row) => [row.userId, Number(row.amount ?? 0)]));
  const legacyCapitalMap = new Map(legacyCapitalRows.map((row) => [row.userId, Number(row.amount ?? 0)]));
  const txnMap = new Map<number, typeof txnRows>();
  for (const row of txnRows) {
    const rows = txnMap.get(row.userId) ?? [];
    rows.push(row);
    txnMap.set(row.userId, rows);
  }

  const result = await Promise.all(users.map(async (u) => {
    const botRow = botMap.get(u.id);
    const wallet = calculateWalletSnapshot(txnMap.get(u.id) ?? []);
    const purchasedCapital = purchaseMap.get(u.id) ?? 0;
    const legacyLockedCapital = legacyCapitalMap.get(u.id) ?? 0;
    const initialCapital = purchasedCapital > 0 ? purchasedCapital : legacyLockedCapital;
    const account = composeAccountBalanceSnapshot(wallet, {
      initialCapital: Math.round(Math.max(0, initialCapital) * 100) / 100,
      vaultCapital: calculateVaultCapital(initialCapital, txnMap.get(u.id) ?? []),
    });
    return {
      id: u.id,
      accountUid: u.accountUid,
      fullName: u.fullName,
      email: u.email,
      status: u.status,
      kycStatus: u.kycStatus,
      // Keep balance for older admin clients; it is the withdrawable amount.
      balance: account.availableBalance,
      availableBalance: account.availableBalance,
      pendingOutflow: account.pendingOutflow,
      mainWalletBalance: account.mainWalletBalance,
      vaultCapital: account.vaultCapital,
      portfolioBalance: account.portfolioBalance,
      totalBots: Number(botRow?.totalBots ?? 0),
      avatarUrl: u.avatarUrl,
      country: profileMap.get(u.id)?.country ?? null,
      createdAt: u.createdAt.toISOString(),
    };
  }));

  return res.json(result);
});

router.get("/admin/users/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, id)).limit(1);
  const userBots = await db
    .select({ ub: userBotsTable, bot: botsTable })
    .from(userBotsTable)
    .leftJoin(botsTable, eq(userBotsTable.botId, botsTable.id))
    .where(eq(userBotsTable.userId, id));
  const txns = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, id))
    .orderBy(desc(transactionsTable.createdAt));
  let totalWithdrawals = 0;
  for (const t of txns) {
    if (t.status !== "completed") continue;
    const amt = parseFloat(t.amount);
    if (t.type === "withdrawal") totalWithdrawals += amt;
  }
  const account = await getAccountBalanceSnapshot(id);

  return res.json({
    id: user.id,
    accountUid: user.accountUid,
    fullName: user.fullName,
    email: user.email,
    status: user.status,
    kycStatus: user.kycStatus,
    isAdmin: user.isAdmin,
    // Keep balance for older admin clients; it is the withdrawable amount.
    balance: account.availableBalance,
    availableBalance: account.availableBalance,
    pendingOutflow: account.pendingOutflow,
    mainWalletBalance: account.mainWalletBalance,
    vaultCapital: account.vaultCapital,
    portfolioBalance: account.portfolioBalance,
    totalBots: userBots.length,
    avatarUrl: user.avatarUrl,
    phone: profile?.phone ?? null,
    country: profile?.country ?? null,
    totalDeposits: account.totalDeposited,
    totalWithdrawals: Math.round(totalWithdrawals * 100) / 100,
    createdAt: user.createdAt.toISOString(),
    bots: userBots.map((b) => ({
      id: b.ub.id,
      botId: b.ub.botId,
      name: b.bot?.name ?? "Unknown Bot",
      status: b.ub.status,
      profitTotal: parseFloat(b.ub.profitTotal),
      profitToday: parseFloat(b.ub.profitToday),
      createdAt: b.ub.createdAt.toISOString(),
    })),
    transactions: txns.map((t) => ({
      id: t.id,
      userId: t.userId,
      userName: user.fullName,
      userEmail: user.email,
      type: t.type,
      amount: parseFloat(t.amount),
      status: t.status,
      paymentMethod: t.paymentMethod,
      walletAddress: t.walletAddress,
      description: t.description,
      createdAt: t.createdAt.toISOString(),
      cryptoAmount: t.cryptoAmount ? parseFloat(t.cryptoAmount) : null,
      cryptoAsset: t.cryptoAsset,
      conversionRate: t.conversionRate ? parseFloat(t.conversionRate) : null,
    })),
  });
});

async function getAdminUser(id: number) {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return null;
  const [profile] = await db.select().from(userProfilesTable).where(eq(userProfilesTable.userId, id)).limit(1);
  const userBots = await db.select().from(userBotsTable).where(eq(userBotsTable.userId, id));
  const account = await getAccountBalanceSnapshot(id);
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    status: user.status,
    kycStatus: user.kycStatus,
    // Keep balance for older admin clients; it is the withdrawable amount.
    balance: account.availableBalance,
    availableBalance: account.availableBalance,
    pendingOutflow: account.pendingOutflow,
    mainWalletBalance: account.mainWalletBalance,
    vaultCapital: account.vaultCapital,
    portfolioBalance: account.portfolioBalance,
    totalBots: userBots.length,
    avatarUrl: user.avatarUrl,
    country: profile?.country ?? null,
    createdAt: user.createdAt.toISOString(),
  };
}

router.post("/admin/users/:id/status", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = AdminSetUserStatusBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  await db.update(usersTable).set({ status: parsed.data.status }).where(eq(usersTable.id, id));
  const user = await getAdminUser(id);
  if (!user) return res.status(404).json({ error: "User not found" });
  return res.json(user);
});

router.post("/admin/users/:id/reset-password", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const tempPassword = "Qfx-" + crypto.randomBytes(4).toString("hex");
  await db.update(usersTable).set({ passwordHash: await hashPassword(tempPassword), updatedAt: new Date() }).where(eq(usersTable.id, id));
  await revokeUserSessions(id);
  await recordSecurityEvent(req, "admin_password_reset", id);
  return res.json({ tempPassword });
});

router.post("/admin/users/:id/reset-history", async (req, res): Promise<void> => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) {
    res.status(400).json({ error: "Invalid id" });
    return;
  }

  const [user] = await db.select({ id: usersTable.id }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await db.transaction(async (tx) => {
    // Clear user-owned financial and activity records while preserving the
    // account, credentials, profile details, support history, and audit trail.
    await tx.delete(signalClaimsTable).where(eq(signalClaimsTable.userId, id));
    await tx.delete(positionsTable).where(eq(positionsTable.userId, id));
    await tx.delete(userBotsTable).where(eq(userBotsTable.userId, id));
    await tx.delete(transactionsTable).where(eq(transactionsTable.userId, id));
    await tx.delete(earningsTable).where(eq(earningsTable.userId, id));
    await tx.delete(vipPackagePurchasesTable).where(eq(vipPackagePurchasesTable.userId, id));
    await tx.delete(vipInvestmentCapitalTable).where(eq(vipInvestmentCapitalTable.userId, id));
    await tx.delete(depositSessionsTable).where(eq(depositSessionsTable.userId, id));
    await tx.delete(notificationsTable).where(eq(notificationsTable.userId, id));
    await tx.delete(referralsTable).where(or(
      eq(referralsTable.referrerUserId, id),
      eq(referralsTable.referredUserId, id),
    ));
    await tx.delete(kycTable).where(eq(kycTable.userId, id));
    await tx.update(usersTable)
      .set({ kycStatus: "not_verified", updatedAt: new Date() })
      .where(eq(usersTable.id, id));
  });

  await recordSecurityEvent(req, "admin_user_history_reset", id);
  res.json({
    userId: id,
    message: "User history reset. Account, profile, support, and security records were preserved.",
  });
});

router.post("/admin/users/:id/adjust-balance", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = AdminAdjustBalanceBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const amount = parsed.data.amount;
  if (amount === 0) return res.status(400).json({ error: "Amount cannot be zero" });
  const note = parsed.data.note?.trim() || "Admin balance adjustment";

  await db.insert(transactionsTable).values({
    userId: id,
    type: amount >= 0 ? "deposit" : "withdrawal",
    amount: Math.abs(amount).toString(),
    status: "completed",
    paymentMethod: "admin",
    description: note,
  });

  const updated = await getAdminUser(id);
  return res.json(updated);
});

// ---------------- Refund by UID ----------------
router.post("/admin/refund-by-uid", async (req, res) => {
  const { accountUid, amount, note } = req.body as { accountUid?: string; amount?: number; note?: string };
  if (!accountUid || typeof accountUid !== "string") return res.status(400).json({ error: "accountUid required" });
  if (!amount || typeof amount !== "number" || amount <= 0) return res.status(400).json({ error: "amount must be a positive number" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.accountUid, accountUid.trim().toUpperCase())).limit(1);
  if (!user) return res.status(404).json({ error: "No user found with that UID" });

  const desc = (note?.trim() || `Refund by admin`);
  await db.insert(transactionsTable).values({
    userId: user.id,
    type: "deposit",
    amount: amount.toFixed(2),
    status: "completed",
    paymentMethod: "admin",
    description: desc,
  });

  const updated = await getAdminUser(user.id);
  return res.json(updated);
});

// ---------------- KYC ----------------
router.get("/admin/kyc", async (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = await db
    .select({ kyc: kycTable, user: usersTable })
    .from(kycTable)
    .innerJoin(usersTable, eq(kycTable.userId, usersTable.id))
    .orderBy(desc(kycTable.submittedAt));

  let result = rows.map((r) => ({
    userId: r.kyc.userId,
    fullName: r.user.fullName,
    email: r.user.email,
    status: r.kyc.status,
    documentType: r.kyc.documentType,
    documentFrontUrl: r.kyc.documentFrontUrl,
    selfieUrl: r.kyc.selfieUrl,
    submittedAt: r.kyc.submittedAt ? r.kyc.submittedAt.toISOString() : null,
  }));
  if (status && status !== "all") {
    result = status === "pending" ? result.filter((r) => KYC_PENDING.includes(r.status)) : result.filter((r) => r.status === status);
  }
  return res.json(result);
});

router.post("/admin/kyc/:userId/review", async (req, res) => {
  const userId = Number(req.params.userId);
  if (Number.isNaN(userId)) return res.status(400).json({ error: "Invalid id" });
  const parsed = AdminReviewKycBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const approve = parsed.data.action === "approve";
  const newStatus = approve ? "verified" : "rejected";
  await db
    .update(kycTable)
    .set({ status: newStatus, rejectionReason: approve ? null : parsed.data.reason ?? null, reviewedAt: new Date() })
    .where(eq(kycTable.userId, userId));
  await db.update(usersTable).set({ kycStatus: newStatus }).where(eq(usersTable.id, userId));

  await db.insert(notificationsTable).values({
    userId,
    type: "kyc",
    title: approve ? "KYC Verified ✓" : "KYC Rejected",
    message: approve
      ? "Your identity verification has been approved. You now have full access to all features."
      : `Your KYC submission was rejected. Reason: ${parsed.data.reason ?? "Please resubmit with clearer documents."}`,
  });

  const [row] = await db
    .select({ kyc: kycTable, user: usersTable })
    .from(kycTable)
    .innerJoin(usersTable, eq(kycTable.userId, usersTable.id))
    .where(eq(kycTable.userId, userId))
    .limit(1);
  if (!row) return res.status(404).json({ error: "KYC not found" });
  return res.json({
    userId: row.kyc.userId,
    fullName: row.user.fullName,
    email: row.user.email,
    status: row.kyc.status,
    documentType: row.kyc.documentType,
    documentFrontUrl: row.kyc.documentFrontUrl,
    selfieUrl: row.kyc.selfieUrl,
    submittedAt: row.kyc.submittedAt ? row.kyc.submittedAt.toISOString() : null,
  });
});

// ---------------- Bots ----------------
async function mapBots() {
  const [bots, userBotStats] = await Promise.all([
    db.select().from(botsTable).orderBy(desc(botsTable.createdAt)),
    db.select({
      botId: userBotsTable.botId,
      activeUsers: sql<number>`count(*)::int`,
      totalProfit: sql<string>`coalesce(sum(${userBotsTable.profitTotal}), 0)`,
    }).from(userBotsTable).groupBy(userBotsTable.botId),
  ]);
  const statsByBot = new Map(userBotStats.map((row) => [row.botId, row]));
  return bots.map((b) => ({
    id: b.id,
    name: b.name,
    description: b.description,
    category: b.category,
    riskLevel: b.riskLevel,
    price: parseFloat(b.price),
    monthlyReturn: parseFloat(b.monthlyReturn),
    winRate: parseFloat(b.winRate),
    minInvestment: parseFloat(b.minInvestment),
    iconUrl: b.iconUrl,
    isActive: b.isMarketplace,
    activeUsers: Number(statsByBot.get(b.id)?.activeUsers ?? 0),
    totalProfit: Math.round(Number(statsByBot.get(b.id)?.totalProfit ?? 0) * 100) / 100,
    createdAt: b.createdAt.toISOString(),
  }));
}

async function mapOneBot(id: number) {
  const all = await mapBots();
  return all.find((b) => b.id === id) ?? null;
}

router.get("/admin/bots", async (_req, res) => {
  return res.json(await mapBots());
});

router.post("/admin/bots", async (req, res) => {
  const parsed = AdminCreateBotBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const d = parsed.data;
  const [bot] = await db
    .insert(botsTable)
    .values({
      name: d.name,
      description: d.description,
      category: d.category,
      riskLevel: d.riskLevel,
      price: d.price.toString(),
      winRate: d.winRate.toString(),
      monthlyReturn: (d.monthlyReturn ?? 0).toString(),
      minInvestment: (d.minInvestment ?? 0).toString(),
      iconUrl: d.iconUrl ?? null,
      isMarketplace: d.isActive ?? true,
    })
    .returning();
  const mapped = await mapOneBot(bot.id);
  return res.status(201).json(mapped);
});

router.patch("/admin/bots/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = AdminUpdateBotBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const d = parsed.data;

  const update: Record<string, unknown> = {};
  if (d.name !== undefined) update.name = d.name;
  if (d.description !== undefined) update.description = d.description;
  if (d.category !== undefined) update.category = d.category;
  if (d.riskLevel !== undefined) update.riskLevel = d.riskLevel;
  if (d.price !== undefined) update.price = d.price.toString();
  if (d.winRate !== undefined) update.winRate = d.winRate.toString();
  if (d.monthlyReturn !== undefined) update.monthlyReturn = d.monthlyReturn.toString();
  if (d.minInvestment !== undefined) update.minInvestment = d.minInvestment.toString();
  if (d.iconUrl !== undefined) update.iconUrl = d.iconUrl;
  if (d.isActive !== undefined) update.isMarketplace = d.isActive;

  if (Object.keys(update).length > 0) {
    await db.update(botsTable).set(update).where(eq(botsTable.id, id));
  }
  const mapped = await mapOneBot(id);
  if (!mapped) return res.status(404).json({ error: "Bot not found" });
  return res.json(mapped);
});

router.delete("/admin/bots/:id", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db.delete(userBotsTable).where(eq(userBotsTable.botId, id));
  await db.delete(botsTable).where(eq(botsTable.id, id));
  return res.json({ message: "Bot deleted" });
});

router.post("/admin/bots/:id/toggle", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, id)).limit(1);
  if (!bot) return res.status(404).json({ error: "Bot not found" });
  await db.update(botsTable).set({ isMarketplace: !bot.isMarketplace }).where(eq(botsTable.id, id));
  const mapped = await mapOneBot(id);
  return res.json(mapped);
});

router.post("/admin/bots/:id/assign", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = AdminAssignBotBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const [bot] = await db.select().from(botsTable).where(eq(botsTable.id, id)).limit(1);
  if (!bot) return res.status(404).json({ error: "Bot not found" });
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, parsed.data.userId)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  await db.insert(userBotsTable).values({
    userId: parsed.data.userId,
    botId: id,
    status: "running",
    startedAt: new Date(),
  });
  return res.json({ message: "Bot assigned" });
});

// ---------------- Transactions ----------------
function mapTxnRow(t: typeof transactionsTable.$inferSelect, u: typeof usersTable.$inferSelect | null) {
  // Preserve the historical network label from each transaction's payment method.
  const network = t.paymentMethod?.match(/\(([^)]+)\)/)?.[1] ?? null;
  return {
    id: t.id,
    userId: t.userId,
    userName: u?.fullName ?? "Unknown",
    userEmail: u?.email ?? "",
    type: t.type,
    amount: parseFloat(t.amount),
    status: t.status,
    paymentMethod: t.paymentMethod,
    network,
    walletAddress: t.walletAddress,
    description: t.description,
    createdAt: t.createdAt.toISOString(),
    cryptoAmount: t.cryptoAmount ? parseFloat(t.cryptoAmount) : null,
    cryptoAsset: t.cryptoAsset,
    conversionRate: t.conversionRate ? parseFloat(t.conversionRate) : null,
  };
}

router.get("/admin/transactions", async (req, res) => {
  const type = req.query.type as string | undefined;
  const status = req.query.status as string | undefined;
  const requestedLimit = Number.parseInt(String(req.query.limit ?? "200"), 10);
  const requestedOffset = Number.parseInt(String(req.query.offset ?? "0"), 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(500, Math.max(1, requestedLimit)) : 200;
  const offset = Number.isFinite(requestedOffset) ? Math.min(1_000_000, Math.max(0, requestedOffset)) : 0;
  const filters = [];
  if (type && type !== "all") filters.push(eq(transactionsTable.type, type));
  if (status && status !== "all") filters.push(eq(transactionsTable.status, status));

  const [[{ total }], rows] = await Promise.all([
    db.select({ total: sql<number>`count(*)::int` })
      .from(transactionsTable)
      .where(filters.length > 0 ? and(...filters) : undefined),
    db
      .select({ txn: transactionsTable, user: usersTable })
      .from(transactionsTable)
      .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
      .where(filters.length > 0 ? and(...filters) : undefined)
      .orderBy(desc(transactionsTable.createdAt))
      .limit(limit)
      .offset(offset),
  ]);
  res.setHeader("X-Total-Count", String(Number(total ?? 0)));
  return res.json(rows.map((r) => mapTxnRow(r.txn, r.user)));
});

router.get("/admin/referrals", async (_req, res) => {
  const referrals = await db.select().from(referralsTable).orderBy(desc(referralsTable.createdAt));
  const userIds = Array.from(new Set(referrals.flatMap((referral) => [referral.referrerUserId, referral.referredUserId])));
  if (userIds.length === 0) return res.json([]);
  const [users, profiles, vipPurchases] = await Promise.all([
    db.select().from(usersTable).where(inArray(usersTable.id, userIds)),
    db.select().from(userProfilesTable).where(inArray(userProfilesTable.userId, userIds)),
    db.select({
      userId: vipPackagePurchasesTable.userId,
      vipLevel: vipPackagePurchasesTable.vipLevel,
    }).from(vipPackagePurchasesTable).where(and(
      inArray(vipPackagePurchasesTable.userId, userIds),
      eq(vipPackagePurchasesTable.status, "completed"),
    )).orderBy(desc(vipPackagePurchasesTable.vipLevel)),
  ]);
  const userMap = new Map(users.map((user) => [user.id, user]));
  const profileMap = new Map(profiles.map((profile) => [profile.userId, profile]));
  const vipLevelMap = new Map<number, number>();
  for (const purchase of vipPurchases) {
    if (!vipLevelMap.has(purchase.userId)) vipLevelMap.set(purchase.userId, purchase.vipLevel);
  }
  return res.json(referrals.map((referral) => {
    const referrer = userMap.get(referral.referrerUserId);
    const referred = userMap.get(referral.referredUserId);
    const referredProfile = profileMap.get(referral.referredUserId);
    const currentVipLevel = vipLevelMap.get(referral.referredUserId) ?? 0;
    return {
    id: referral.id,
    referrerName: referrer?.fullName ?? "Unknown",
    referrerEmail: referrer?.email ?? "",
    referredName: referred?.fullName ?? "Unknown",
    referredPhone: referredProfile?.phone ?? null,
    referredCountry: referredProfile?.country ?? null,
    currentVipLevel,
    activityStatus: currentVipLevel >= 1 ? "active" : "inactive",
    status: referral.status,
    bonusAmount: Number(referral.bonusAmount),
    reservedAmount: Number(referral.reservedAmount),
    createdAt: referral.createdAt.toISOString(),
    creditedAt: referral.creditedAt?.toISOString() ?? null,
    };
  }));
});

router.post("/admin/transactions/:id/review", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = AdminReviewTransactionBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const newStatus = parsed.data.action === "approve" ? "completed" : "rejected";
  await db.update(transactionsTable).set({ status: newStatus }).where(eq(transactionsTable.id, id));

  const [row] = await db
    .select({ txn: transactionsTable, user: usersTable })
    .from(transactionsTable)
    .leftJoin(usersTable, eq(transactionsTable.userId, usersTable.id))
    .where(eq(transactionsTable.id, id))
    .limit(1);
  if (!row) return res.status(404).json({ error: "Transaction not found" });
  return res.json(mapTxnRow(row.txn, row.user));
});

// ---------------- Deposit Sessions ----------------
function mapDepositSession(
  s: typeof depositSessionsTable.$inferSelect,
  u: typeof usersTable.$inferSelect | null
) {
  return {
    id: s.id,
    userId: s.userId,
    userName: u?.fullName ?? "Unknown",
    userEmail: u?.email ?? "",
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

router.get("/admin/deposit-sessions", async (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = await db
    .select({ session: depositSessionsTable, user: usersTable })
    .from(depositSessionsTable)
    .leftJoin(usersTable, eq(depositSessionsTable.userId, usersTable.id))
    .orderBy(desc(depositSessionsTable.createdAt));

  let result = rows.map((r) => mapDepositSession(r.session, r.user));
  if (status && status !== "all") result = result.filter((s) => s.status === status);
  return res.json(result);
});

router.post("/admin/deposit-sessions/:id/review", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const { action, confirmations } = req.body as { action?: string; confirmations?: number };
  if (!action) return res.status(400).json({ error: "action is required" });

  const sessions = await db.select().from(depositSessionsTable).where(eq(depositSessionsTable.id, id)).limit(1);
  if (!sessions[0]) return res.status(404).json({ error: "Deposit session not found" });
  const session = sessions[0];

  if (action === "detect") {
    await db.update(depositSessionsTable)
      .set({ status: "payment_detected", updatedAt: new Date() })
      .where(eq(depositSessionsTable.id, id));
  } else if (action === "update_confirmations") {
    const count = Number(confirmations ?? 0);
    const newStatus = count >= session.requiredConfirmations ? "confirming" : session.status === "payment_detected" ? "confirming" : session.status;
    await db.update(depositSessionsTable)
      .set({ confirmations: count, status: newStatus, updatedAt: new Date() })
      .where(eq(depositSessionsTable.id, id));
  } else if (action === "approve") {
    // Credit the user by creating a completed deposit transaction (balance is derived from transactions)
    const [txn] = await db.insert(transactionsTable).values({
      userId: session.userId,
      type: "deposit",
      amount: session.amount,
      status: "completed",
      paymentMethod: session.paymentMethodName,
      walletAddress: session.depositAddress,
      description: `Crypto deposit via ${session.paymentMethodName}`,
    }).returning();
    await db.update(depositSessionsTable)
      .set({ status: "completed", transactionId: txn.id, confirmations: session.requiredConfirmations, updatedAt: new Date() })
      .where(eq(depositSessionsTable.id, id));
  } else if (action === "reject") {
    await db.update(depositSessionsTable)
      .set({ status: "failed", updatedAt: new Date() })
      .where(eq(depositSessionsTable.id, id));
  } else {
    return res.status(400).json({ error: "Unknown action" });
  }

  const [row] = await db
    .select({ session: depositSessionsTable, user: usersTable })
    .from(depositSessionsTable)
    .leftJoin(usersTable, eq(depositSessionsTable.userId, usersTable.id))
    .where(eq(depositSessionsTable.id, id))
    .limit(1);
  if (!row) return res.status(404).json({ error: "Not found" });
  return res.json(mapDepositSession(row.session, row.user));
});

// ---------------- Tickets ----------------
function mapTicketRow(t: typeof supportTicketsTable.$inferSelect, u: typeof usersTable.$inferSelect | null) {
  return {
    id: t.id,
    userId: t.userId,
    userName: u?.fullName ?? "Unknown",
    userEmail: u?.email ?? "",
    subject: t.subject,
    message: t.message,
    category: t.category,
    status: t.status,
    adminReply: t.adminReply,
    createdAt: t.createdAt.toISOString(),
    repliedAt: t.repliedAt ? t.repliedAt.toISOString() : null,
  };
}

router.get("/admin/tickets", async (req, res) => {
  const status = req.query.status as string | undefined;
  const rows = await db
    .select({ ticket: supportTicketsTable, user: usersTable })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .orderBy(desc(supportTicketsTable.createdAt));

  let result = rows.map((r) => mapTicketRow(r.ticket, r.user));
  if (status && status !== "all") result = result.filter((t) => t.status === status);
  return res.json(result);
});

router.post("/admin/tickets/:id/reply", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = AdminReplyTicketBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  const [ticket] = await db.select().from(supportTicketsTable).where(eq(supportTicketsTable.id, id)).limit(1);
  if (!ticket) return res.status(404).json({ error: "Ticket not found" });

  await db
    .update(supportTicketsTable)
    .set({ adminReply: parsed.data.reply, repliedAt: new Date(), status: "answered", updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));

  // Notify the user of the reply
  await db.insert(notificationsTable).values({
    userId: ticket.userId,
    type: "support",
    title: `Reply to: ${ticket.subject}`,
    message: parsed.data.reply,
  });

  const [row] = await db
    .select({ ticket: supportTicketsTable, user: usersTable })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .where(eq(supportTicketsTable.id, id))
    .limit(1);
  return res.json(mapTicketRow(row!.ticket, row!.user));
});

router.post("/admin/tickets/:id/close", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  await db
    .update(supportTicketsTable)
    .set({ status: "closed", updatedAt: new Date() })
    .where(eq(supportTicketsTable.id, id));
  const [row] = await db
    .select({ ticket: supportTicketsTable, user: usersTable })
    .from(supportTicketsTable)
    .leftJoin(usersTable, eq(supportTicketsTable.userId, usersTable.id))
    .where(eq(supportTicketsTable.id, id))
    .limit(1);
  if (!row) return res.status(404).json({ error: "Ticket not found" });
  return res.json(mapTicketRow(row.ticket, row.user));
});

// ---------------- Settings ----------------
async function getOrCreateSettings() {
  const rows = await db.select().from(settingsTable).limit(1);
  if (rows.length > 0) {
    const current = rows[0];
    const methods = current.paymentMethods ?? [];
    const isCanonical =
      methods.length === 1 &&
      methods[0]?.id === BSC_PAYMENT_METHOD_SETTINGS.id &&
      methods[0]?.name === BSC_PAYMENT_METHOD_SETTINGS.name &&
      methods[0]?.network === BSC_PAYMENT_METHOD_SETTINGS.network &&
      methods[0]?.address === BSC_PAYMENT_METHOD_SETTINGS.address &&
      methods[0]?.enabled === true;
    if (isCanonical) return current;
    const [normalized] = await db
      .update(settingsTable)
      .set({ paymentMethods: [BSC_PAYMENT_METHOD_SETTINGS], updatedAt: new Date() })
      .where(eq(settingsTable.id, current.id))
      .returning();
    return normalized;
  }
  const [created] = await db.insert(settingsTable).values({
    paymentMethods: [BSC_PAYMENT_METHOD_SETTINGS],
  }).returning();
  return created;
}

function mapSettings(s: typeof settingsTable.$inferSelect) {
  return {
    appName: s.appName,
    supportEmail: s.supportEmail,
    logoUrl: s.logoUrl,
    maintenanceMode: s.maintenanceMode,
    withdrawalsEnabled: s.withdrawalsEnabled,
    depositsEnabled: s.depositsEnabled,
    minDeposit: parseFloat(s.minDeposit),
    minWithdrawal: parseFloat(s.minWithdrawal),
     paymentMethods: [BSC_PAYMENT_METHOD_SETTINGS],
    signalsEnabled: s.signalsEnabled,
    signalsEmergencyStop: s.signalsEmergencyStop,
    signalsTimezone: s.signalsTimezone,
    signalTimes: s.signalTimes ?? ["19:00", "21:00", "23:00"],
    signalDailyLimit: s.signalDailyLimit,
    signalSpacingMinutes: s.signalSpacingMinutes,
    signalMaxStakePercent: parseFloat(s.signalMaxStakePercent),
  };
}

router.get("/admin/settings", async (_req, res) => {
  const s = await getOrCreateSettings();
  return res.json(mapSettings(s));
});

router.put("/admin/settings", async (req, res) => {
  const parsed = AdminUpdateSettingsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });
  const d = parsed.data;
  const current = await getOrCreateSettings();
  const previousSignalSettings = {
    signalsEnabled: current.signalsEnabled,
    signalsEmergencyStop: current.signalsEmergencyStop,
    signalsTimezone: current.signalsTimezone,
    signalTimes: current.signalTimes ?? ["19:00", "21:00", "23:00"],
    signalDailyLimit: current.signalDailyLimit,
    signalSpacingMinutes: current.signalSpacingMinutes,
    signalMaxStakePercent: parseFloat(current.signalMaxStakePercent),
  };

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (d.appName !== undefined) update.appName = d.appName;
  if (d.supportEmail !== undefined) update.supportEmail = d.supportEmail;
  if (d.logoUrl !== undefined) update.logoUrl = d.logoUrl;
  if (d.maintenanceMode !== undefined) update.maintenanceMode = d.maintenanceMode;
  if (d.withdrawalsEnabled !== undefined) update.withdrawalsEnabled = d.withdrawalsEnabled;
  if (d.depositsEnabled !== undefined) update.depositsEnabled = d.depositsEnabled;
  if (d.minDeposit !== undefined) update.minDeposit = d.minDeposit.toString();
  if (d.minWithdrawal !== undefined) update.minWithdrawal = d.minWithdrawal.toString();
  // Deposits and withdrawals are intentionally limited to one settlement
  // method. Ignore legacy/admin-supplied alternatives and normalize the stored
  // settings row on every save.
  update.paymentMethods = [BSC_PAYMENT_METHOD_SETTINGS satisfies PaymentMethod];
  if (d.signalsEnabled !== undefined) update.signalsEnabled = d.signalsEnabled;
  if (d.signalsEmergencyStop !== undefined) update.signalsEmergencyStop = d.signalsEmergencyStop;
  if (d.signalsTimezone !== undefined) {
    try { new Intl.DateTimeFormat("en-US", { timeZone: d.signalsTimezone }); }
    catch { return res.status(400).json({ error: "signalsTimezone must be a valid IANA timezone." }); }
    update.signalsTimezone = d.signalsTimezone;
  }
  if (d.signalTimes !== undefined) {
    const times = Array.from(new Set(d.signalTimes)).sort();
    if (times.length < 1 || times.length > 6 || times.some((time) => !/^\d{2}:\d{2}$/.test(time) || Number(time.slice(0, 2)) > 23 || Number(time.slice(3)) > 59)) {
      return res.status(400).json({ error: "Provide between 1 and 6 valid schedule times in HH:MM format." });
    }
    update.signalTimes = times;
  }
  if (d.signalDailyLimit !== undefined) {
    if (!Number.isInteger(d.signalDailyLimit) || d.signalDailyLimit < 1 || d.signalDailyLimit > 20) return res.status(400).json({ error: "Daily signal limit must be between 1 and 20." });
    update.signalDailyLimit = d.signalDailyLimit;
  }
  if (d.signalSpacingMinutes !== undefined) {
    if (!Number.isInteger(d.signalSpacingMinutes) || d.signalSpacingMinutes < 30 || d.signalSpacingMinutes > 1440) return res.status(400).json({ error: "Signal spacing must be between 30 and 1440 minutes." });
    update.signalSpacingMinutes = d.signalSpacingMinutes;
  }
  if (d.signalMaxStakePercent !== undefined) {
    if (d.signalMaxStakePercent < 1 || d.signalMaxStakePercent > 100) return res.status(400).json({ error: "Maximum stake percentage must be between 1 and 100." });
    update.signalMaxStakePercent = d.signalMaxStakePercent.toString();
  }

  await db.update(settingsTable).set(update).where(eq(settingsTable.id, current.id));
  const s = await getOrCreateSettings();
  const nextSignalSettings = {
    signalsEnabled: s.signalsEnabled,
    signalsEmergencyStop: s.signalsEmergencyStop,
    signalsTimezone: s.signalsTimezone,
    signalTimes: s.signalTimes ?? ["19:00", "21:00", "23:00"],
    signalDailyLimit: s.signalDailyLimit,
    signalSpacingMinutes: s.signalSpacingMinutes,
    signalMaxStakePercent: parseFloat(s.signalMaxStakePercent),
  };
  const signalChanged = JSON.stringify(previousSignalSettings) !== JSON.stringify(nextSignalSettings);
  if (signalChanged) {
    const adminToken = getRequestToken(req, ADMIN_SESSION_COOKIE);
    const adminSession = adminToken ? await db.select({ userId: sessionsTable.userId }).from(sessionsTable).where(eq(sessionsTable.token, adminToken)).limit(1) : [];
    if (adminSession[0]) {
      await db.insert(signalScheduleAuditTable).values({
        adminUserId: adminSession[0].userId,
        action: "settings_updated",
        previousSettings: previousSignalSettings,
        nextSettings: nextSignalSettings,
      });
    }
  }
  return res.json(mapSettings(s));
});

router.get("/admin/signal-audit", async (_req, res) => {
  const rows = await db.select().from(signalScheduleAuditTable)
    .orderBy(desc(signalScheduleAuditTable.createdAt))
    .limit(100);
  return res.json(rows.map((row) => ({
    id: row.id,
    adminUserId: row.adminUserId,
    action: row.action,
    previousSettings: row.previousSettings,
    nextSettings: row.nextSettings,
    createdAt: row.createdAt.toISOString(),
  })));
});

// ---------------- Live Chat ----------------
router.get("/admin/chat", async (req, res) => {
  // Latest message per user. A system message is the boundary between
  // conversations, so the full history can remain available without a
  // destructive data migration.
  const result = await db.execute(sql`
    WITH latest AS (
      SELECT DISTINCT ON (cm.user_id)
        cm.user_id,
        cm.sender,
        cm.message,
        cm.created_at
      FROM chat_messages cm
      ORDER BY cm.user_id, cm.created_at DESC, cm.id DESC
    )
    SELECT
      latest.user_id,
      u.full_name,
      u.email,
      latest.sender AS last_sender,
      latest.message AS last_message,
      latest.created_at AS last_message_at,
      CASE WHEN latest.sender = 'system' THEN 'closed' ELSE 'open' END AS status,
      CASE WHEN latest.sender = 'user' THEN true ELSE false END AS pending_reply,
      CASE WHEN latest.sender = 'user' THEN (
        SELECT COUNT(*) FROM chat_messages cm2
        WHERE cm2.user_id = latest.user_id
          AND cm2.sender = 'user'
          AND cm2.created_at > GREATEST(
            COALESCE((SELECT MAX(cm3.created_at) FROM chat_messages cm3 WHERE cm3.user_id = latest.user_id AND cm3.sender = 'admin'), TIMESTAMP '1970-01-01'),
            COALESCE((SELECT MAX(cm4.created_at) FROM chat_messages cm4 WHERE cm4.user_id = latest.user_id AND cm4.sender = 'system'), TIMESTAMP '1970-01-01')
          )
      ) ELSE 0 END AS unread_count
    FROM latest
    JOIN users u ON u.id = latest.user_id
    ORDER BY latest.created_at DESC
  `);

  const rows = Array.isArray(result) ? result : (result as any).rows ?? [];
  return res.json(rows.map((r: any) => ({
    userId: Number(r.user_id),
    userName: r.full_name,
    userEmail: r.email,
    lastMessage: r.last_message,
    lastMessageAt: new Date(r.last_message_at).toISOString(),
    unreadCount: Number(r.unread_count),
    status: r.status,
    pendingReply: Boolean(r.pending_reply),
  })));
});

router.get("/admin/chat/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid user id" });

  const messages = await db.select().from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, userId))
    .orderBy(chatMessagesTable.createdAt);

  return res.json(messages.map(m => ({
    id: m.id,
    sender: m.sender,
    message: m.message,
    createdAt: m.createdAt.toISOString(),
  })));
});

router.post("/admin/chat/:userId/close", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid user id" });

  const [targetUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!targetUser) return res.status(404).json({ error: "User not found" });

  const [latestMessage] = await db.select({
    sender: chatMessagesTable.sender,
    createdAt: chatMessagesTable.createdAt,
  }).from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, userId))
    .orderBy(desc(chatMessagesTable.createdAt), desc(chatMessagesTable.id))
    .limit(1);

  if (!latestMessage) {
    return res.status(400).json({ error: "Cannot close a conversation with no messages" });
  }

  if (latestMessage.sender === "system") {
    return res.json({
      status: "closed",
      closedAt: latestMessage.createdAt.toISOString(),
    });
  }

  const closedMessage = await db.transaction(async (tx) => {
    const [createdMessage] = await tx.insert(chatMessagesTable).values({
      userId,
      sender: "system",
      message: "This conversation was closed by VIXUS Support. Start a new conversation if you need more help.",
    }).returning();

    await tx.insert(notificationsTable).values({
      userId,
      type: "support_closed",
      title: "Support conversation closed",
      message: "Your VIXUS Support conversation was closed. Start a new conversation if you still need help.",
      isRead: false,
    });

    return createdMessage;
  });

  return res.json({
    status: "closed",
    closedAt: closedMessage.createdAt.toISOString(),
  });
});

router.post("/admin/chat/:userId", async (req, res) => {
  const userId = parseInt(req.params.userId, 10);
  if (isNaN(userId)) return res.status(400).json({ error: "Invalid user id" });

  const { message } = req.body as { message?: string };
  const trimmedMessage = typeof message === "string" ? message.trim() : "";
  if (!trimmedMessage) {
    return res.status(400).json({ error: "message is required" });
  }
  if (trimmedMessage.length > 2000) {
    return res.status(400).json({ error: "message must be 2000 characters or fewer" });
  }

  const [targetUser] = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!targetUser) return res.status(404).json({ error: "User not found" });

  const [latestMessage] = await db.select({
    sender: chatMessagesTable.sender,
  }).from(chatMessagesTable)
    .where(eq(chatMessagesTable.userId, userId))
    .orderBy(desc(chatMessagesTable.createdAt), desc(chatMessagesTable.id))
    .limit(1);
  if (latestMessage?.sender === "system") {
    return res.status(409).json({
      code: "CHAT_CLOSED",
      error: "This conversation is closed. The user must start a new conversation before you can reply.",
    });
  }

  const msg = await db.transaction(async (tx) => {
    const [createdMessage] = await tx.insert(chatMessagesTable).values({
      userId,
      sender: "admin",
      message: trimmedMessage,
    }).returning();

    await tx.insert(notificationsTable).values({
      userId,
      type: "admin_message",
      title: "Message from VIXUS Support",
      message: trimmedMessage,
      isRead: false,
    });

    return createdMessage;
  });

  return res.status(201).json({
    id: msg.id,
    sender: msg.sender,
    message: msg.message,
    createdAt: msg.createdAt.toISOString(),
  });
});

// ---------------- Admin Login ----------------
// Seed admins are auto-promoted on first login — no manual DB step needed.
const ADMIN_USERNAME = "admin.vixus-ai";
// The production panel password is injected as an encrypted deployment secret.
// Keep the development fallback only for local/test environments.
const ADMIN_PASSWORD = process.env.ADMIN_PANEL_PASSWORD;
if (process.env.NODE_ENV === "production" && !ADMIN_PASSWORD) {
  throw new Error("ADMIN_PANEL_PASSWORD must be configured in production.");
}
const SEED_ADMIN_EMAILS = ["admin@vixus.ai"];

router.post("/admin/login", async (req, res) => {
  const ipLimit = await consumeRateLimit({
    key: `admin-login:ip:${requestIp(req)}`,
    limit: 8,
    windowMs: 15 * 60 * 1000,
    blockMs: 30 * 60 * 1000,
  });
  if (rejectRateLimited(res, ipLimit)) return;

  const { email, username, password } = req.body ?? {};

  if (!email || !username || !password)
    return res.status(400).json({ error: "Email, username and password are required." });

  if (username !== ADMIN_USERNAME)
    return res.status(401).json({ error: "Invalid credentials. Access denied." });

  const normalised = String(email).toLowerCase().trim();
  const [user] = await db.select().from(usersTable)
    .where(eq(usersTable.email, normalised))
    .limit(1);

  if (!user)
    return res.status(403).json({ error: "No account found with that email. Sign up on the platform first." });
  if (user.status !== "active")
    return res.status(403).json({ error: "Your account has been suspended. Contact support." });

  // The panel password is a server-controlled master credential. Seeded and
  // promoted admins may also use the password stored on their own account,
  // which keeps admin access working when only the account password was
  // configured during setup.
  const panelPasswordMatches = Boolean(ADMIN_PASSWORD && safeEqualStrings(String(password), ADMIN_PASSWORD));
  const accountVerification = await verifyPassword(String(password), user.passwordHash);
  const accountPasswordMatches = accountVerification.valid;
  if (!panelPasswordMatches && !accountPasswordMatches)
    {
    await recordSecurityEvent(req, "admin_login_failed", user.id, { reason: "invalid_credentials" });
    return res.status(401).json({ error: "Invalid credentials. Access denied." });
    }

  if (accountVerification.needsRehash) {
    await db.update(usersTable)
      .set({ passwordHash: await hashPassword(String(password)), updatedAt: new Date() })
      .where(eq(usersTable.id, user.id));
  }

  // Auto-promote seed admins on first login if not already promoted.
  if (!user.isAdmin && SEED_ADMIN_EMAILS.includes(normalised)) {
    await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, user.id));
    user.isAdmin = true;
  }

  if (!user.isAdmin)
    return res.status(403).json({ error: "You have not been granted admin access. Contact the platform owner." });

  const token = createAdminToken(user.id);
  await db.insert(sessionsTable).values({
    userId: user.id,
    token,
    device: "Admin Browser",
    ip: (req.ip || "0.0.0.0").replace("::ffff:", ""),
    location: "Unknown",
  });
  setAdminSessionCookie(res, token);
  await recordSecurityEvent(req, "admin_login_succeeded", user.id);
  return res.json({ ok: true, name: user.fullName });
});

// ---------------- Promote / Demote Admin ----------------
router.post("/admin/users/:id/promote", async (req, res) => {
  const id = Number(req.params.id);
  if (Number.isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
  if (!user) return res.status(404).json({ error: "User not found" });

  const next = !user.isAdmin;
  await db.update(usersTable).set({ isAdmin: next }).where(eq(usersTable.id, id));
  return res.json({ ok: true, isAdmin: next });
});

// ---------------- Broadcast ----------------
router.post("/admin/broadcast", async (req, res) => {
  const parsed = AdminBroadcastBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: "Invalid input" });

  // Keep the million-user fan-out inside PostgreSQL. Loading every user id
  // into the API process creates avoidable memory pressure and a giant
  // parameterized INSERT.
  const fanout = await db.execute(sql`
    insert into ${notificationsTable} ("user_id", "type", "title", "message")
    select ${usersTable.id}, 'announcement', ${parsed.data.title}, ${parsed.data.message}
    from ${usersTable}
  `);
  const recipientCount = Number(fanout.rowCount ?? 0);

  // Log the broadcast (non-fatal — table may not exist yet on first deploy)
  try {
    await db.insert(broadcastsTable).values({
      title: parsed.data.title,
      message: parsed.data.message,
      recipientCount,
    });
  } catch (_e) {
    // broadcastsTable migration pending — log only, notification already sent
  }

  return res.json({ message: `Broadcast sent to ${recipientCount} users` });
});

router.get("/admin/broadcasts", async (_req, res) => {
  // Derive broadcast history by grouping announcement notifications.
  // Each broadcast creates one notification per user; we collapse them here.
  const rows = await db
    .select({
      id:             sql<number>`min(${notificationsTable.id})`,
      title:          notificationsTable.title,
      message:        notificationsTable.message,
      recipientCount: sql<number>`count(*)`,
      createdAt:      sql<string>`min(${notificationsTable.createdAt})`,
    })
    .from(notificationsTable)
    .where(eq(notificationsTable.type, "announcement"))
    .groupBy(notificationsTable.title, notificationsTable.message)
    .orderBy(sql`min(${notificationsTable.createdAt}) desc`);

  return res.json(rows.map(r => ({
    id:             r.id,
    title:          r.title,
    message:        r.message,
    recipientCount: Number(r.recipientCount),
    createdAt:      String(r.createdAt),
  })));
});

router.delete("/admin/broadcasts/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });

  // Look up title+message from the representative notification row
  const anchor = await db
    .select({ title: notificationsTable.title, message: notificationsTable.message })
    .from(notificationsTable)
    .where(eq(notificationsTable.id, id))
    .limit(1);

  if (!anchor.length) return res.status(404).json({ error: "Not found" });

  const { title, message } = anchor[0];

  // Delete all user-facing notifications for this broadcast
  await db.delete(notificationsTable).where(
    and(
      eq(notificationsTable.type, "announcement"),
      eq(notificationsTable.title, title),
      eq(notificationsTable.message, message),
    ),
  );

  // Also clean up broadcastsTable log if it exists (best-effort)
  try {
    await db.delete(broadcastsTable).where(
      and(eq(broadcastsTable.title, title), eq(broadcastsTable.message, message)),
    );
  } catch (_e) { /* table may not exist yet — ignore */ }

  return res.json({ message: "Broadcast deleted" });
});

// ─── Web Push Subscriptions ───────────────────────────────────────────────────

router.get("/admin/push/vapid-public-key", (_req, res) => {
  return res.json({ publicKey: VAPID_PUBLIC_KEY });
});

router.post("/admin/push/subscribe", async (req, res) => {
  const { endpoint, keys } = req.body ?? {};
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return res.status(400).json({ error: "Invalid subscription" });
  }

  try {
    await db.execute(sql`
      INSERT INTO admin_push_subscriptions (endpoint, p256dh, auth)
      VALUES (${endpoint}, ${keys.p256dh}, ${keys.auth})
      ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
    `);
    return res.json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Failed to save push subscription");
    return res.status(500).json({ error: "Failed to save subscription" });
  }
});

router.delete("/admin/push/subscribe", async (req, res) => {
  const { endpoint } = req.body ?? {};
  if (!endpoint) return res.status(400).json({ error: "Endpoint required" });

  try {
    await db.execute(sql`DELETE FROM admin_push_subscriptions WHERE endpoint = ${endpoint}`);
    return res.json({ ok: true });
  } catch {
    return res.status(500).json({ error: "Failed to remove subscription" });
  }
});

export default router;
