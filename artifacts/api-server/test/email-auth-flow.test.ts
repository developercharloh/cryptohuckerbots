import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.AUTH_TEST_BYPASS = "false";

const { default: app } = await import("../src/app.ts");
const database = await import("@workspace/db");
const drizzle = await import("drizzle-orm");
const { hashPassword } = await import("../src/lib/password.ts");
const { USER_SESSION_COOKIE } = await import("../src/lib/session.ts");

const {
  db,
  pool,
  usersTable,
  sessionsTable,
  emailVerificationTokensTable,
  loginOtpChallengesTable,
  authRateLimitsTable,
  eq,
  and,
  isNull,
  sql,
} = {
  ...database,
  eq: drizzle.eq,
  and: drizzle.and,
  isNull: drizzle.isNull,
  sql: drizzle.sql,
};

const origin = "https://vixus.trade";
const password = "EmailAuthRegression1!";
const email = `email-auth-${Date.now()}-${process.pid}@example.test`;

class CookieJar {
  private cookie: string | undefined;

  absorb(response: Response): void {
    const header = response.headers.get("set-cookie");
    if (!header) return;
    const [nameValue, ...attributes] = header.split(";");
    const separator = nameValue.indexOf("=");
    if (separator < 0) return;
    if (nameValue.slice(separator + 1).trim() === "") {
      this.cookie = undefined;
      return;
    }
    if (attributes.some((attribute) => attribute.trim().toLowerCase() === "max-age=0")) {
      this.cookie = undefined;
      return;
    }
    this.cookie = nameValue.trim();
  }

  value(): string | undefined {
    return this.cookie;
  }

  set(value: string): void {
    this.cookie = value;
  }
}

let server: Server;
let baseUrl: string;
let userId: number | undefined;
let databaseAvailable = false;

async function request<T = Record<string, unknown>>(
  path: string,
  options: { method?: string; body?: unknown; jar?: CookieJar } = {},
): Promise<{ response: Response; body: T; raw: string }> {
  const headers = new Headers({ Origin: origin });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  if (options.jar?.value()) headers.set("Cookie", options.jar.value()!);
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  options.jar?.absorb(response);
  const raw = await response.text();
  return {
    response,
    body: (raw ? JSON.parse(raw) : {}) as T,
    raw,
  };
}

function skipWithoutDatabase(t: { skip: (reason?: string) => void }): boolean {
  if (databaseAvailable) return false;
  t.skip("requires a provisioned PostgreSQL test schema");
  return true;
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

  const usersTableStatus = await db.execute(sql`select to_regclass('public.users') as table_name`);
  if (!usersTableStatus.rows[0]?.table_name) return;
  databaseAvailable = true;
  await db.delete(authRateLimitsTable);
  const [user] = await db.insert(usersTable).values({
    accountUid: `VAI${Date.now().toString(36).toUpperCase().slice(-8)}`,
    fullName: "Email Auth Regression",
    email,
    passwordHash: await hashPassword(password),
    emailVerifiedAt: new Date(),
  }).returning({ id: usersTable.id });
  userId = user.id;
});

after(async () => {
  if (userId) {
    await db.delete(loginOtpChallengesTable).where(eq(loginOtpChallengesTable.userId, userId));
    await db.delete(emailVerificationTokensTable).where(eq(emailVerificationTokensTable.userId, userId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  }
  await pool.end();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("password login starts an email challenge without creating a session", async (t) => {
  if (skipWithoutDatabase(t)) return;
  const jar = new CookieJar();
  const staleToken = `stale-session-${Date.now()}-${process.pid}`;
  await db.insert(sessionsTable).values({
    userId: userId!,
    token: staleToken,
    device: "Regression test",
    ip: "127.0.0.1",
    location: "Unknown",
  });
  jar.set(`${USER_SESSION_COOKIE}=${staleToken}`);
  const login = await request<{ requiresEmailOtp: boolean; challengeToken: string }>("/api/auth/login", {
    method: "POST",
    jar,
    body: { email, password },
  });

  assert.equal(login.response.status, 200);
  assert.equal(login.body.requiresEmailOtp, true);
  assert.ok(login.body.challengeToken);
  assert.equal(jar.value(), undefined);

  const me = await request("/api/auth/me", { jar });
  assert.equal(me.response.status, 401);

  const [challenge] = await db.select()
    .from(loginOtpChallengesTable)
    .where(and(
      eq(loginOtpChallengesTable.userId, userId!),
      isNull(loginOtpChallengesTable.usedAt),
    ))
    .limit(1);
  assert.ok(challenge);
});

test("an unverified account can receive a fresh verification challenge", async (t) => {
  if (skipWithoutDatabase(t)) return;
  await db.update(usersTable)
    .set({ emailVerifiedAt: null })
    .where(eq(usersTable.id, userId!));

  const login = await request<{ code: string }>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  assert.equal(login.response.status, 403);
  assert.equal(login.body.code, "EMAIL_NOT_VERIFIED");

  const resend = await request("/api/auth/resend-verification", {
    method: "POST",
    body: { email },
  });
  assert.equal(resend.response.status, 200);

  const [verification] = await db.select()
    .from(emailVerificationTokensTable)
    .where(eq(emailVerificationTokensTable.userId, userId!))
    .limit(1);
  assert.ok(verification);
  assert.equal(verification.usedAt, null);
});