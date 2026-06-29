import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  useListBots, useListTradeSignals, useExecuteTrade,
  useListTradePositions, useCloseTradePosition, useGetDashboardSummary,
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
  XCircle, Bot as BotIcon, BarChart2, Bell, ChevronLeft,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";

type Step = "configure" | "running" | "result";

const STORAGE_KEY = "vixus_active_trade";

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

// Pair display info
const PAIR_INFO: Record<string, { base: string; price: string; change: number; icon: string }> = {
  "EUR/USD": { base: "EUR", price: "1.08412", change: 0.23,  icon: "€" },
  "GBP/USD": { base: "GBP", price: "1.27105", change: 0.41,  icon: "£" },
  "USD/JPY": { base: "USD", price: "153.420", change: -0.18, icon: "$" },
  "BTC/USD": { base: "BTC", price: "67,821.5", change: 1.25, icon: "₿" },
  "ETH/USD": { base: "ETH", price: "3,512.80", change: 2.04, icon: "Ξ" },
  "XAU/USD": { base: "XAU", price: "2,342.80", change: -0.09, icon: "🥇" },
};

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function generateChartData(pair: string, count = 60) {
  let seed = 0;
  for (let i = 0; i < pair.length; i++) seed += pair.charCodeAt(i);
  const rand = seededRandom(seed);
  const base = parseFloat((PAIR_INFO[pair]?.price ?? "100").replace(/,/g, "")) || 100;
  let price = base * (0.995 + rand() * 0.01);
  const data = [];
  for (let i = 0; i < count; i++) {
    price += (rand() - 0.49) * base * 0.002;
    data.push({ i, price: parseFloat(price.toFixed(5)) });
  }
  return data;
}

