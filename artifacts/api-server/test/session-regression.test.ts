import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

// Keep the values deterministic for this test process. The admin route reads
// these at module initialization, before the app is imported below.
process.env.NODE_ENV = "test";
process.env.ADMIN_PANEL_PASSWORD = "cookie-regression-admin-password";
process.env.ADMIN_JWT_SECRET = "cookie-regression-jwt-secret";

const { default: app } = await import("../src/app.ts");
const {
  db,
  pool,
  eq,
  sql,
  adminLoginNotificationsTable,
  kycTable,
  notificationSettingsTable,
  authRateLimitsTable,
  sessionsTable,
  usersTable,
} = await (async () => {
  const database = await import("@workspace/db");
  const drizzle = await import("drizzle-orm");
  return { ...database, eq: drizzle.eq, sql: drizzle.sql };
})();
const {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_TTL_MS,
  USER_SESSION_COOKIE,
} = await import("../src/lib/session.ts");

const TEST_ORIGIN = "https://vixus.trade";
const ADMIN_USERNAME = "admin.vixus-ai";
const ADMIN_PASSWORD = "cookie-regression-admin-password";
const userPassword = "CookieRegressionUserPassword1!";
const userEmail = `cookie-regression-${Date.now()}-${process.pid}@example.test`;

type RequestOptions = {
  jar?: CookieJar;
  method?: string;
  body?: unknown;
  origin?: string | null;
  signal?: AbortSignal;
};

type ApiResponse<T = unknown> = {
  response: Response;
  body: T;
  raw: string;
};

class CookieJar {
  private readonly cookies = new Map<string, string>();
  private readonly observedValues = new Set<string>();

  absorb(response: Response): void {
    const headers = response.headers as Headers & {
      getSetCookie?: () => string[];
    };
    const setCookies = headers.getSetCookie?.() ??
      (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);

    for (const setCookie of setCookies) {
      const separator = setCookie.indexOf("=");
      if (separator < 0) continue;

      const name = setCookie.slice(0, separator).trim();
      const value = setCookie.slice(separator + 1).split(";", 1)[0];
      const attributes = setCookie.toLowerCase();
      if (value === "" || attributes.includes("max-age=0")) {
        this.cookies.delete(name);
        continue;
      }

      this.cookies.set(name, value);
      this.observedValues.add(value);
    }
  }

  header(): string | undefined {
    if (this.cookies.size === 0) return undefined;
    return [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  value(name: string): string | undefined {
    return this.cookies.get(name);
  }

  set(name: string, value: string): void {
    this.cookies.set(name, value);
    this.observedValues.add(value);
  }

  assertNoObservedValue(text: string): void {
    for (const observed of this.observedValues) {
      assert.equal(
        text.includes(observed),
        false,
        `session token appeared in a JSON response or event stream`,
      );
    }
  }
}

let server: Server;
let baseUrl: string;
let testUserId: number;
let databaseAvailable = false;

async function request<T = Record<string, unknown>>(
  path: string,
  options: RequestOptions = {},
): Promise<ApiResponse<T>> {
  const jar = options.jar ?? new CookieJar();
  const url = new URL(path, baseUrl);
  const cookie = jar.header();
  jar.assertNoObservedValue(url.search);

  const headers = new Headers();
  if (options.origin !== null) {
    headers.set("Origin", options.origin ?? TEST_ORIGIN);
  }
  if (cookie) headers.set("Cookie", cookie);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");

  const response = await fetch(url, {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    signal: options.signal,
  });
  jar.absorb(response);

  const raw = await response.text();
  jar.assertNoObservedValue(raw);

  let body: T;
  try {
    body = raw === "" ? (undefined as T) : JSON.parse(raw) as T;
  } catch {
    body = raw as T;
  }
  return { response, body, raw };
}

function assertCredentialedCors(response: Response): void {
  assert.equal(response.headers.get("access-control-allow-origin"), TEST_ORIGIN);
  assert.equal(response.headers.get("access-control-allow-credentials"), "true");
}

function createExpiredAdminToken(userId: number): string {
  const payload = Buffer.from(JSON.stringify({
    userId,
    expiresAt: Date.now() - ADMIN_SESSION_TTL_MS - 1,
    nonce: "expired-cookie-regression",
  })).toString("base64url");
  const signature = createHmac("sha256", "cookie-regression-jwt-secret")
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

before(async () => {
  server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not expose a port");
  baseUrl = `http://127.0.0.1:${address.port}`;

  const usersTableStatus = await db.execute(sql`select to_regclass('public.users') as table_name`);
  if (!usersTableStatus.rows[0]?.table_name) return;
  await db.delete(authRateLimitsTable);

  const registration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: {
      fullName: "Cookie Regression User",
      email: userEmail,
      password: userPassword,
      country: "Kenya",
    },
  });
  assert.equal(registration.response.status, 201);
  testUserId = registration.body.user.id;

  // Admin login intentionally requires a DB user with admin access. Promote
  // only this uniquely named test user and remove it in the after hook.
  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, testUserId));
  databaseAvailable = true;
});

