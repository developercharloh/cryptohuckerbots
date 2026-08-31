import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";

process.env.NODE_ENV = "test";
process.env.ADMIN_PANEL_PASSWORD = "vip-package-test-admin-password";
process.env.ADMIN_JWT_SECRET = "vip-package-test-jwt-secret";

const { default: app } = await import("../src/app.ts");
const database = await import("@workspace/db");
const { db, pool, sql, eq, asc, transactionsTable, vipPackagePurchasesTable, vipInvestmentCapitalTable, signalClaimsTable, signalOpportunitiesTable, positionsTable, usersTable, sessionsTable } = {
  ...database,
  ...(await import("drizzle-orm")),
};

const origin = "https://vixus.trade";
const userEmail = `vip-package-${Date.now()}-${process.pid}@example.test`;
const noBalanceEmail = `vip-package-empty-${Date.now()}-${process.pid}@example.test`;
const userPassword = "VipPackageTestPassword1!";

class CookieJar {
  private readonly cookies = new Map<string, string>();

  absorb(response: Response) {
    const headers = response.headers as Headers & { getSetCookie?: () => string[] };
    const values = headers.getSetCookie?.() ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie")!] : []);
    for (const value of values) {
      const separator = value.indexOf("=");
      if (separator < 0) continue;
      const name = value.slice(0, separator);
      const cookieValue = value.slice(separator + 1).split(";", 1)[0];
      if (!cookieValue || value.toLowerCase().includes("max-age=0")) this.cookies.delete(name);
      else this.cookies.set(name, cookieValue);
    }
  }

  header() {
    return this.cookies.size ? [...this.cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ") : undefined;
  }
}

let server: Server;
let baseUrl: string;
let userId = 0;
let noBalanceUserId = 0;
let databaseAvailable = false;
const jar = new CookieJar();
const noBalanceJar = new CookieJar();

async function request<T = any>(path: string, options: { method?: string; body?: unknown; cookieJar?: CookieJar } = {}) {
  const headers = new Headers({ Origin: origin });
  const cookie = (options.cookieJar ?? jar).header();
  if (cookie) headers.set("Cookie", cookie);
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const response = await fetch(new URL(path, baseUrl), {
    method: options.method ?? "GET",
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  (options.cookieJar ?? jar).absorb(response);
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

  const status = await db.execute(sql`select to_regclass('public.vip_package_purchases') as table_name`);
  if (!status.rows[0]?.table_name) return;
  const registration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: { fullName: "VIP Package Test User", email: userEmail, password: userPassword },
  });
  assert.equal(registration.response.status, 201);
  userId = registration.body.user.id;
  const emptyRegistration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    cookieJar: noBalanceJar,
    body: { fullName: "VIP Empty Wallet User", email: noBalanceEmail, password: userPassword },
  });
  assert.equal(emptyRegistration.response.status, 201);
  noBalanceUserId = emptyRegistration.body.user.id;
  await db.insert(transactionsTable).values({
    userId,
    type: "deposit",
    amount: "50000.00",
    status: "completed",
    paymentMethod: "test",
    description: "VIP package regression funding",
  });
  databaseAvailable = true;
});

after(async () => {
  if (userId) {
    await db.delete(vipInvestmentCapitalTable).where(eq(vipInvestmentCapitalTable.userId, userId));
    await db.delete(vipPackagePurchasesTable).where(eq(vipPackagePurchasesTable.userId, userId));
    await db.delete(signalClaimsTable).where(eq(signalClaimsTable.userId, userId));
    await db.delete(positionsTable).where(eq(positionsTable.userId, userId));
    await db.delete(transactionsTable).where(eq(transactionsTable.userId, userId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, userId));
    await db.delete(usersTable).where(eq(usersTable.id, userId));
  }
  if (noBalanceUserId) {
    await db.delete(vipInvestmentCapitalTable).where(eq(vipInvestmentCapitalTable.userId, noBalanceUserId));
    await db.delete(vipPackagePurchasesTable).where(eq(vipPackagePurchasesTable.userId, noBalanceUserId));
    await db.delete(signalClaimsTable).where(eq(signalClaimsTable.userId, noBalanceUserId));
    await db.delete(positionsTable).where(eq(positionsTable.userId, noBalanceUserId));
    await db.delete(transactionsTable).where(eq(transactionsTable.userId, noBalanceUserId));
    await db.delete(sessionsTable).where(eq(sessionsTable.userId, noBalanceUserId));
    await db.delete(usersTable).where(eq(usersTable.id, noBalanceUserId));
  }
  await pool.end();
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
});