const TIMEFRAMES = ["1m", "5m", "15m", "1H", "4H", "1D"];

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
  positionId: number; endTimeMs: number; runtime: number;
  signalId: string | number; signalConfidence: number;
  signalPair: string; signalDirection: string;
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
  const [runtime]                         = useState(5);
  const [activePositionId, setActivePositionId] = useState<number | null>(null);
  const [executedSignal, setExecutedSignal]     = useState<SignalInfo | null>(null);
  const [secondsLeft, setSecondsLeft]   = useState(0);
  const [totalSecs, setTotalSecs]       = useState(0);
  const [msgIdx, setMsgIdx]             = useState(0);
  const [result, setResult]             = useState<TradePosition | null>(null);
  const [showConfetti, setShowConfetti] = useState(false);

  // Chart state
  const [selectedPair, setSelectedPair] = useState("EUR/USD");
  const [activeTimeframe, setActiveTimeframe] = useState("5m");
  const [pairDropOpen, setPairDropOpen] = useState(false);

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const finishedRef  = useRef(false);
  const restoringRef = useRef<SavedTrade | null>(null);
  const positionsReadyRef = useRef(false);

  const stakeNum = parseFloat(stake) || 0;

  const chartData = useMemo(() => generateChartData(selectedPair, 60), [selectedPair]);
  const pairInfo = PAIR_INFO[selectedPair] ?? { base: "EUR", price: "1.08412", change: 0.23, icon: "€" };
  const priceUp = pairInfo.change >= 0;

  // Auto-select first bot
  useEffect(() => {
    if (bots.length === 0) return;
    const params = new URLSearchParams(window.location.search);
    const pair = params.get("pair");
    if (pair && PAIR_INFO[pair]) setSelectedPair(pair);
    const paramId = parseInt(params.get("botId") ?? "0", 10);
    if (paramId && bots.some(b => b.id === paramId)) {
      setSelectedBotId(paramId);
    } else if (!selectedBotId) {
      setSelectedBotId(bots[0].id);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bots]);

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
      id: saved.signalId, confidence: saved.signalConfidence,
      pair: saved.signalPair, direction: saved.signalDirection,
    };

    if (pos.status === "open") {
      const remaining = Math.max(0, Math.floor((saved.endTimeMs - Date.now()) / 1000));
      setActivePositionId(pos.id);
      setExecutedSignal(partialSignal);
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
              closeMutation.mutate({ id: posId }, {
                onSuccess: (closed) => finishTrade(closed),
                onError: () => queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] }),
              });
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      };

      if (remaining > 0) startTimer(pos.id);
      else closeMutation.mutate({ id: pos.id }, {
        onSuccess: (closed) => finishTrade(closed),
        onError: () => queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] }),
      });
    } else {
      localStorage.removeItem(STORAGE_KEY);
      finishedRef.current = true;
      setActivePositionId(pos.id);
      setExecutedSignal(partialSignal);
      setResult(pos);
      setStep("result");
      if (pos.pnl >= 0) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 5500); }
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
      queryClient.invalidateQueries({ queryKey: ["/api/cashier/transactions"] });
      queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions]);

  const activePosition = useMemo(() =>
    positions?.find(p => p.id === activePositionId) ?? null,
  [positions, activePositionId]);

  useEffect(() => {
    if (step !== "running") return;
    const id = setInterval(() => setMsgIdx(i => (i + 1) % AI_MESSAGES.length), 3300);
    return () => clearInterval(id);
  }, [step]);

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
    if (pos.pnl >= 0) { setShowConfetti(true); setTimeout(() => setShowConfetti(false), 5500); }
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cashier/transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/bots"] });
  };

  const availableBalance = summary?.availableBalance ?? 0;

  const handleExecute = () => {
    if (!selectedBotId || stakeNum < 1) return;
    if (!signals.length) { toast({ title: "No signals available", variant: "destructive" }); return; }
    if (stakeNum > availableBalance) {
      toast({ title: "Insufficient balance", description: `Available: $${availableBalance.toFixed(2)}`, variant: "destructive" });
      return;
    }
    const lastPair = localStorage.getItem("vixus_last_pair") ?? "";
    const pool = signals.filter(s => s.pair !== lastPair);
    const candidates = pool.length > 0 ? pool : signals;
    const signal = candidates[Math.floor(Math.random() * candidates.length)];
    const secs = runtime * 60;

    executeMutation.mutate(
      { data: { signalId: signal.id, botId: selectedBotId, targetProfit: signal.suggestedTp, stopLoss: signal.suggestedSl, stake: stakeNum } },
      {
        onSuccess: (pos) => {
          const endTimeMs = Date.now() + secs * 1000;
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ positionId: pos.id, endTimeMs, runtime, signalId: signal.id, signalConfidence: signal.confidence, signalPair: signal.pair, signalDirection: signal.direction } as SavedTrade));
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
                closeMutation.mutate({ id: pos.id }, {
                  onSuccess: (closed) => finishTrade(closed),
                  onError: () => queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] }),
                });
                return 0;
              }
              return s - 1;
            });
          }, 1000);
        },
        onError: (err: any) => toast({ title: "Trade failed", description: err.message, variant: "destructive" }),
      }
    );
  };

  const handleReset = () => {
    localStorage.removeItem(STORAGE_KEY);
    setStep("configure"); setActivePositionId(null); setResult(null);
    setShowConfetti(false); setStake(""); prevStatusRef.current = null; finishedRef.current = false;
  };

  const handleCashOut = useCallback(() => {
    if (!activePositionId) return;
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    closeMutation.mutate({ id: activePositionId }, {
      onSuccess: (closed) => finishTrade(closed),
      onError: () => queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] }),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePositionId]);

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

  const history = (positions || [])
    .filter(p => p.status !== "open")
    .filter(p => !p.closedAt || new Date(p.closedAt).getTime() >= journalClearedBefore)
    .slice(0, 30);

  const bestSignal = useMemo(() => {
    if (!signals.length) return null;
    const lastPair = localStorage.getItem("vixus_last_pair") ?? "";
    const pool = signals.filter(s => s.pair !== lastPair);
    const candidates = pool.length > 0 ? pool : signals;
    return candidates[Math.floor(Date.now() / 60_000) % candidates.length];
  }, [signals]);

  const pos = activePosition;
  const minDisplayPnl = (pos && secondsLeft <= 10 && secondsLeft > 0) ? pos.stake * 0.04 : -Infinity;
  const pnl   = Math.max(pos?.pnl ?? 0, minDisplayPnl);
  const posUp = pnl >= 0;
  const posBuy = pos ? isBuy(pos.direction) : true;
  const pct   = pos
    ? Math.max(0, Math.min(100, ((pnl + pos.stopLoss) / (pos.targetProfit + pos.stopLoss)) * 100))
    : 50;

  const PAIRS_LIST = Object.keys(PAIR_INFO);

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

  return (
    <Layout showNav>
      {showConfetti && <Confetti />}
      <div style={{ background: "#07091A", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

        {/* ── Exchange Header ── */}
        <div style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Pair selector */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setPairDropOpen(o => !o)}
                style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "6px 10px", cursor: "pointer" }}
              >
                <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{selectedPair}</span>
                <ChevronDown style={{ width: 14, height: 14, color: "#9CA3AF" }} />
              </button>
              {pairDropOpen && (
                <div style={{ position: "absolute", top: "calc(100% + 6px)", left: 0, zIndex: 50, background: "#131626", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 6, minWidth: 130, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
                  {PAIRS_LIST.map(p => (
                    <button key={p} onClick={() => { setSelectedPair(p); setPairDropOpen(false); }}
                      style={{ width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 8, background: p === selectedPair ? "rgba(124,58,237,0.2)" : "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: p === selectedPair ? "#A78BFA" : "#E5E7EB" }}>
                      {p}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Live price */}
            <div>
              <p style={{ fontSize: 18, fontWeight: 800, color: "#fff", lineHeight: 1 }}>{pairInfo.price}</p>
              <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 2 }}>
                {priceUp ? <TrendingUp style={{ width: 10, height: 10, color: "#22c55e" }} /> : <TrendingDown style={{ width: 10, height: 10, color: "#ef4444" }} />}
                <span style={{ fontSize: 11, fontWeight: 700, color: priceUp ? "#22c55e" : "#ef4444" }}>
                  {priceUp ? "+" : ""}{pairInfo.change.toFixed(2)}%
                </span>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "3px 8px" }}>
              <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 5px #22c55e" }} />
              <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e" }}>LIVE</span>
            </div>
          </div>
        </div>

        {/* ── Price Chart ── */}
        <div style={{ padding: "8px 0 0", height: 160, position: "relative" }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={priceUp ? "#22c55e" : "#ef4444"} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={priceUp ? "#22c55e" : "#ef4444"} stopOpacity={0}    />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="price"
                stroke={priceUp ? "#22c55e" : "#ef4444"}
                strokeWidth={1.5}
                fill="url(#chartGrad)"
                dot={false}
                isAnimationActive={false}
              />
              <Tooltip
                contentStyle={{ background: "#1a1f36", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 11 }}
                itemStyle={{ color: "#fff" }}
                labelStyle={{ display: "none" }}
                formatter={(v: any) => [v.toFixed(5), "Price"]}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* ── Timeframe selector ── */}
        <div style={{ display: "flex", gap: 4, padding: "6px 16px 12px", overflowX: "auto" }}>
          {TIMEFRAMES.map(tf => (
            <button
              key={tf}
              onClick={() => setActiveTimeframe(tf)}
              style={{
                padding: "4px 12px", borderRadius: 8, fontSize: 11, fontWeight: 700, border: "none", cursor: "pointer",
                background: activeTimeframe === tf ? "linear-gradient(135deg,#7C3AED,#4F46E5)" : "rgba(255,255,255,0.06)",
                color: activeTimeframe === tf ? "#fff" : "#6B7280",
                boxShadow: activeTimeframe === tf ? "0 2px 8px rgba(124,58,237,0.4)" : "none",
              }}
            >
              {tf}
            </button>
          ))}
        </div>

        {/* ── Divider ── */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px" }} />

        {/* ── Trade Panel ── */}
        <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", paddingBottom: 88 }}>

          {/* ── CONFIGURE ── */}
          {step === "configure" && (
            <div className="space-y-5">
              {/* Best signal */}
              {bestSignal && (() => {
                const buy = isBuy(bestSignal.direction);
                return (
                  <div style={{ borderRadius: 16, padding: 14, border: `1px solid ${buy ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`, background: buy ? "rgba(34,197,94,0.05)" : "rgba(239,68,68,0.05)" }}>
                    <p style={{ fontSize: 9, color: "#6B7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 700 }}>AI Signal — Auto Selected</p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={{ width: 36, height: 36, borderRadius: "50%", background: buy ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          {buy ? <ArrowUpRight style={{ width: 18, height: 18, color: "#22c55e" }} /> : <ArrowDownRight style={{ width: 18, height: 18, color: "#ef4444" }} />}
                        </div>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{bestSignal.pair}</p>
                          <p style={{ fontSize: 10, color: "#6B7280" }}>{bestSignal.market} · {bestSignal.timeframe}</p>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ background: buy ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", borderRadius: 6, padding: "3px 8px", marginBottom: 4 }}>
                          <span style={{ fontSize: 10, fontWeight: 700, color: buy ? "#22c55e" : "#ef4444" }}>{bestSignal.direction}</span>
                        </div>
                        <p style={{ fontSize: 13, fontWeight: 800, color: bestSignal.confidence >= 85 ? "#22c55e" : "#fff" }}>
                          {bestSignal.confidence}% AI
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Stake */}
              <div>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: "#A78BFA" }}>1</span>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Stake Amount</span>
                  </div>
                  <span style={{ fontSize: 11, color: stakeNum > availableBalance && stakeNum > 0 ? "#ef4444" : "#6B7280" }}>
                    Avail: ${availableBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ position: "relative" }}>
                  <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", color: "#6B7280", fontWeight: 600 }}>$</span>
                  <Input
                    type="number" placeholder="Enter amount..." value={stake}
                    onChange={e => setStake(e.target.value)}
                    style={{ paddingLeft: 28, height: 52, background: "rgba(255,255,255,0.05)", border: stakeNum > availableBalance && stakeNum > 0 ? "1px solid #ef4444" : "1px solid rgba(255,255,255,0.1)", borderRadius: 12, fontSize: 16, fontWeight: 700, color: "#fff" }}
                  />
                </div>
                {/* Quick amounts */}
                <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
                  {[10, 25, 50, 100].map(amt => (
                    <button key={amt} onClick={() => setStake(String(amt))}
                      style={{ flex: 1, padding: "5px 0", borderRadius: 8, background: parseFloat(stake) === amt ? "rgba(124,58,237,0.3)" : "rgba(255,255,255,0.05)", border: `1px solid ${parseFloat(stake) === amt ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`, fontSize: 11, fontWeight: 700, color: parseFloat(stake) === amt ? "#A78BFA" : "#9CA3AF", cursor: "pointer" }}>
                      ${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Bot select */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                  <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <span style={{ fontSize: 9, fontWeight: 800, color: "#A78BFA" }}>2</span>
                  </div>
                  <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Select AI Bot</span>
                </div>
                {loadingBots ? (
                  <div style={{ display: "flex", gap: 8 }}>{[1,2].map(i => <Skeleton key={i} className="h-20 flex-1 rounded-2xl" />)}</div>
                ) : (
                  <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 4 }}>
                    {bots.map((bot, idx) => {
                      const active = selectedBotId === bot.id;
                      return (
                        <button key={bot.id} onClick={() => setSelectedBotId(bot.id)}
                          style={{ flexShrink: 0, width: 120, padding: "10px 10px", borderRadius: 14, background: active ? "rgba(124,58,237,0.2)" : "rgba(255,255,255,0.04)", border: `1px solid ${active ? "rgba(124,58,237,0.5)" : "rgba(255,255,255,0.08)"}`, cursor: "pointer", textAlign: "center" }}>
                          <div style={{ width: 32, height: 32, borderRadius: 10, background: `linear-gradient(135deg, ${["#7C3AED,#4F46E5","#3B82F6,#06B6D4","#F59E0B,#EF4444","#10B981,#22C55E","#EC4899,#F43F5E"][idx%5]})`, display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 6px" }}>
                            <BotIcon style={{ width: 16, height: 16, color: "#fff" }} />
                          </div>
                          <p style={{ fontSize: 10, fontWeight: 700, color: active ? "#A78BFA" : "#E5E7EB", marginBottom: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{bot.name}</p>
                          <p style={{ fontSize: 9, color: "#6B7280" }}>{bot.winRate ?? 85}% win</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Execute button */}
              <button
                onClick={handleExecute}
                disabled={executeMutation.isPending || !selectedBotId || stakeNum < 1 || stakeNum > availableBalance}
                style={{
                  width: "100%", height: 56, borderRadius: 16, border: "none", cursor: "pointer",
                  background: executeMutation.isPending || !selectedBotId || stakeNum < 1 ? "rgba(124,58,237,0.3)" : "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
                  fontSize: 15, fontWeight: 800, color: "#fff",
                  boxShadow: "0 4px 20px rgba(124,58,237,0.4)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                }}
              >
                <Zap style={{ width: 18, height: 18, fill: "#fff", color: "#fff" }} />
                {executeMutation.isPending ? "Executing..." : "Execute AI Trade"}
              </button>

              {/* Trade Journal */}
              {history.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Trade Journal</p>
                    <button onClick={handleClearJournal} style={{ fontSize: 10, color: "#6B7280", background: "none", border: "none", cursor: "pointer" }}>Clear</button>
                  </div>
                  {JournalRows}
                </div>
              )}
            </div>
          )}

          {/* ── RUNNING ── */}
          {step === "running" && pos && (
            <div className="flex flex-col items-center gap-5 pt-2">
              {/* Timer ring */}
              <div style={{ position: "relative", width: 140, height: 140 }}>
                <svg width={140} height={140} style={{ transform: "rotate(-90deg)" }}>
                  <circle cx={70} cy={70} r={RADIUS} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={8} />
                  <circle cx={70} cy={70} r={RADIUS} fill="none"
                    stroke={posUp ? "#22c55e" : "#ef4444"}
                    strokeWidth={8} strokeLinecap="round"
                    strokeDasharray={CIRCUMFERENCE}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>
                <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <p style={{ fontSize: 26, fontWeight: 800, color: "#fff", fontFamily: "monospace", lineHeight: 1 }}>{mm}:{ss}</p>
                  <p style={{ fontSize: 10, color: "#6B7280" }}>remaining</p>
                </div>
              </div>

              {/* Pair + direction */}
              <div style={{ textAlign: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginBottom: 4 }}>
                  <p style={{ fontSize: 20, fontWeight: 800, color: "#fff" }}>{executedSignal?.pair ?? pos.pair}</p>
                  <div style={{ background: posBuy ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)", borderRadius: 8, padding: "3px 10px" }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: posBuy ? "#22c55e" : "#ef4444" }}>{pos.direction}</span>
                  </div>
                </div>
                <AIWave />
                <p style={{ fontSize: 11, color: "#6B7280", marginTop: 6 }}>{AI_MESSAGES[msgIdx]}</p>
              </div>

              {/* P&L */}
              <div style={{ width: "100%", background: "rgba(255,255,255,0.04)", borderRadius: 20, padding: "16px 20px", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                <p style={{ fontSize: 10, color: "#6B7280", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>Live P&L</p>
                <p style={{ fontSize: 36, fontWeight: 900, color: posUp ? "#22c55e" : "#ef4444", fontFamily: "monospace" }}>
                  {posUp ? "+" : "−"}${Math.abs(pnl).toFixed(2)}
                </p>
                <div style={{ height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 12 }}>
                  <div style={{ height: 4, borderRadius: 2, background: posUp ? "#22c55e" : "#ef4444", width: `${pct}%`, transition: "width 1s ease" }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 9, color: "#ef4444" }}>SL −${pos.stopLoss.toFixed(2)}</span>
                  <span style={{ fontSize: 9, color: "#22c55e" }}>TP +${pos.targetProfit.toFixed(2)}</span>
                </div>
              </div>

              {/* Stake info */}
              <div style={{ width: "100%", display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                  <p style={{ fontSize: 9, color: "#6B7280", marginBottom: 3 }}>STAKE</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>${pos.stake.toFixed(2)}</p>
                </div>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                  <p style={{ fontSize: 9, color: "#6B7280", marginBottom: 3 }}>AI CONF.</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#A78BFA" }}>{executedSignal?.confidence ?? "—"}%</p>
                </div>
              </div>

              {/* Cash out */}
              <button onClick={handleCashOut} disabled={closeMutation.isPending}
                style={{ width: "100%", height: 52, borderRadius: 16, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", fontSize: 14, fontWeight: 700, color: "#f87171", cursor: "pointer" }}>
                {closeMutation.isPending ? "Closing..." : "Cash Out Early"}
              </button>
            </div>
          )}

          {/* ── RESULT ── */}
          {step === "result" && result && (() => {
            const win = result.pnl >= 0;
            const buy = isBuy(result.direction);
            const roi = result.stake > 0 ? (result.pnl / result.stake) * 100 : 0;
            return (
              <div className="flex flex-col items-center gap-5 pt-2">
                {/* Result icon */}
                <div style={{ width: 88, height: 88, borderRadius: "50%", background: win ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", border: `2px solid ${win ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {win ? <CheckCircle2 style={{ width: 40, height: 40, color: "#22c55e" }} /> : <XCircle style={{ width: 40, height: 40, color: "#ef4444" }} />}
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>{win ? "Trade Closed — Profit!" : "Trade Closed — Loss"}</p>
                  <p style={{ fontSize: 44, fontWeight: 900, color: win ? "#22c55e" : "#ef4444", fontFamily: "monospace", lineHeight: 1 }}>
                    {win ? "+" : "−"}${Math.abs(result.pnl).toFixed(2)}
                  </p>
                  <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>{roi > 0 ? "+" : ""}{roi.toFixed(1)}% ROI on ${result.stake.toFixed(0)} stake</p>
                </div>

                {/* Stats */}
                <div style={{ width: "100%", background: "rgba(255,255,255,0.04)", borderRadius: 18, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {[
                    ["Pair", result.pair],
                    ["Direction", result.direction],
                    ["Duration", result.elapsedMs > 0 ? fmtDuration(result.elapsedMs) : "—"],
                    ["Status", result.status === "tp_hit" ? "TP Hit ✓" : result.status === "sl_hit" ? "SL Hit ✗" : result.status === "closed_manual" ? "Manual Close" : "Expired"],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{val}</span>
                    </div>
                  ))}
                </div>

                <button onClick={handleReset}
                  style={{ width: "100%", height: 52, borderRadius: 16, background: "linear-gradient(135deg, #7C3AED, #4F46E5)", border: "none", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer", boxShadow: "0 4px 16px rgba(124,58,237,0.4)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Zap style={{ width: 16, height: 16, fill: "#fff" }} />
                  New Trade
                </button>

                {history.length > 0 && (
                  <div style={{ width: "100%" }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#fff", marginBottom: 10 }}>Trade Journal</p>
                    {JournalRows}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      </div>
    </Layout>
  );
}
