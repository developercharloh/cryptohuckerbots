import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.ADMIN_JWT_SECRET = "signal-trial-test-secret";

const { default: app } = await import("../src/app.ts");
const database = await import("@workspace/db");
const drizzle = await import("drizzle-orm");
const {
  db,
  pool,
  authRateLimitsTable,
  chatMessagesTable,
  sessionsTable,
  usersTable,
  vipPackagePurchasesTable,
  sql,
  eq,
} = { ...database, ...drizzle };

const origin = "https://vixus.trade";
const email = `signal-trial-${Date.now()}-${process.pid}@example.test`;
const password = "SignalTrialTestPassword1!";

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
let userId = 0;
let databaseAvailable = false;
const jar = new CookieJar();

async function request<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}) {
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
  const registration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Signal Trial Test User",
      email,
      password,
      country: "Kenya",
      phone: `+254703${String(process.pid).padStart(4, "0")}`,
    },
  });
  assert.equal(registration.response.status, 201);
  userId = registration.body.user.id;
  databaseAvailable = true;
});

after(async () => {
  if (userId) {
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, userId));
    await db.delete(vipPackagePurchasesTable).where(eq(vipPackagePurchasesTable.userId, userId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  }
  await pool.end();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("new users receive a server-timed signal window and one reminder", async (t) => {
  if (!databaseAvailable) {
    t.skip("requires a provisioned PostgreSQL test schema");
    return;
  }

  const created = await db.select({
    signalTrialStartedAt: usersTable.signalTrialStartedAt,
    signalTrialEndsAt: usersTable.signalTrialEndsAt,
    signalTrialReminderSentAt: usersTable.signalTrialReminderSentAt,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  assert.ok(created[0]?.signalTrialStartedAt);
  assert.ok(created[0]?.signalTrialEndsAt);
  assert.ok(Math.abs(
    created[0].signalTrialEndsAt!.getTime() -
    created[0].signalTrialStartedAt!.getTime() -
    60 * 24 * 60 * 60 * 1000,
  ) < 5_000);
  assert.equal(created[0].signalTrialReminderSentAt, null);

  type Access = {
    signalTrialActive: boolean;
    signalTrialExpired: boolean;
    signalTrialStartedAt: string | null;
    signalTrialEndsAt: string | null;
    signalTrialRemainingMs: number;
    vip2Required: boolean;
    vipLevel: number;
    dailyLimit: number;
  };
  const active = await request<Access>("/api/trade/access");
  assert.equal(active.response.status, 200);
  assert.equal(active.body.signalTrialActive, true);
  assert.equal(active.body.signalTrialExpired, false);
  assert.ok(active.body.signalTrialRemainingMs > 59 * 24 * 60 * 60 * 1000);
  assert.ok(active.body.signalTrialEndsAt);
  assert.equal(active.body.vip2Required, false);

  // A user without a recorded trial remains on the old access path.
  await db.update(usersTable).set({
    signalTrialStartedAt: null,
    signalTrialEndsAt: null,
    signalTrialReminderSentAt: null,
  }).where(eq(usersTable.id, userId));
  const existing = await request<Access>("/api/trade/access");
  assert.equal(existing.body.signalTrialActive, false);
  assert.equal(existing.body.signalTrialExpired, false);
  assert.equal(existing.body.signalTrialStartedAt, null);
  assert.equal(existing.body.signalTrialEndsAt, null);
  assert.equal(existing.body.vip2Required, false);

  const now = Date.now();
  await db.update(usersTable).set({
    signalTrialStartedAt: new Date(now - 57 * 24 * 60 * 60 * 1000),
    signalTrialEndsAt: new Date(now + 2 * 24 * 60 * 60 * 1000),
  }).where(eq(usersTable.id, userId));
  const reminderWindow = await request<Access>("/api/trade/access");
  assert.equal(reminderWindow.body.signalTrialActive, true);
  const reminderMessages = await db.select({
    sender: chatMessagesTable.sender,
    message: chatMessagesTable.message,
  }).from(chatMessagesTable).where(eq(chatMessagesTable.userId, userId));
  assert.equal(reminderMessages.length, 1);
  assert.equal(reminderMessages[0].sender, "admin");
  assert.match(reminderMessages[0].message, /ends in 3 days/i);

  await request<Access>("/api/trade/access");
  const repeatedReminderMessages = await db.select({ id: chatMessagesTable.id })
    .from(chatMessagesTable).where(eq(chatMessagesTable.userId, userId));
  assert.equal(repeatedReminderMessages.length, 1);

  await db.update(usersTable).set({
    signalTrialEndsAt: new Date(now - 1_000),
  }).where(eq(usersTable.id, userId));
  const expired = await request<Access>("/api/trade/access");
  assert.equal(expired.body.signalTrialActive, false);
  assert.equal(expired.body.signalTrialExpired, true);
  assert.equal(expired.body.signalTrialRemainingMs, 0);
  assert.equal(expired.body.vip2Required, true);
  assert.equal(expired.body.dailyLimit, 0);

  const blockedSignals = await request("/api/trade/signals");
  assert.equal(blockedSignals.response.status, 200);
  assert.deepEqual(blockedSignals.body, []);
  const blockedExecution = await request("/api/trade/execute", {
    method: "POST",
    body: {
      signalId: "expired-trial-signal",
      opportunityId: 1,
      consent: true,
      clientRequestId: `expired-trial-${Date.now()}`,
    },
  });
  assert.equal(blockedExecution.response.status, 403);
  assert.equal(blockedExecution.body.code, "VIP2_REQUIRED");

  await db.insert(vipPackagePurchasesTable).values({
    userId,
    vipLevel: 2,
    amount: "0.00",
    status: "completed",
  });
  const vipTwo = await request<Access>("/api/trade/access");
  assert.equal(vipTwo.body.vipLevel, 2);
  assert.equal(vipTwo.body.vip2Required, false);
  assert.equal(vipTwo.body.dailyLimit, 3);
});