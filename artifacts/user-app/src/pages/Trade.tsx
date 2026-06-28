import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  useListBots,
  useListTradeSignals,
  useExecuteTrade,
  useListTradePositions,
  useCloseTradePosition,
  useGetDashboardSummary,
  TradePosition,
} from "@workspace/api-client-react";

import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  TrendingUp, TrendingDown, Zap, Activity, Clock, Check,
  ArrowUpRight, ArrowDownRight, ChevronDown, CheckCircle2,
  XCircle, Bot as BotIcon, BarChart2, Bell, Trash2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

type Step = "configure" | "running" | "result";

const STORAGE_KEY = "vixus_active_trade";

const RUNTIMES = [
  { value: 5, label: "5 Minutes" },
];

const AI_MESSAGES = [
  "Analyzing market conditions...",
  "Scanning for optimal entry points...",
  "Executing high-probability trade...",
  "Monitoring position performance...",
  "Calculating risk-adjusted returns...",
  "Identifying profitable chart patterns...",
  "Trend reversal signal detected...",
  "Adjusting position sizing dynamically...",
  "Market volatility managed efficiently...",
  "Profit target zone approaching...",
];

const BOT_COLORS = [
  "from-purple-500 to-indigo-600",
  "from-blue-500 to-cyan-600",
  "from-orange-500 to-red-500",
  "from-green-500 to-emerald-600",
  "from-pink-500 to-rose-600",
];

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function AIWave() {
  return (
    <>
      <style>{`
        @keyframes wv{0%,100%{transform:scaleY(0.3)}50%{transform:scaleY(1)}}
        .wv{animation:wv 1.1s ease-in-out infinite}
      `}</style>
      <div className="flex items-end gap-[2px] h-4 shrink-0">
        {[0,0.1,0.22,0.08,0.3,0.18,0.05,0.25,0.12,0.35,0.15,0.07].map((d, i) => (
          <div key={i} className="wv w-[3px] rounded-full bg-primary" style={{ height:"100%", animationDelay:`${d}s` }} />
        ))}
      </div>
    </>
  );
}

function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 80 }, (_, i) => ({
      id: i, x: Math.random() * 100, delay: Math.random() * 2.5, dur: 2 + Math.random() * 2,
      color: ["#7C3AED","#4ade80","#f59e0b","#38bdf8","#f472b6","#a78bfa"][i % 6],
      w: 5 + Math.random() * 7, h: 4 + Math.random() * 6, round: i % 3 !== 0,
    })), []);
  return (
    <>
      <style>{`
        @keyframes cfFall{0%{transform:translateY(-40px) rotate(0deg);opacity:1}100%{transform:translateY(115vh) rotate(900deg);opacity:0}}
        .cf{animation:cfFall linear forwards}
      `}</style>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        {pieces.map(p => (
          <div key={p.id} className="absolute cf" style={{
            left:`${p.x}%`, top:0, width:p.w, height:p.round?p.w:p.h,
            background:p.color, borderRadius:p.round?"50%":"2px",
            animationDuration:`${p.dur}s`, animationDelay:`${p.delay}s`,
          }} />
        ))}
      </div>
    </>
  );
}

const fmtDuration = (ms: number) => {
  const s = Math.floor(ms / 1000), m = Math.floor(s / 60), sec = s % 60;
  return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
};
const isBuy = (d: string) => d.toUpperCase() === "BUY";

type SavedTrade = {
  positionId: number;
  endTimeMs: number;
  runtime: number;
  signalId: string | number;
  signalConfidence: number;
  signalPair: string;
  signalDirection: string;
};

type SignalInfo = { id?: string | number; confidence?: number; pair?: string; direction?: string };

