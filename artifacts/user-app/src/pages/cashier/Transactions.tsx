import { useState } from "react";
import { useLocation } from "wouter";
import { useListTransactions, ListTransactionsType } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { ChevronLeft, ArrowDownRight, ArrowUpRight, Zap, Trash2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUSD } from "@/lib/format";

const CLEAR_KEY = "vixus_cleared_txns_before";

export default function Transactions() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<ListTransactionsType>("all");

  const [clearedBefore, setClearedBefore] = useState<number>(() =>
    parseInt(localStorage.getItem(CLEAR_KEY) ?? "0", 10)
  );

  const { data: allTxns = [], isLoading } = useListTransactions({ type: filter });

  const transactions = allTxns.filter(tx => {
    if (!clearedBefore) return true;
    return new Date(tx.createdAt).getTime() >= clearedBefore;
  });

  const handleClear = () => {
    const now = Date.now();
    localStorage.setItem(CLEAR_KEY, String(now));
    setClearedBefore(now);
  };

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/cashier")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight flex-1">Transactions</h1>
          {transactions.length > 0 && (
            <button
              onClick={handleClear}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Clear
            </button>
          )}
        </div>

        <div className="flex bg-card p-1 rounded-xl h-12">
          {(["all", "deposit", "withdrawal"] as ListTransactionsType[]).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`flex-1 text-[13px] font-medium rounded-lg transition-colors capitalize ${filter === f ? "bg-primary text-white" : "text-muted-foreground"}`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {isLoading ? (
            Array(5).fill(0).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-2xl" />)
          ) : transactions.length > 0 ? (
            transactions.map((tx) => (
              <div key={tx.id} className="flex items-center justify-between p-4 bg-card rounded-2xl">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                    tx.type === "deposit" ? "bg-green-500/10" :
                    tx.type === "withdrawal" ? "bg-red-500/10" : "bg-primary/10"
                  }`}>
                    {tx.type === "deposit"
                      ? <ArrowDownRight className="w-5 h-5 text-green-500" />
                      : tx.type === "withdrawal"
                        ? <ArrowUpRight className="w-5 h-5 text-red-500" />
                        : <Zap className="w-4 h-4 text-primary fill-primary" />}
                  </div>
                  <div>
                    <div className="font-semibold text-sm mb-0.5 capitalize">{
                      tx.type === "trade_loss" ? "Trade Capital" : tx.type.replace("_", " ")
                    }</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(tx.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className={`font-bold text-sm mb-0.5 ${
                    tx.type === "deposit"    ? "text-green-500" :
                    tx.type === "withdrawal" ? "text-red-500"   : "text-foreground"
                  }`}>
                    {tx.type === "deposit" ? "+" : tx.type === "withdrawal" ? "−" : ""}{formatUSD(tx.amount)}
                  </div>
                  <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block ${
                    tx.status === "Completed" ? "bg-green-500/10 text-green-500" :
                    tx.status === "Failed"    ? "bg-red-500/10 text-red-500"     :
                    "bg-yellow-500/10 text-yellow-500"
                  }`}>
                    {tx.status}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-16 px-4 bg-card rounded-2xl flex flex-col items-center justify-center">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                <ArrowDownRight className="w-8 h-8 text-muted-foreground opacity-50" />
              </div>
              <h3 className="font-bold text-lg mb-1">No transactions</h3>
              <p className="text-sm text-muted-foreground">Your transaction history will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