after(async () => {
  if (testUserId) {
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, testUserId));
    await db.delete(adminLoginNotificationsTable).where(eq(adminLoginNotificationsTable.userId, testUserId));
    await db.delete(kycTable).where(eq(kycTable.userId, testUserId));
    await db.delete(notificationSettingsTable).where(eq(notificationSettingsTable.userId, testUserId));
    await db.delete(usersTable).where(eq(usersTable.id, testUserId));
  }
  await pool.end();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

function skipWithoutDatabase(t: { skip: (reason?: string) => void }): boolean {
  if (databaseAvailable) return false;
  t.skip("requires a provisioned PostgreSQL test schema");
  return true;
}

test("rejects unauthenticated requests and returns credentialed CORS headers", async (t) => {
  if (skipWithoutDatabase(t)) return;
  const result = await request("/api/auth/me?from=reload");
  assert.equal(result.response.status, 401);
  assert.deepEqual(result.body, { error: "Unauthorized" });
  assertCredentialedCors(result.response);
});

test("blocks cookie-authenticated mutations without a trusted Origin", async () => {
  const noOrigin = await request("/api/auth/login", {
    method: "POST",
    origin: null,
    body: { email: userEmail, password: userPassword },
  });
  assert.equal(noOrigin.response.status, 403);
  assert.deepEqual(noOrigin.body, {
    error: "Cross-site request blocked. Include a trusted Origin or CSRF token.",
  });

  const untrustedVercelPreview = await request("/api/auth/forgot-password", {
    method: "POST",
    origin: "https://unrelated-preview.vercel.app",
    body: { email: userEmail },
  });
  assert.equal(untrustedVercelPreview.response.status, 403);

  const blockedStream = await request("/api/admin/login-events", {
    origin: "https://unrelated-preview.vercel.app",
  });
  assert.equal(blockedStream.response.status, 403);
});

test("rejects unknown password reset tokens and keeps logout available from a trusted frontend", async () => {
  const reset = await request("/api/auth/reset-password", {
    method: "POST",
    body: { token: "cookie-regression-reset-token", password: "NewCookiePassword1!" },
  });
  assert.equal(reset.response.status, 400);
  assert.deepEqual(reset.body, { error: "This reset link is invalid or expired." });
  assertCredentialedCors(reset.response);

  const logout = await request("/api/auth/logout", { method: "POST" });
  assert.equal(logout.response.status, 200);
  assert.deepEqual(logout.body, { message: "Logged out successfully" });
  assertCredentialedCors(logout.response);
});

test("handles credentialed preflight for configured frontend origins", async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "OPTIONS",
    headers: {
      Origin: TEST_ORIGIN,
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  assert.equal(response.status, 204);
  assertCredentialedCors(response);
  assert.match(response.headers.get("access-control-allow-methods") ?? "", /POST/);
  assert.match(response.headers.get("access-control-allow-headers") ?? "", /content-type/i);
});

test("expires user sessions after the absolute session lifetime", async (t) => {
  if (skipWithoutDatabase(t)) return;
  const loginJar = new CookieJar();
  const login = await request<{ user: { id: number; email: string } }>("/api/auth/login", {
    method: "POST",
    jar: loginJar,
    body: { email: userEmail, password: userPassword },
  });
  assert.equal(login.response.status, 200);
  assert.equal(login.body.user.email, userEmail);
  assertCredentialedCors(login.response);
  assert.ok(loginJar.value(USER_SESSION_COOKIE));
  assert.match(login.response.headers.get("set-cookie") ?? "", /HttpOnly/i);
  assert.match(login.response.headers.get("set-cookie") ?? "", /SameSite=Lax/i);
  assert.equal(login.raw.includes("token"), false);

  const reloaded = await request<{ email: string }>("/api/auth/me?from=reload", {
    jar: loginJar,
  });
  assert.equal(reloaded.response.status, 200);
  assert.equal(reloaded.body.email, userEmail);
  assertCredentialedCors(reloaded.response);
  assert.match(reloaded.response.headers.get("set-cookie") ?? "", /Max-Age=/i);

  const logout = await request("/api/auth/logout", {
    method: "POST",
    jar: loginJar,
  });
  assert.equal(logout.response.status, 200);
  assert.equal(loginJar.value(USER_SESSION_COOKIE), undefined);

  const afterLogout = await request("/api/auth/me", { jar: loginJar });
  assert.equal(afterLogout.response.status, 401);

  const persistentJar = new CookieJar();
  const secondLogin = await request("/api/auth/login", {
    method: "POST",
    jar: persistentJar,
    body: { email: userEmail, password: userPassword },
  });
  assert.equal(secondLogin.response.status, 200);
  const persistentToken = persistentJar.value(USER_SESSION_COOKIE);
  assert.ok(persistentToken);

  const [session] = await db.select().from(sessionsTable)
    .where(eq(sessionsTable.token, persistentToken));
  assert.ok(session);
  await db.update(sessionsTable)
    .set({ createdAt: new Date("2000-01-01T00:00:00.000Z") })
    .where(eq(sessionsTable.id, session.id));

  const persistent = await request("/api/auth/me", { jar: persistentJar });
  assert.equal(persistent.response.status, 401);
  assert.equal(persistentJar.value(USER_SESSION_COOKIE), undefined);
  const retainedSession = await db.select().from(sessionsTable)
    .where(eq(sessionsTable.id, session.id));
  assert.equal(retainedSession.length, 0);
});

