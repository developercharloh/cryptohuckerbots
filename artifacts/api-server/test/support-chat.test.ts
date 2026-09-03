import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.ADMIN_PANEL_PASSWORD = "support-chat-admin-password";
process.env.ADMIN_JWT_SECRET = "support-chat-jwt-secret";

const { default: app } = await import("../src/app.ts");
const database = await import("@workspace/db");
const drizzle = await import("drizzle-orm");
const {
  db,
  pool,
  chatMessagesTable,
  chatAttachmentsTable,
  notificationsTable,
  authRateLimitsTable,
  sessionsTable,
  usersTable,
  sql,
  eq,
} = { ...database, ...drizzle };
const { attachmentStorage } = await import("../src/lib/chat-attachments.ts");

const origin = "https://vixus.trade";
const password = "SupportChatTestPassword1!";
const adminEmail = `support-chat-admin-${Date.now()}-${process.pid}@example.test`;
const userEmail = `support-chat-user-${Date.now()}-${process.pid}@example.test`;

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
const attachmentIds: number[] = [];
const adminJar = new CookieJar();
const userJar = new CookieJar();

async function request<T = unknown>(
  path: string,
  options: { method?: string; body?: unknown; cookieJar?: CookieJar; readBody?: boolean } = {},
) {
  const jar = options.cookieJar ?? userJar;
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
  if (options.readBody === false) return { response, body: undefined as T | undefined };
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
    body: { fullName: "Support Chat Admin", email: adminEmail, password, country: "Kenya", phone: `+254701${String(process.pid).padStart(4, "0")}` },
    cookieJar: adminJar,
  });
  assert.equal(adminRegistration.response.status, 201);
  adminUserId = adminRegistration.body.user.id;
  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, adminUserId));

  const userRegistration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: { fullName: "Support Chat User", email: userEmail, password, country: "Kenya", phone: `+254702${String(process.pid).padStart(4, "0")}` },
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
      password: "support-chat-admin-password",
    },
  });
  assert.equal(adminLogin.response.status, 200);
  databaseAvailable = true;
});

