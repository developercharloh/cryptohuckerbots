import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.ADMIN_PANEL_PASSWORD = "cross-account-test-admin-password";
process.env.ADMIN_JWT_SECRET = "cross-account-test-jwt-secret";

const { default: app } = await import("../src/app.ts");
const database = await import("@workspace/db");
const drizzle = await import("drizzle-orm");
const {
  db,
  pool,
  sql,
  eq,
  and,
  authRateLimitsTable,
  chatMessagesTable,
  depositSessionsTable,
  kycTable,
  notificationsTable,
  positionsTable,
  sessionsTable,
  supportTicketsTable,
  transactionsTable,
  userProfilesTable,
  usersTable,
} = { ...database, ...drizzle };

const origin = "https://vixus.trade";
const password = "CrossAccountTestPassword1!";
const suffix = `${Date.now()}-${process.pid}`;
const userAEmail = `cross-account-a-${suffix}@example.test`;
const userBEmail = `cross-account-b-${suffix}@example.test`;

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
let userAId = 0;
let userBId = 0;
let notificationId = 0;
let depositSessionId = 0;
let positionId = 0;
let databaseAvailable = false;
const jarA = new CookieJar();
const jarB = new CookieJar();

async function request<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; cookieJar?: CookieJar } = {},
) {
  const jar = options.cookieJar ?? jarA;
  const headers = new Headers({ Origin: origin });
  const cookie = jar.header();
  if (cookie) headers.set("Cookie", cookie);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  jar.absorb(response);
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

  const registrationA = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: { fullName: "Cross Account A", email: userAEmail, password, country: "Kenya" },
    cookieJar: jarA,
  });
  const registrationB = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: { fullName: "Cross Account B", email: userBEmail, password, country: "Kenya" },
    cookieJar: jarB,
  });
  assert.equal(registrationA.response.status, 201);
  assert.equal(registrationB.response.status, 201);
  userAId = registrationA.body.user.id;
  userBId = registrationB.body.user.id;

  const [notification] = await db.insert(notificationsTable).values({
    userId: userAId,
    type: "security",
    title: "Private notification",
    message: "This must never be visible to account B.",
  }).returning();
  notificationId = notification.id;

  const [depositSession] = await db.insert(depositSessionsTable).values({
    userId: userAId,
    status: "waiting_payment",
    amount: "100.00",
    paymentMethodId: "usdt_trc20",
    paymentMethodName: "USDT (TRC20)",
    network: "TRC20",
    depositAddress: "TTestDepositAddress",
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  }).returning();
  depositSessionId = depositSession.id;

  const [position] = await db.insert(positionsTable).values({
    userId: userAId,
    botId: 0,
    botName: "Private test bot",
    signalId: `private-${suffix}`,
    pair: "EUR/USD",
    direction: "buy",
    market: "forex",
    winRate: "90.00",
    stake: "25.00",
    targetProfit: "2.50",
    stopLoss: "2.50",
    status: "open",
  }).returning();
  positionId = position.id;

  databaseAvailable = true;
});

after(async () => {
  if (positionId) await db.delete(positionsTable).where(eq(positionsTable.id, positionId));
  if (depositSessionId) await db.delete(depositSessionsTable).where(eq(depositSessionsTable.id, depositSessionId));
  if (notificationId) await db.delete(notificationsTable).where(eq(notificationsTable.id, notificationId));
  for (const userId of [userAId, userBId]) {
    if (!userId) continue;
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, userId));
    await db.delete(supportTicketsTable).where(eq(supportTicketsTable.userId, userId));
    await db.delete(kycTable).where(eq(kycTable.userId, userId));
    await db.delete(userProfilesTable).where(eq(userProfilesTable.userId, userId));
    await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  }
  await pool.end();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("user-owned collections and records never cross account boundaries", async (t) => {
  if (!databaseAvailable) {
    t.skip("requires a provisioned PostgreSQL test schema");
    return;
  }

  const notifications = await request<Array<{ id: number }>>("/api/notifications", { cookieJar: jarB });
  assert.equal(notifications.response.status, 200);
  assert.equal(notifications.body.some((item) => item.id === notificationId), false);

  const notificationRead = await request(`/api/notifications/${notificationId}/read`, {
    method: "POST",
    cookieJar: jarB,
  });
  assert.equal(notificationRead.response.status, 200);
  const [storedNotification] = await db.select({ isRead: notificationsTable.isRead })
    .from(notificationsTable).where(eq(notificationsTable.id, notificationId));
  assert.equal(storedNotification.isRead, false);

  const notificationDelete = await request(`/api/notifications/${notificationId}`, {
    method: "DELETE",
    cookieJar: jarB,
  });
  assert.equal(notificationDelete.response.status, 200);
  assert.equal((await db.select().from(notificationsTable).where(eq(notificationsTable.id, notificationId))).length, 1);

  for (const path of [
    `/api/profile`,
    `/api/profile/sessions`,
    `/api/profile/kyc`,
    `/api/dashboard/summary`,
    `/api/dashboard/earnings-chart`,
    `/api/support/tickets`,
    `/api/support/chat`,
    `/api/trade/positions`,
  ]) {
    const response = await request(path, { cookieJar: jarB });
    assert.equal(response.response.status, 200);
    const bodyText = JSON.stringify(response.body);
    assert.equal(bodyText.includes(String(userAId)), false, `response leaked account A id at ${path}`);
  }

  const foreignDeposit = await request(`/api/cashier/deposit/session/${depositSessionId}`, { cookieJar: jarB });
  assert.equal(foreignDeposit.response.status, 404);

  const foreignDepositTxid = await request(`/api/cashier/deposit/session/${depositSessionId}/txid`, {
    method: "POST",
    body: { txid: "foreign-user-must-not-update" },
    cookieJar: jarB,
  });
  assert.equal(foreignDepositTxid.response.status, 404);

  const foreignClose = await request(`/api/trade/positions/${positionId}/close`, {
    method: "POST",
    cookieJar: jarB,
  });
  assert.equal(foreignClose.response.status, 400);
  const [storedPosition] = await db.select({ status: positionsTable.status })
    .from(positionsTable).where(eq(positionsTable.id, positionId));
  assert.equal(storedPosition.status, "open");

  const foreignSessionDelete = await request("/api/profile/sessions/999999999", {
    method: "DELETE",
    cookieJar: jarB,
  });
  assert.equal(foreignSessionDelete.response.status, 404);

  const [accountAKyc] = await db.select({ status: kycTable.status })
    .from(kycTable).where(eq(kycTable.userId, userAId));
  assert.equal(accountAKyc.status, "not_submitted");
});