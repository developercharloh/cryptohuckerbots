import { useState } from "react";
import { useLocation } from "wouter";
import { useListTransactions, ListTransactionsType } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { ChevronLeft, ArrowDownRight, ArrowUpRight, Zap, ChevronDown, Download, CheckCircle2, Clock3 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUSD } from "@/lib/format";

export default function Transactions() {
  const [, setLocation] = useLocation();
  const [filter, setFilter] = useState<ListTransactionsType>("all");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const { data: allTxns = [], isLoading } = useListTransactions({ type: filter });
  const transactions = allTxns;

  const exportStatement = () => {
    if (transactions.length === 0) return;
    const headers = ["ID", "Type", "Amount", "Status", "Payment method", "Created at", "Wallet address"];
    const rows = transactions.map((tx) => [
      tx.id,
      tx.type.replace(/_/g, " "),
      tx.amount.toFixed(2),
      tx.status,
      tx.paymentMethod,
      tx.createdAt,
      tx.walletAddress ?? "",
    ]);
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const csv = [headers, ...rows].map((row) => row.map(quote).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vixus-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <Layout>
      <div className="p-5 pb-8 space-y-6">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/cashier")} className="w-10 h-10 flex items-center justify-center rounded-xl bg-card">
            <ChevronLeft className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-bold tracking-tight flex-1">Transactions</h1>
          <button
            type="button"
            onClick={exportStatement}
            disabled={transactions.length === 0 || isLoading}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2.5 py-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
            aria-label="Download account statement as CSV"
          >
            <Download className="h-3.5 w-3.5" /> CSV
          </button>
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
            transactions.map((tx) => {
              const expanded = expandedId === tx.id;
              const incoming = ["deposit", "trade_profit", "trade_loss_return", "signal_reward", "referral_bonus", "vault_trade_return"].includes(tx.type);
              const outgoing = ["withdrawal", "trade_loss", "vip_package_purchase", "vault_trade_stake", "vault_trade_fee"].includes(tx.type);
              const label = tx.type === "trade_loss" ? "Contract Opened" :
                tx.type === "trade_profit" || tx.type === "trade_loss_return" ? "Contract Closed" :
                tx.type === "signal_reward" ? "Signal Reward" :
                tx.type === "referral_bonus" ? "Referral Bonus" :
                tx.type === "vip_package_purchase" ? "Vault Capital Transfer" :
                tx.type === "vault_trade_stake" ? "Vault Capital Reserved" :
                tx.type === "vault_trade_return" ? "Vault Capital Returned" :
                tx.type === "vault_trade_fee" ? "Vault Capital Trading Fee" :
                tx.type.replace(/_/g, " ");
              return (
                <div key={tx.id} className="overflow-hidden rounded-2xl bg-card">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedId(expanded ? null : tx.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setExpandedId(expanded ? null : tx.id);
                      }
                    }}
                    className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:bg-muted/30"
                    aria-expanded={expanded}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        tx.type === "deposit" ? "bg-green-500/10" :
                        tx.type === "withdrawal" || tx.type === "vip_package_purchase" ? "bg-red-500/10" : "bg-primary/10"
                      }`}>
                        {tx.type === "deposit"
                          ? <ArrowDownRight className="w-5 h-5 text-green-500" />
                          : tx.type === "withdrawal"
                            ? <ArrowUpRight className="w-5 h-5 text-red-500" />
                            : <Zap className="w-4 h-4 text-primary fill-primary" />}
                      </div>
                      <div>
                        <div className="font-semibold text-sm mb-0.5 capitalize">{label}</div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 text-right">
                      <div>
                        <div className={`font-bold text-sm mb-0.5 ${
                          incoming ? "text-green-500" : outgoing ? "text-red-500" : "text-foreground"
                        }`}>
                          {incoming ? "+" : outgoing ? "−" : ""}{formatUSD(Math.abs(tx.amount))}
                        </div>
                        <div className={`text-[10px] px-2 py-0.5 rounded-full inline-block ${
                          tx.status === "Completed" ? "bg-green-500/10 text-green-500" :
                          tx.status === "Failed" ? "bg-red-500/10 text-red-500" :
                          "bg-yellow-500/10 text-yellow-500"
                        }`}>
                          {tx.status}
                        </div>
                      </div>
                      <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${expanded ? "rotate-180" : ""}`} />
                    </div>
                  </div>
                  {expanded && (
                    <div className="border-t border-border/50 bg-background/40 px-4 pb-4 pt-3">
                      <div className="grid gap-3 sm:grid-cols-3">
                        {[
                          { label: "Recorded", value: new Date(tx.createdAt).toLocaleString(), Icon: Clock3, tone: "text-primary" },
                          { label: "Status", value: tx.status, Icon: tx.status === "Completed" ? CheckCircle2 : Clock3, tone: tx.status === "Completed" ? "text-green-500" : "text-yellow-500" },
                          { label: "Method", value: tx.paymentMethod || "Ledger activity", Icon: Zap, tone: "text-blue-400" },
                        ].map(({ label: detailLabel, value, Icon, tone }) => (
                          <div key={detailLabel} className="rounded-xl border border-border/50 bg-card p-3">
                            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                              <Icon className={`h-3.5 w-3.5 ${tone}`} /> {detailLabel}
                            </div>
                            <p className="mt-1 text-xs font-semibold capitalize">{value}</p>
                          </div>
                        ))}
                      </div>
                      {tx.walletAddress && (
                        <p className="mt-3 break-all rounded-xl border border-border/50 bg-card px-3 py-2 font-mono text-[10px] text-muted-foreground">
                          Wallet: {tx.walletAddress}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })
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
