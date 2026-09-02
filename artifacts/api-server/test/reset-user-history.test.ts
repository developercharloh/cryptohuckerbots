import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.ADMIN_PANEL_PASSWORD = "reset-history-admin-password";
process.env.ADMIN_JWT_SECRET = "reset-history-admin-jwt-secret";

const { default: app } = await import("../src/app.ts");
const database = await import("@workspace/db");
const drizzle = await import("drizzle-orm");
const {
  db,
  pool,
  sql,
  eq,
  adminLoginNotificationsTable,
  authRateLimitsTable,
  depositSessionsTable,
  earningsTable,
  kycTable,
  notificationsTable,
  notificationSettingsTable,
  positionsTable,
  referralsTable,
  sessionsTable,
  signalClaimsTable,
  transactionsTable,
  userBotsTable,
  usersTable,
  vipInvestmentCapitalTable,
  vipPackagePurchasesTable,
} = {
  ...database,
  ...drizzle,
};

const origin = "https://vixus.trade";
const password = "ResetHistoryTestPassword1!";
const suffix = `${Date.now()}-${process.pid}`;
const adminEmail = `reset-history-admin-${suffix}@example.test`;
const userEmail = `reset-history-user-${suffix}@example.test`;

class CookieJar {
  private readonly cookies = new Map<string, string>();

  absorb(response: Response): void {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const values = headers.getSetCookie?.() ??
      (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
    for (const value of values) {
      const separator = value.indexOf("=");
      if (separator < 0) continue;
      const name = value.slice(0, separator);
      const cookieValue = value.slice(separator + 1).split(";", 1)[0];
      if (!cookieValue || value.toLowerCase().includes("max-age=0")) this.cookies.delete(name);
      else this.cookies.set(name, cookieValue);
    }
  }

  header(): string | undefined {
    return this.cookies.size
      ? [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ")
      : undefined;
  }
}

let server: Server;
let baseUrl: string;
let adminUserId = 0;
let targetUserId = 0;
let databaseAvailable = false;
const adminJar = new CookieJar();

async function request<T = any>(
  path: string,
  options: { method?: string; body?: unknown; cookieJar?: CookieJar } = {},
) {
  const headers = new Headers({ Origin: origin });
  const cookieJar = options.cookieJar ?? adminJar;
  const cookie = cookieJar.header();
  if (cookie) headers.set("Cookie", cookie);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  cookieJar.absorb(response);
  const raw = await response.text();
  return { response, body: raw ? JSON.parse(raw) as T : undefined };
}

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  const status = await db.execute(sql`select to_regclass('public.users') as table_name`);
  if (!status.rows[0]?.table_name) return;
  await db.delete(authRateLimitsTable);

  const adminRegistration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Reset History Admin",
      email: adminEmail,
      password,
      country: "Kenya",
      phone: "+254700000001",
    },
  });
  assert.equal(adminRegistration.response.status, 201);
  adminUserId = adminRegistration.body.user.id;
  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, adminUserId));

  const userRegistration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Reset History User",
      email: userEmail,
      password,
      country: "Kenya",
      phone: "+254700000002",
    },
  });
  assert.equal(userRegistration.response.status, 201);
  targetUserId = userRegistration.body.user.id;

  const adminLogin = await request("/api/admin/login", {
    method: "POST",
    body: {
      email: adminEmail,
      username: "admin.vixus-ai",
      password: "reset-history-admin-password",
    },
  });
  assert.equal(adminLogin.response.status, 200);
  databaseAvailable = true;
});

