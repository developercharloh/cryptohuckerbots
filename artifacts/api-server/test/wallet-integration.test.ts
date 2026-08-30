import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.ADMIN_PANEL_PASSWORD = "wallet-integration-admin-password";
process.env.ADMIN_JWT_SECRET = "wallet-integration-jwt-secret";

const { default: app } = await import("../src/app.ts");
const database = await import("@workspace/db");
const drizzle = await import("drizzle-orm");
const {
  db,
  pool,
  sql,
  eq,
  adminLoginNotificationsTable,
  earningsTable,
  kycTable,
  notificationSettingsTable,
  sessionsTable,
  transactionsTable,
  usersTable,
  vipInvestmentCapitalTable,
} = {
  ...database,
  ...drizzle,
};

const origin = "https://vixus.trade";
const password = "WalletIntegrationTestPassword1!";
const adminEmail = `wallet-integration-admin-${Date.now()}-${process.pid}@example.test`;
const userEmail = `wallet-integration-user-${Date.now()}-${process.pid}@example.test`;

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
const userJar = new CookieJar();

async function request<T = any>(
  path: string,
  options: { method?: string; body?: unknown; cookieJar?: CookieJar } = {},
) {
  const headers = new Headers({ Origin: origin });
  const cookie = (options.cookieJar ?? userJar).header();
  if (cookie) headers.set("Cookie", cookie);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  (options.cookieJar ?? userJar).absorb(response);
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

  const adminRegistration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: { fullName: "Wallet Integration Admin", email: adminEmail, password },
    cookieJar: adminJar,
  });
  assert.equal(adminRegistration.response.status, 201);
  adminUserId = adminRegistration.body.user.id;
  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, adminUserId));

  const userRegistration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: { fullName: "Wallet Integration User", email: userEmail, password },
    cookieJar: userJar,
  });
  assert.equal(userRegistration.response.status, 201);
  targetUserId = userRegistration.body.user.id;

  const adminLogin = await request("/api/admin/login", {
    method: "POST",
    cookieJar: adminJar,
    body: {
      email: adminEmail,
      username: "admin.vixus-ai",
      password: "wallet-integration-admin-password",
    },
  });
  assert.equal(adminLogin.response.status, 200);
  databaseAvailable = true;
});

after(async () => {
  for (const userId of [adminUserId, targetUserId]) {
    if (!userId) continue;
    await db.delete(adminLoginNotificationsTable).where(eq(adminLoginNotificationsTable.userId, userId));
    await db.delete(earningsTable).where(eq(earningsTable.userId, userId));
    await db.delete(kycTable).where(eq(kycTable.userId, userId));
    await db.delete(notificationSettingsTable).where(eq(notificationSettingsTable.userId, userId));
    await db.delete(vipInvestmentCapitalTable).where(eq(vipInvestmentCapitalTable.userId, userId));
    await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  }
  await pool.end();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("admin credits, approved deposits, returns, and locked capital reconcile in the dashboard wallet", async (t) => {
  if (!databaseAvailable) {
    t.skip("requires a provisioned PostgreSQL test schema");
    return;
  }

  const adminCredit = await request(`/api/admin/users/${targetUserId}/adjust-balance`, {
    method: "POST",
    cookieJar: adminJar,
    body: { amount: 125, note: "Wallet integration admin credit" },
  });
  assert.equal(adminCredit.response.status, 200);

  const afterAdminCredit = await request<{
    mainWalletBalance: number;
    lockedInvestmentCapital: number;
    totalBalance: number;
  }>("/api/dashboard/summary");
  assert.equal(afterAdminCredit.response.status, 200);
  assert.equal(afterAdminCredit.body.mainWalletBalance, 125);
  assert.equal(afterAdminCredit.body.lockedInvestmentCapital, 0);
  assert.equal(afterAdminCredit.body.totalBalance, 125);

  const pendingDeposit = await request<{ id: number }>("/api/cashier/deposit", {
    method: "POST",
    body: { amount: 250, paymentMethod: "USDT (TRC20)", walletAddress: "test-wallet" },
  });
  assert.equal(pendingDeposit.response.status, 201);

  const beforeApproval = await request<{ mainWalletBalance: number }>("/api/dashboard/summary");
  assert.equal(beforeApproval.body.mainWalletBalance, 125);

  const approvedDeposit = await request(`/api/admin/transactions/${pendingDeposit.body.id}/review`, {
    method: "POST",
    cookieJar: adminJar,
    body: { action: "approve" },
  });
  assert.equal(approvedDeposit.response.status, 200);
  assert.equal(approvedDeposit.body.status, "completed");

  await db.insert(transactionsTable).values({
    userId: targetUserId,
    type: "trade_profit",
    amount: "50.00",
    status: "completed",
    paymentMethod: "balance",
    description: "Wallet integration trade return",
  });
  await db.insert(earningsTable).values({
    userId: targetUserId,
    amount: "50.00",
    source: "trade",
  });
  await db.insert(vipInvestmentCapitalTable).values({
    userId: targetUserId,
    vipLevel: 1,
    amount: "500.00",
    status: "locked",
  });

  const summary = await request<{
    mainWalletBalance: number;
    availableBalance: number;
    lockedInvestmentCapital: number;
    totalBalance: number;
    totalEarnings: number;
  }>("/api/dashboard/summary");
  assert.equal(summary.response.status, 200);
  assert.equal(summary.body.mainWalletBalance, 425);
  assert.equal(summary.body.availableBalance, 425);
  assert.equal(summary.body.lockedInvestmentCapital, 500);
  assert.equal(summary.body.totalBalance, 925);
  assert.equal(summary.body.totalEarnings, 50);

  const withdrawalAgainstLockedCapital = await request("/api/cashier/withdraw", {
    method: "POST",
    body: { amount: 426, paymentMethod: "USDT (TRC20)", walletAddress: "test-withdrawal-wallet" },
  });
  assert.equal(withdrawalAgainstLockedCapital.response.status, 400);
  assert.match(withdrawalAgainstLockedCapital.body.error, /Available: \$425\.00/);
});