test("covers admin login, invalid credentials, logout, invalidation, and expiry", async (t) => {
  if (skipWithoutDatabase(t)) return;
  const invalid = await request("/api/admin/login", {
    method: "POST",
    body: {
      email: userEmail,
      username: ADMIN_USERNAME,
      password: "wrong-password",
    },
  });
  assert.equal(invalid.response.status, 401);
  assert.equal(invalid.raw.includes("session"), false);

  const adminJar = new CookieJar();
  const login = await request<{ ok: boolean; name: string }>("/api/admin/login", {
    method: "POST",
    jar: adminJar,
    body: {
      email: userEmail,
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    },
  });
  assert.equal(login.response.status, 200);
  assert.deepEqual(login.body, { ok: true, name: "Cookie Regression User" });
  assertCredentialedCors(login.response);
  assert.ok(adminJar.value(ADMIN_SESSION_COOKIE));
  assert.equal(login.raw.includes("token"), false);

  const accountPasswordAdminJar = new CookieJar();
  const accountPasswordLogin = await request<{ ok: boolean; name: string }>("/api/admin/login", {
    method: "POST",
    jar: accountPasswordAdminJar,
    body: {
      email: userEmail,
      username: ADMIN_USERNAME,
      password: userPassword,
    },
  });
  assert.equal(accountPasswordLogin.response.status, 200);
  assert.deepEqual(accountPasswordLogin.body, { ok: true, name: "Cookie Regression User" });

  const session = await request<{ authenticated: boolean }>("/api/admin/session", {
    jar: adminJar,
  });
  assert.equal(session.response.status, 200);
  assert.deepEqual(session.body, { authenticated: true, name: "Cookie Regression User" });

  const logout = await request("/api/admin/logout", {
    method: "POST",
    jar: adminJar,
  });
  assert.equal(logout.response.status, 200);
  assert.equal(adminJar.value(ADMIN_SESSION_COOKIE), undefined);
  const afterLogout = await request("/api/admin/session", { jar: adminJar });
  assert.equal(afterLogout.response.status, 401);

  const invalidatedJar = new CookieJar();
  await request("/api/admin/login", {
    method: "POST",
    jar: invalidatedJar,
    body: {
      email: userEmail,
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    },
  });
  const invalidatedToken = invalidatedJar.value(ADMIN_SESSION_COOKIE);
  assert.ok(invalidatedToken);
  await db.delete(sessionsTable).where(eq(sessionsTable.token, invalidatedToken));

  const invalidated = await request("/api/admin/session", { jar: invalidatedJar });
  assert.equal(invalidated.response.status, 401);
  assert.equal(invalidatedJar.value(ADMIN_SESSION_COOKIE), undefined);

  const expiredJar = new CookieJar();
  expiredJar.set(ADMIN_SESSION_COOKIE, createExpiredAdminToken(testUserId));
  const expired = await request("/api/admin/session", { jar: expiredJar });
  assert.equal(expired.response.status, 401);
  assert.equal(expiredJar.value(ADMIN_SESSION_COOKIE), undefined);
});

test("protects the admin login event stream and sends its initial SSE heartbeat", async (t) => {
  if (skipWithoutDatabase(t)) return;
  const adminJar = new CookieJar();
  const login = await request("/api/admin/login", {
    method: "POST",
    jar: adminJar,
    body: {
      email: userEmail,
      username: ADMIN_USERNAME,
      password: ADMIN_PASSWORD,
    },
  });
  assert.equal(login.response.status, 200);

  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/admin/login-events?from=admin`, {
    headers: {
      Origin: TEST_ORIGIN,
      Cookie: adminJar.header()!,
    },
    signal: controller.signal,
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/event-stream/);
  assertCredentialedCors(response);

  const reader = response.body?.getReader();
  assert.ok(reader);
  const firstChunk = await reader.read();
  const firstText = new TextDecoder().decode(firstChunk.value);
  assert.match(firstText, /: connected/);
  adminJar.assertNoObservedValue(firstText);
  await reader.cancel();
  controller.abort();
});

test("customFetch opts into cookies for cross-origin API calls", async () => {
  const { customFetch } = await import("../../../lib/api-client-react/src/custom-fetch.ts");
  const originalFetch = globalThis.fetch;
  let capturedCredentials: RequestCredentials | undefined;

  globalThis.fetch = (async (_input, init) => {
    capturedCredentials = init?.credentials;
    return new Response('{"ok":true}', {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const body = await customFetch<{ ok: boolean }>("https://api.vixus.trade/api/auth/me", {
      responseType: "json",
    });
    assert.deepEqual(body, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(capturedCredentials, "include");
});