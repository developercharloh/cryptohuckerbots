import { useState } from "react";
import {
  useAdminListTransactions,
  useAdminReviewTransaction,
  useAdminListDepositSessions,
  useAdminReviewDepositSession,
  getAdminListTransactionsQueryKey,
  getAdminListDepositSessionsQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { CheckCircle, XCircle, Clock, Copy, Check, Eye, AlertTriangle, ArrowUpRight } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-primary/10 hover:bg-primary/20 text-primary font-medium transition-colors shrink-0"
    >
      {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
      {copied ? "Copied" : "Copy"}
    </button>
  );
}

function FilterChip({ value, active, onClick }: { value: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors capitalize ${
        active ? "bg-primary text-primary-foreground border-primary" : "bg-card text-muted-foreground border-border"
      }`}
    >
      {value}
    </button>
  );
}

function statusColor(status: string) {
  if (status === "completed") return "default";
  if (status === "pending" || status === "waiting_payment" || status === "created") return "secondary";
  if (status === "payment_detected" || status === "confirming") return "outline";
  return "destructive";
}

const DEPOSIT_STATUSES = ["all", "waiting_payment", "payment_detected", "confirming", "completed", "failed"];

// ── Transactions tab ─────────────────────────────────────────────────────────
const typeOptions = ["all", "deposit", "withdrawal"] as const;
const txStatusOptions = ["all", "pending", "completed", "rejected"] as const;

function TransactionsTab() {
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const { data: transactions, isLoading } = useAdminListTransactions({
    type: filterType !== "all" ? filterType : undefined,
    status: filterStatus !== "all" ? filterStatus : undefined,
  });
  const reviewTxn = useAdminReviewTransaction();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleReview = (id: number, action: "approve" | "reject") => {
    reviewTxn.mutate(
      { id, data: { action } },
      {
        onSuccess: () => {
          toast({ title: `Transaction ${action}d` });
          queryClient.invalidateQueries({ queryKey: getAdminListTransactionsQueryKey() });
        },
        onError: (err) => {
          toast({ title: `Failed to ${action}`, description: err.message, variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground w-12">Type</span>
          {typeOptions.map((opt) => (
            <FilterChip key={opt} value={opt} active={filterType === opt} onClick={() => setFilterType(opt)} />
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-muted-foreground w-12">Status</span>
          {txStatusOptions.map((opt) => (
            <FilterChip key={opt} value={opt} active={filterStatus === opt} onClick={() => setFilterStatus(opt)} />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)
        ) : transactions?.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
            No transactions found
          </div>
        ) : (
          transactions?.map((txn) => (
            <Card key={txn.id} className="rounded-2xl border-border/60" data-testid={`row-txn-${txn.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant={statusColor(txn.status)} className="text-[10px] h-4 px-1.5 capitalize">
                        {txn.status === "pending" && <Clock className="w-2.5 h-2.5 mr-1 inline" />}
                        {txn.status}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground capitalize">{txn.type === "trade_loss" ? "Trade Capital" : txn.type.replace("_", " ")}</span>
                    </div>
                    <p className="text-sm font-semibold truncate">{txn.userName}</p>
                    <p className="text-[11px] text-muted-foreground truncate">{txn.userEmail}</p>
                    {txn.paymentMethod && <p className="text-[11px] text-muted-foreground mt-0.5">{txn.paymentMethod}</p>}
                    {txn.type === "withdrawal" && txn.walletAddress && (
                      <div className="mt-1.5 p-2 rounded-lg bg-secondary/60 space-y-1.5">
                        {txn.network && <p className="text-[10px] font-semibold text-primary uppercase tracking-wide">{txn.network} Network</p>}
                        <div className="flex items-start gap-2">
                          <p className="text-[10px] text-muted-foreground font-mono break-all leading-tight flex-1">{txn.walletAddress}</p>
                          <CopyButton text={txn.walletAddress} />
                        </div>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">{format(new Date(txn.createdAt), "PP · p")}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className={`text-lg font-bold ${txn.type === "deposit" || txn.type === "trade_profit" ? "text-emerald-400" : "text-foreground"}`}>
                      {txn.type === "deposit" || txn.type === "trade_profit" ? "+" : ""}${txn.amount.toFixed(2)}
                    </div>
                  </div>
                </div>
                {txn.status === "pending" && (txn.type === "deposit" || txn.type === "withdrawal") && (
                  <div className="flex gap-2 mt-3 pt-3 border-t border-border/50">
                    <Button variant="outline" size="sm"
                      className="flex-1 h-8 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
                      onClick={() => handleReview(txn.id, "approve")} disabled={reviewTxn.isPending}
                      data-testid={`btn-approve-txn-${txn.id}`}>
                      <CheckCircle className="w-3.5 h-3.5 mr-1.5" /> Approve
                    </Button>
                    <Button variant="outline" size="sm"
                      className="flex-1 h-8 text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl"
                      onClick={() => handleReview(txn.id, "reject")} disabled={reviewTxn.isPending}
                      data-testid={`btn-reject-txn-${txn.id}`}>
                      <XCircle className="w-3.5 h-3.5 mr-1.5" /> Reject
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ── Deposit Sessions tab ──────────────────────────────────────────────────────
function DepositSessionsTab() {
  const [filterStatus, setFilterStatus] = useState("all");
  const [confirmInput, setConfirmInput] = useState<Record<number, string>>({});

  const { data: sessions, isLoading } = useAdminListDepositSessions(
    { status: filterStatus !== "all" ? filterStatus : undefined },
    { query: { refetchInterval: 10000 } as any }
  );
  const reviewSession = useAdminReviewDepositSession();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const act = (id: number, action: string, extra?: Record<string, unknown>) => {
    reviewSession.mutate(
      { id, data: { action, ...extra } },
      {
        onSuccess: () => {
          toast({ title: "Deposit session updated" });
          queryClient.invalidateQueries({ queryKey: getAdminListDepositSessionsQueryKey() });
        },
        onError: (err) => {
          toast({ title: "Action failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const statusLabel: Record<string, string> = {
    created: "Created",
    waiting_payment: "Waiting Payment",
    payment_detected: "Detected",
    confirming: "Confirming",
    completed: "Completed",
    failed: "Failed",
    expired: "Expired",
    cancelled: "Cancelled",
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-muted-foreground w-12">Status</span>
        {DEPOSIT_STATUSES.map((s) => (
          <FilterChip key={s} value={statusLabel[s] ?? s} active={filterStatus === s} onClick={() => setFilterStatus(s)} />
        ))}
      </div>

      <div className="space-y-2">
        {isLoading ? (
          Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)
        ) : sessions?.length === 0 ? (
          <div className="text-center py-12 text-sm text-muted-foreground border border-dashed border-border rounded-2xl">
            No deposit sessions found
          </div>
        ) : (
          sessions?.map((s) => {
            const isPending = ["created", "waiting_payment", "payment_detected", "confirming"].includes(s.status);
            return (
              <Card key={s.id} className="rounded-2xl border-border/60">
                <CardContent className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={statusColor(s.status)} className="text-[10px] h-4 px-1.5 capitalize">
                          {s.status === "waiting_payment" && <Clock className="w-2.5 h-2.5 mr-1 inline" />}
                          {s.status === "payment_detected" && <Eye className="w-2.5 h-2.5 mr-1 inline" />}
                          {statusLabel[s.status] ?? s.status}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">{s.network} · Session #{s.id}</span>
                      </div>
                      <p className="text-sm font-semibold truncate">{s.userName}</p>
                      <p className="text-[11px] text-muted-foreground">{s.userEmail}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{format(new Date(s.createdAt), "PP · p")}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-lg font-bold text-emerald-400">+${s.amount.toFixed(2)}</p>
                      <p className="text-[10px] text-muted-foreground">{s.paymentMethodName}</p>
                    </div>
                  </div>

                  {/* Deposit address */}
                  <div className="rounded-lg bg-secondary/50 p-2.5 space-y-1">
                    <p className="text-[10px] text-muted-foreground font-medium">Deposit Address</p>
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] font-mono break-all flex-1 leading-snug">{s.depositAddress}</code>
                      <CopyButton text={s.depositAddress} />
                    </div>
                  </div>

                  {/* TXID if submitted */}
                  {s.txid && (
                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5 space-y-1">
                      <div className="flex items-center gap-1.5">
                        <ArrowUpRight className="w-3 h-3 text-blue-400" />
                        <p className="text-[10px] text-blue-300 font-medium">Transaction ID submitted</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="text-[10px] font-mono break-all flex-1 leading-snug">{s.txid}</code>
                        <CopyButton text={s.txid} />
                      </div>
                    </div>
                  )}

                  {/* Confirmations bar */}
                  {(s.status === "payment_detected" || s.status === "confirming") && (
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <p className="text-[10px] text-muted-foreground">Confirmations</p>
                        <p className="text-[10px] font-semibold">{s.confirmations} / {s.requiredConfirmations}</p>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all"
                          style={{ width: `${Math.min(100, (s.confirmations / s.requiredConfirmations) * 100)}%` }} />
                      </div>
                    </div>
                  )}

                  {/* Confirmations update */}
                  {(s.status === "payment_detected" || s.status === "confirming") && (
                    <div className="flex gap-2">
                      <Input
                        type="number" min={0} max={s.requiredConfirmations}
                        placeholder="Set confirmations"
                        value={confirmInput[s.id] ?? ""}
                        onChange={(e) => setConfirmInput((prev) => ({ ...prev, [s.id]: e.target.value }))}
                        className="h-8 text-xs bg-background border-border rounded-lg"
                      />
                      <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg shrink-0"
                        onClick={() => act(s.id, "update_confirmations", { confirmations: Number(confirmInput[s.id] ?? 0) })}
                        disabled={reviewSession.isPending}>
                        Update
                      </Button>
                    </div>
                  )}

                  {/* Action buttons */}
                  {isPending && (
                    <div className="flex gap-2 pt-1 border-t border-border/50">
                      {s.status === "waiting_payment" && (
                        <Button size="sm" variant="outline"
                          className="flex-1 h-8 text-[11px] text-blue-400 border-blue-400/30 hover:bg-blue-400/10 rounded-xl"
                          onClick={() => act(s.id, "detect")} disabled={reviewSession.isPending}>
                          <Eye className="w-3 h-3 mr-1" /> Mark Detected
                        </Button>
                      )}
                      <Button size="sm" variant="outline"
                        className="flex-1 h-8 text-[11px] text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
                        onClick={() => act(s.id, "approve")} disabled={reviewSession.isPending}>
                        <CheckCircle className="w-3 h-3 mr-1" /> Approve & Credit
                      </Button>
                      <Button size="sm" variant="outline"
                        className="flex-1 h-8 text-[11px] text-destructive border-destructive/30 hover:bg-destructive/10 rounded-xl"
                        onClick={() => act(s.id, "reject")} disabled={reviewSession.isPending}>
                        <XCircle className="w-3 h-3 mr-1" /> Reject
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Main Finance page ─────────────────────────────────────────────────────────
export default function Finance() {
  const [tab, setTab] = useState<"deposits" | "transactions">("deposits");

  return (
    <div className="p-4 space-y-4 pb-8">
      <div className="pt-1">
        <h1 className="text-xl font-bold tracking-tight">Finance</h1>
        <p className="text-xs text-muted-foreground">Deposit sessions &amp; transaction ledger</p>
      </div>

      <div className="flex gap-2">
        <FilterChip value="Deposits" active={tab === "deposits"} onClick={() => setTab("deposits")} />
        <FilterChip value="Transactions" active={tab === "transactions"} onClick={() => setTab("transactions")} />
      </div>

      {tab === "deposits" ? <DepositSessionsTab /> : <TransactionsTab />}
    </div>
  );
}
