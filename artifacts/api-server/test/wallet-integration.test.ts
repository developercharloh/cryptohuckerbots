import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, test } from "node:test";
import { BSC_DEPOSIT_ADDRESS } from "../src/lib/payment-methods.ts";

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
  authRateLimitsTable,
  depositSessionsTable,
  earningsTable,
  kycTable,
  notificationSettingsTable,
  sessionsTable,
  transactionsTable,
  usersTable,
  vipInvestmentCapitalTable,
  withdrawalConfirmationsTable,
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
  await db.delete(authRateLimitsTable);

  const adminRegistration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: { fullName: "Wallet Integration Admin", email: adminEmail, password, country: "Kenya", phone: `+254703${String(process.pid).padStart(4, "0")}` },
    cookieJar: adminJar,
  });
  assert.equal(adminRegistration.response.status, 201);
  adminUserId = adminRegistration.body.user.id;
  await db.update(usersTable).set({ isAdmin: true }).where(eq(usersTable.id, adminUserId));

  const userRegistration = await request<{ user: { id: number } }>("/api/auth/register", {
    method: "POST",
    body: { fullName: "Wallet Integration User", email: userEmail, password, country: "Kenya", phone: `+254704${String(process.pid).padStart(4, "0")}` },
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
    await db.delete(depositSessionsTable).where(eq(depositSessionsTable.userId, userId));
    await db.delete(withdrawalConfirmationsTable).where(eq(withdrawalConfirmationsTable.userId, userId));
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
    body: { amount: 250, paymentMethod: "BSC BNB Smart Chain (BEP20)", walletAddress: "test-wallet", txid: `0x${"01".repeat(32)}` },
  });
  assert.equal(pendingDeposit.response.status, 201);

  const beforeApproval = await request<{ mainWalletBalance: number }>("/api/dashboard/summary");
  assert.equal(beforeApproval.body.mainWalletBalance, 125);

  const approvedDeposit = await request(`/api/admin/transactions/${pendingDeposit.body.id}/review`, {
    method: "POST",
    cookieJar: adminJar,
    body: { action: "approve", txid: `0x${"01".repeat(32)}` },
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
  // Legacy earnings rows must not inflate the dashboard's real trade profit.
  await db.insert(earningsTable).values({
    userId: targetUserId,
    amount: "17453.00",
    source: "legacy-import",
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
    totalProfit: number;
  }>("/api/dashboard/summary");
  assert.equal(summary.response.status, 200);
  assert.equal(summary.body.mainWalletBalance, 425);
  assert.equal(summary.body.availableBalance, 425);
  assert.equal(summary.body.lockedInvestmentCapital, 500);
  assert.equal(summary.body.totalBalance, 925);
  assert.equal(summary.body.totalEarnings, 50);
  assert.equal(summary.body.totalProfit, 50);

  const depositSession = await request<{ id: number; status: string; amount: number }>("/api/cashier/deposit/session", {
    method: "POST",
    body: { amount: 80, paymentMethodId: "usdt_bep20" },
  });
  assert.equal(depositSession.response.status, 201);
  assert.equal(depositSession.body.status, "waiting_payment");
  assert.equal(depositSession.body.amount, 80);

  const submittedTxid = `0x${"ab".repeat(32)}`;
  const submittedDeposit = await request<{ txid: string; status: string }>(`/api/cashier/deposit/session/${depositSession.body.id}/txid`, {
    method: "POST",
    body: { txid: submittedTxid },
  });
  assert.equal(submittedDeposit.response.status, 200);
  assert.equal(submittedDeposit.body.status, "payment_detected");
  assert.equal(submittedDeposit.body.txid, submittedTxid);

  const duplicateHash = await request("/api/cashier/deposit", {
    method: "POST",
    body: { amount: 20, paymentMethod: "BSC BNB Smart Chain (BEP20)", txid: submittedTxid },
  });
  assert.equal(duplicateHash.response.status, 409);

  const hashlessSession = await request<{ id: number }>("/api/cashier/deposit/session", {
    method: "POST",
    body: { amount: 90, paymentMethodId: "usdt_bep20" },
  });
  assert.equal(hashlessSession.response.status, 201);

  const adminDepositSessions = await request<Array<{
    id: number;
    txid: string | null;
    depositAddress: string;
  }>>("/api/admin/deposit-sessions", { cookieJar: adminJar });
  assert.equal(adminDepositSessions.response.status, 200);
  const adminDeposit = adminDepositSessions.body.find((entry) => entry.id === depositSession.body.id);
  assert.ok(adminDeposit);
  assert.equal(adminDeposit.txid, submittedTxid);
  assert.equal(adminDeposit.depositAddress, BSC_DEPOSIT_ADDRESS);
  assert.equal(adminDepositSessions.body.some((entry) => entry.id === hashlessSession.body.id), false);

  const reconciliationLookup = await request<{
    realName: string;
    accountUid: string;
    amount: number;
    alreadyReconciled: boolean;
  }>("/api/admin/deposit-reconciliation/lookup", {
    method: "POST",
    cookieJar: adminJar,
    body: { txid: submittedTxid },
  });
  assert.equal(reconciliationLookup.response.status, 200);
  assert.equal(reconciliationLookup.body.realName, "Wallet Integration User");
  assert.ok(reconciliationLookup.body.accountUid);
  assert.equal(reconciliationLookup.body.amount, 80);
  assert.equal(reconciliationLookup.body.alreadyReconciled, false);

  const beforeSessionApproval = await request<{ mainWalletBalance: number }>("/api/dashboard/summary");
  assert.equal(beforeSessionApproval.body.mainWalletBalance, 425);

  const approvedDepositSession = await request(`/api/admin/deposit-sessions/${depositSession.body.id}/review`, {
    method: "POST",
    cookieJar: adminJar,
    body: { action: "approve", txid: submittedTxid },
  });
  assert.equal(approvedDepositSession.response.status, 200);
  assert.equal(approvedDepositSession.body.status, "completed");

  const afterSessionApproval = await request<{
    mainWalletBalance: number;
    availableBalance: number;
  }>("/api/dashboard/summary");
  assert.equal(afterSessionApproval.body.mainWalletBalance, 505);
  assert.equal(afterSessionApproval.body.availableBalance, 505);

  const repeatedReconciliation = await request(`/api/admin/deposit-sessions/${depositSession.body.id}/review`, {
    method: "POST",
    cookieJar: adminJar,
    body: { action: "approve", txid: submittedTxid },
  });
  assert.equal(repeatedReconciliation.response.status, 409);

  const pendingWithdrawal = await request("/api/cashier/withdraw", {
    method: "POST",
    body: {
      amount: 100,
      paymentMethod: "BSC BNB Smart Chain (BEP20)",
      walletAddress: "0x1234567890abcdef1234567890ABCDEF12345678",
    },
  });
  assert.equal(pendingWithdrawal.response.status, 400);

  const withdrawalPreparation = await request<{ confirmationToken: string }>("/api/cashier/withdraw/prepare", {
    method: "POST",
    body: {
      amount: 100,
      paymentMethod: "BSC BNB Smart Chain (BEP20)",
      walletAddress: "0x1234567890abcdef1234567890ABCDEF12345678",
    },
  });
  assert.equal(withdrawalPreparation.response.status, 200);
  assert.ok(withdrawalPreparation.body.confirmationToken);

  const confirmedWithdrawal = await request("/api/cashier/withdraw", {
    method: "POST",
    body: {
      amount: 100,
      paymentMethod: "BSC BNB Smart Chain (BEP20)",
      walletAddress: "0x1234567890abcdef1234567890ABCDEF12345678",
      confirmationToken: withdrawalPreparation.body.confirmationToken,
    },
  });
  assert.equal(confirmedWithdrawal.response.status, 201);
  const heldSummary = await request<{
    mainWalletBalance: number;
    availableBalance: number;
    pendingOutflow: number;
    totalBalance: number;
    portfolioBalance: number;
  }>("/api/dashboard/summary");
  assert.equal(heldSummary.body.mainWalletBalance, 505);
   assert.equal(heldSummary.body.availableBalance, 405);
  assert.equal(heldSummary.body.pendingOutflow, 100);
  assert.equal(heldSummary.body.totalBalance, 1005);
  assert.equal(heldSummary.body.portfolioBalance, 1005);

  const adminUsers = await request<Array<{
    id: number;
    balance: number;
    availableBalance: number;
    pendingOutflow: number;
    mainWalletBalance: number;
    vaultCapital: number;
    portfolioBalance: number;
  }>>("/api/admin/users", { cookieJar: adminJar });
  assert.equal(adminUsers.response.status, 200);
  const adminListUser = adminUsers.body.find((entry) => entry.id === targetUserId);
  assert.ok(adminListUser);
  assert.equal(adminListUser.mainWalletBalance, heldSummary.body.mainWalletBalance);
  assert.equal(adminListUser.vaultCapital, 500);
  assert.equal(adminListUser.portfolioBalance, heldSummary.body.portfolioBalance);
  assert.equal(adminListUser.availableBalance, heldSummary.body.availableBalance);
  assert.equal(adminListUser.pendingOutflow, heldSummary.body.pendingOutflow);
  assert.equal(adminListUser.balance, heldSummary.body.availableBalance);

  const adminDetail = await request<{
    mainWalletBalance: number;
    vaultCapital: number;
    portfolioBalance: number;
    availableBalance: number;
    pendingOutflow: number;
  }>(`/api/admin/users/${targetUserId}`, { cookieJar: adminJar });
  assert.equal(adminDetail.response.status, 200);
  assert.equal(adminDetail.body.mainWalletBalance, heldSummary.body.mainWalletBalance);
  assert.equal(adminDetail.body.vaultCapital, 500);
  assert.equal(adminDetail.body.portfolioBalance, heldSummary.body.portfolioBalance);
  assert.equal(adminDetail.body.availableBalance, heldSummary.body.availableBalance);
  assert.equal(adminDetail.body.pendingOutflow, heldSummary.body.pendingOutflow);

  const withdrawalFromMainWallet = await request("/api/cashier/withdraw", {
    method: "POST",
    body: {
      amount: 326,
      paymentMethod: "BSC BNB Smart Chain (BEP20)",
      walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    },
  });
  assert.equal(withdrawalFromMainWallet.response.status, 400);

  const secondWithdrawalPreparation = await request<{ confirmationToken: string }>("/api/cashier/withdraw/prepare", {
    method: "POST",
    body: {
      amount: 326,
      paymentMethod: "BSC BNB Smart Chain (BEP20)",
      walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
    },
  });
  assert.equal(secondWithdrawalPreparation.response.status, 200);

  const secondWithdrawal = await request("/api/cashier/withdraw", {
    method: "POST",
    body: {
      amount: 326,
      paymentMethod: "BSC BNB Smart Chain (BEP20)",
      walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      confirmationToken: secondWithdrawalPreparation.body.confirmationToken,
    },
  });
  assert.equal(secondWithdrawal.response.status, 201);

  const replayedWithdrawal = await request("/api/cashier/withdraw", {
    method: "POST",
    body: {
      amount: 326,
      paymentMethod: "BSC BNB Smart Chain (BEP20)",
      walletAddress: "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd",
      confirmationToken: secondWithdrawalPreparation.body.confirmationToken,
    },
  });
  assert.equal(replayedWithdrawal.response.status, 400);

  await db.insert(transactionsTable).values({
    userId: targetUserId,
    type: "trade_profit",
    amount: "3.00",
    status: "completed",
    paymentMethod: "balance",
    description: "Regression test settled profit",
  });
  const profitSummary = await request<{
    totalProfit: number;
    vaultCapital: number;
    portfolioBalance: number;
  }>("/api/dashboard/summary");
  assert.equal(profitSummary.body.totalProfit, 53);
  assert.equal(profitSummary.body.vaultCapital, 500);
  assert.equal(profitSummary.body.portfolioBalance, 1008);

  const earningsChart = await request<Array<{ profit: number; cumulative: number }>>(
    "/api/dashboard/earnings-chart?period=30d",
  );
  assert.equal(earningsChart.response.status, 200);
  assert.equal(earningsChart.body.length, 30);
  assert.equal(earningsChart.body.reduce((sum, point) => sum + point.profit, 0), 53);
  assert.equal(earningsChart.body.at(-1)?.cumulative, 53);
});