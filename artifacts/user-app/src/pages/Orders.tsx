import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useListTradePositions } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  ChevronLeft, CheckCircle2, Clock, Zap,
  ArrowUpRight, ArrowDownRight, Activity, Trash2,
} from "lucide-react";

const CLEAR_KEY = "vixus_cleared_positions_before";
const SAVE_KEY  = "vixus_active_trade";

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
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  return `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
}

const isBuy = (d: string) => d.toUpperCase() === "BUY";

export default function Orders() {
  const [, setLocation] = useLocation();

  const { data: positions = [], isLoading } = useListTradePositions({
    query: { refetchInterval: 4000 } as any,
  });

  // Read saved trade synchronously so filtering works on first render
  const [activeTradeId, setActiveTradeId] = useState<number | null>(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const saved = JSON.parse(raw) as { positionId: number; endTimeMs: number };
      if (!saved.positionId || !saved.endTimeMs) return null;
      // Expired — clear stale entry
      if (saved.endTimeMs < Date.now()) {
        localStorage.removeItem(SAVE_KEY);
        return null;
      }
      return saved.positionId;
    } catch { return null; }
  });

  const [remainingMs, setRemainingMs] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return 0;
      const saved = JSON.parse(raw) as { positionId: number; endTimeMs: number };
      return Math.max(0, (saved.endTimeMs ?? 0) - Date.now());
    } catch { return 0; }
  });

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Clear-history timestamp (positions closed before this are hidden)
  const [clearedBefore, setClearedBefore] = useState<number>(() => {
    return parseInt(localStorage.getItem(CLEAR_KEY) ?? "0", 10);
  });

  // Start countdown timer if there's an active trade
  useEffect(() => {
    if (!activeTradeId || remainingMs <= 0) return;
    timerRef.current = setInterval(() => {
      setRemainingMs(prev => {
        const next = prev - 1000;
        if (next <= 0) {
          clearInterval(timerRef.current!);
          localStorage.removeItem(SAVE_KEY);
          setActiveTradeId(null);
          return 0;
        }
        return next;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [activeTradeId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Only show "open" positions that belong to the current active trade session
  const open   = positions.filter(p => p.status === "open" && p.id === activeTradeId);
  const closed = positions.filter(p =>
    p.status !== "open" &&
    (!p.closedAt || new Date(p.closedAt).getTime() >= clearedBefore)
  );

  const handleClearHistory = () => {
    const now = Date.now();
    localStorage.setItem(CLEAR_KEY, String(now));
    setClearedBefore(now);
  };

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
            <h1 className="text-xl font-bold tracking-tight">Active Trades</h1>
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
                {[1, 2].map(i => <Skeleton key={i} className="h-28 w-full rounded-2xl" />)}
              </div>
            ) : open.length === 0 ? (
              <div className="bg-card rounded-2xl p-8 text-center">
                <Clock className="w-10 h-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-semibold text-muted-foreground">No running trades</p>
                <p className="text-xs text-muted-foreground/50 mt-1">Go to the Trade tab to start one.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {open.map(p => {
                  const buy    = isBuy(p.direction);
                  const pnlPos = p.pnl >= 0;
                  const hasCountdown = p.id === activeTradeId && remainingMs > 0;
                  return (
                    <div
                      key={p.id}
                      className={`rounded-2xl p-4 border ${buy ? "bg-green-500/5 border-green-500/15" : "bg-red-500/5 border-red-500/15"}`}
                    >
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

                      {/* Countdown row */}
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/20">
                        <span>Stake ${p.stake.toFixed(0)}</span>
                        {hasCountdown ? (
                          <span className="flex items-center gap-1 font-mono font-bold text-primary">
                            <Clock className="w-3 h-3" />
                            {fmtCountdown(remainingMs)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">In progress...</span>
                        )}
                        <span className="text-primary font-semibold">
                          ROI {p.stake > 0 ? ((p.pnl / p.stake) * 100).toFixed(1) : "0.0"}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* ── Closed positions ── */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle2 className="w-4 h-4 text-green-500" />
              <h2 className="text-sm font-bold">Closed — Profit</h2>
              <span className="text-[10px] text-muted-foreground bg-card rounded-full px-2 py-0.5">{closed.length}</span>
              {closed.length > 0 && (
                <button
                  onClick={handleClearHistory}
                  className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors"
                >
                  <Trash2 className="w-3 h-3" />
                  Clear
                </button>
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
                <p className="text-xs text-muted-foreground/50 mt-1">Trades that close in profit will appear here.</p>
              </div>
            ) : (
              <div className="space-y-2.5">
                {closed.map(p => {
                  const buy  = isBuy(p.direction);
                  const roi  = p.stake > 0 ? (p.pnl / p.stake) * 100 : 0;
                  const label =
                    p.status === "tp_hit"        ? "TP Hit"     :
                    p.status === "closed_manual"  ? "Cashed Out" :
                    p.status === "closed_expired" ? "Expired"    : "Closed";
                  return (
                    <div key={p.id} className="bg-card rounded-2xl p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-green-500/15 text-green-500 flex items-center justify-center shrink-0">
                            <CheckCircle2 className="w-4.5 h-4.5" />
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
                          <p className="text-base font-bold text-green-400">+${Math.abs(p.pnl).toFixed(2)}</p>
                          <p className="text-[10px] text-muted-foreground">{label}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/30">
                        <span>Stake ${p.stake.toFixed(0)}</span>
                        <span>{p.elapsedMs > 0 ? fmtDuration(p.elapsedMs) : "—"}</span>
                        <span className="font-semibold text-green-400">{roi.toFixed(1)}% ROI</span>
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
