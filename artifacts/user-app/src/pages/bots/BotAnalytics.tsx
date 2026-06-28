import { useState, useRef, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useGetBot, useGetBotAnalytics } from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ChevronLeft, ChevronDown, TrendingUp, TrendingDown,
  BarChart2, Trophy, Zap, Activity,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell, ReferenceLine,
} from "recharts";

const PERIODS = [
  { id: "daily",   label: "Daily",   sub: "Last 14 days" },
  { id: "weekly",  label: "Weekly",  sub: "Last 12 weeks" },
  { id: "monthly", label: "Monthly", sub: "Last 12 months" },
  { id: "yearly",  label: "Yearly",  sub: "Last 5 years" },
];

function PeriodDropdown({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = PERIODS.find(p => p.id === value) ?? PERIODS[0];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 bg-[#1a2235] border border-white/10 text-xs font-semibold px-3 py-1.5 rounded-lg text-white"
      >
        {selected.label}
        <ChevronDown className="w-3 h-3 text-white/60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-[#1a2235] border border-white/10 rounded-xl shadow-2xl overflow-hidden">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              className={`w-full text-left px-4 py-3 transition-colors ${
                p.id === value
                  ? "bg-primary text-white"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              <p className="text-xs font-semibold">{p.label}</p>
              <p className={`text-[10px] mt-0.5 ${p.id === value ? "text-white/70" : "text-white/40"}`}>{p.sub}</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MultiLineTick({ x, y, payload, index, visibleTicksCount }: any) {
  // Only render every other tick when there are many data points
  if (visibleTicksCount > 8 && index % 2 !== 0) return null;
  const lines = (payload.value as string).split("\n");
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line: string, i: number) => (
        <text key={i} x={0} y={0} dy={12 + i * 11} textAnchor="middle" fill="#475569" fontSize={9}>
          {line}
        </text>
      ))}
    </g>
  );
}

export default function BotAnalytics() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const [, setLocation] = useLocation();
  const [period, setPeriod] = useState("daily");

  const { data: bot, isLoading: loadingBot } = useGetBot(id, { query: { enabled: !!id } as any });
  const { data: chartData = [], isLoading: loadingChart } = useGetBotAnalytics(id, period, {
    query: { enabled: !!id, refetchInterval: 60000 } as any,
  });

  if (!id) { setLocation("/bots"); return null; }

  const totalProfit = chartData.reduce((s, p) => s + p.profit, 0);
  const positivePeriods = chartData.filter(p => p.profit > 0).length;
  const winRate = chartData.length > 0 ? Math.round((positivePeriods / chartData.length) * 100) : 0;
  const bestPeriod = Math.max(...chartData.map(p => p.profit), 0);
  const worstPeriod = Math.min(...chartData.map(p => p.profit), 0);
  const avgProfit = chartData.length > 0 ? totalProfit / chartData.length : 0;
  const isPositive = totalProfit >= 0;
  const lastCumulative = chartData[chartData.length - 1]?.cumulative ?? 0;

  return (
    <Layout>
      <div className="pb-10">
        {/* ── Hero header ───────────────────────────────────────────── */}
        <div className="relative bg-gradient-to-b from-primary/20 to-transparent px-5 pt-5 pb-8">
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={() => setLocation(`/bots/${id}`)}
              className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/10 backdrop-blur shrink-0"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              {loadingBot ? <Skeleton className="h-6 w-44" /> : (
                <h1 className="text-lg font-bold truncate">{bot?.name}</h1>
              )}
              <p className="text-xs text-muted-foreground mt-0.5">Analytics Overview</p>
            </div>
            {!loadingBot && (
              <div className={`text-[10px] px-2.5 py-1 rounded-full font-semibold flex items-center gap-1 ${
                bot?.status === "running"
                  ? "bg-green-500/20 text-green-400"
                  : "bg-muted/40 text-muted-foreground"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${bot?.status === "running" ? "bg-green-400 animate-pulse" : "bg-muted-foreground"}`} />
                {bot?.status === "running" ? "Live" : "Paused"}
              </div>
            )}
          </div>

          {/* Big total profit */}
          <div className="text-center">
            {loadingChart ? (
              <Skeleton className="h-12 w-40 mx-auto mb-2" />
            ) : (
              <>
                <p className={`text-4xl font-bold tracking-tight ${isPositive ? "text-green-400" : "text-red-400"}`}>
                  {isPositive ? "+" : ""}{totalProfit.toFixed(2)}
                </p>
                <p className="text-sm text-muted-foreground mt-1">USDT — Period Total</p>
                <div className={`inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full text-xs font-semibold ${
                  isPositive ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"
                }`}>
                  {isPositive ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                  {isPositive ? "Profitable period" : "Loss period"}
                </div>
              </>
            )}
          </div>
        </div>

        <div className="px-4 -mt-4 space-y-4">
          {/* ── 4 stat cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                <Trophy className="w-4.5 h-4.5 text-primary" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Win Rate</p>
                <p className="text-xl font-bold mt-0.5">{winRate}%</p>
                <p className="text-[10px] text-muted-foreground">{positivePeriods}/{chartData.length} periods</p>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/15 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4.5 h-4.5 text-green-400" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Cumulative</p>
                <p className={`text-xl font-bold mt-0.5 ${lastCumulative >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {lastCumulative >= 0 ? "+" : ""}{lastCumulative.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">USDT total</p>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-yellow-500/15 flex items-center justify-center shrink-0">
                <Zap className="w-4.5 h-4.5 text-yellow-400" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Best Period</p>
                <p className="text-xl font-bold mt-0.5 text-green-400">+{bestPeriod.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground">USDT</p>
              </div>
            </div>

            <div className="bg-card rounded-2xl p-4 flex items-start gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center shrink-0">
                <Activity className="w-4.5 h-4.5 text-blue-400" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground">Avg / Period</p>
                <p className={`text-xl font-bold mt-0.5 ${avgProfit >= 0 ? "text-foreground" : "text-red-400"}`}>
                  {avgProfit >= 0 ? "+" : ""}{avgProfit.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground">USDT</p>
              </div>
            </div>
          </div>

          {/* ── Chart card ────────────────────────────────────────────── */}
          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-primary" />
                <span className="text-sm font-bold">Performance Chart</span>
              </div>
              <PeriodDropdown value={period} onChange={setPeriod} />
            </div>
            <p className="text-[10px] text-muted-foreground mb-4 ml-6">
              {PERIODS.find(p => p.id === period)?.sub}
            </p>

            {/* Legend */}
            <div className="flex items-center gap-4 mb-3">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-primary" />
                <span className="text-[10px] text-muted-foreground">Profit</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-sm bg-red-500/70" />
                <span className="text-[10px] text-muted-foreground">Loss</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-px" style={{ borderTop: "2px dashed #4ade80" }} />
                <span className="text-[10px] text-muted-foreground">Cumulative</span>
              </div>
            </div>

            <div className="h-[220px] -mx-2">
              {loadingChart ? (
                <Skeleton className="w-full h-full rounded-xl" />
              ) : chartData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full gap-2">
                  <BarChart2 className="w-8 h-8 text-muted-foreground/30" />
                  <p className="text-xs text-muted-foreground">No data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={chartData} margin={{ top: 16, right: 4, left: -28, bottom: 28 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <ReferenceLine y={0} stroke="#334155" strokeWidth={1} />
                    <XAxis
                      dataKey="label"
                      tick={<MultiLineTick />}
                      tickLine={false}
                      axisLine={false}
                      interval="preserveStartEnd"
                      height={36}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tick={{ fill: "#475569", fontSize: 9 }}
                      tickFormatter={(v) => `$${v}`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0f1729",
                        borderColor: "#1e293b",
                        borderRadius: "14px",
                        fontSize: "11px",
                        padding: "10px 14px",
                      }}
                      labelStyle={{ color: "#94a3b8", marginBottom: "6px", fontWeight: 600 }}
                      formatter={(value: number, name: string) => [
                        `${value >= 0 ? "+" : ""}$${value.toFixed(2)}`,
                        name === "profit" ? "Period Profit" : "Cumulative",
                      ]}
                    />
                    <Bar dataKey="profit" radius={[4, 4, 0, 0]} maxBarSize={22}>
                      {chartData.map((entry, i) => (
                        <Cell key={i} fill={entry.profit >= 0 ? "#7C3AED" : "#ef4444"} fillOpacity={0.9} />
                      ))}
                    </Bar>
                    <Line
                      type="monotone"
                      dataKey="cumulative"
                      stroke="#4ade80"
                      strokeWidth={2.5}
                      dot={{ fill: "#4ade80", r: 2.5, strokeWidth: 0 }}
                      strokeDasharray="5 3"
                      activeDot={{ r: 5, fill: "#4ade80" }}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Period breakdown list ──────────────────────────────────── */}
          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold">Period Breakdown</span>
              <span className="ml-auto text-[10px] text-muted-foreground bg-muted/30 px-2 py-0.5 rounded-full">
                {chartData.length} periods
              </span>
            </div>

            {loadingChart ? (
              <div className="space-y-2">
                {Array(6).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
              </div>
            ) : (
              <div className="space-y-1">
                {[...chartData].reverse().map((p, i) => {
                  const isWin = p.profit >= 0;
                  return (
                    <div
                      key={i}
                      className="flex items-center gap-3 py-2.5 border-b border-border/20 last:border-0"
                    >
                      {/* Colour dot */}
                      <div className={`w-2 h-2 rounded-full shrink-0 ${isWin ? "bg-primary" : "bg-red-500"}`} />

                      {/* Label */}
                      <span className="text-xs text-muted-foreground flex-1">
                        {p.label.replace("\n", " ")}
                      </span>

                      {/* Period profit */}
                      <span className={`text-xs font-bold w-20 text-right ${isWin ? "text-green-400" : "text-red-400"}`}>
                        {isWin ? "+" : ""}{p.profit.toFixed(2)}
                      </span>

                      {/* Cumulative */}
                      <span className={`text-[10px] w-20 text-right ${p.cumulative >= 0 ? "text-muted-foreground" : "text-red-400/70"}`}>
                        Σ {p.cumulative >= 0 ? "+" : ""}{p.cumulative.toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Summary footer */}
            {chartData.length > 0 && !loadingChart && (
              <div className="mt-3 pt-3 border-t border-border/30 flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">Total</span>
                <span className={`text-sm font-bold ${isPositive ? "text-green-400" : "text-red-400"}`}>
                  {isPositive ? "+" : ""}{totalProfit.toFixed(2)} USDT
                </span>
              </div>
            )}
          </div>

          {/* ── Bot info strip ─────────────────────────────────────────── */}
          {!loadingBot && bot && (
            <div className="bg-card rounded-2xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">{bot.name}</p>
                <p className="text-[10px] text-muted-foreground">{bot.category} · {bot.winRate}% win rate</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-green-400">+${bot.profitTotal}</p>
                <p className="text-[10px] text-muted-foreground">All-time</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
