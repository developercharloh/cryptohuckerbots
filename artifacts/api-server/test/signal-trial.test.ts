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

test("VIP 1 receives a usage-based 60-pair signal allowance", async (t) => {
  if (!databaseAvailable) {
    t.skip("requires a provisioned PostgreSQL test schema");
    return;
  }

  const created = await db.select({
    signalTrialStartedAt: usersTable.signalTrialStartedAt,
    signalTrialEndsAt: usersTable.signalTrialEndsAt,
    signalTrialReminderSentAt: usersTable.signalTrialReminderSentAt,
    signalAccessStartedAt: usersTable.signalAccessStartedAt,
    signalPairsRemaining: usersTable.signalPairsRemaining,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  assert.equal(created[0]?.signalTrialStartedAt, null);
  assert.equal(created[0]?.signalTrialEndsAt, null);
  assert.equal(created[0].signalTrialReminderSentAt, null);
  assert.equal(created[0]?.signalAccessStartedAt, null);
  assert.equal(created[0]?.signalPairsRemaining, null);

  type Access = {
    signalTrialActive: boolean;
    signalTrialExpired: boolean;
    signalTrialStartedAt: string | null;
    signalTrialEndsAt: string | null;
    signalTrialRemainingMs: number;
    vip2Required: boolean;
    vipLevel: number;
    dailyLimit: number;
    signalAccessStartedAt: string | null;
    signalPairsRemaining: number | null;
    signalPairAllowance: number;
  };
  const beforeVip = await request<Access>("/api/trade/access");
  assert.equal(beforeVip.body.signalTrialActive, false);
  assert.equal(beforeVip.body.signalTrialExpired, false);
  assert.equal(beforeVip.body.signalPairsRemaining, null);
  assert.equal(beforeVip.body.vipLevel, 0);

  const [vipOne] = await db.insert(vipPackagePurchasesTable).values({
    userId,
    vipLevel: 1,
    amount: "350.00",
    status: "completed",
  }).returning();
  const active = await request<Access>("/api/trade/access");
  assert.equal(active.response.status, 200);
  assert.equal(active.body.signalTrialActive, true);
  assert.equal(active.body.signalTrialExpired, false);
  assert.equal(active.body.signalPairsRemaining, 60);
  assert.equal(active.body.signalPairAllowance, 60);
  assert.ok(active.body.signalAccessStartedAt);
  assert.equal(active.body.signalTrialEndsAt, null);
  assert.equal(active.body.vip2Required, false);
  assert.equal(active.body.dailyLimit, 2);

  const initialized = await db.select({
    signalAccessStartedAt: usersTable.signalAccessStartedAt,
    signalPairsRemaining: usersTable.signalPairsRemaining,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  assert.equal(initialized[0]?.signalAccessStartedAt?.getTime(), vipOne.createdAt.getTime());
  assert.equal(initialized[0]?.signalPairsRemaining, 60);

  await db.update(usersTable).set({
    signalPairsRemaining: 0,
  }).where(eq(usersTable.id, userId));
  const exhausted = await request<Access>("/api/trade/access");
  assert.equal(exhausted.body.signalTrialActive, false);
  assert.equal(exhausted.body.signalTrialExpired, true);
  assert.equal(exhausted.body.signalPairsRemaining, 0);
  assert.equal(exhausted.body.signalTrialRemainingMs, 0);
  assert.equal(exhausted.body.vip2Required, true);
  assert.equal(exhausted.body.dailyLimit, 0);

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