after(async () => {
  if (targetUserId) {
    await db.delete(signalClaimsTable).where(eq(signalClaimsTable.userId, targetUserId));
    await db.delete(positionsTable).where(eq(positionsTable.userId, targetUserId));
    await db.delete(userBotsTable).where(eq(userBotsTable.userId, targetUserId));
    await db.delete(transactionsTable).where(eq(transactionsTable.userId, targetUserId));
    await db.delete(earningsTable).where(eq(earningsTable.userId, targetUserId));
    await db.delete(vipPackagePurchasesTable).where(eq(vipPackagePurchasesTable.userId, targetUserId));
    await db.delete(vipInvestmentCapitalTable).where(eq(vipInvestmentCapitalTable.userId, targetUserId));
    await db.delete(depositSessionsTable).where(eq(depositSessionsTable.userId, targetUserId));
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, targetUserId));
    await db.delete(referralsTable).where(eq(referralsTable.referredUserId, targetUserId));
    await db.delete(kycTable).where(eq(kycTable.userId, targetUserId));
  }
  for (const userId of [adminUserId, targetUserId]) {
    if (!userId) continue;
    await db.delete(adminLoginNotificationsTable).where(eq(adminLoginNotificationsTable.userId, userId));
    await db.delete(notificationSettingsTable).where(eq(notificationSettingsTable.userId, userId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  }
  await pool.end();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("admin history reset preserves the account while clearing financial, activity, referral, and KYC state", async (t) => {
  if (!databaseAvailable) {
    t.skip("requires a provisioned PostgreSQL test schema");
    return;
  }

  await db.insert(transactionsTable).values({
    userId: targetUserId,
    type: "deposit",
    amount: "350",
    status: "completed",
    paymentMethod: "USDT (TRC20)",
  });
  await db.insert(earningsTable).values({ userId: targetUserId, amount: "25", source: "test" });
  await db.insert(userBotsTable).values({ userId: targetUserId, botId: 1, status: "running" });
  await db.insert(positionsTable).values({
    userId: targetUserId,
    botId: 1,
    botName: "Test Bot",
    signalId: `reset-history-${suffix}`,
    pair: "BTC/USD",
    direction: "buy",
    market: "crypto",
    stake: "10",
    targetProfit: "2.25",
    stopLoss: "0",
  });
  await db.insert(signalClaimsTable).values({
    userId: targetUserId,
    opportunityId: 1,
    consentAt: new Date(),
  });
  await db.insert(vipPackagePurchasesTable).values({
    userId: targetUserId,
    vipLevel: 1,
    amount: "350",
    status: "completed",
  });
  await db.insert(vipInvestmentCapitalTable).values({
    userId: targetUserId,
    vipLevel: 1,
    amount: "350",
    status: "locked",
  });
  await db.insert(depositSessionsTable).values({
    userId: targetUserId,
    amount: "350",
    paymentMethodId: "usdt-trc20",
    paymentMethodName: "USDT (TRC20)",
    network: "TRC20",
    depositAddress: "test-address",
    expiresAt: new Date(Date.now() + 60_000),
  });
  await db.insert(notificationsTable).values({
    userId: targetUserId,
    type: "test",
    title: "Test notification",
    message: "Test notification",
  });
  await db.insert(referralsTable).values({
    referrerUserId: adminUserId,
    referredUserId: targetUserId,
    status: "credited",
    bonusAmount: "20",
    reservedAmount: "0",
  });
  await db.update(kycTable)
    .set({ status: "verified", documentType: "passport" })
    .where(eq(kycTable.userId, targetUserId));
  await db.update(usersTable).set({ kycStatus: "verified" }).where(eq(usersTable.id, targetUserId));

  const reset = await request<{ userId: number; message: string }>(
    `/api/admin/users/${targetUserId}/reset-history`,
    { method: "POST" },
  );
  assert.equal(reset.response.status, 200);
  assert.equal(reset.body.userId, targetUserId);

  const detail = await request<{
    kycStatus: string;
    mainWalletBalance: number;
    vaultCapital: number;
    portfolioBalance: number;
    totalBots: number;
    totalDeposits: number;
    totalWithdrawals: number;
    bots: unknown[];
    transactions: unknown[];
  }>(`/api/admin/users/${targetUserId}`);
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.kycStatus, "not_verified");
  assert.equal(detail.body.mainWalletBalance, 0);
  assert.equal(detail.body.vaultCapital, 0);
  assert.equal(detail.body.portfolioBalance, 0);
  assert.equal(detail.body.totalBots, 0);
  assert.equal(detail.body.totalDeposits, 0);
  assert.equal(detail.body.totalWithdrawals, 0);
  assert.deepEqual(detail.body.bots, []);
  assert.deepEqual(detail.body.transactions, []);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));
  assert.equal(user.email, userEmail);
  assert.equal(user.kycStatus, "not_verified");
  assert.equal((await db.select().from(kycTable).where(eq(kycTable.userId, targetUserId))).length, 0);
  assert.equal((await db.select().from(referralsTable).where(eq(referralsTable.referredUserId, targetUserId))).length, 0);
});