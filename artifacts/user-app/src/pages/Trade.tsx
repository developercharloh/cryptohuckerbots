import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  useListTradeSignals, useGetTradeAccess, useExecuteTrade, useExecuteAllTradeSignals,
  useListTradePositions, useCloseTradePosition, useGetDashboardSummary,
  TradePosition,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  TrendingUp, TrendingDown, Zap, Activity, Check,
  ArrowUpRight, ArrowDownRight, ChevronDown, CheckCircle2,
  XCircle, BarChart2, Bell, ChevronLeft, ShieldCheck, WalletCards, Sparkles,
  Loader2, LockKeyhole,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip,
} from "recharts";

type Step = "configure" | "running" | "result";
type ExecutionMode = "single" | "all";

const STORAGE_KEY = "vixus_active_trade";
const BULK_STORAGE_KEY = "vixus_active_bulk_trade";

const AI_MESSAGES = [
  "Analyzing market conditions...",
  "Scanning for optimal entry points...",
  "Reviewing market conditions and risk...",
  "Monitoring position performance...",
  "Calibrating execution timing...",
  "Checking the configured exit levels...",
  "Trend reversal signal detected...",
  "Adjusting position sizing dynamically...",
  "Market volatility managed efficiently...",
  "Watching for the next price update...",
];

const BOT_COLORS = [
  "from-amber-400 to-blue-600",
  "from-blue-500 to-cyan-600",
  "from-orange-500 to-red-500",
  "from-green-500 to-emerald-600",
  "from-pink-500 to-rose-600",
];

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

const VIP_LEVELS = [
  { level: 1, dailySignals: 2 },
  { level: 2, dailySignals: 3 },
  { level: 3, dailySignals: 4 },
  { level: 4, dailySignals: 5 },
  { level: 5, dailySignals: 6 },
  { level: 6, dailySignals: 7 },
  { level: 7, dailySignals: 8 },
  { level: 8, dailySignals: 9 },
  { level: 9, dailySignals: 10 },
  { level: 10, dailySignals: 11 },
] as const;

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
      color: ["#F5B942","#4ade80","#f59e0b","#38bdf8","#f472b6","#FFD86B"][i % 6],
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
type BulkSignalPhase = "queued" | "scanning" | "selected" | "executing" | "active";

const getBulkSignalPhase = (activityStep: number, index: number): BulkSignalPhase => {
  const localStep = activityStep - index * 3;
  if (localStep >= 3) return "active";
  if (localStep === 2) return "executing";
  if (localStep === 1) return "selected";
  if (localStep === 0) return "scanning";
  return "queued";
};

type SavedTrade = {
  positionId: number; endTimeMs: number; runtime: number;
  signalId: string | number; signalConfidence: number;
  signalPair: string; signalDirection: string;
};
type SignalInfo = { id?: string | number; opportunityId?: number; confidence?: number; pair?: string; direction?: string; status?: string };
type SavedBulkTrade = { positionIds: number[]; signals: SignalInfo[]; activityStep?: number };

