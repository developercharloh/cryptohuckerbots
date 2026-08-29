import { db, transactionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export async function getAvailableBalance(userId: number): Promise<number> {
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
          and ${transactionsTable.type} = 'withdrawal'
          then -${transactionsTable.amount}
        else 0 end), 0)`,
    })
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  return Number(row?.balance ?? 0);
}