test("deposit funding does not grant VIP, purchase unlocks access, and purchases are atomic", async (t) => {
  if (!databaseAvailable) {
    t.skip("requires a provisioned PostgreSQL test schema");
    return;
  }

  const beforePurchase = await request<{ vipLevel: number; hasPackage: boolean; canExecute: boolean; totalDeposited: number }>("/api/trade/access");
  assert.equal(beforePurchase.response.status, 200);
  assert.equal(beforePurchase.body.vipLevel, 0);
  assert.equal(beforePurchase.body.hasPackage, false);
  assert.equal(beforePurchase.body.canExecute, false);
  assert.equal(beforePurchase.body.totalDeposited, 50000);

  const blocked = await request("/api/trade/execute", {
    method: "POST",
    body: { signalId: "forged-signal", opportunityId: 1, consent: true },
  });
  assert.equal(blocked.response.status, 403);
  assert.equal(blocked.body.code, "VIP_REQUIRED");

  const insufficient = await request<{ code: string }>("/api/trade/vip-packages/1/purchase", {
    method: "POST",
    cookieJar: noBalanceJar,
  });
  assert.equal(insufficient.response.status, 400);
  assert.equal(insufficient.body.code, "INSUFFICIENT_BALANCE");

  await db.insert(transactionsTable).values({
    userId: noBalanceUserId,
    type: "deposit",
    amount: "500.00",
    status: "completed",
    paymentMethod: "test",
    description: "VIP upgrade shortfall regression funding",
  });
  const noBalanceFirst = await request<{ amountPaid: number; mainWalletBalance: number }>("/api/trade/vip-packages/1/purchase", {
    method: "POST",
    cookieJar: noBalanceJar,
  });
  assert.equal(noBalanceFirst.response.status, 201);
  assert.equal(noBalanceFirst.body.amountPaid, 500);
  assert.equal(noBalanceFirst.body.mainWalletBalance, 0);
  const insufficientUpgrade = await request<{ code: string; error: string }>("/api/trade/vip-packages/2/purchase", {
    method: "POST",
    cookieJar: noBalanceJar,
  });
  assert.equal(insufficientUpgrade.response.status, 400);
  assert.equal(insufficientUpgrade.body.code, "INSUFFICIENT_BALANCE");
  assert.match(insufficientUpgrade.body.error, /Amount required: \$500\.00/);
  assert.match(insufficientUpgrade.body.error, /Available balance: \$0\.00/);

  const noBalanceSignals = await request<Array<{ opportunityId: number }>>("/api/trade/signals", { cookieJar: noBalanceJar });
  assert.equal(noBalanceSignals.response.status, 200);
  await db.insert(signalClaimsTable).values(noBalanceSignals.body.slice(0, 3).map((signal) => ({
    userId: noBalanceUserId,
    opportunityId: signal.opportunityId,
    consentAt: new Date(),
  })));
  const exhaustedVipOne = await request<{ vipLevel: number; remainingToday: number; cooldownActive: boolean; cooldownUntil: string | null }>("/api/trade/access", { cookieJar: noBalanceJar });
  assert.equal(exhaustedVipOne.body.vipLevel, 1);
  assert.equal(exhaustedVipOne.body.remainingToday, 0);
  assert.equal(exhaustedVipOne.body.cooldownActive, true);
  assert.ok(exhaustedVipOne.body.cooldownUntil);

  await db.insert(transactionsTable).values({
    userId: noBalanceUserId,
    type: "deposit",
    amount: "500.00",
    status: "completed",
    paymentMethod: "test",
    description: "VIP cooldown upgrade regression funding",
  });
  const upgradedNoBalance = await request<{ package: { level: number } }>("/api/trade/vip-packages/2/purchase", {
    method: "POST",
    cookieJar: noBalanceJar,
  });
  assert.equal(upgradedNoBalance.response.status, 201);
  assert.equal(upgradedNoBalance.body.package.level, 2);
  const upgradedNoBalanceAccess = await request<{ vipLevel: number; dailyLimit: number; usedToday: number; remainingToday: number; cooldownActive: boolean }>("/api/trade/access", { cookieJar: noBalanceJar });
  assert.equal(upgradedNoBalanceAccess.body.vipLevel, 2);
  assert.equal(upgradedNoBalanceAccess.body.dailyLimit, 4);
  assert.equal(upgradedNoBalanceAccess.body.usedToday, 3);
  assert.equal(upgradedNoBalanceAccess.body.remainingToday, 1);
  assert.equal(upgradedNoBalanceAccess.body.cooldownActive, false);

  const first = await request<{ package: { level: number }; amountPaid: number; lockedInvestmentCapital: number; mainWalletBalance: number }>("/api/trade/vip-packages/1/purchase", { method: "POST" });
  assert.equal(first.response.status, 201);
  assert.equal(first.body.package.level, 1);
  assert.equal(first.body.amountPaid, 500);
  assert.equal(first.body.lockedInvestmentCapital, 500);
  assert.equal(first.body.mainWalletBalance, 49500);

  const active = await request<{ vipLevel: number; hasPackage: boolean; canExecute: boolean; lockedInvestmentCapital: number }>("/api/trade/access");
  assert.equal(active.body.vipLevel, 1);
  assert.equal(active.body.hasPackage, true);
  assert.equal(active.body.canExecute, true);
  assert.equal(active.body.lockedInvestmentCapital, 500);

  const packages = await request<Array<{ level: number; amountDue: number }>>("/api/trade/vip-packages");
  assert.equal(packages.response.status, 200);
  assert.equal(packages.body.find((pkg) => pkg.level === 2)?.amountDue, 500);
  assert.equal(packages.body.find((pkg) => pkg.level === 3)?.amountDue, 1500);

  const duplicate = await request<{ code: string }>("/api/trade/vip-packages/1/purchase", { method: "POST" });
  assert.equal(duplicate.response.status, 409);
  assert.equal(duplicate.body.code, "VIP_PACKAGE_NOT_UPGRADABLE");

  const upgrade = await request<{ package: { level: number }; amountPaid: number; lockedInvestmentCapital: number; mainWalletBalance: number }>("/api/trade/vip-packages/2/purchase", { method: "POST" });
  assert.equal(upgrade.response.status, 201);
  assert.equal(upgrade.body.package.level, 2);
  assert.equal(upgrade.body.amountPaid, 500);
  assert.equal(upgrade.body.lockedInvestmentCapital, 1000);
  assert.equal(upgrade.body.mainWalletBalance, 49000);

  const upgradedAccess = await request<{ vipLevel: number; dailyLimit: number; remainingToday: number }>("/api/trade/access");
  assert.equal(upgradedAccess.body.vipLevel, 2);
  assert.equal(upgradedAccess.body.dailyLimit, 4);
  assert.equal(upgradedAccess.body.remainingToday, 4);

  const concurrent = await Promise.all([
    request("/api/trade/vip-packages/5/purchase", { method: "POST" }),
    request("/api/trade/vip-packages/5/purchase", { method: "POST" }),
  ]);
  assert.deepEqual(concurrent.map((result) => result.response.status).sort(), [201, 409]);
  const successfulConcurrentUpgrade = concurrent.find((result) => result.response.status === 201);
  assert.equal(successfulConcurrentUpgrade?.body.amountPaid, 7000);
  assert.equal(successfulConcurrentUpgrade?.body.mainWalletBalance, 42000);

  const lowerTier = await request<{ code: string }>("/api/trade/vip-packages/3/purchase", { method: "POST" });
  assert.equal(lowerTier.response.status, 409);
  assert.equal(lowerTier.body.code, "VIP_PACKAGE_NOT_UPGRADABLE");

  const finalAccess = await request<{ vipLevel: number; remainingToday: number }>("/api/trade/access");
  assert.equal(finalAccess.body.vipLevel, 5);
  assert.equal(finalAccess.body.remainingToday, 7);
  const capitalRows = await db.select({
    level: vipInvestmentCapitalTable.vipLevel,
    amount: vipInvestmentCapitalTable.amount,
    status: vipInvestmentCapitalTable.status,
  }).from(vipInvestmentCapitalTable).where(eq(vipInvestmentCapitalTable.userId, userId));
  assert.equal(capitalRows.filter((row) => row.status === "locked").length, 1);
  assert.equal(capitalRows.find((row) => row.status === "locked")?.level, 5);
  assert.equal(capitalRows.find((row) => row.status === "locked")?.amount, "8000.00");
  const vipTransactions = await db.select({
    type: transactionsTable.type,
    amount: transactionsTable.amount,
  }).from(transactionsTable).where(eq(transactionsTable.userId, userId));
  assert.deepEqual(
    vipTransactions
      .filter((row) => row.type === "vip_package_purchase")
      .map((row) => row.amount)
      .sort(),
    ["500.00", "500.00", "7000.00"],
  );

  const beforeTrade = await request<{ mainWalletBalance: number; vaultCapital: number; portfolioBalance: number; totalProfit: number }>("/api/dashboard/summary");
  assert.equal(beforeTrade.body.mainWalletBalance, 42000);
  assert.equal(beforeTrade.body.vaultCapital, 8000);
  assert.equal(beforeTrade.body.portfolioBalance, 50000);
  assert.equal(beforeTrade.body.totalProfit, 0);

  const availableSignals = await request<Array<{ id: string; opportunityId: number }>>("/api/trade/signals");
  assert.equal(availableSignals.response.status, 200);
  const signal = availableSignals.body[0];
  assert.ok(signal, "VIP user should receive an available signal");

  const opened = await request<{ id: number }>("/api/trade/execute", {
    method: "POST",
    body: { signalId: signal.id, opportunityId: signal.opportunityId, consent: true },
  });
  assert.equal(opened.response.status, 200);

  const afterOpen = await request<{ mainWalletBalance: number; vaultCapital: number; portfolioBalance: number }>("/api/dashboard/summary");
  assert.equal(afterOpen.body.mainWalletBalance, 42000);
  assert.equal(afterOpen.body.vaultCapital, 7997.5);
  assert.equal(afterOpen.body.portfolioBalance, 49997.5);

  // Simulate the user closing the app before settlement. The next server
  // read must settle the AI Signal independently of the browser timer.
  await db.update(positionsTable)
    .set({ openedAt: new Date(Date.now() - 10 * 60 * 1000) })
    .where(eq(positionsTable.id, opened.body.id));
  const restored = await request<Array<{ id: number; pnl: number; status: string }>>("/api/trade/positions");
  const settled = restored.body.find((position) => position.id === opened.body.id);
  assert.ok(settled);
  assert.equal(settled.pnl, 2.5);
  assert.equal(settled.status, "tp_hit");

  const afterClose = await request<{ mainWalletBalance: number; vaultCapital: number; portfolioBalance: number; totalProfit: number }>("/api/dashboard/summary");
  assert.equal(afterClose.body.mainWalletBalance, 42002.5);
  assert.equal(afterClose.body.vaultCapital, 8000);
  assert.equal(afterClose.body.portfolioBalance, 50002.5);
  assert.equal(afterClose.body.totalProfit, 2.5);

  const signalRewards = await db.select({
    type: transactionsTable.type,
    amount: transactionsTable.amount,
  }).from(transactionsTable).where(eq(transactionsTable.userId, userId));
  assert.deepEqual(
    signalRewards.filter((row) => row.type === "signal_reward").map((row) => row.amount),
    ["2.50"],
  );

   // A fresh signal window for the same pair is a separate opportunity, so
   // users can trade the same pair again within their daily allowance.
   const repeatedPairSignals = await request<Array<{ id: string; opportunityId: number; pair: string }>>("/api/trade/signals");
   const repeatedPairSignal = repeatedPairSignals.body.find((candidate) =>
     candidate.pair === signal.pair && candidate.opportunityId !== signal.opportunityId
   );
   assert.ok(repeatedPairSignal, "The same pair should have another fresh signal opportunity");
   const repeatedOpened = await request<{ id: number }>("/api/trade/execute", {
     method: "POST",
     body: { signalId: repeatedPairSignal.id, opportunityId: repeatedPairSignal.opportunityId, consent: true },
   });
   assert.equal(repeatedOpened.response.status, 200);
   assert.notEqual(repeatedOpened.body.id, opened.body.id);
   await db.update(positionsTable)
     .set({ openedAt: new Date(Date.now() - 10 * 60 * 1000) })
     .where(eq(positionsTable.id, repeatedOpened.body.id));
   await request<Array<{ id: number; pnl: number; status: string }>>("/api/trade/positions");
   const afterRepeatedClose = await request<{ mainWalletBalance: number; vaultCapital: number; portfolioBalance: number; totalProfit: number }>("/api/dashboard/summary");
   assert.equal(afterRepeatedClose.body.mainWalletBalance, 42005);
   assert.equal(afterRepeatedClose.body.vaultCapital, 8000);
   assert.equal(afterRepeatedClose.body.portfolioBalance, 50005);
   assert.equal(afterRepeatedClose.body.totalProfit, 5);

   const repeatedSignalRewards = await db.select({
     type: transactionsTable.type,
     amount: transactionsTable.amount,
   }).from(transactionsTable).where(eq(transactionsTable.userId, userId));
   assert.deepEqual(
     repeatedSignalRewards.filter((row) => row.type === "signal_reward").map((row) => row.amount),
     ["2.50", "2.50"],
   );

  const opportunities = await db.select({ id: signalOpportunitiesTable.id })
    .from(signalOpportunitiesTable)
    .orderBy(asc(signalOpportunitiesTable.id));
  const additionalClaims = opportunities
    .filter((opportunity) => opportunity.id !== signal.opportunityId)
    .slice(0, 6);
  await db.insert(signalClaimsTable).values(additionalClaims.map((opportunity) => ({
    userId,
    opportunityId: opportunity.id,
    consentAt: new Date(),
  })));
  const exhaustedAccess = await request<{ vipLevel: number; remainingToday: number; canExecute: boolean; cooldownActive: boolean; cooldownUntil: string | null }>("/api/trade/access");
  assert.equal(exhaustedAccess.body.vipLevel, 5);
  assert.equal(exhaustedAccess.body.remainingToday, 0);
  assert.equal(exhaustedAccess.body.canExecute, false);
  assert.equal(exhaustedAccess.body.cooldownActive, true);
  assert.ok(exhaustedAccess.body.cooldownUntil);
  assert.ok(new Date(exhaustedAccess.body.cooldownUntil!).getTime() > Date.now());

  const refreshedExhaustedAccess = await request<{ cooldownUntil: string | null }>("/api/trade/access");
  assert.equal(refreshedExhaustedAccess.body.cooldownUntil, exhaustedAccess.body.cooldownUntil);
  const blockedDuringCooldown = await request<{ code: string; cooldownUntil: string }>("/api/trade/execute", {
    method: "POST",
    body: { signalId: signal.id, opportunityId: signal.opportunityId, consent: true },
  });
  assert.equal(blockedDuringCooldown.response.status, 429);
  assert.equal(blockedDuringCooldown.body.code, "SIGNAL_COOLDOWN");
  assert.equal(blockedDuringCooldown.body.cooldownUntil, exhaustedAccess.body.cooldownUntil);
  const noSignalsDuringCooldown = await request<Array<unknown>>("/api/trade/signals");
  assert.deepEqual(noSignalsDuringCooldown.body, []);

  const expiredAt = new Date(Date.now() - 24 * 60 * 60_000 - 1000);
  await db.update(signalClaimsTable).set({ createdAt: expiredAt, consentAt: expiredAt }).where(eq(signalClaimsTable.userId, userId));
  const afterCooldown = await request<{ remainingToday: number; cooldownActive: boolean; cooldownUntil: string | null }>("/api/trade/access");
  assert.equal(afterCooldown.body.remainingToday, 7);
  assert.equal(afterCooldown.body.cooldownActive, false);
  assert.equal(afterCooldown.body.cooldownUntil, null);

  const retryClose = await request<{ pnl: number }>(`/api/trade/positions/${opened.body.id}/close`, { method: "POST" });
  assert.equal(retryClose.response.status, 200);
  assert.equal(retryClose.body.pnl, 2.5);
  const afterRetry = await request<{ mainWalletBalance: number; portfolioBalance: number; totalProfit: number }>("/api/dashboard/summary");
  assert.equal(afterRetry.body.mainWalletBalance, 42002.5);
  assert.equal(afterRetry.body.portfolioBalance, 50002.5);
  assert.equal(afterRetry.body.totalProfit, 2.5);
});