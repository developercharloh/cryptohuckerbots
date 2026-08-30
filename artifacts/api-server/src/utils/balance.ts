import { db, transactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

const CREDIT_TYPES = ["deposit", "trade_profit", "trade_loss_return"] as const;
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

export async function getWalletSnapshot(userId: number): Promise<WalletSnapshot> {
  const [row] = await db
    .select({
      balance: sql<string>`coalesce(sum(case
        when ${transactionsTable.status} = 'completed'
          and ${transactionsTable.type} in ('deposit', 'trade_profit', 'trade_loss_return')
          then ${transactionsTable.amount}
        when ${transactionsTable.status} = 'completed'
          and ${transactionsTable.type} in ('withdrawal', 'trade_loss', 'reserved_stake', 'trade_fee', 'bot_purchase', 'vip_package_purchase')
          then -${transactionsTable.amount}
        -- Pending withdrawals lock funds before an admin review.
        when ${transactionsTable.status} = 'pending'
          and ${transactionsTable.type} in ('withdrawal', 'reserved_stake', 'trade_fee', 'bot_purchase', 'vip_package_purchase')
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
    availableBalance: Math.round(Math.max(0, ledgerBalance - pendingOutflow) * 100) / 100,
    totalDeposited: Math.round(Number(row?.totalDeposited ?? 0) * 100) / 100,
  };
}

export async function getAvailableBalance(userId: number): Promise<number> {
  const wallet = await getWalletSnapshot(userId);
  return wallet.availableBalance;
}