export default function Trade() {
  const [, setLocation] = useLocation();
  const { data: signals = [] } = useListTradeSignals();
  const { data: vipAccess } = useGetTradeAccess({ query: { refetchInterval: 15000 } as any });
  const { data: positions } = useListTradePositions({ query: { refetchInterval: 4000 } as any });
  const { data: summary } = useGetDashboardSummary({ query: { refetchInterval: 10000 } as any });
  const executeMutation = useExecuteTrade();
  const executeAllMutation = useExecuteAllTradeSignals();
  const closeMutation   = useCloseTradePosition();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [step, setStep]                   = useState<Step>("configure");
  const [executionMode, setExecutionMode] = useState<ExecutionMode>("single");
  const [consent, setConsent]             = useState(false);
  const [consentPrompt, setConsentPrompt] = useState(false);
  const [runtime]                         = useState(5);
  const [activePositionId, setActivePositionId] = useState<number | null>(null);
  const [executedSignal, setExecutedSignal]     = useState<SignalInfo | null>(null);
  const [msgIdx, setMsgIdx]             = useState(0);
  const [result, setResult]             = useState<TradePosition | null>(null);
  const [bulkPositionIds, setBulkPositionIds] = useState<number[]>([]);
  const [bulkSignals, setBulkSignals] = useState<SignalInfo[]>([]);
  const [bulkActivityStep, setBulkActivityStep] = useState(0);
  const [bulkResultPositions, setBulkResultPositions] = useState<TradePosition[]>([]);
  const [showConfetti, setShowConfetti] = useState(false);
  const [refreshingSignals, setRefreshingSignals] = useState(false);

  // Chart state
  const [selectedPair, setSelectedPair] = useState("EUR/USD");
  const [requestedDirection] = useState(() => new URLSearchParams(window.location.search).get("direction")?.toUpperCase() ?? "");
  const [pairDropOpen, setPairDropOpen] = useState(false);

  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null);
  const consentRef   = useRef<HTMLInputElement>(null);
  const finishedRef  = useRef(false);
  const restoringRef = useRef<SavedTrade | null>(null);
  const positionsReadyRef = useRef(false);

  const chartData = useMemo(() => generateChartData(selectedPair, 60), [selectedPair]);
  const pairInfo = PAIR_INFO[selectedPair] ?? { base: "EUR", price: "1.08412", change: 0.23, icon: "€" };
  const priceUp = pairInfo.change >= 0;

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const pair = params.get("pair");
    if (pair && PAIR_INFO[pair]) setSelectedPair(pair);
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

    try {
      const rawBulk = localStorage.getItem(BULK_STORAGE_KEY);
      if (rawBulk) {
        const savedBulk = JSON.parse(rawBulk) as SavedBulkTrade;
        const tracked = positions.filter((position) => savedBulk.positionIds.includes(position.id));
        if (savedBulk.positionIds.length > 0 && tracked.length === savedBulk.positionIds.length) {
          setBulkPositionIds(savedBulk.positionIds);
          setBulkSignals(savedBulk.signals ?? []);
          setBulkActivityStep(savedBulk.activityStep ?? (savedBulk.signals?.length ?? 0) * 3);
          finishedRef.current = false;
          if (tracked.every((position) => position.status !== "open")) {
            finishBulkTrade(tracked);
          } else {
            setStep("running");
          }
          return;
        }
        if (tracked.length > 0) return;
        localStorage.removeItem(BULK_STORAGE_KEY);
      }
    } catch {
      localStorage.removeItem(BULK_STORAGE_KEY);
    }

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
      setActivePositionId(pos.id);
      setExecutedSignal(partialSignal);
      prevStatusRef.current = "open";
      finishedRef.current = false;
      setStep("running");

      const startTimer = (posId: number) => {
        timerRef.current = setInterval(() => {
           if (Date.now() < saved.endTimeMs) return;
           clearInterval(timerRef.current!);
           timerRef.current = null;
           closeMutation.mutate({ id: posId }, {
             onSuccess: (closed) => finishTrade(closed),
             onError: () => queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] }),
           });
        }, 1000);
      };

       if (Date.now() < saved.endTimeMs) startTimer(pos.id);
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
    if (step !== "running" || bulkPositionIds.length === 0 || !positions) return;
    const tracked = positions.filter((position) => bulkPositionIds.includes(position.id));
    if (tracked.length === bulkPositionIds.length && tracked.every((position) => position.status !== "open")) {
      finishBulkTrade(tracked);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions, bulkPositionIds, step]);

  // Reveal the server-selected batch as a readable AI activity feed.
  // The API still opens the batch atomically; this only makes each decision visible.
  useEffect(() => {
    if (step !== "running" || bulkPositionIds.length === 0 || bulkSignals.length === 0) return;
    const maxStep = bulkSignals.length * 3;
    if (bulkActivityStep >= maxStep) return;
    const timer = setInterval(() => {
      setBulkActivityStep((currentStep) => {
        const nextStep = Math.min(currentStep + 1, maxStep);
        try {
          const raw = localStorage.getItem(BULK_STORAGE_KEY);
          if (raw) {
            const saved = JSON.parse(raw) as SavedBulkTrade;
            localStorage.setItem(BULK_STORAGE_KEY, JSON.stringify({ ...saved, activityStep: nextStep }));
          }
        } catch {
          // The positions remain server-tracked if storage is unavailable.
        }
        return nextStep;
      });
    }, 820);
    return () => clearInterval(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, bulkPositionIds.length, bulkSignals.length]);

  useEffect(() => {
    if (step !== "running") return;
    const id = setInterval(() => setMsgIdx(i => (i + 1) % AI_MESSAGES.length), 3300);
    return () => clearInterval(id);
  }, [step]);

  const prevStatusRef = useRef<string | null>(null);
  useEffect(() => {
    if (!activePosition || step !== "running" || bulkPositionIds.length > 0) return;
    const cur = activePosition.status;
    const prev = prevStatusRef.current;
    prevStatusRef.current = cur;
    if (prev === "open" && cur !== "open") {
      if (timerRef.current) clearInterval(timerRef.current);
      finishTrade(activePosition);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activePosition, bulkPositionIds.length]);

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

  const finishBulkTrade = (closedPositions: TradePosition[]) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    localStorage.removeItem(BULK_STORAGE_KEY);
    setBulkResultPositions(closedPositions);
    setBulkPositionIds([]);
    setStep("result");
    if (closedPositions.every((position) => position.pnl >= 0)) {
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 5500);
    }
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/cashier/transactions"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trade/access"] });
    queryClient.invalidateQueries({ queryKey: ["/api/trade/signals"] });
  };

  const vaultCapital = summary?.vaultCapital ?? summary?.lockedInvestmentCapital ?? 0;
  const signalAmount = vipAccess?.signalAmount ?? 1.5;

  const handleRefreshSignals = useCallback(async () => {
    if (refreshingSignals) return;
    if (vipAccess?.withdrawalGateActive) {
      toast({
        title: "Signal execution paused",
        description: `Complete ${vipAccess.withdrawalReferralRequirement} active referrals or upgrade to VIP 2 after reaching $${vipAccess.withdrawalSignalThreshold.toFixed(2)} in withdrawals.`,
      });
      return;
    }
    setRefreshingSignals(true);
    try {
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/trade/access"], type: "active" }),
        queryClient.refetchQueries({ queryKey: ["/api/trade/signals"], type: "active" }),
      ]);
      const refreshedSignals = queryClient.getQueryData<SignalInfo[]>(["/api/trade/signals"]) ?? [];
      const hasAvailableSignal = refreshedSignals.some(
         (signal) =>
           signal.status !== "executed" &&
           Boolean(signal.opportunityId) &&
           signal.pair === selectedPair &&
           (!requestedDirection || signal.direction?.toUpperCase() === requestedDirection),
      );
      toast({
        title: hasAvailableSignal ? "AI signal ready" : "Signals refreshed",
        description: hasAvailableSignal
           ? `Review the newly available ${selectedPair} signal above before executing.`
           : `There is no new signal for ${selectedPair} right now. Try another pair or refresh again.`,
      });
    } catch (error: any) {
      toast({
        title: "Could not refresh AI Signals",
        description: error?.message ?? "Please check your connection and try again.",
        variant: "destructive",
      });
    } finally {
      setRefreshingSignals(false);
    }
  }, [queryClient, refreshingSignals, requestedDirection, selectedPair, toast]);

  const handleExecute = () => {
    const signal = bestSignal;
    if (vipAccess?.vipLevel === 0) {
      toast({
        title: "Unlock AI Signals",
        description: "Purchase a VIP package to execute AI Signals.",
      });
      setLocation("/vip-packages");
      return;
    }
    if (vipAccess?.withdrawalGateActive) {
      toast({
        title: "Signal execution paused",
        description: `You have withdrawn $${vipAccess.totalWithdrawn.toFixed(2)}. Refer ${vipAccess.withdrawalReferralRequirement} active users or upgrade to VIP 2 to continue receiving signals.`,
      });
      return;
    }
    if (cooldownActive || vipAccess?.remainingToday === 0) {
      toast({
        title: cooldownActive ? "24-hour cooldown active" : "Daily signal allowance reached",
        description: cooldownActive
          ? `No new signals can execute for ${formatCooldown(cooldownSeconds)}.`
          : "Your signal allowance will be available again after the current signal window.",
      });
      return;
    }
    if (!signal || !signal.opportunityId) {
      void handleRefreshSignals();
      return;
    }
    if (!consent) {
      setConsentPrompt(true);
      toast({
        title: "Confirm execution to continue",
        description: "Tick the confirmation box above, then tap Execute AI Signal.",
      });
      consentRef.current?.focus();
      return;
    }
    const signalAmount = vipAccess?.signalAmount ?? 1.5;
    if (signalAmount > vaultCapital) {
      toast({ title: "Insufficient Vault Capital", description: `Your Vault Capital is $${vaultCapital.toFixed(2)}. Activate or upgrade VIP and try again.`, variant: "destructive" });
      return;
    }
    const secs = runtime * 60;

    executeMutation.mutate(
       { data: { signalId: signal.id, opportunityId: signal.opportunityId, consent: true, clientRequestId: crypto.randomUUID() } },
      {
        onSuccess: (pos) => {
          const endTimeMs = Date.now() + secs * 1000;
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ positionId: pos.id, endTimeMs, runtime, signalId: signal.id, signalConfidence: signal.confidence, signalPair: signal.pair, signalDirection: signal.direction } as SavedTrade));
          setActivePositionId(pos.id);
          setBulkPositionIds([]);
          setBulkResultPositions([]);
          localStorage.removeItem(BULK_STORAGE_KEY);
          setExecutedSignal(signal);
          prevStatusRef.current = "open";
          finishedRef.current = false;
          setMsgIdx(0);
           setConsent(false);
           setConsentPrompt(false);
          setStep("running");
          queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
           timerRef.current = setInterval(() => {
             if (Date.now() < endTimeMs) return;
             clearInterval(timerRef.current!);
             timerRef.current = null;
             closeMutation.mutate({ id: pos.id }, {
               onSuccess: (closed) => finishTrade(closed),
               onError: () => queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] }),
             });
           }, 1000);
        },
         onError: (err: any) => toast({
           title: "Signal could not be executed",
           description: err?.data?.error ?? err?.message ?? "Please try again.",
           variant: "destructive",
         }),
      }
    );
  };

  const handleExecuteAll = () => {
    if (vipAccess?.vipLevel === 0) {
      toast({
        title: "Unlock AI Signals",
        description: "Purchase a VIP package to execute AI Signals.",
      });
      setLocation("/vip-packages");
      return;
    }
    if (vipAccess?.withdrawalGateActive) {
      toast({
        title: "Signal execution paused",
        description: `You have withdrawn $${vipAccess.totalWithdrawn.toFixed(2)}. Refer ${vipAccess.withdrawalReferralRequirement} active users or upgrade to VIP 2 to continue receiving signals.`,
      });
      return;
    }
    if (cooldownActive || vipAccess?.remainingToday === 0) {
      toast({
        title: cooldownActive ? "24-hour cooldown active" : "Daily signal allowance reached",
        description: cooldownActive
          ? `No new signals can execute for ${formatCooldown(cooldownSeconds)}.`
          : "Your signal allowance will be available again after the current signal window.",
      });
      return;
    }
    if (bulkSignalCount === 0) {
      void handleRefreshSignals();
      return;
    }
    if (!consent) {
      setConsentPrompt(true);
      toast({
        title: "Confirm batch execution to continue",
        description: "Tick the confirmation box above, then execute all available AI signals.",
      });
      consentRef.current?.focus();
      return;
    }
    const totalStake = signalAmount * bulkSignalCount;
    if (totalStake > vaultCapital) {
      toast({
        title: "Insufficient Vault Capital",
        description: `You need $${totalStake.toFixed(2)} of Vault Capital for ${bulkSignalCount} simultaneous signals.`,
        variant: "destructive",
      });
      return;
    }

    executeAllMutation.mutate(
      { data: { consent: true, clientRequestId: crypto.randomUUID() } },
      {
        onSuccess: (batch) => {
          const selectedSignals: SignalInfo[] = batch.selectedSignals.map((signal) => ({
            id: signal.id,
            opportunityId: signal.opportunityId,
            confidence: signal.confidence,
            pair: signal.pair,
            direction: signal.direction,
            status: "executed",
          }));
          setBulkPositionIds(batch.positions.map((position) => position.id));
          setBulkSignals(selectedSignals);
          setBulkActivityStep(0);
          setBulkResultPositions([]);
          setResult(null);
          setActivePositionId(null);
          setExecutedSignal(null);
          setConsent(false);
          setConsentPrompt(false);
          finishedRef.current = false;
          localStorage.setItem(BULK_STORAGE_KEY, JSON.stringify({
            positionIds: batch.positions.map((position) => position.id),
            signals: selectedSignals,
            activityStep: 0,
          } satisfies SavedBulkTrade));
          setStep("running");
          toast({
            title: `${batch.executedCount} AI signals executing`,
            description: `AI selected the best available pairs. Expected profit after settlement: $${batch.totalReward.toFixed(2)}.`,
          });
          queryClient.invalidateQueries({ queryKey: ["/api/trade/positions"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trade/access"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trade/signals"] });
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/summary"] });
        },
        onError: (err: any) => toast({
          title: "Signals could not be executed",
          description: err?.data?.error ?? err?.message ?? "Please try again.",
          variant: "destructive",
        }),
      },
    );
  };

  const handleReset = () => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(BULK_STORAGE_KEY);
    setStep("configure"); setActivePositionId(null); setResult(null);
    setBulkPositionIds([]); setBulkSignals([]); setBulkActivityStep(0); setBulkResultPositions([]);
    setShowConfetti(false); setConsent(false); prevStatusRef.current = null; finishedRef.current = false;
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

  const [cooldownNowMs, setCooldownNowMs] = useState(() => Date.now());
  const cooldownUntilMs = vipAccess?.cooldownUntil
    ? new Date(vipAccess.cooldownUntil).getTime()
    : 0;
  const cooldownSeconds = cooldownUntilMs > cooldownNowMs
    ? Math.ceil((cooldownUntilMs - cooldownNowMs) / 1000)
    : 0;
  const cooldownActive = cooldownSeconds > 0;
  const withdrawalGateActive = Boolean(vipAccess?.withdrawalGateActive);

  useEffect(() => {
    if (!vipAccess?.cooldownUntil) return;
    setCooldownNowMs(Date.now());
    const id = setInterval(() => setCooldownNowMs(Date.now()), 1000);
    return () => clearInterval(id);
  }, [vipAccess?.cooldownUntil]);

  useEffect(() => {
    if (!vipAccess?.cooldownUntil || cooldownActive) return;
    void queryClient.invalidateQueries({ queryKey: ["/api/trade/access"] });
    void queryClient.invalidateQueries({ queryKey: ["/api/trade/signals"] });
  }, [cooldownActive, vipAccess?.cooldownUntil, queryClient]);

  const formatCooldown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const remainingSeconds = seconds % 60;
    return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const history = (positions || [])
    .filter(p => p.status !== "open")
    .slice(0, 100);

  const bestSignal = useMemo(() => {
     const unclaimed = signals.filter(s => s.status !== "executed");
     const matchingDirection = requestedDirection ? unclaimed.filter(s => s.direction.toUpperCase() === requestedDirection) : unclaimed;
     const matchingPair = matchingDirection.filter(s => s.pair === selectedPair);
     return matchingPair[0] ?? null;
  }, [signals, requestedDirection, selectedPair]);
  const bulkSignalCount = useMemo(() => {
    const uniqueSignalIds = new Set(
      signals
        .filter((signal) => signal.status !== "executed" && Boolean(signal.opportunityId))
        .map((signal) => String(signal.id)),
    );
    return Math.min(uniqueSignalIds.size, vipAccess?.remainingToday ?? 0);
  }, [signals, vipAccess?.remainingToday]);
  const refreshAction = !bestSignal &&
    executionMode === "single" &&
    vipAccess?.vipLevel !== 0 &&
    !withdrawalGateActive &&
    !cooldownActive &&
    vipAccess?.remainingToday !== 0;
  const executePending = executeMutation.isPending || executeAllMutation.isPending;
  const executeButtonLabel = refreshingSignals
    ? "Refreshing AI Signals…"
    : executePending
    ? "Executing signal…"
    : vipAccess?.vipLevel === 0
      ? "Unlock AI Signals"
      : withdrawalGateActive
        ? "Upgrade to VIP 2 to continue"
      : cooldownActive
        ? "24-hour cooldown active"
      : vipAccess?.remainingToday === 0
        ? "Daily allowance complete"
        : executionMode === "all"
          ? bulkSignalCount === 0
            ? "Refresh AI Signals"
            : bulkSignalCount * signalAmount > vaultCapital
              ? "Add balance to continue"
              : !consent
                ? "Confirm & execute all signals"
                : `Execute all ${bulkSignalCount} AI signals`
          : !bestSignal
            ? "Refresh AI Signals"
            : signalAmount > vaultCapital
              ? "Add balance to continue"
              : !consent
                ? "Confirm & execute signal"
                : "Execute AI Signal";
  const pos = activePosition;
  const pnl   = pos?.pnl ?? 0;
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
                      {p.status === "closed_manual" ? "Closed early" : p.pnl >= 0 ? "Profit outcome" : "Loss outcome"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-2 border-t border-border/30">
                  <span>Signal ${p.stake.toFixed(2)}</span>
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
      <div className="user-trade-page" style={{ background: "#07091A", minHeight: "100dvh", display: "flex", flexDirection: "column" }}>

        {/* ── Exchange Header ── */}
        <div className="user-trade-header" style={{ padding: "16px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
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
                      style={{ width: "100%", textAlign: "left", padding: "7px 10px", borderRadius: 8, background: p === selectedPair ? "rgba(245,185,66,0.2)" : "none", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600, color: p === selectedPair ? "#FFD86B" : "#E5E7EB" }}>
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
        <div className="user-trade-chart" style={{ padding: "8px 0 0", height: 160, position: "relative" }}>
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

        {/* ── Divider ── */}
        <div style={{ height: 1, background: "rgba(255,255,255,0.06)", margin: "0 16px" }} />

        {/* ── Trade Panel ── */}
        <div className="user-trade-panel" style={{ flex: 1, overflowY: "auto", padding: "12px 16px", paddingBottom: 88 }}>

          {/* ── CONFIGURE ── */}
          {step === "configure" && (
            <div className="space-y-5">
              {/* VIP access summary */}
              {vipAccess && (
                <div style={{ borderRadius: 16, padding: 14, border: "1px solid rgba(245,185,66,0.3)", background: "linear-gradient(135deg, rgba(245,185,66,0.12), rgba(37,99,235,0.08))" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 9, color: "#F5B942", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 800 }}>VIP Signal Access</p>
                      <p style={{ fontSize: 18, color: "#fff", fontWeight: 900, marginTop: 3 }}>
                        {vipAccess.vipLevel > 0 ? `VIP ${vipAccess.vipLevel}` : "VIP access locked"}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 12, color: "#fff", fontWeight: 800 }}>
                        {vipAccess.remainingToday} of {vipAccess.dailyLimit} left
                      </p>
                      <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>
                         {vipAccess.hasPackage
                           ? vipAccess.vipLevel === 1
                             ? "$350 VIP 1 activation completed"
                             : "Referral upgrade active"
                           : "Activate VIP 1 to unlock signals"}
                      </p>
                    </div>
                  </div>
                   {vipAccess.withdrawalGateActive ? (
                     <div style={{
                       marginTop: 12,
                       padding: 12,
                       borderRadius: 12,
                       border: "1px solid rgba(251,191,36,0.42)",
                       background: "rgba(251,191,36,0.08)",
                     }}>
                       <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                         <LockKeyhole style={{ width: 17, height: 17, color: "#FCD34D", flexShrink: 0, marginTop: 1 }} />
                         <div style={{ flex: 1 }}>
                           <p style={{ fontSize: 12, fontWeight: 900, color: "#FDE68A" }}>Signal execution paused</p>
                           <p style={{ fontSize: 10, color: "#FDE68A", lineHeight: 1.5, marginTop: 4 }}>
                             Completed withdrawals: ${vipAccess.totalWithdrawn.toFixed(2)} of ${vipAccess.withdrawalSignalThreshold.toFixed(2)} threshold.
                             Refer {vipAccess.withdrawalReferralRequirement} active users or upgrade to VIP 2 to continue receiving and executing signals.
                           </p>
                         </div>
                       </div>
                       <button onClick={() => setLocation("/vip-packages")} style={{ width: "100%", marginTop: 10, border: "1px solid rgba(252,211,77,0.36)", borderRadius: 9, padding: "8px 10px", background: "rgba(252,211,77,0.12)", color: "#FDE68A", fontSize: 10, fontWeight: 900, cursor: "pointer" }}>
                         View VIP 2 upgrade
                       </button>
                     </div>
                   ) : vipAccess.vipLevel === 0 ? (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, marginTop: 10 }}>
                      <p style={{ fontSize: 11, color: "#FCD34D", lineHeight: 1.5 }}>
                         Activate VIP 1 to unlock AI Signals.
                      </p>
                      <button onClick={() => setLocation("/vip-packages")} style={{ flexShrink: 0, border: "none", borderRadius: 9, padding: "8px 10px", background: "linear-gradient(135deg, #F5B942, #2563EB)", color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                        Buy VIP Package
                      </button>
                    </div>
                  ) : vipAccess.nextLevel ? (
                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
                      <button onClick={() => setLocation("/vip-packages")} style={{ flexShrink: 0, border: "1px solid rgba(245,185,66,0.35)", borderRadius: 9, padding: "8px 10px", background: "rgba(245,185,66,0.08)", color: "#FFD86B", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                        Upgrade VIP
                      </button>
                    </div>
                  ) : null}
                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
                      <p style={{ fontSize: 9, color: "#FFD86B", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
                        VIP Levels
                      </p>
                      <button
                        onClick={() => setLocation("/vip-packages")}
                        style={{ border: "none", background: "transparent", color: "#93C5FD", fontSize: 10, fontWeight: 800, cursor: "pointer", padding: 0 }}
                      >
                        View details
                      </button>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                      {VIP_LEVELS.map((tier) => (
                        <button
                          key={tier.level}
                          onClick={() => setLocation("/vip-packages")}
                          style={{
                            flex: "1 0 54px", borderRadius: 8, padding: "6px 4px",
                            border: `1px solid ${vipAccess.vipLevel === tier.level ? "rgba(245,185,66,0.65)" : "rgba(255,255,255,0.1)"}`,
                            background: vipAccess.vipLevel === tier.level ? "rgba(245,185,66,0.14)" : "rgba(255,255,255,0.035)",
                            color: vipAccess.vipLevel === tier.level ? "#FFD86B" : "#CBD5E1",
                            cursor: "pointer", textAlign: "center",
                          }}
                        >
                          <span style={{ display: "block", fontSize: 10, fontWeight: 900 }}>VIP {tier.level}</span>
                          <span style={{ display: "block", fontSize: 8, marginTop: 2, color: "#94A3B8" }}>{tier.dailySignals}/day</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Execution mode */}
              {vipAccess?.vipLevel !== 0 && !withdrawalGateActive && (
                <div style={{
                  borderRadius: 16,
                  padding: 14,
                  border: "1px solid rgba(147,197,253,0.2)",
                  background: "rgba(37,99,235,0.06)",
                }}>
                  <p style={{ fontSize: 9, color: "#93C5FD", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 800 }}>
                    Execution mode
                  </p>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 9 }}>
                    {([
                      ["single", "One by one", "Choose a pair"],
                      ["all", "Execute all", "AI selects pairs"],
                    ] as const).map(([mode, label, description]) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => {
                          setExecutionMode(mode);
                          setConsent(false);
                          setConsentPrompt(false);
                        }}
                        style={{
                          borderRadius: 11,
                          padding: "9px 8px",
                          textAlign: "left",
                          border: `1px solid ${executionMode === mode ? "rgba(245,185,66,0.65)" : "rgba(255,255,255,0.1)"}`,
                          background: executionMode === mode ? "rgba(245,185,66,0.14)" : "rgba(255,255,255,0.035)",
                          color: executionMode === mode ? "#FFD86B" : "#CBD5E1",
                          cursor: "pointer",
                        }}
                      >
                        <span style={{ display: "block", fontSize: 11, fontWeight: 900 }}>{label}</span>
                        <span style={{ display: "block", fontSize: 9, color: executionMode === mode ? "#FDE68A" : "#94A3B8", marginTop: 3 }}>{description}</span>
                      </button>
                    ))}
                  </div>
                  <p style={{ fontSize: 10, color: "#94A3B8", lineHeight: 1.45, marginTop: 9 }}>
                    {executionMode === "all"
                      ? `AI will choose up to ${bulkSignalCount} highest-confidence available pairs from your VIP allowance.`
                      : "Review the selected pair and execute one signal at a time."}
                  </p>
                </div>
              )}

              {cooldownActive && vipAccess?.cooldownUntil && (
                <div style={{
                  borderRadius: 16,
                  padding: 16,
                  border: "1px solid rgba(245,185,66,0.35)",
                  background: "linear-gradient(135deg, rgba(245,185,66,0.12), rgba(37,99,235,0.1))",
                  boxShadow: "0 10px 28px rgba(0,0,0,0.16)",
                }}>
                  <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 12, flexShrink: 0,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      background: "rgba(245,185,66,0.16)", color: "#FFD86B",
                    }}>
                      <Activity style={{ width: 19, height: 19 }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 850, color: "#fff" }}>
                        VIP {vipAccess.vipLevel} daily allowance complete
                      </p>
                      <p style={{ fontSize: 11, color: "#CBD5E1", lineHeight: 1.5, marginTop: 4 }}>
                        Your next signal window opens after the server-controlled 24-hour cooldown.
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontSize: 9, color: "#FFD86B", textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>Available in</p>
                      <p style={{ fontSize: 18, color: "#fff", fontWeight: 900, fontFamily: "monospace", marginTop: 3 }}>
                        {formatCooldown(cooldownSeconds)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Best signal */}
              {executionMode === "single" && bestSignal && (() => {
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
              {executionMode === "all" && bulkSignalCount > 0 && (
                <div style={{
                  borderRadius: 16,
                  padding: 14,
                  border: "1px solid rgba(34,197,94,0.24)",
                  background: "linear-gradient(135deg, rgba(34,197,94,0.08), rgba(37,99,235,0.06))",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <p style={{ fontSize: 9, color: "#86EFAC", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em", fontWeight: 800 }}>
                        AI batch execution
                      </p>
                      <p style={{ fontSize: 19, fontWeight: 900, color: "#fff" }}>{bulkSignalCount} pairs selected automatically</p>
                      <p style={{ fontSize: 10, color: "#9CA3AF", lineHeight: 1.45, marginTop: 5 }}>
                        The server selects the highest-confidence unclaimed signals and executes them simultaneously.
                      </p>
                    </div>
                    <Sparkles style={{ width: 25, height: 25, color: "#86EFAC", flexShrink: 0 }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                    <span style={{ fontSize: 10, color: "#A7F3D0" }}>Total signal stake</span>
                    <span style={{ fontSize: 11, fontWeight: 800, color: "#fff" }}>${(bulkSignalCount * signalAmount).toFixed(2)}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 5 }}>
                    <span style={{ fontSize: 10, color: "#A7F3D0" }}>Expected profit</span>
                    <span style={{ fontSize: 11, fontWeight: 900, color: "#86EFAC" }}>+${(bulkSignalCount * signalAmount).toFixed(2)}</span>
                  </div>
                </div>
              )}
              {!bestSignal && vipAccess?.vipLevel === 0 && (
                <div style={{ borderRadius: 16, padding: 16, border: "1px solid rgba(245,185,66,0.25)", background: "rgba(245,185,66,0.06)" }}>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>VIP 1 access required</p>
                  <p style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.5, marginTop: 6 }}>
                    AI Signals unlock after you purchase a VIP package from your available wallet balance.
                  </p>
                </div>
              )}
              {/* Fixed signal execution */}
              <div style={{
                borderRadius: 20,
                padding: 16,
                border: "1px solid rgba(245,185,66,0.28)",
                background: "linear-gradient(145deg, rgba(32,29,48,0.98), rgba(15,19,38,0.98))",
                boxShadow: "0 12px 32px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.04)",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{
                      width: 38, height: 38, borderRadius: 12,
                      background: "linear-gradient(135deg, rgba(245,185,66,0.24), rgba(37,99,235,0.25))",
                      border: "1px solid rgba(255,216,107,0.18)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <ShieldCheck style={{ width: 20, height: 20, color: "#FFD86B" }} />
                    </div>
                    <div>
                       <p style={{ fontSize: 14, fontWeight: 850, color: "#fff" }}>{withdrawalGateActive ? "Execution locked" : "Ready to execute"}</p>
                       <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>{withdrawalGateActive ? "Complete the referral requirement or upgrade to VIP 2" : "Simple, server-controlled signal entry"}</p>
                    </div>
                  </div>
                  <div style={{
                    display: "flex", alignItems: "center", gap: 5,
                    borderRadius: 999, padding: "5px 8px",
                     background: withdrawalGateActive ? "rgba(251,191,36,0.1)" : bestSignal ? "rgba(34,197,94,0.1)" : cooldownActive || vipAccess?.remainingToday === 0 ? "rgba(255,255,255,0.06)" : "rgba(245,185,66,0.1)",
                     border: `1px solid ${withdrawalGateActive ? "rgba(251,191,36,0.32)" : bestSignal ? "rgba(34,197,94,0.24)" : cooldownActive || vipAccess?.remainingToday === 0 ? "rgba(255,255,255,0.1)" : "rgba(245,185,66,0.24)"}`,
                  }}>
                    <span style={{
                      width: 5, height: 5, borderRadius: "50%",
                       background: withdrawalGateActive ? "#FCD34D" : bestSignal ? "#4ade80" : cooldownActive || vipAccess?.remainingToday === 0 ? "#9CA3AF" : "#F5B942",
                      boxShadow: bestSignal ? "0 0 8px #4ade80" : "none",
                    }} />
                     <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: "0.08em", color: withdrawalGateActive ? "#FDE68A" : bestSignal ? "#86EFAC" : "#9CA3AF" }}>
                       {withdrawalGateActive ? "LOCKED" : bestSignal ? "READY" : cooldownActive ? "COOLDOWN" : vipAccess?.remainingToday === 0 ? "ALLOWANCE COMPLETE" : "AVAILABLE"}
                    </span>
                  </div>
                </div>

                <div style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  gap: 12, marginTop: 16, padding: "13px 12px",
                  borderRadius: 14, background: "rgba(255,255,255,0.045)",
                  border: "1px solid rgba(255,255,255,0.06)",
                }}>
                  <div>
                    <p style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.08em", color: "#7C849D", fontWeight: 800 }}>Vault Capital available</p>
                    <p style={{ fontSize: 23, color: "#fff", fontWeight: 900, marginTop: 3 }}>${vaultCapital.toFixed(2)}</p>
                  </div>
                  <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "right", display: "flex", alignItems: "center", gap: 5 }}>
                      <WalletCards style={{ width: 14, height: 14, color: "#9CA3AF" }} />
                      Trading capital available
                  </p>
                </div>

                   <p style={{ fontSize: 10, color: "#8D94A8", lineHeight: 1.5, marginTop: 11 }}>
                   {executionMode === "all"
                     ? "Confirm once to let AI select and execute the highest-confidence pairs simultaneously."
                     : "Review the live signal, then confirm below to continue."}
                </p>
                <label style={{
                  display: "flex", gap: 10, alignItems: "flex-start", marginTop: 12,
                  padding: "11px 12px", borderRadius: 13,
                  color: "#E5E7EB", fontSize: 11, lineHeight: 1.45, cursor: "pointer",
                  border: `1px solid ${consentPrompt ? "rgba(245,185,66,0.7)" : consent ? "rgba(34,197,94,0.36)" : "rgba(255,255,255,0.1)"}`,
                  background: consentPrompt ? "rgba(245,185,66,0.09)" : consent ? "rgba(34,197,94,0.08)" : "rgba(255,255,255,0.035)",
                  transition: "all 160ms ease",
                }}>
                  <input
                    ref={consentRef}
                    type="checkbox"
                    checked={consent}
                    onChange={e => { setConsent(e.target.checked); setConsentPrompt(false); }}
                    style={{ marginTop: 2, accentColor: "#F5B942", width: 16, height: 16, flexShrink: 0 }}
                  />
                  <span>
                    <strong style={{ display: "block", color: consent ? "#86EFAC" : "#fff", fontSize: 11 }}>
                      {consent
                        ? "Confirmed — ready to execute"
                        : executionMode === "all"
                          ? "Confirm all signal executions"
                          : "Confirm signal execution"}
                    </strong>
                    <span style={{ display: "block", color: "#9CA3AF", marginTop: 3 }}>
                       {executionMode === "all"
                         ? "I consent to AI selecting and executing the best available pairs up to my VIP allowance."
                         : "I have reviewed this live signal and consent to execute it."}
                    </span>
                  </span>
                </label>
              </div>

              {/* Execute button */}
              <button
                 onClick={refreshAction ? handleRefreshSignals : executionMode === "all" ? handleExecuteAll : handleExecute}
                 type="button"
                 disabled={executePending || refreshingSignals || withdrawalGateActive || cooldownActive || vipAccess?.remainingToday === 0}
                style={{
                  width: "100%", height: 56, borderRadius: 16, border: "none", cursor: "pointer",
                   background: executePending || refreshingSignals || withdrawalGateActive || cooldownActive || vipAccess?.remainingToday === 0 ? "rgba(245,185,66,0.3)" : "linear-gradient(135deg, #F5B942 0%, #2563EB 100%)",
                  fontSize: 15, fontWeight: 800, color: "#fff",
                   boxShadow: executePending || refreshingSignals || withdrawalGateActive || cooldownActive || vipAccess?.remainingToday === 0 ? "none" : "0 7px 24px rgba(124,58,237,0.38)",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                   opacity: executePending || refreshingSignals || withdrawalGateActive || cooldownActive || vipAccess?.remainingToday === 0 ? 0.72 : 1,
                  transition: "transform 160ms ease, box-shadow 160ms ease, opacity 160ms ease",
                }}
              >
                {refreshingSignals
                  ? <Loader2 className="animate-spin" style={{ width: 18, height: 18 }} />
                  : <Zap style={{ width: 18, height: 18, fill: "#fff", color: "#fff" }} />}
                {executeButtonLabel}
              </button>

              {/* Trade Journal */}
              {history.length > 0 && (
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>Trade Journal</p>
                    <span style={{ fontSize: 10, color: "#6B7280" }}>Permanent history</span>
                  </div>
                  {JournalRows}
                </div>
              )}
            </div>
          )}

          {/* ── RUNNING ── */}
          {step === "running" && bulkPositionIds.length > 0 && (() => {
            const totalSteps = bulkSignals.length * 3;
            const completedSteps = Math.min(bulkActivityStep, totalSteps);
            const progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 100;
            const currentIndex = totalSteps > 0 ? Math.min(Math.floor(completedSteps / 3), bulkSignals.length - 1) : 0;
            const currentSignal = bulkSignals[currentIndex];
            const currentPhase = currentSignal ? getBulkSignalPhase(completedSteps, currentIndex) : "active";
            const feedTitle = completedSteps >= totalSteps
              ? "All signals are live"
              : currentPhase === "scanning"
                ? "AI is scanning candidates"
                : currentPhase === "selected"
                  ? "AI confidence check complete"
                  : "AI is opening the next position";
            const feedSubtitle = completedSteps >= totalSteps
              ? "Every selected pair is now being monitored by the server."
              : currentSignal
                ? `${currentSignal.pair} · ${currentSignal.direction} · ${currentSignal.confidence}% confidence`
                : "Comparing available market opportunities";
            return (
              <div className="flex flex-col gap-4 pt-2">
                <div style={{
                  width: "100%", borderRadius: 20, padding: "17px 16px",
                  background: "linear-gradient(135deg, rgba(245,185,66,0.15), rgba(37,99,235,0.13) 58%, rgba(124,58,237,0.12))",
                  border: "1px solid rgba(245,185,66,0.3)",
                  boxShadow: "0 16px 42px rgba(37,99,235,0.12)",
                }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 11 }}>
                      <div style={{ position: "relative", width: 43, height: 43, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(145deg, rgba(245,185,66,0.28), rgba(124,58,237,0.22))" }}>
                        <Sparkles style={{ width: 21, height: 21, color: "#FFE08A" }} />
                        {completedSteps < totalSteps && <span style={{ position: "absolute", right: -2, top: -2, width: 10, height: 10, borderRadius: "50%", background: "#4ade80", border: "2px solid #121327", boxShadow: "0 0 0 4px rgba(74,222,128,0.16)" }} />}
                      </div>
                      <div>
                        <p style={{ fontSize: 9, color: "#FDE68A", textTransform: "uppercase", letterSpacing: "0.1em", fontWeight: 900 }}>AI execution feed</p>
                        <p style={{ fontSize: 15, fontWeight: 900, color: "#fff", marginTop: 4 }}>{feedTitle}</p>
                      </div>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 900, color: "#FFE08A", fontFamily: "monospace" }}>{progress}%</span>
                  </div>
                  <p style={{ fontSize: 11, color: "#CBD5E1", marginTop: 11, paddingLeft: 54 }}>{feedSubtitle}</p>
                  <div style={{ height: 5, marginTop: 15, background: "rgba(255,255,255,0.1)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.max(progress, 3)}%`, borderRadius: 99, background: "linear-gradient(90deg, #F5B942, #4ade80)", boxShadow: "0 0 16px rgba(74,222,128,0.45)", transition: "width 500ms ease" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                    <span style={{ fontSize: 9, color: "#94A3B8" }}>{completedSteps >= totalSteps ? "Batch opened successfully" : "Reviewing available pairs"}</span>
                    <span style={{ fontSize: 9, color: "#94A3B8" }}>{bulkSignals.length} signal{bulkSignals.length === 1 ? "" : "s"} · server secured</span>
                  </div>
                </div>

                <div style={{ width: "100%", borderRadius: 20, padding: "15px 14px 13px", background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                    <div>
                      <p style={{ fontSize: 12, color: "#fff", fontWeight: 850 }}>Pair-by-pair activity</p>
                      <p style={{ fontSize: 9, color: "#7C8498", marginTop: 3 }}>A clear replay of every AI selection and execution step</p>
                    </div>
                    <span style={{ fontSize: 10, color: "#86EFAC", fontWeight: 800 }}>{bulkSignals.filter((signal, index) => getBulkSignalPhase(completedSteps, index) === "active").length}/{bulkSignals.length} live</span>
                  </div>
                  <div>
                    {bulkSignals.map((signal, index) => {
                      const phase = getBulkSignalPhase(completedSteps, index);
                      const isCurrent = index === currentIndex && phase !== "active" && phase !== "queued";
                      const phaseLabel = {
                        queued: "Queued",
                        scanning: "Scanning",
                        selected: "Selected",
                        executing: "Executing",
                        active: "Position live",
                      }[phase];
                      const phaseColor = phase === "active" ? "#4ade80" : phase === "selected" ? "#60A5FA" : phase === "executing" ? "#FCD34D" : phase === "scanning" ? "#C4B5FD" : "#64748B";
                      const PhaseIcon = phase === "active" ? CheckCircle2 : phase === "selected" ? Check : phase === "executing" ? ArrowUpRight : phase === "scanning" ? Loader2 : Activity;
                      return (
                        <div key={`${signal.opportunityId}-${signal.id}`} style={{ display: "flex", gap: 11, minHeight: index === bulkSignals.length - 1 ? 45 : 57 }}>
                          <div style={{ width: 24, display: "flex", flexDirection: "column", alignItems: "center" }}>
                            <div style={{ width: 24, height: 24, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", background: `${phaseColor}1f`, border: `1px solid ${phaseColor}66`, transition: "all 300ms ease" }}>
                              <PhaseIcon className={phase === "scanning" ? "animate-spin" : ""} style={{ width: 12, height: 12, color: phaseColor }} />
                            </div>
                            {index < bulkSignals.length - 1 && <div style={{ width: 1, flex: 1, minHeight: 19, background: phase === "active" ? "rgba(74,222,128,0.45)" : "rgba(255,255,255,0.1)", transition: "background 300ms ease" }} />}
                          </div>
                          <div style={{ flex: 1, paddingBottom: 12, opacity: phase === "queued" ? 0.56 : 1, transition: "opacity 300ms ease" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{ fontSize: 12, fontWeight: 850, color: "#fff" }}>{signal.pair}</span>
                                <span style={{ fontSize: 8, fontWeight: 900, color: isBuy(signal.direction ?? "") ? "#4ade80" : "#f87171", background: isBuy(signal.direction ?? "") ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", borderRadius: 5, padding: "3px 5px" }}>{signal.direction}</span>
                              </div>
                              <span style={{ fontSize: 9, color: phaseColor, fontWeight: 850 }}>{phaseLabel}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4 }}>
                              <span style={{ fontSize: 9, color: isCurrent ? "#C4B5FD" : "#7C8498" }}>
                                {phase === "queued" ? "Waiting for AI review" : phase === "scanning" ? "Comparing momentum and liquidity" : phase === "selected" ? "Best available opportunity selected" : phase === "executing" ? "Opening securely with Vault Capital" : "Monitoring position performance"}
                              </span>
                              <span style={{ fontSize: 9, color: "#FDE68A", fontFamily: "monospace" }}>{signal.confidence}%</span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "3px 8px 0" }}>
                  <Activity style={{ width: 14, height: 14, color: "#60A5FA" }} />
                  <p style={{ fontSize: 10, color: "#8D94A8", textAlign: "center", lineHeight: 1.5 }}>
                    All {bulkPositionIds.length} positions opened together. Rewards are credited to Main Wallet as each signal settles.
                  </p>
                </div>
                <div style={{ width: "100%", textAlign: "center", paddingTop: 2 }}>
                  <p style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Expected profit</p>
                  <p style={{ fontSize: 32, fontWeight: 900, color: "#22c55e", fontFamily: "monospace", marginTop: 3 }}>
                    +${(bulkSignals.length * signalAmount).toFixed(2)}
                  </p>
                  <p style={{ fontSize: 10, color: "#9CA3AF", marginTop: 3 }}>${signalAmount.toFixed(2)} × {bulkSignals.length} signal{bulkSignals.length === 1 ? "" : "s"}</p>
                </div>
              </div>
            );
          })()}
          {step === "running" && bulkPositionIds.length === 0 && pos && (
            <div className="flex flex-col items-center gap-5 pt-2">
              {/* Position status — settlement remains server-controlled without exposing a client countdown. */}
              <div style={{
                width: "100%", borderRadius: 18, padding: "15px 16px",
                display: "flex", alignItems: "center", gap: 12,
                background: "linear-gradient(135deg, rgba(245,185,66,0.12), rgba(37,99,235,0.1))",
                border: "1px solid rgba(245,185,66,0.28)",
              }}>
                <div style={{ width: 42, height: 42, borderRadius: 14, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245,185,66,0.16)" }}>
                  <Activity style={{ width: 21, height: 21, color: "#FFD86B" }} />
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 850, color: "#fff" }}>Signal is active</p>
                  <p style={{ fontSize: 11, color: "#CBD5E1", marginTop: 3 }}>The server is monitoring and settling this position securely.</p>
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
                 <p style={{ fontSize: 9, color: "#6B7280", marginTop: 6 }}>Signal execution is managed securely by the server</p>
              </div>

               {/* Signal info */}
              <div style={{ width: "100%", display: "flex", gap: 8 }}>
                <div style={{ flex: 1, background: "rgba(255,255,255,0.04)", borderRadius: 14, padding: "10px 12px", border: "1px solid rgba(255,255,255,0.07)", textAlign: "center" }}>
                  <p style={{ fontSize: 9, color: "#6B7280", marginBottom: 3 }}>AI CONF.</p>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#FFD86B" }}>{executedSignal?.confidence ?? "—"}%</p>
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
          {step === "result" && bulkResultPositions.length > 0 && (() => {
            const totalReward = bulkResultPositions.length * signalAmount;
            return (
              <div className="flex flex-col items-center gap-5 pt-2">
                <div style={{ width: 88, height: 88, borderRadius: "50%", background: "rgba(34,197,94,0.12)", border: "2px solid rgba(34,197,94,0.3)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckCircle2 style={{ width: 40, height: 40, color: "#22c55e" }} />
                </div>
                <div style={{ textAlign: "center" }}>
                  <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 4 }}>All AI Signals Settled</p>
                  <p style={{ fontSize: 44, fontWeight: 900, color: "#22c55e", fontFamily: "monospace", lineHeight: 1 }}>
                    +${totalReward.toFixed(2)}
                  </p>
                  <p style={{ fontSize: 13, color: "#6B7280", marginTop: 6 }}>
                     ${signalAmount.toFixed(2)} × {bulkResultPositions.length} signal{bulkResultPositions.length === 1 ? "" : "s"} added to Main Wallet
                  </p>
                </div>
                <div style={{
                  width: "100%", borderRadius: 16, padding: "13px 14px",
                  background: "rgba(34,197,94,0.1)", border: "1px solid rgba(34,197,94,0.24)",
                }}>
                  <p style={{ fontSize: 13, fontWeight: 850, color: "#fff" }}>AI-selected pairs completed successfully</p>
                  <p style={{ fontSize: 11, lineHeight: 1.5, color: "#CBD5E1", marginTop: 4 }}>
                     The fixed ${signalAmount.toFixed(2)} reward for each settled signal has been recorded in your Main Wallet and is reflected in your Portfolio Wallet.
                  </p>
                </div>
                <div style={{ width: "100%", background: "rgba(255,255,255,0.04)", borderRadius: 18, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {bulkResultPositions.map((position) => (
                    <div key={position.id} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{position.pair} · {position.direction}</span>
                       <span style={{ fontSize: 12, fontWeight: 800, color: "#4ade80" }}>+${signalAmount.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
                <button onClick={handleReset}
                  style={{ width: "100%", height: 52, borderRadius: 16, background: "linear-gradient(135deg, #F5B942, #2563EB)", border: "none", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer", boxShadow: "0 4px 16px rgba(245,185,66,0.25)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
          {step === "result" && bulkResultPositions.length === 0 && result && (() => {
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
                  <p style={{ fontSize: 13, color: "#6B7280", marginTop: 4 }}>{roi > 0 ? "+" : ""}{roi.toFixed(1)}% outcome on ${result.stake.toFixed(2)} signal</p>
                    <p style={{ fontSize: 11, color: "#FFD86B", marginTop: 8 }}>Disclosed signal outcome: +${signalAmount.toFixed(2)} to Main Wallet · reflected in Portfolio Wallet</p>
                </div>

                 <div style={{
                   width: "100%", display: "flex", alignItems: "flex-start", gap: 10,
                   borderRadius: 16, padding: "13px 14px",
                   background: win ? "rgba(34,197,94,0.1)" : "rgba(245,185,66,0.08)",
                   border: `1px solid ${win ? "rgba(34,197,94,0.24)" : "rgba(245,185,66,0.24)"}`,
                 }}>
                   <Sparkles style={{ width: 18, height: 18, color: win ? "#4ade80" : "#FFD86B", flexShrink: 0, marginTop: 1 }} />
                   <div>
                     <p style={{ fontSize: 13, fontWeight: 850, color: "#fff" }}>
                       {win ? "Congratulations — signal complete!" : "Signal complete — outcome recorded"}
                     </p>
                     <p style={{ fontSize: 11, lineHeight: 1.5, color: "#CBD5E1", marginTop: 4 }}>
                         `Your position settled successfully at the disclosed +$${signalAmount.toFixed(2)} signal outcome. The amount was added to Main Wallet.`
                     </p>
                   </div>
                 </div>

                {/* Stats */}
                <div style={{ width: "100%", background: "rgba(255,255,255,0.04)", borderRadius: 18, padding: "14px 16px", border: "1px solid rgba(255,255,255,0.07)" }}>
                  {[
                    ["Pair", result.pair],
                    ["Direction", result.direction],
                    ["Duration", result.elapsedMs > 0 ? fmtDuration(result.elapsedMs) : "—"],
                    ["Status", result.status === "closed_manual" ? "Closed early" : result.pnl >= 0 ? "Profit outcome" : "Loss outcome"],
                  ].map(([label, val]) => (
                    <div key={label} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                      <span style={{ fontSize: 12, color: "#6B7280" }}>{label}</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{val}</span>
                    </div>
                  ))}
                </div>

                <button onClick={handleReset}
                  style={{ width: "100%", height: 52, borderRadius: 16, background: "linear-gradient(135deg, #F5B942, #2563EB)", border: "none", fontSize: 14, fontWeight: 800, color: "#fff", cursor: "pointer", boxShadow: "0 4px 16px rgba(245,185,66,0.25)", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
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