after(async () => {
  for (const attachmentId of attachmentIds) {
    await db.delete(chatAttachmentsTable).where(eq(chatAttachmentsTable.id, attachmentId));
  }
  if (targetUserId) {
    await db.delete(chatMessagesTable).where(eq(chatMessagesTable.userId, targetUserId));
    await db.delete(notificationsTable).where(eq(notificationsTable.userId, targetUserId));
  }
  for (const userId of [adminUserId, targetUserId]) {
    if (userId) await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    if (userId) await db.delete(usersTable).where(eq(usersTable.id, userId));
  }
  await pool.end();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("support inbox tracks pending replies and closed conversation boundaries", async (t) => {
  if (!databaseAvailable) {
    t.skip("requires a provisioned PostgreSQL test schema");
    return;
  }

  const firstMessage = await request("/api/support/chat", {
    method: "POST",
    body: { message: "I need help with my account." },
  });
  assert.equal(firstMessage.response.status, 201);

  type Conversation = {
    userId: number;
    status: "open" | "closed";
    pendingReply: boolean;
    unreadCount: number;
  };
  const findConversation = async () => {
    const result = await request<Conversation[]>("/api/admin/chat", { cookieJar: adminJar });
    return result.body.find((conversation) => conversation.userId === targetUserId);
  };

  let conversation = await findConversation();
  assert.equal(conversation?.status, "open");
  assert.equal(conversation?.pendingReply, true);
  assert.equal(conversation?.unreadCount, 1);

  const closed = await request<{ status: string; closedAt: string }>(`/api/admin/chat/${targetUserId}/close`, {
    method: "POST",
    cookieJar: adminJar,
  });
  assert.equal(closed.response.status, 200);
  assert.equal(closed.body.status, "closed");

  conversation = await findConversation();
  assert.equal(conversation?.status, "closed");
  assert.equal(conversation?.pendingReply, false);

  const notifications = await request<Array<{ type: string; isRead: boolean }>>("/api/notifications");
  assert.ok(notifications.body.some((notification) => notification.type === "support_closed" && !notification.isRead));

  const closedReply = await request(`/api/admin/chat/${targetUserId}`, {
    method: "POST",
    cookieJar: adminJar,
    body: { message: "This reply must be blocked until the user starts again." },
  });
  assert.equal(closedReply.response.status, 409);

  const newMessage = await request("/api/support/chat", {
    method: "POST",
    body: { message: "I have a new question." },
  });
  assert.equal(newMessage.response.status, 201);

  conversation = await findConversation();
  assert.equal(conversation?.status, "open");
  assert.equal(conversation?.pendingReply, true);

  const resumedReply = await request(`/api/admin/chat/${targetUserId}`, {
    method: "POST",
    cookieJar: adminJar,
    body: { message: "Support is here to help." },
  });
  assert.equal(resumedReply.response.status, 201);

  conversation = await findConversation();
  assert.equal(conversation?.pendingReply, false);

  const thread = await request<Array<{ sender: string; message: string }>>(`/api/admin/chat/${targetUserId}`, {
    cookieJar: adminJar,
  });
  assert.deepEqual(thread.body.map((message) => message.sender), ["user", "system", "system", "user", "admin"]);
  assert.match(thread.body[1].message, /closed by VIXUS Support/);
  assert.equal(thread.body[2].message, "New conversation started.");
});

test("support attachments include admin-visible metadata and stay private when downloaded", async (t) => {
  if (!databaseAvailable) {
    t.skip("requires a provisioned PostgreSQL test schema");
    return;
  }

  const [message] = await db.insert(chatMessagesTable).values({
    userId: targetUserId,
    sender: "user",
    message: "Please review this screenshot.",
  }).returning();
  const [attachment] = await db.insert(chatAttachmentsTable).values({
    messageId: message.id,
    userId: targetUserId,
    pathname: `support/${targetUserId}/regression/screenshot.png`,
    blobUrl: "https://private.blob.vercel-storage.com/regression-screenshot.png",
    filename: "account-screenshot.png",
    contentType: "image/png",
    sizeBytes: 18,
  }).returning();
  attachmentIds.push(attachment.id);

  const userThread = await request<Array<{
    id: number;
    attachments: Array<{
      id: number;
      filename: string;
      contentType: string;
      sizeBytes: number;
      downloadUrl: string;
    }>;
  }>>("/api/support/chat");
  const userMessage = userThread.body.find((item) => item.id === message.id);
  assert.deepEqual(userMessage?.attachments, [{
    id: attachment.id,
    filename: "account-screenshot.png",
    contentType: "image/png",
    sizeBytes: 18,
    downloadUrl: `/api/support/attachments/${attachment.id}`,
  }]);

  const adminThread = await request<Array<{
    id: number;
    attachments: Array<{
      id: number;
      filename: string;
      contentType: string;
      sizeBytes: number;
      downloadUrl: string;
    }>;
  }>>(`/api/admin/chat/${targetUserId}`, { cookieJar: adminJar });
  const adminMessage = adminThread.body.find((item) => item.id === message.id);
  assert.deepEqual(adminMessage?.attachments, [{
    id: attachment.id,
    filename: "account-screenshot.png",
    contentType: "image/png",
    sizeBytes: 18,
    downloadUrl: `/api/admin/attachments/${attachment.id}`,
  }]);

  const unauthenticatedAdminDownload = await request(`/api/admin/attachments/${attachment.id}`, {
    cookieJar: new CookieJar(),
  });
  assert.equal(unauthenticatedAdminDownload.response.status, 401);

  const unauthenticatedUserDownload = await request(`/api/support/attachments/${attachment.id}`, {
    cookieJar: new CookieJar(),
  });
  assert.equal(unauthenticatedUserDownload.response.status, 401);

  const originalGet = attachmentStorage.get;
  attachmentStorage.get = (async () => ({
    statusCode: 200,
    blob: { contentType: "image/png", size: 18 },
    stream: new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("private-image-data"));
        controller.close();
      },
    }),
  })) as typeof attachmentStorage.get;

  try {
    const adminDownload = await request(`/api/admin/attachments/${attachment.id}`, { cookieJar: adminJar, readBody: false });
    assert.equal(adminDownload.response.status, 200);
    assert.equal(adminDownload.response.headers.get("content-type"), "image/png");
    assert.equal(adminDownload.response.headers.get("content-disposition"), 'inline; filename="account-screenshot.png"');
    assert.equal(adminDownload.response.headers.get("x-content-type-options"), "nosniff");
    assert.equal(await adminDownload.response.text(), "private-image-data");

    const userDownload = await request(`/api/support/attachments/${attachment.id}`, { cookieJar: userJar, readBody: false });
    assert.equal(userDownload.response.status, 200);
    assert.equal(userDownload.response.headers.get("content-type"), "image/png");
    assert.equal(await userDownload.response.text(), "private-image-data");
  } finally {
    attachmentStorage.get = originalGet;
  }
});
