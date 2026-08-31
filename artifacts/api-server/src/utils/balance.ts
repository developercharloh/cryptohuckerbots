import { db, transactionsTable, vipInvestmentCapitalTable, vipPackagePurchasesTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

const CREDIT_TYPES = ["deposit", "trade_profit", "trade_loss_return", "signal_reward"] as const;
const DEBIT_TYPES = [
  "withdrawal",
  "trade_loss",
  "reserved_stake",
  "trade_fee",
  "bot_purchase",
  "vip_package_purchase",
] as const;
const PENDING_HOLD_TYPES = [
  "withdrawal",
  "reserved_stake",
  "trade_fee",
  "bot_purchase",
  "vip_package_purchase",
] as const;
const VAULT_CREDIT_TYPES = ["vault_trade_return"] as const;
const VAULT_DEBIT_TYPES = ["vault_trade_stake", "vault_trade_fee"] as const;

type WalletTransaction = {
  type: string;
  amount: string | number;
  status?: string;
};

export function transactionDelta(type: string, amount: number): number {
  if ((CREDIT_TYPES as readonly string[]).includes(type)) return amount;
  if ((DEBIT_TYPES as readonly string[]).includes(type)) return -amount;
  return 0;
}

export function vaultTransactionDelta(type: string, amount: number): number {
  if ((VAULT_CREDIT_TYPES as readonly string[]).includes(type)) return amount;
  if ((VAULT_DEBIT_TYPES as readonly string[]).includes(type)) return -amount;
  return 0;
}

export function calculateVaultCapital(initialCapital: number, txns: WalletTransaction[]): number {
  let capital = Number.isFinite(initialCapital) ? initialCapital : 0;
  for (const txn of txns) {
    if (txn.status && txn.status !== "completed") continue;
    const amount = Number(txn.amount);
    if (!Number.isFinite(amount)) continue;
    capital += vaultTransactionDelta(txn.type, amount);
  }
  return Math.round(Math.max(0, capital) * 100) / 100;
}

export function calculateWalletBalance(txns: WalletTransaction[]): number {
  let balance = 0;
  for (const txn of txns) {
    if (txn.status && txn.status !== "completed") continue;
    balance += transactionDelta(txn.type, Number(txn.amount));
  }
  return Math.max(0, Math.round(balance * 100) / 100);
}

export type WalletSnapshot = {
  ledgerBalance: number;
  pendingOutflow: number;
  availableBalance: number;
  totalDeposited: number;
};

export type VaultCapitalSnapshot = {
  initialCapital: number;
  vaultCapital: number;
};

export type AccountBalanceSnapshot = WalletSnapshot & VaultCapitalSnapshot & {
  mainWalletBalance: number;
  portfolioBalance: number;
};

export function composeAccountBalanceSnapshot(
  wallet: WalletSnapshot,
  vault: VaultCapitalSnapshot,
): AccountBalanceSnapshot {
  const mainWalletBalance = wallet.ledgerBalance;
  const portfolioBalance = Math.round(Math.max(0, mainWalletBalance + vault.vaultCapital) * 100) / 100;
  return {
    ...wallet,
    ...vault,
    mainWalletBalance,
    portfolioBalance,
  };
}

export async function getAccountBalanceSnapshot(userId: number): Promise<AccountBalanceSnapshot> {
  const [wallet, vault] = await Promise.all([
    getWalletSnapshot(userId),
    getVaultCapitalSnapshot(userId),
  ]);
  return composeAccountBalanceSnapshot(wallet, vault);
}

export function calculateWalletSnapshot(txns: WalletTransaction[]): WalletSnapshot {
  let ledgerBalance = 0;
  let pendingOutflow = 0;
  let totalDeposited = 0;

  for (const txn of txns) {
    const amount = Number(txn.amount);
    if (!Number.isFinite(amount)) continue;

    if (txn.status === "pending") {
      if ((PENDING_HOLD_TYPES as readonly string[]).includes(txn.type)) {
        pendingOutflow += amount;
      }
      continue;
    }

    if (txn.status && txn.status !== "completed") continue;
    ledgerBalance += transactionDelta(txn.type, amount);
    if (txn.type === "deposit") totalDeposited += amount;
  }

  ledgerBalance = Math.max(0, Math.round(ledgerBalance * 100) / 100);
  pendingOutflow = Math.max(0, Math.round(pendingOutflow * 100) / 100);
  return {
    ledgerBalance,
    pendingOutflow,
    availableBalance: ledgerBalance,
    totalDeposited: Math.round(totalDeposited * 100) / 100,
  };
}

export async function getWalletSnapshot(userId: number): Promise<WalletSnapshot> {
  const [row] = await db
    .select({
      balance: sql<string>`coalesce(sum(case
        when ${transactionsTable.status} = 'completed'
          and ${transactionsTable.type} in ('deposit', 'trade_profit', 'trade_loss_return', 'signal_reward')
          then ${transactionsTable.amount}
        when ${transactionsTable.status} = 'completed'
          and ${transactionsTable.type} in ('withdrawal', 'trade_loss', 'reserved_stake', 'trade_fee', 'bot_purchase', 'vip_package_purchase')
          then -${transactionsTable.amount}
        else 0 end), 0)`,
      pendingOutflow: sql<string>`coalesce(sum(case
        when ${transactionsTable.status} = 'pending'
          and ${transactionsTable.type} in ('withdrawal', 'reserved_stake', 'trade_fee', 'bot_purchase', 'vip_package_purchase')
          then ${transactionsTable.amount}
        else 0 end), 0)`,
      totalDeposited: sql<string>`coalesce(sum(case
        when ${transactionsTable.status} = 'completed'
          and ${transactionsTable.type} = 'deposit'
          then ${transactionsTable.amount}
        else 0 end), 0)`,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  const ledgerBalance = Math.max(0, Number(row?.balance ?? 0));
  const pendingOutflow = Math.max(0, Number(row?.pendingOutflow ?? 0));
  return {
    ledgerBalance: Math.round(ledgerBalance * 100) / 100,
    pendingOutflow: Math.round(pendingOutflow * 100) / 100,
    availableBalance: Math.round(ledgerBalance * 100) / 100,
    totalDeposited: Math.round(Number(row?.totalDeposited ?? 0) * 100) / 100,
  };
}

export async function getAvailableBalance(userId: number): Promise<number> {
  const wallet = await getWalletSnapshot(userId);
  return wallet.availableBalance;
}

export async function getVaultCapitalSnapshot(userId: number): Promise<VaultCapitalSnapshot> {
  const [[purchaseBaseline], [legacyCapital], vaultTransactions] = await Promise.all([
    db.select({
      amount: sql<string>`coalesce(sum(${vipPackagePurchasesTable.amount}), 0)`,
    }).from(vipPackagePurchasesTable).where(and(
      eq(vipPackagePurchasesTable.userId, userId),
      eq(vipPackagePurchasesTable.status, "completed"),
    )),
    db.select({
      amount: sql<string>`coalesce(sum(${vipInvestmentCapitalTable.amount}), 0)`,
    }).from(vipInvestmentCapitalTable).where(and(
      eq(vipInvestmentCapitalTable.userId, userId),
      eq(vipInvestmentCapitalTable.status, "locked"),
    )),
    db.select({
      type: transactionsTable.type,
      amount: transactionsTable.amount,
      status: transactionsTable.status,
    }).from(transactionsTable).where(eq(transactionsTable.userId, userId)),
  ]);

  const purchasedCapital = Number(purchaseBaseline?.amount ?? 0);
  const legacyLockedCapital = Number(legacyCapital?.amount ?? 0);
  const initialCapital = purchasedCapital > 0 ? purchasedCapital : legacyLockedCapital;
  return {
    initialCapital: Math.round(Math.max(0, initialCapital) * 100) / 100,
    vaultCapital: calculateVaultCapital(initialCapital, vaultTransactions),
  };
}
