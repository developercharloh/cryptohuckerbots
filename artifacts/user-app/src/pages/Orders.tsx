import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useListTradePositions } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, CheckCircle2, Clock, Zap,
  ArrowUpRight, ArrowDownRight, Activity, Trash2, XCircle,
} from "lucide-react";

const CLEAR_KEY = "vixus_cleared_positions_before";

/* ── Duration formatters ──────────────────────────────── */
function fmtDuration(ms: number): string {
  const sec = Math.floor(ms / 1000);
  const m   = Math.floor(sec / 60);
  const s   = sec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

function fmtCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

const isBuy = (d: string) => d.toUpperCase() === "BUY";

/* ── Per-position countdown hook ────────────────────── */
function useCountdown(openedAt: string): number {
  const endMs = new Date(openedAt).getTime() + 5 * 60 * 1000; // 5-min window per trade
  const [remaining, setRemaining] = useState(() => Math.max(0, endMs - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, endMs - Date.now())), 1000);
    return () => clearInterval(id);
  }, [endMs]);
  return remaining;
}

/* ── Close-position helper ──────────────────────────── */
async function closePosition(id: number): Promise<boolean> {
  try {
    const token = localStorage.getItem("vixus_token") ?? "";
    const res = await fetch(`/api/trade/positions/${id}/close`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/* ── Open position card ─────────────────────────────── */
function OpenCard({
  p, onClose,
}: {
  p: {
    id: number; pair: string; direction: string; botName: string;
    stake: number; pnl: number; openedAt: string;
  };
  onClose: () => void;
}) {
  const buy = isBuy(p.direction);
  const pnlPos = p.pnl >= 0;
  const remaining = useCountdown(p.openedAt);
  const [closing, setClosing] = useState(false);

  const handleClose = async () => {
    setClosing(true);
    await closePosition(p.id);
    onClose();
  };

  return (
    <div className={`rounded-2xl p-4 border ${buy ? "bg-green-500/5 border-green-500/15" : "bg-red-500/5 border-red-500/15"}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${buy ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
            {buy ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
          </div>
          <div>
            <p className="font-bold text-sm">{p.pair}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Badge className={`text-[10px] border-none px-1.5 h-4 ${buy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                {p.direction}
              </Badge>
              <span className="text-[10px] text-muted-foreground">{p.botName}</span>
            </div>
          </div>
        </div>
        <div className="text-right shrink-0">
          <p className={`text-base font-bold ${pnlPos ? "text-green-400" : "text-red-400"}`}>
            {pnlPos ? "+" : "−"}${Math.abs(p.pnl).toFixed(2)}
          </p>
          <div className="flex items-center gap-1 justify-end mt-0.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-green-400 font-semibold">LIVE</span>
          </div>
        </div>
      </div>

      {/* Countdown + stake + ROI row */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/20 mb-3">
        <span>Stake ${p.stake.toFixed(0)}</span>
        {remaining > 0 ? (
          <span className="flex items-center gap-1 font-mono font-bold text-primary">
            <Clock className="w-3 h-3" />
            {fmtCountdown(remaining)}
          </span>
        ) : (
          <span className="text-muted-foreground/60">Closing soon…</span>
        )}
        <span className={`font-semibold ${pnlPos ? "text-green-400" : "text-red-400"}`}>
          ROI {p.stake > 0 ? ((p.pnl / p.stake) * 100).toFixed(1) : "0.0"}%
        </span>
      </div>

      {/* Close early button */}
      <button
        onClick={handleClose}
        disabled={closing}
        className="w-full py-2 rounded-xl text-[11px] font-bold border border-border/30 text-muted-foreground hover:text-destructive hover:border-destructive/40 transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
      >
        <XCircle className="w-3.5 h-3.5" />
        {closing ? "Closing…" : "Close Trade Early"}
      </button>
    </div>
  );
}

/* ── Main component ─────────────────────────────────── */
export default function Orders() {
  const [, setLocation] = useLocation();

  const { data: positions = [], isLoading, refetch } = useListTradePositions({
    query: { refetchInterval: 4000 } as any,
  });

  // Clear-history timestamp
  const [clearedBefore, setClearedBefore] = useState<number>(() => {
    return parseInt(localStorage.getItem(CLEAR_KEY) ?? "0", 10);
  });

  const handleClearHistory = () => {
    const now = Date.now();
    localStorage.setItem(CLEAR_KEY, String(now));
    setClearedBefore(now);
  };

  const handleClose = useCallback(() => {
    setTimeout(() => refetch(), 800);
  }, [refetch]);

  // All open positions
  const open = positions.filter(p => p.status === "open");

  // Closed positions after clearedBefore (both wins and losses)
  const closed = positions.filter(p =>
    p.status !== "open" &&
    (!p.closedAt || new Date(p.closedAt).getTime() >= clearedBefore)
  );

  const totalPnl = closed.reduce((acc, p) => acc + p.pnl, 0);

  return (
    <Layout showNav>
      <div className="flex flex-col min-h-[100dvh]">

        {/* Header */}
        <div className="flex items-center gap-3 px-5 pt-6 pb-4 shrink-0">
          <button
            onClick={() => setLocation("/dashboard")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-card"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="flex-1">
            <h1 className="text-xl font-bold tracking-tight">Orders</h1>
            <p className="text-[11px] text-muted-foreground">Live positions &amp; trade history</p>
          </div>
          {open.length > 0 && (
            <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] text-green-400 font-bold tracking-wider">{open.length} LIVE</span>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-28 space-y-6">

          {/* ── Running positions ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Activity className="w-4 h-4 text-primary" />
              <h2 className="text-sm font-bold">Running</h2>
              <span className="text-[10px] text-muted-foreground bg-card rounded-full px-2 py-0.5">{open.length}</span>
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2].map(i => <Skeleton key={i} className="h-36 w-full rounded-2xl" />)}
              </div>
            ) : open.length === 0 ? (
              <div className="bg-card rounded-2xl p-8 text-center">
                <Clock className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No running trades</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Go to Markets to start a trade.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {open.map(p => (
                  <OpenCard key={p.id} p={p} onClose={handleClose} />
                ))}
              </div>
            )}
          </section>

          {/* ── Closed positions ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-muted-foreground" />
              <h2 className="text-sm font-bold">History</h2>
              <span className="text-[10px] text-muted-foreground bg-card rounded-full px-2 py-0.5">{closed.length}</span>
              {closed.length > 0 && (
                <>
                  <span className={`ml-auto text-[11px] font-bold ${totalPnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {totalPnl >= 0 ? "+" : "−"}${Math.abs(totalPnl).toFixed(2)}
                  </span>
                  <button
                    onClick={handleClearHistory}
                    className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                    Clear
                  </button>
                </>
              )}
            </div>

            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}
              </div>
            ) : closed.length === 0 ? (
              <div className="bg-card rounded-2xl p-8 text-center">
                <Zap className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No closed trades yet</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Closed trades will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {closed.map(p => {
                  const buy    = isBuy(p.direction);
                  const profit = p.pnl >= 0;
                  const roi    = p.stake > 0 ? (p.pnl / p.stake) * 100 : 0;
                  const label  =
                    p.status === "tp_hit"         ? "TP Hit"     :
                    p.status === "sl_hit"         ? "SL Hit"     :
                    p.status === "closed_manual"  ? "Closed"     :
                    p.status === "closed_expired" ? "Expired"    : "Closed";

                  return (
                    <div key={p.id} className="bg-card rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${profit ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                            {profit
                              ? <CheckCircle2 className="w-4 h-4" />
                              : <XCircle className="w-4 h-4" />
                            }
                          </div>
                          <div>
                            <p className="font-bold text-sm">{p.pair}</p>
                            <div className="flex items-center gap-1.5 mt-0.5">
                              <Badge className={`text-[10px] border-none px-1.5 h-4 ${buy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                                {p.direction}
                              </Badge>
                              <span className="text-[10px] text-muted-foreground">{p.botName}</span>
                            </div>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className={`text-base font-bold ${profit ? "text-green-400" : "text-red-400"}`}>
                            {profit ? "+" : "−"}${Math.abs(p.pnl).toFixed(2)}
                          </p>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/30">
                        <span>Stake ${p.stake.toFixed(0)}</span>
                        <span>{p.elapsedMs > 0 ? fmtDuration(p.elapsedMs) : "—"}</span>
                        <span className={`font-semibold ${profit ? "text-green-400" : "text-red-400"}`}>
                          {roi >= 0 ? "+" : ""}{roi.toFixed(1)}% ROI
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </Layout>
  );
}