export default function Trade() {
  const { data: bots = [], isLoading: loadingBots } = useListBots();
  const { data: signals = [] } = useListTradeSignals();
  const { data: positions } = useListTradePositions({ query: { refetchInterval: 4000 } as any });
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 10000 } as any });
  const executeMutation = useExecuteTrade();
  const closeMutation   = useCloseTradePosition();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep]                   = useState<Step>("configure");
  const [selectedBotId, setSelectedBotId] = useState<number | null>(null);
  const [stake, setStake]                 = useState("");
  const [runtime, setRuntime]             = useState(5);
  const [runtimeOpen, setRuntimeOpen]     = useState(false);
  const runtimeRef   = useRef<HTMLDivElement>(null);
  const [activePositionId, setActivePositionId] = useState<number | null>(null);
  const [executedSignal, setExecutedSignal]     = useState<SignalInfo | null>(null);
  const [secondsLeft, setSecondsLeft]   = useState(0);
  const [totalSecs, setTotalSecs]       = useState(0);
  const [msgIdx, setMsgIdx]             = useState(0);
  const [result, setResult]             = useState<TradePosition | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  const timerRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef = useRef(false);
  const restoringRef = useRef<SavedTrade | null>(null);
  const positionsReadyRef = useRef(false);

  const stakeNum = parseFloat(stake) || 0;

  // Auto-select first bot (or bot from ?botId param)
  useEffect(() => {
    if (bots.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const paramId = parseInt(params.get("botId") ?? "0", 10);
    if (paramId && bots.some(b => b.id === paramId)) {
      setSelectedBotId(paramId);
    } else if (!selectedBotId) {
      setSelectedBotId(bots[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots]);

  // Close dropdown on outside click
  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (runtimeRef.current && !runtimeRef.current.contains(e.target as Node)) setRuntimeOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  // Read localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) restoringRef.current = JSON.parse(raw) as SavedTrade;
    } catch { localStorage.removeItem(STORAGE_KEY); }
  }, []);

  // Restore trade state once positions load
  useEffect(() => {
    if (!positions || positionsReadyRef.current) return;
    positionsReadyRef.current = true;
    const saved = restoringRef.current;
    if (!saved) return;
    restoringRef.current = null;

    const pos = positions.find(p => p.id === saved.positionId);
    if (!pos) { localStorage.removeItem(STORAGE_KEY); return; }

    const partialSignal: SignalInfo = {
      id: saved.signalId,
      confidence: saved.signalConfidence,
      pair: saved.signalPair,
      direction: saved.signalDirection,
    };

    if (pos.status === "open") {
      const remaining = Math.max(0, Math.floor((saved.endTimeMs - Date.now()) / 1000));
      setActivePositionId(pos.id);
      setExecutedSignal(partialSignal);
      setRuntime(saved.runtime);
      setTotalSecs(saved.runtime * 60);
      setSecondsLeft(remaining);
      prevStatusRef.current = "open";
      finishedRef.current = false;
      setStep("running");

      const startTimer = (posId: number) => {
        timerRef.current = setInterval(() => {
          setSecondsLeft(s => {
            if (s <= 1) {
              clearInterval(timerRef.current!);
              closeMutation.mutate(
                { id: posId },
                {
                  onSuccess: (closed) => finishTrade(closed),
                  onError: () => queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] }),
                }
              );
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      };

      if (remaining > 0) {
        startTimer(pos.id);
      } else {
        closeMutation.mutate(
          { id: pos.id },
          {
            onSuccess: (closed) => finishTrade(closed),
            onError: () => queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] }),
          }
        );
      }
    } else {
      // Closed while offline — show result
      localStorage.removeItem(STORAGE_KEY);
      finishedRef.current = true;
      setActivePositionId(pos.id);
      setExecutedSignal(partialSignal);
      setResult(pos);
      setStep("result");
      if (pos.pnl >= 0) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 5500);
      }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashier/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  // Live active position from polling
  const activePosition = useMemo(() =>
    positions?.find(p => p.id === activePositionId) ?? null,
  [positions, activePositionId]);

  // AI message cycling while running
  useEffect(() => {
    if (step !== "running") return;
    const id = setInterval(() => setMsgIdx(i => (i + 1) % AI_MESSAGES.length), 3300);
    return () => clearInterval(id);
  }, [step]);

  // Detect natural TP/SL hit via polling
  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activePosition || step !== "running") return;
    const cur = activePosition.status;
    const prev = prevStatusRef.current;
    prevStatusRef.current = cur;
    if (prev === "open" && cur !== "open") {
      if (timerRef.current) clearInterval(timerRef.current);
      finishTrade(activePosition);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePosition]);

  const finishTrade = (pos: TradePosition) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    localStorage.removeItem(STORAGE_KEY);
    setResult(pos);
    setStep("result");
    if (pos.pnl >= 0) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5500);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cashier/transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
  };

  const availableBalance = summary?.availableBalance ?? 0;

  const handleExecute = () => {
    if (!selectedBotId || stakeNum < 1) return;
    if (!signals.length) {
      toast({ title: "No signals available", variant: "destructive" });
      return;
    }
    if (stakeNum > availableBalance) {
      toast({
        title: "Insufficient balance",
        description: `Your available balance is $${availableBalance.toFixed(2)}. Please deposit or reduce your stake.`,
        variant: "destructive",
      });
      return;
    }
    // Pick a random signal that is different from the last used pair
    const lastPair = localStorage.getItem("vixus_last_pair") ?? "";
    const pool = signals.filter(s => s.pair !== lastPair);
    const candidates = pool.length > 0 ? pool : signals;
    const signal = candidates[Math.floor(Math.random() * candidates.length)];
    const secs   = runtime * 60;

    executeMutation.mutate(
      { data: { signalId: signal.id, botId: selectedBotId, targetProfit: signal.suggestedTp, stopLoss: signal.suggestedSl, stake: stakeNum } },
      {
        onSuccess: (pos) => {
          const endTimeMs = Date.now() + secs * 1000;
          localStorage.setItem(STORAGE_KEY, JSON.stringify({
            positionId: pos.id, endTimeMs, runtime,
            signalId: signal.id, signalConfidence: signal.confidence,
            signalPair: signal.pair, signalDirection: signal.direction,
          } as SavedTrade));
          localStorage.setItem("vixus_last_pair", signal.pair);

          setActivePositionId(pos.id);
          setExecutedSignal(signal);
          prevStatusRef.current = "open";
          finishedRef.current = false;
          setTotalSecs(secs);
          setSecondsLeft(secs);
          setMsgIdx(0);
          setStep("running");

          queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });

          timerRef.current = setInterval(() => {
            setSecondsLeft(s => {
              if (s <= 1) {
                clearInterval(timerRef.current!);
                closeMutation.mutate(
                  { id: pos.id },
                  {
                    onSuccess: (closed) => finishTrade(closed),
                    onError: () => queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] }),
                  }
                );
                return 0;
              }
              return s - 1;
            });
          }, 1000);
        },
        onError: (err: any) => {
          toast({ title: "Trade failed", description: err.message, variant: "destructive" });
        },
      }
    );
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStep("configure");
    setActivePositionId(null);
    setResult(null);
    setShowConfetti(false);
    setStake("");
    prevStatusRef.current = null;
    finishedRef.current = false;
  };

  const handleCashOut = useCallback(() => {
    if (!activePositionId) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    closeMutation.mutate(
      { id: activePositionId },
      {
        onSuccess: (closed) => finishTrade(closed),
        onError: () => queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] }),
      }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePositionId]);

  // Clear-history for journal
  const [journalClearedBefore, setJournalClearedBefore] = useState<number>(() =>
    parseInt(localStorage.getItem("vixus_cleared_positions_before") ?? "0", 10)
  );
  const handleClearJournal = () => {
    const now = Date.now();
    localStorage.setItem("vixus_cleared_positions_before", String(now));
    setJournalClearedBefore(now);
  };

  const timerProgress = totalSecs > 0 ? secondsLeft / totalSecs : 0;
  const dashOffset    = CIRCUMFERENCE * (1 - timerProgress);
  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  const history    = (positions || [])
    .filter(p => p.status !== "open")
    .filter(p => !p.closedAt || new Date(p.closedAt).getTime() >= journalClearedBefore)
    .slice(0, 30);
  // Show a random signal as "selected" — different from last used pair
  const bestSignal = useMemo(() => {
    if (!signals.length) return null;
    const lastPair = localStorage.getItem("vixus_last_pair") ?? "";
    const pool = signals.filter(s => s.pair !== lastPair);
    const candidates = pool.length > 0 ? pool : signals;
    return candidates[Math.floor(Date.now() / 60_000) % candidates.length];
  }, [signals]);

  // Running-view derived values
  const pos = activePosition;
  // In the final 10 s of the countdown clamp P&L so the screen never flips
  // to red right before the trade closes (the server guarantees ≥10 % of TP).
  const minDisplayPnl = (pos && secondsLeft <= 10 && secondsLeft > 0)
    ? pos.stake * 0.04
    : -Infinity;
  const pnl   = Math.max(pos?.pnl ?? 0, minDisplayPnl);
  const posUp = pnl >= 0;
  const posBuy = pos ? isBuy(pos.direction) : true;
  const pct   = pos
    ? Math.max(0, Math.min(100, ((pnl + pos.stopLoss) / (pos.targetProfit + pos.stopLoss)) * 100))
    : 50;

  // ─── JOURNAL ROWS (shared) ────────────────────────────────────────────────
  const JournalRows = (
    <>
      {history.length === 0 ? (
        <div className="flex flex-col items-center py-10 gap-2">
          <BarChart2 className="w-10 h-10 text-muted-foreground/20" />
          <p className="text-xs text-muted-foreground">No closed trades yet</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {history.map((p) => {
            const win = p.pnl >= 0;
            const buy = isBuy(p.direction);
            const sig = signals.find(s => s.id === p.signalId);
            const roi = p.stake > 0 ? (p.pnl / p.stake) * 100 : 0;
            return (
              <div key={p.id} className="bg-card rounded-2xl p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${win ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                      {win ? <CheckCircle2 className="w-4.5 h-4.5" /> : <XCircle className="w-4.5 h-4.5" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-bold text-sm">{p.pair}</p>
                        <Badge className={`text-[10px] border-none px-1.5 h-4 ${buy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                          {p.direction}
                        </Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {p.botName}{sig ? ` · ${sig.confidence}% AI` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-base font-bold ${win ? "text-green-400" : "text-red-400"}`}>
                      {win ? "+" : "−"}${Math.abs(p.pnl).toFixed(2)}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {p.status === "tp_hit" ? "TP Hit" : p.status === "sl_hit" ? "SL Hit" : p.status === "closed_manual" ? "Manual" : "Expired"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/30">
                  <span>Stake ${p.stake.toFixed(0)}</span>
                  <span>{p.elapsedMs > 0 ? fmtDuration(p.elapsedMs) : "—"}</span>
                  <span className={`font-semibold ${win ? "text-green-400" : "text-red-400"}`}>{roi.toFixed(1)}% ROI</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  // ─── RENDER ───────────────────────────────────────────────────────────────
  return (
    <Layout showNav>
      {showConfetti && <Confetti />}
      <div className="flex flex-col h-[100dvh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 bg-gradient-to-br from-primary to-purple-700 rounded-xl flex items-center justify-center shadow-lg shadow-primary/30">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <div>
              <p className="font-bold text-sm leading-tight">AI Trade Terminal</p>
              <p className="text-[10px] text-muted-foreground">VIXUS AI</p>
            </div>
          </div>
          <button className="w-9 h-9 bg-card rounded-xl flex items-center justify-center relative">
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full border-2 border-card" />
          </button>
        </div>

        {/* ── CONFIGURE ── */}
        {step === "configure" && (
          <div className="flex-1 overflow-y-auto px-5 pb-32 space-y-6 pt-1">

            {/* Best signal preview */}
            {bestSignal && (() => {
              const buy = isBuy(bestSignal.direction);
              return (
                <div className={`rounded-2xl p-4 border ${buy ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                  <p className="text-[10px] text-muted-foreground mb-2.5 uppercase tracking-widest font-semibold">Best Signal — Auto Selected</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${buy ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                        {buy ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                      </div>
                      <div>
                        <p className="font-bold">{bestSignal.pair}</p>
                        <p className="text-[10px] text-muted-foreground">{bestSignal.market} · {bestSignal.timeframe}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge className={`text-[10px] border-none mb-1 block ${buy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                        {bestSignal.direction}
                      </Badge>
                      <p className={`text-sm font-bold ${bestSignal.confidence >= 85 ? "text-green-400" : "text-foreground"}`}>
                        {bestSignal.confidence}% AI
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            {/* 1 — Stake */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">1</div>
                  <h2 className="text-sm font-bold">Stake Amount</h2>
                </div>
                <span className={`text-xs font-medium ${stakeNum > availableBalance && stakeNum > 0 ? "text-red-400" : "text-muted-foreground"}`}>
                  Available: ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium select-none">$</span>
                <Input
                  type="number" placeholder="Enter amount..." value={stake}
                  onChange={e => setStake(e.target.value)}
                  className={`bg-card border-none h-14 rounded-xl text-lg font-bold pl-8 pr-4 ${stakeNum > availableBalance && stakeNum > 0 ? "ring-2 ring-red-500/60" : ""}`}
                />
              </div>
              {stakeNum > availableBalance && stakeNum > 0 && (
                <p className="text-xs text-red-400 mt-1.5 font-medium">Stake exceeds your available balance</p>
              )}
              <div className="flex gap-2 mt-2.5">
                {[50, 100, 250, 500].map(v => (
                  <button
                    key={v} onClick={() => setStake(v.toString())}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                      stakeNum === v ? "bg-primary border-primary text-white shadow-lg shadow-primary/30" : "border-border/40 text-muted-foreground bg-card"
                    }`}
                  >${v}</button>
                ))}
              </div>
            </section>

            {/* 2 — Duration */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">2</div>
                <h2 className="text-sm font-bold">Trade Duration</h2>
              </div>
              <div ref={runtimeRef} className="relative">
                <button onClick={() => setRuntimeOpen(o => !o)}
                  className="w-full flex items-center justify-between bg-card h-14 rounded-xl px-4 text-sm font-semibold">
                  <span className="flex items-center gap-2.5">
                    <Clock className="w-4 h-4 text-primary" />
                    {RUNTIMES.find(r => r.value === runtime)?.label}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${runtimeOpen ? "rotate-180" : ""}`} />
                </button>
                {runtimeOpen && (
                  <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border/40 rounded-2xl shadow-2xl overflow-hidden">
                    {RUNTIMES.map(r => (
                      <button key={r.value} onClick={() => { setRuntime(r.value); setRuntimeOpen(false); }}
                        className={`w-full text-left px-4 py-3.5 text-sm flex items-center justify-between transition-colors ${
                          r.value === runtime ? "bg-primary text-white font-semibold" : "hover:bg-background text-foreground"
                        }`}>
                        {r.label}
                        {r.value === runtime && <Check className="w-4 h-4" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* 3 — Bot */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">3</div>
                <h2 className="text-sm font-bold">Select Bot</h2>
              </div>
              {loadingBots ? (
                <div className="space-y-2.5">{Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />)}</div>
              ) : bots.length === 0 ? (
                <div className="bg-card rounded-2xl p-6 text-center">
                  <BotIcon className="w-10 h-10 text-muted-foreground/20 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground mb-1">No bots in your portfolio.</p>
                  <p className="text-xs text-muted-foreground/60">Purchase a bot from the Bots tab first.</p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {bots.map((bot, i) => (
                    <button key={bot.id} onClick={() => setSelectedBotId(bot.id)}
                      className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all ${
                        selectedBotId === bot.id ? "border-primary bg-primary/5 shadow-md shadow-primary/10" : "border-transparent bg-card"
                      }`}>
                      <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 bg-gradient-to-br ${BOT_COLORS[i % BOT_COLORS.length]}`}>
                        {bot.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{bot.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-green-400 font-medium">Win {bot.winRate}%</span>
                          <span className="text-[10px] text-muted-foreground">· Today +${bot.profitToday}</span>
                        </div>
                      </div>
                      <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        selectedBotId === bot.id ? "border-primary bg-primary" : "border-muted"
                      }`}>
                        {selectedBotId === bot.id && <Check className="w-3 h-3 text-white stroke-[3]" />}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {/* Summary */}
            {selectedBotId && stakeNum >= 1 && bestSignal && (() => {
              const bot = bots.find(b => b.id === selectedBotId);
              const buy = isBuy(bestSignal.direction);
              return (
                <div className="bg-gradient-to-br from-primary/15 to-purple-950/40 border border-primary/25 rounded-2xl p-4 space-y-3">
                  <p className="text-[10px] text-primary/80 uppercase tracking-widest font-semibold">Trade Summary</p>
                  {[
                    { k: "Signal",    v: `${bestSignal.pair} ${bestSignal.direction}`, c: buy ? "text-green-400" : "text-red-400" },
                    { k: "Bot",       v: bot?.name ?? "—", c: "" },
                    { k: "Stake",     v: `$${stakeNum.toFixed(2)}`, c: "" },
                    { k: "Duration",  v: RUNTIMES.find(r => r.value === runtime)?.label ?? "", c: "" },
                  ].map(({ k, v, c }) => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground">{k}</span>
                      <span className={`text-[11px] font-semibold ${c || "text-foreground"}`}>{v}</span>
                    </div>
                  ))}
                </div>
              );
            })()}

            {/* Journal section — always visible below configure */}
            <div className="pt-2">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold">Trade Journal</h2>
                {history.length > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-card rounded-full px-2 py-0.5">{history.length} trades</span>
                )}
                {history.length > 0 && (
                  <button onClick={handleClearJournal} className="ml-auto flex items-center gap-1 text-[10px] text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3 h-3" />Clear
                  </button>
                )}
              </div>
              {JournalRows}
            </div>
          </div>
        )}

        {/* ── RUNNING ── */}
        {step === "running" && (
          <div className="flex-1 overflow-y-auto px-5 pb-10 space-y-5 pt-1">

            {/* Status bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
                  <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Bot Active</p>
                  <p className="text-sm font-bold">{bots.find(b => b.id === selectedBotId)?.name ?? "—"}</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
                <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[10px] text-green-400 font-bold tracking-wider">LIVE</span>
              </div>
            </div>

            {/* Pair card */}
            {pos && (
              <div className={`w-full rounded-2xl p-4 flex items-center justify-between border ${posBuy ? "bg-green-500/5 border-green-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${posBuy ? "bg-green-500/15 text-green-500" : "bg-red-500/15 text-red-500"}`}>
                    {posBuy ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                  <div>
                    <p className="font-bold">{pos.pair}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Badge className={`text-[10px] border-none ${posBuy ? "bg-green-500/10 text-green-500" : "bg-red-500/10 text-red-500"}`}>
                        {pos.direction}
                      </Badge>
                      {executedSignal?.confidence && (
                        <span className="text-[10px] text-muted-foreground">{executedSignal.confidence}% AI confidence</span>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">Stake</p>
                  <p className="text-sm font-bold">${pos.stake.toFixed(2)}</p>
                </div>
              </div>
            )}

            {/* Circular timer */}
            <div className="flex justify-center">
              <div className="relative flex items-center justify-center">
                <svg width="190" height="190">
                  <defs>
                    <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#7C3AED" />
                      <stop offset="100%" stopColor="#4ade80" />
                    </linearGradient>
                  </defs>
                  <circle cx="95" cy="95" r={RADIUS + 10} fill="none" stroke="#7C3AED" strokeWidth="1" strokeOpacity="0.1" />
                  <circle cx="95" cy="95" r={RADIUS} fill="none" stroke="#1e293b" strokeWidth="9" />
                  <circle cx="95" cy="95" r={RADIUS} fill="none" stroke="url(#timerGrad)" strokeWidth="9" strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashOffset}
                    style={{ transition:"stroke-dashoffset 0.95s linear", transformOrigin:"95px 95px", transform:"rotate(-90deg)" }}
                  />
                </svg>
                <div className="absolute flex flex-col items-center">
                  <p className="text-4xl font-mono font-bold tracking-tight">{mm}:{ss}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Time Remaining</p>
                </div>
              </div>
            </div>

            {/* Live P&L */}
            <div className="bg-card rounded-2xl p-5 text-center">
              <p className="text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Live P&L</p>
              <p className={`text-5xl font-bold tracking-tight transition-colors duration-500 ${posUp ? "text-green-400" : "text-red-400"}`}>
                {posUp ? "+" : "−"}${Math.abs(pnl).toFixed(2)}
              </p>
              <div className="flex items-center justify-center gap-1.5 mt-2 mb-4">
                {posUp ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> : <TrendingDown className="w-3.5 h-3.5 text-red-400" />}
                <span className={`text-[10px] font-semibold ${posUp ? "text-green-400" : "text-red-400"}`}>
                  {pos && pos.stake > 0 ? `${((pnl / pos.stake) * 100).toFixed(2)}% ROI` : "—"}
                </span>
              </div>
              <div className="relative h-1.5 w-full rounded-full bg-background overflow-hidden">
                <div className={`h-full rounded-full transition-all duration-700 ${posUp ? "bg-green-500" : "bg-red-500"}`} style={{ width:`${pct}%` }} />
              </div>
            </div>

            {/* AI analysis */}
            <div className="bg-card rounded-2xl p-4 space-y-3">
              <div className="flex items-center gap-3">
                <AIWave />
                <span className="text-xs font-semibold text-muted-foreground">AI Analysis</span>
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed transition-all duration-700">{AI_MESSAGES[msgIdx]}</p>
              <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-primary to-purple-400 rounded-full animate-pulse" style={{ width:"60%" }} />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { icon: <Activity className="w-4 h-4 text-primary" />, label: "Market",   val: pos?.market ?? "—" },
                { icon: <Clock    className="w-4 h-4 text-primary" />, label: "Duration", val: `${runtime}m` },
                { icon: <Zap      className="w-4 h-4 text-primary fill-primary" />, label: "Stake", val: `$${stakeNum > 0 ? stakeNum.toFixed(0) : (pos?.stake.toFixed(0) ?? "—")}` },
              ].map(({ icon, label, val }) => (
                <div key={label} className="bg-card rounded-2xl p-3 flex flex-col items-center gap-1.5">
                  {icon}
                  <p className="text-[9px] text-muted-foreground text-center">{label}</p>
                  <p className="text-sm font-bold">{val}</p>
                </div>
              ))}
            </div>

            {/* Cash Out */}
            <Button
              onClick={handleCashOut}
              disabled={closeMutation.isPending}
              className="w-full h-13 rounded-2xl text-[15px] font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:opacity-90 disabled:opacity-40 shadow-lg shadow-amber-500/20"
            >
              {closeMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Cashing Out...
                </span>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2 fill-white" />
                  Cash Out — Take Profit Now
                </>
              )}
            </Button>

            <p className="text-[10px] text-muted-foreground/40 text-center px-6 pb-2">
              Cash out anytime to take current profits, or let the timer run for maximum returns.
            </p>

            {/* ── Journal below running trade ── */}
            <div className="pt-4 border-t border-border/30">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold">Trade Journal</h2>
                {history.length > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-card rounded-full px-2 py-0.5">{history.length} trades</span>
                )}
              </div>
              {JournalRows}
            </div>
          </div>
        )}

        {/* ── RESULT ── */}
        {step === "result" && result && (
          <div className="flex-1 overflow-y-auto px-5 pb-10">
            <div className="flex flex-col items-center py-10 gap-6 text-center">
              {result.pnl >= 0 ? (
                <>
                  <div className="relative">
                    <div className="w-28 h-28 rounded-full bg-green-500/10 flex items-center justify-center">
                      <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center">
                        <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                          <Check className="w-8 h-8 text-green-400 stroke-[3]" />
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping" style={{ animationDuration:"2.5s" }} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-green-400">
                      {result.status === "tp_hit" ? "Take Profit Hit! 🎉" : "Trade Closed!"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">{result.pair} {result.direction} · {result.botName}</p>
                  </div>
                  <div className="text-5xl font-bold text-green-400">+${Math.abs(result.pnl).toFixed(2)}</div>
                  {executedSignal?.confidence && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-2 text-xs text-green-400 font-medium">
                      {executedSignal.confidence}% AI confidence signal paid off ✓
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="w-24 h-24 rounded-full bg-red-500/10 flex items-center justify-center">
                    <XCircle className="w-12 h-12 text-red-500" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-red-400">
                      {result.status === "sl_hit" ? "Stop Loss Hit" : "Trade Closed"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">{result.pair} {result.direction} · {result.botName}</p>
                  </div>
                  <div className="text-5xl font-bold text-red-400">−${Math.abs(result.pnl).toFixed(2)}</div>
                </>
              )}
              <Button className="w-full h-12 rounded-xl font-medium" onClick={handleReset}>
                Trade Again
              </Button>
            </div>

            {/* Journal below result */}
            <div className="border-t border-border/30 pt-4">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-primary" />
                <h2 className="text-sm font-bold">Trade Journal</h2>
                {history.length > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-card rounded-full px-2 py-0.5">{history.length} trades</span>
                )}
              </div>
              {JournalRows}
            </div>
          </div>
        )}

        {/* Start button — configure only */}
        {step === "configure" && (
          <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 pb-24 pt-4 bg-gradient-to-t from-background via-background/95 to-transparent">
            <Button
              onClick={handleExecute}
              disabled={!selectedBotId || stakeNum < 1 || stakeNum > availableBalance || executeMutation.isPending || !bots.length}
              className="w-full h-14 rounded-2xl text-base font-bold bg-gradient-to-r from-[#7C3AED] to-[#9333ea] hover:opacity-90 disabled:opacity-30 transition-opacity shadow-lg shadow-primary/30"
            >
              {executeMutation.isPending ? (
                <span className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Placing Trade...
                </span>
              ) : (
                <>
                  <Zap className="w-5 h-5 mr-2 fill-white" />
                  Start Trade — {RUNTIMES.find(r => r.value === runtime)?.label}
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </Layout>
  );
}
