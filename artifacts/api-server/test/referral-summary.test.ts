import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";

const { default: app } = await import("../src/app.ts");
const database = await import("@workspace/db");
const drizzle = await import("drizzle-orm");
const {
  db,
  pool,
  usersTable,
  sessionsTable,
  referralsTable,
  vipPackagePurchasesTable,
  sql,
  eq,
  and,
} = {
  ...database,
  sql: drizzle.sql,
  eq: drizzle.eq,
  and: drizzle.and,
};

const origin = "https://vixus.trade";
const testPrefix = `referral-summary-${Date.now()}-${process.pid}`;
const referrerEmail = `${testPrefix}-referrer@example.test`;
const inactiveEmail = `${testPrefix}-inactive@example.test`;
const activeEmail = `${testPrefix}-active@example.test`;
const sessionToken = `${testPrefix}-session`;

let server: Server;
let baseUrl: string;
let referrerId: number | undefined;
let inactiveUserId: number | undefined;
let activeUserId: number | undefined;
let databaseAvailable = false;

function accountUid(suffix: string): string {
  return `VAI${Date.now().toString(36).toUpperCase().slice(-8)}${suffix}`;
}

async function request<T>(path: string): Promise<{ response: Response; body: T }> {
  const response = await fetch(new URL(path, baseUrl), {
    headers: {
      Origin: origin,
      Authorization: `Bearer ${sessionToken}`,
    },
  });
  return {
    response,
    body: await response.json() as T,
  };
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
  databaseAvailable = true;

  const [referrer] = await db.insert(usersTable).values({
    accountUid: accountUid("R"),
    fullName: "Referral Summary Referrer",
    email: referrerEmail,
    passwordHash: "test-only-password-hash",
    emailVerifiedAt: new Date(),
  }).returning({ id: usersTable.id });
  const [inactive] = await db.insert(usersTable).values({
    accountUid: accountUid("I"),
    fullName: "Referral Summary Inactive",
    email: inactiveEmail,
    passwordHash: "test-only-password-hash",
    emailVerifiedAt: new Date(),
  }).returning({ id: usersTable.id });
  const [active] = await db.insert(usersTable).values({
    accountUid: accountUid("A"),
    fullName: "Referral Summary Active",
    email: activeEmail,
    passwordHash: "test-only-password-hash",
    emailVerifiedAt: new Date(),
  }).returning({ id: usersTable.id });

  referrerId = referrer.id;
  inactiveUserId = inactive.id;
  activeUserId = active.id;

  await db.insert(sessionsTable).values({
    userId: referrerId,
    token: sessionToken,
    device: "Referral summary regression test",
    ip: "127.0.0.1",
    location: "Unknown",
  });

  const [vipOnePurchase] = await db.insert(vipPackagePurchasesTable).values({
    userId: activeUserId,
    vipLevel: 1,
    amount: "350.00",
    status: "completed",
  }).returning({ id: vipPackagePurchasesTable.id });

  await db.insert(referralsTable).values([
    {
      referrerUserId: referrerId,
      referredUserId: inactiveUserId,
      status: "credited",
      bonusAmount: "20.00",
      reservedAmount: "0.00",
      creditedAt: new Date(),
    },
    {
      referrerUserId: referrerId,
      referredUserId: activeUserId,
      status: "credited",
      bonusAmount: "20.00",
      reservedAmount: "0.00",
      vip1PurchaseId: vipOnePurchase.id,
      creditedAt: new Date(),
    },
  ]);
});

after(async () => {
  if (referrerId && inactiveUserId && activeUserId) {
    await db.delete(referralsTable).where(and(
      eq(referralsTable.referrerUserId, referrerId),
      eq(referralsTable.referredUserId, inactiveUserId),
    ));
    await db.delete(referralsTable).where(and(
      eq(referralsTable.referrerUserId, referrerId),
      eq(referralsTable.referredUserId, activeUserId),
    ));
    await db.delete(vipPackagePurchasesTable).where(eq(vipPackagePurchasesTable.userId, activeUserId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, referrerId));
    await db.delete(usersTable).where(eq(usersTable.id, inactiveUserId));
    await db.delete(usersTable).where(eq(usersTable.id, activeUserId));
    await db.delete(usersTable).where(eq(usersTable.id, referrerId));
  }
  await pool.end();
  await new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
});

test("only active VIP 1 referrals count toward dashboard totals and bonuses", async (t) => {
  if (!databaseAvailable) {
    t.skip("requires a provisioned PostgreSQL test schema");
    return;
  }

  const result = await request<{
    totalEarned: number;
    pendingCount: number;
    referrals: Array<{
      referredEmail: string;
      currentVipLevel: number;
      activityStatus: string;
      status: string;
      bonusAmount: number;
    }>;
  }>("/api/profile/referrals");

  assert.equal(result.response.status, 200);
  assert.equal(result.body.totalEarned, 20);
  assert.equal(result.body.pendingCount, 0);

  const inactive = result.body.referrals.find((referral) => referral.referredEmail === inactiveEmail);
  assert.ok(inactive);
  assert.equal(inactive.currentVipLevel, 0);
  assert.equal(inactive.activityStatus, "inactive");
  assert.equal(inactive.status, "credited");
  assert.equal(inactive.bonusAmount, 0);

  const active = result.body.referrals.find((referral) => referral.referredEmail === activeEmail);
  assert.ok(active);
  assert.equal(active.currentVipLevel, 1);
  assert.equal(active.activityStatus, "active");
  assert.equal(active.status, "credited");
  assert.equal(active.bonusAmount, 20);
});