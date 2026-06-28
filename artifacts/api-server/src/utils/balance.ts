import { db, transactionsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

export async function getAvailableBalance(userId: number): Promise<number> {
  const txns = await db
    .select()
    .from(transactionsTable)
    .where(eq(transactionsTable.userId, userId));

  let balance = 0;
  for (const t of txns) {
    const amt = parseFloat(t.amount);
    if (t.status === "completed") {
      if (t.type === "deposit" || t.type === "trade_profit") balance += amt;
      if (t.type === "withdrawal" || t.type === "trade_loss" || t.type === "bot_purchase") balance -= amt;
    }
    // Pending withdrawals also lock the funds so users can't double-spend
    if (t.status === "pending" && t.type === "withdrawal") balance -= amt;
  }
  return balance;
}
