import assert from "node:assert/strict";
import crypto from "node:crypto";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.DIDIT_WEBHOOK_SECRET = "webhook-security-test-secret";

const { default: app } = await import("../src/app.ts");
const database = await import("@workspace/db");
const drizzle = await import("drizzle-orm");
const { db, pool, diditWebhookEventsTable, eq, sql } = {
  ...database,
  ...drizzle,
};

let server: Server;
let baseUrl: string;
const sessionId = `webhook-security-${Date.now()}-${process.pid}`;

function signedHeaders(rawBody: string): Headers {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = crypto
    .createHmac("sha256", "webhook-security-test-secret")
    .update(rawBody)
    .digest("hex");
  return new Headers({
    "Content-Type": "application/json",
    "X-Signature": signature,
    "X-Timestamp": timestamp,
  });
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
  const status = await db.execute(sql`select to_regclass('public.didit_webhook_events') as table_name`);
  if (!status.rows[0]?.table_name) return;
  await db.delete(diditWebhookEventsTable).where(eq(diditWebhookEventsTable.sessionId, sessionId));
});

after(async () => {
  await db.delete(diditWebhookEventsTable).where(eq(diditWebhookEventsTable.sessionId, sessionId));
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  await pool.end();
});

test("ignores a replayed signed Didit webhook without repeating processing", async (t) => {
  const status = await db.execute(sql`select to_regclass('public.didit_webhook_events') as table_name`);
  if (!status.rows[0]?.table_name) {
    t.skip("requires the webhook idempotency migration");
    return;
  }

  const rawBody = JSON.stringify({
    session_id: sessionId,
    status: "Approved",
    webhook_type: "status.updated",
  });

  const first = await fetch(`${baseUrl}/api/webhooks/didit`, {
    method: "POST",
    headers: signedHeaders(rawBody),
    body: rawBody,
  });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), { ok: true });

  const replay = await fetch(`${baseUrl}/api/webhooks/didit`, {
    method: "POST",
    headers: signedHeaders(rawBody),
    body: rawBody,
  });
  assert.equal(replay.status, 200);
  assert.deepEqual(await replay.json(), { ok: true, duplicate: true });

  const [event] = await db
    .select()
    .from(diditWebhookEventsTable)
    .where(eq(diditWebhookEventsTable.sessionId, sessionId));
  assert.ok(event);
});

test("rejects a signed Didit webhook with an expired timestamp", async () => {
  const rawBody = JSON.stringify({ session_id: `${sessionId}-expired`, status: "Approved" });
  const headers = signedHeaders(rawBody);
  headers.set("X-Timestamp", String(Math.floor(Date.now() / 1000) - 301));

  const response = await fetch(`${baseUrl}/api/webhooks/didit`, {
    method: "POST",
    headers,
    body: rawBody,
  });
  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), { error: "Timestamp expired" });
});