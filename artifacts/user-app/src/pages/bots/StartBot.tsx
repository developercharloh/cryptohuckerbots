import { useState, useEffect, useMemo, useRef } from "react";
import { useLocation, useSearch } from "wouter";
import { useListBots, useGetDashboardSummary } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, ChevronDown, Check, TrendingUp, Clock,
  Bot as BotIcon, Zap, Activity, BarChart2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Step = "configure" | "running" | "results";

const RUNTIMES = [
  { value: 1, label: "1 Minute" },
  { value: 2, label: "2 Minutes" },
  { value: 3, label: "3 Minutes" },
  { value: 4, label: "4 Minutes" },
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

function Confetti() {
  const pieces = useMemo(() =>
    Array.from({ length: 90 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      delay: Math.random() * 2.8,
      dur: 2.2 + Math.random() * 2.4,
      color: ["#7C3AED", "#4ade80", "#f59e0b", "#38bdf8", "#f472b6", "#a78bfa", "#6366f1", "#fbbf24", "#34d399"][i % 9],
      w: 5 + Math.random() * 8,
      h: 4 + Math.random() * 7,
      round: i % 3 !== 0,
    })), []);

  return (
    <>
      <style>{`
        @keyframes cfFall {
          0%   { transform: translateY(-40px) rotate(0deg) scale(1); opacity: 1; }
          80%  { opacity: 0.8; }
          100% { transform: translateY(115vh) rotate(900deg) scale(0.6); opacity: 0; }
        }
        .cf { animation: cfFall linear forwards; }
      `}</style>
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-50">
        {pieces.map(p => (
          <div
            key={p.id}
            className="absolute cf"
            style={{
              left: `${p.x}%`,
              top: 0,
              width: p.w,
              height: p.round ? p.w : p.h,
              background: p.color,
              borderRadius: p.round ? "50%" : "2px",
              animationDuration: `${p.dur}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>
    </>
  );
}

function AIWave() {
  return (
    <>
      <style>{`
        @keyframes wv { 0%,100%{transform:scaleY(0.3)} 50%{transform:scaleY(1)} }
        .wv{animation:wv 1.1s ease-in-out infinite}
      `}</style>
      <div className="flex items-end gap-[2px] h-4 shrink-0">
        {[0, 0.1, 0.22, 0.08, 0.3, 0.18, 0.05, 0.25, 0.12, 0.35, 0.15, 0.07].map((d, i) => (
          <div
            key={i}
            className="wv w-[3px] rounded-full bg-primary"
            style={{ height: "100%", animationDelay: `${d}s` }}
          />
        ))}
      </div>
    </>
  );
}

export default function StartBot() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const preId = new URLSearchParams(search).get("botId");
  const { toast } = useToast();

  const { data: bots = [], isLoading: loadingBots } = useListBots();
  const { data: summary } = useGetDashboardSummary();

  const [stakeAmount, setStakeAmount] = useState("");
  const [runtime, setRuntime] = useState(3);
  const [selectedBotId, setSelectedBotId] = useState<number | null>(preId ? parseInt(preId) : null);
  const [runtimeOpen, setRuntimeOpen] = useState(false);
  const runtimeRef = useRef<HTMLDivElement>(null);

  const [step, setStep] = useState<Step>("configure");
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [pnl, setPnl] = useState(0);
  const [msgIdx, setMsgIdx] = useState(0);
  const [tradeCount, setTradeCount] = useState(1);
  const [showConfetti, setShowConfetti] = useState(false);

  const stakeNum = parseFloat(stakeAmount) || 0;
  const selectedBot = bots.find(b => b.id === selectedBotId);
  const canStart = stakeNum >= 1 && selectedBotId !== null;
  const totalSeconds = runtime * 60;

  const [startingTrade, setStartingTrade] = useState(false);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (runtimeRef.current && !runtimeRef.current.contains(e.target as Node)) setRuntimeOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!selectedBotId && bots.length > 0) setSelectedBotId(bots[0].id);
  }, [bots, selectedBotId]);

  // Countdown
  useEffect(() => {
    if (step !== "running") return;
    const id = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(id);
          setPnl(p => {
            const final = Math.max(stakeNum * 0.045, p);
            return final;
          });
          setStep("results");
          setShowConfetti(true);
          setTimeout(() => setShowConfetti(false), 5500);
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [step, stakeNum]);

  // P&L simulation
  useEffect(() => {
    if (step !== "running") return;
    const id = setInterval(() => {
      setPnl(p => {
        const gain = Math.random() > 0.27;
        const delta = gain ? 0.04 + Math.random() * 0.42 : -(0.02 + Math.random() * 0.16);
        const cap = stakeNum * 0.22;
        return Math.max(-stakeNum * 0.04, Math.min(cap, p + delta));
      });
    }, 2100);
    return () => clearInterval(id);
  }, [step, stakeNum]);

  // AI messages
  useEffect(() => {
    if (step !== "running") return;
    const id = setInterval(() => setMsgIdx(i => (i + 1) % AI_MESSAGES.length), 3300);
    return () => clearInterval(id);
  }, [step]);

  // Trade count
  useEffect(() => {
    if (step !== "running") return;
    const id = setInterval(() => {
      setTradeCount(c => Math.min(14, c + (Math.random() > 0.45 ? 1 : 0)));
    }, 6500);
    return () => clearInterval(id);
  }, [step]);

  // Pick a sensible pair based on bot category
  const pickPair = () => {
    const cat = (selectedBot?.category ?? "").toLowerCase();
    if (cat.includes("crypto")) return { pair: "BTC/USDT", market: "Crypto", direction: "BUY" as const };
    if (cat.includes("commod") || cat.includes("gold")) return { pair: "XAU/USD", market: "Commodities", direction: "BUY" as const };
    const forexPairs = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD"];
    return { pair: forexPairs[Math.floor(Math.random() * forexPairs.length)], market: "Forex", direction: Math.random() > 0.5 ? "BUY" as const : "SELL" as const };
  };

  const handleStart = async () => {
    if (!canStart) return;
    if (stakeNum < 1) { toast({ title: "Minimum stake is $1", variant: "destructive" }); return; }
    const available = summary?.availableBalance ?? 0;
    if (stakeNum > available) {
      toast({
        title: "Insufficient balance",
        description: `You need $${stakeNum.toFixed(2)} but only have $${available.toFixed(2)} available.`,
        variant: "destructive",
      });
      return;
    }

    // Create a real position in the DB so it shows in Orders
    setStartingTrade(true);
    try {
      const token = localStorage.getItem("vixus_token") ?? "";
      const { pair, market, direction } = pickPair();
      const res = await fetch("/api/trade/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          pair,
          direction,
          market,
          stake: stakeNum,
          botName: selectedBot?.name ?? "Bot Trade",
        }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        toast({ title: err.error ?? "Failed to start bot", variant: "destructive" });
        return;
      }
      const pos = await res.json() as { id?: number };
      if (pos.id) {
        localStorage.setItem("vixus_active_trade", JSON.stringify({
          positionId: pos.id,
          endTimeMs: Date.now() + runtime * 60 * 1000,
        }));
      }
    } catch {
      toast({ title: "Network error. Try again.", variant: "destructive" });
      return;
    } finally {
      setStartingTrade(false);
    }

    setSecondsLeft(totalSeconds);
    setPnl(0);
    setMsgIdx(0);
    setTradeCount(Math.floor(Math.random() * 2) + 1);
    setStep("running");
  };

  const handleStartAgain = () => {
    setStep("configure");
    setStakeAmount("");
    setPnl(0);
    setShowConfetti(false);
  };

  const mm = Math.floor(secondsLeft / 60).toString().padStart(2, "0");
  const ss = (secondsLeft % 60).toString().padStart(2, "0");
  const timerProgress = totalSeconds > 0 ? secondsLeft / totalSeconds : 0;
  const dashOffset = CIRCUMFERENCE * (1 - timerProgress);
  const finalProfit = Math.max(stakeNum * 0.045, pnl);
  const updatedBalance = (summary?.availableBalance ?? 0) + finalProfit;

  // ─── CONFIGURE ────────────────────────────────────────────────────────────
  if (step === "configure") {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background">
        <div className="flex items-center gap-3 px-5 pt-6 pb-2 shrink-0">
          <button
            onClick={() => setLocation("/bots")}
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-card shrink-0"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-bold leading-tight">Start Bot</h1>
            <p className="text-[11px] text-muted-foreground">Configure your trade settings</p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-32 space-y-7 pt-4">
          {/* 01 Stake Amount */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">1</div>
              <h2 className="text-sm font-bold">Stake Amount</h2>
              <span className="ml-auto text-[10px] text-muted-foreground">
                Available: <span className="font-bold text-foreground">${(summary?.availableBalance ?? 0).toFixed(2)}</span>
              </span>
            </div>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground font-medium select-none">$</span>
              <Input
                type="number"
                placeholder="Enter amount..."
                value={stakeAmount}
                onChange={e => setStakeAmount(e.target.value)}
                className={`bg-card border-none h-14 rounded-xl text-lg font-bold pl-8 pr-4 ${stakeNum > 0 && stakeNum > (summary?.availableBalance ?? 0) ? "ring-2 ring-destructive/60" : ""}`}
              />
            </div>
            {stakeNum > 0 && stakeNum > (summary?.availableBalance ?? 0) && (
              <p className="text-[11px] text-destructive font-semibold mt-2 flex items-center gap-1">
                ⚠ Amount exceeds your available balance of ${(summary?.availableBalance ?? 0).toFixed(2)}
              </p>
            )}
            <div className="flex gap-2 mt-2.5">
              {[50, 100, 250, 500].map(v => (
                <button
                  key={v}
                  onClick={() => setStakeAmount(v.toString())}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border-2 transition-all ${
                    stakeNum === v
                      ? "bg-primary border-primary text-white shadow-lg shadow-primary/30"
                      : "border-border/40 text-muted-foreground hover:border-primary/40 hover:text-foreground bg-card"
                  }`}
                >
                  ${v}
                </button>
              ))}
            </div>
          </section>

          {/* 02 Bot Runtime */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">2</div>
              <h2 className="text-sm font-bold">Bot Runtime</h2>
            </div>
            <div ref={runtimeRef} className="relative">
              <button
                onClick={() => setRuntimeOpen(o => !o)}
                className="w-full flex items-center justify-between bg-card h-14 rounded-xl px-4 text-sm font-semibold"
              >
                <span className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-primary" />
                  {RUNTIMES.find(r => r.value === runtime)?.label}
                </span>
                <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${runtimeOpen ? "rotate-180" : ""}`} />
              </button>
              {runtimeOpen && (
                <div className="absolute left-0 right-0 top-full mt-1.5 z-50 bg-card border border-border/40 rounded-2xl shadow-2xl overflow-hidden">
                  {RUNTIMES.map(r => (
                    <button
                      key={r.value}
                      onClick={() => { setRuntime(r.value); setRuntimeOpen(false); }}
                      className={`w-full text-left px-4 py-3.5 text-sm flex items-center justify-between transition-colors ${
                        r.value === runtime
                          ? "bg-primary text-white font-semibold"
                          : "hover:bg-background text-foreground"
                      }`}
                    >
                      {r.label}
                      {r.value === runtime && <Check className="w-4 h-4" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* 03 Bot Selection */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">3</div>
              <h2 className="text-sm font-bold">Bot Selection</h2>
            </div>
            {loadingBots ? (
              <div className="space-y-2.5">
                {Array(3).fill(0).map((_, i) => <Skeleton key={i} className="h-[72px] w-full rounded-2xl" />)}
              </div>
            ) : bots.length === 0 ? (
              <div className="bg-card rounded-2xl p-6 text-center">
                <BotIcon className="w-10 h-10 text-muted-foreground/25 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">No bots in your portfolio yet.</p>
                <Button onClick={() => setLocation("/bots")} variant="outline" className="rounded-xl h-10 text-sm border-border">
                  Browse Marketplace
                </Button>
              </div>
            ) : (
              <div className="space-y-2.5">
                {bots.map((bot, i) => (
                  <button
                    key={bot.id}
                    onClick={() => setSelectedBotId(bot.id)}
                    className={`w-full flex items-center gap-3 p-4 rounded-2xl border-2 text-left transition-all duration-150 ${
                      selectedBotId === bot.id
                        ? "border-primary bg-primary/8 shadow-md shadow-primary/10"
                        : "border-transparent bg-card hover:border-border/50"
                    }`}
                  >
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 bg-gradient-to-br ${BOT_COLORS[i % BOT_COLORS.length]}`}>
                      {bot.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{bot.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-green-400 font-medium">Win {bot.winRate}%</span>
                        <span className="text-[10px] text-muted-foreground">·</span>
                        <span className="text-[10px] text-muted-foreground">Today +${bot.profitToday}</span>
                      </div>
                    </div>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                      selectedBotId === bot.id ? "border-primary bg-primary" : "border-muted"
                    }`}>
                      {selectedBotId === bot.id && <Check className="w-3 h-3 text-white stroke-[3]" />}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* 04 Summary */}
          {selectedBot && stakeNum >= 1 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center">4</div>
                <h2 className="text-sm font-bold">Summary</h2>
              </div>
              <div className="bg-gradient-to-br from-primary/15 to-purple-950/40 border border-primary/25 rounded-2xl p-4 space-y-3">
                {[
                  { k: "Bot", v: selectedBot.name, vc: "" },
                  { k: "Stake Amount", v: `$${stakeNum.toFixed(2)}`, vc: "" },
                  { k: "Runtime Duration", v: RUNTIMES.find(r => r.value === runtime)?.label ?? "", vc: "" },
                  { k: "Status", v: "Ready to Start", vc: "text-green-400" },
                ].map(({ k, v, vc }) => (
                  <div key={k} className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">{k}</span>
                    <span className={`text-[11px] font-semibold ${vc || "text-foreground"}`}>{v}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Start button */}
        <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] px-5 pb-8 pt-4 bg-gradient-to-t from-background via-background/95 to-transparent">
          <Button
            onClick={handleStart}
            disabled={!canStart || startingTrade}
            className="w-full h-14 rounded-2xl text-base font-bold shadow-none bg-gradient-to-r from-[#7C3AED] to-[#9333ea] hover:opacity-90 disabled:opacity-30 transition-opacity"
          >
            <Zap className="w-5 h-5 mr-2 fill-white" />
            {startingTrade ? "Placing Trade…" : "Start Bot"}
          </Button>
        </div>
      </div>
    );
  }

  // ─── RUNNING ──────────────────────────────────────────────────────────────
  if (step === "running") {
    return (
      <div className="flex flex-col min-h-[100dvh] bg-background">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-6 pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-green-500/10 flex items-center justify-center">
              <div className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide">Bot Running</p>
              <p className="text-sm font-bold">{selectedBot?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 bg-green-500/10 border border-green-500/20 px-3 py-1.5 rounded-full">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
            <span className="text-[10px] text-green-400 font-bold tracking-wider">LIVE</span>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center gap-5 px-5 pb-8 overflow-y-auto">
          {/* Circular countdown timer */}
          <div className="relative flex items-center justify-center mt-2">
            <svg width="190" height="190">
              <defs>
                <linearGradient id="timerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#7C3AED" />
                  <stop offset="100%" stopColor="#4ade80" />
                </linearGradient>
              </defs>
              {/* Outer glow ring */}
              <circle cx="95" cy="95" r={RADIUS + 10} fill="none" stroke="#7C3AED" strokeWidth="1" strokeOpacity="0.1" />
              {/* Track */}
              <circle cx="95" cy="95" r={RADIUS} fill="none" stroke="#1e293b" strokeWidth="9" />
              {/* Progress */}
              <circle
                cx="95" cy="95" r={RADIUS}
                fill="none"
                stroke="url(#timerGrad)"
                strokeWidth="9"
                strokeLinecap="round"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={dashOffset}
                style={{ transition: "stroke-dashoffset 0.95s linear", transformOrigin: "95px 95px", transform: "rotate(-90deg)" }}
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <p className="text-4xl font-mono font-bold tracking-tight">{mm}:{ss}</p>
              <p className="text-[10px] text-muted-foreground mt-1">Time Remaining</p>
            </div>
          </div>

          {/* P&L card */}
          <div className="w-full bg-card rounded-2xl p-5 text-center">
            <p className="text-[11px] text-muted-foreground mb-1 font-medium uppercase tracking-wide">Current Profit</p>
            <p
              className={`text-5xl font-bold tracking-tight transition-all duration-500 ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}
            >
              {pnl >= 0 ? "+" : "−"}${Math.abs(pnl).toFixed(2)}
            </p>
            <div className="flex items-center justify-center gap-1.5 mt-2">
              <TrendingUp className={`w-3.5 h-3.5 ${pnl >= 0 ? "text-green-400" : "text-red-400"}`} />
              <span className={`text-[10px] font-semibold ${pnl >= 0 ? "text-green-400" : "text-red-400"}`}>
                {stakeNum > 0 ? `${((pnl / stakeNum) * 100).toFixed(2)}% ROI` : "—"}
              </span>
            </div>
          </div>

          {/* AI analysis */}
          <div className="w-full bg-card rounded-2xl p-4 space-y-3">
            <div className="flex items-center gap-3">
              <AIWave />
              <span className="text-xs font-semibold text-muted-foreground">AI Analysis</span>
            </div>
            <p className="text-sm font-medium text-foreground leading-relaxed transition-all duration-700">
              {AI_MESSAGES[msgIdx]}
            </p>
            {/* Fake scanning bar */}
            <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-primary to-purple-400 rounded-full animate-pulse" style={{ width: "60%" }} />
            </div>
          </div>

          {/* Stats row */}
          <div className="w-full grid grid-cols-3 gap-3">
            {[
              { icon: <Activity className="w-4 h-4 text-primary" />, label: "Active Trades", val: tradeCount.toString() },
              { icon: <Clock className="w-4 h-4 text-primary" />, label: "Runtime", val: `${runtime}m` },
              { icon: <Zap className="w-4 h-4 text-primary fill-primary" />, label: "Stake", val: `$${stakeNum.toFixed(0)}` },
            ].map(({ icon, label, val }) => (
              <div key={label} className="bg-card rounded-2xl p-3 flex flex-col items-center gap-1.5">
                {icon}
                <p className="text-[9px] text-muted-foreground text-center">{label}</p>
                <p className="text-sm font-bold">{val}</p>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground/40 text-center px-6">
            Bot is managing positions automatically. Keep this screen open.
          </p>
        </div>
      </div>
    );
  }

  // ─── RESULTS ──────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-[100dvh] bg-background overflow-hidden">
      {showConfetti && <Confetti />}

      <div className="flex-1 flex flex-col items-center justify-center px-5 py-8 gap-6 text-center">
        {/* Success icon */}
        <div className="relative">
          <div className="w-28 h-28 rounded-full bg-green-500/10 flex items-center justify-center">
            <div className="w-20 h-20 rounded-full bg-green-500/15 flex items-center justify-center">
              <div className="w-14 h-14 rounded-full bg-green-500/20 flex items-center justify-center">
                <Check className="w-8 h-8 text-green-400 stroke-[3]" />
              </div>
            </div>
          </div>
          <div
            className="absolute inset-0 rounded-full border-2 border-green-500/30 animate-ping"
            style={{ animationDuration: "2.5s" }}
          />
        </div>

        {/* Heading */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight mb-1.5">Congratulations!</h1>
          <p className="text-muted-foreground text-sm">Your bot completed successfully.</p>
        </div>

        {/* Profit earned */}
        <div className="w-full bg-gradient-to-br from-green-500/12 to-emerald-900/20 border border-green-500/20 rounded-3xl p-6">
          <p className="text-[11px] text-muted-foreground font-medium mb-2 uppercase tracking-wider">Profit Earned</p>
          <p className="text-6xl font-bold text-green-400 tracking-tight leading-none">
            +${finalProfit.toFixed(2)}
          </p>
          {stakeNum > 0 && (
            <p className="text-sm text-green-400/70 mt-2 font-medium">
              {((finalProfit / stakeNum) * 100).toFixed(1)}% return on stake
            </p>
          )}
        </div>

        {/* Stats grid */}
        <div className="w-full grid grid-cols-3 gap-3">
          {[
            ["Runtime", `${runtime} Min`],
            ["Stake", `$${stakeNum.toFixed(0)}`],
            ["Trades", tradeCount.toString()],
          ].map(([k, v]) => (
            <div key={k} className="bg-card rounded-2xl p-4 text-center">
              <p className="text-[10px] text-muted-foreground mb-1.5">{k}</p>
              <p className="text-sm font-bold">{v}</p>
            </div>
          ))}
        </div>

        {/* Updated balance */}
        <div className="w-full bg-card rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Updated Balance</span>
          </div>
          <span className="text-lg font-bold">${updatedBalance.toFixed(2)}</span>
        </div>
      </div>

      {/* Buttons */}
      <div className="px-5 pb-10 space-y-3 shrink-0">
        <Button
          onClick={handleStartAgain}
          className="w-full h-14 rounded-2xl text-base font-bold shadow-none bg-gradient-to-r from-[#7C3AED] to-[#9333ea] hover:opacity-90"
        >
          <Zap className="w-5 h-5 mr-2 fill-white" />
          Start Again
        </Button>
        <Button
          variant="outline"
          onClick={() => setLocation("/cashier/transactions")}
          className="w-full h-14 rounded-2xl text-base font-medium border-border/50"
        >
          View History
        </Button>
      </div>
    </div>
  );
}
