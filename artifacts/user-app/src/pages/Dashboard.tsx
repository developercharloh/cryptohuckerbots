import { useState, useRef, useEffect } from "react";
import { Layout } from "@/components/Layout";
import {
  useGetDashboardSummary,
  useGetEarningsChart,
  useGetRecentActivity,
  useGetProfitByBot,
  useListNotifications,
} from "@workspace/api-client-react";
import {
  Bell, Wallet, Activity, Zap, Menu, Eye, EyeOff, User, LifeBuoy, LogOut,
  ChevronDown, ArrowUpRight, TrendingUp, Info, ChevronRight, Bot,
} from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  CartesianGrid, LabelList, PieChart, Pie, Cell,
} from "recharts";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { Link, useLocation } from "wouter";
import { formatUSD } from "@/lib/format";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetClose,
} from "@/components/ui/sheet";
import { format } from "date-fns";

// ── Period options ────────────────────────────────────────────────────────────
type Period = { id: string; label: string };
const PERIODS: Period[] = [
  { id: "today",      label: "Today" },
  { id: "yesterday",  label: "Yesterday" },
  { id: "this_week",  label: "This Week" },
  { id: "last_week",  label: "Last Week" },
  { id: "this_month", label: "This Month" },
  { id: "last_month", label: "Last Month" },
  { id: "this_year",  label: "This Year" },
  { id: "last_year",  label: "Last Year" },
  { id: "all_time",   label: "All Time" },
];

// ── Custom X-axis tick (two-line: day + date) ─────────────────────────────────
function MultiLineTick({ x, y, payload }: any) {
  const lines = (payload.value as string).split("\n");
  return (
    <g transform={`translate(${x},${y})`}>
      {lines.map((line: string, i: number) => (
        <text key={i} x={0} y={0} dy={12 + i * 12} textAnchor="middle" fill="#64748b" fontSize={9}>
          {line}
        </text>
      ))}
    </g>
  );
}

// ── Custom bar label ──────────────────────────────────────────────────────────
function BarLabel({ x, y, width, value }: any) {
  if (!value) return null;
  return (
    <text x={x + width / 2} y={y - 4} textAnchor="middle" fill="#e2e8f0" fontSize={8} fontWeight={600}>
      ${value}
    </text>
  );
}

// ── Donut center label ────────────────────────────────────────────────────────
function DonutCenter({ cx, cy, total }: { cx: number; cy: number; total: number }) {
  return (
    <g>
      <text x={cx} y={cy - 6} textAnchor="middle" fill="#e2e8f0" fontSize={13} fontWeight={700}>
        {formatUSD(total)}
      </text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#64748b" fontSize={9}>
        Total
      </text>
    </g>
  );
}

// ── Period dropdown ───────────────────────────────────────────────────────────
function PeriodDropdown({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = PERIODS.find(p => p.id === value) ?? PERIODS[2];

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
        className="flex items-center gap-1.5 bg-[#1a2235] border border-white/10 text-xs font-medium px-3 py-1.5 rounded-lg text-white"
      >
        {selected.label}
        <ChevronDown className="w-3 h-3 text-white/60" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 z-50 w-36 bg-[#1a2235] border border-white/10 rounded-xl shadow-xl overflow-hidden">
          {PERIODS.map(p => (
            <button
              key={p.id}
              onClick={() => { onChange(p.id); setOpen(false); }}
              className={`w-full text-left px-4 py-2.5 text-xs transition-colors ${
                p.id === value
                  ? "bg-primary text-white font-semibold"
                  : "text-white/80 hover:bg-white/10"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mini stat card ────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, subColor }: { label: string; value: string; sub?: string; subColor?: string }) {
  return (
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-bold text-foreground leading-none mb-1">{value}</p>
      {/* Progress bar */}
      <div className="h-0.5 bg-muted/30 rounded-full mb-1">
        <div className="h-0.5 bg-primary rounded-full" style={{ width: "60%" }} />
      </div>
      {sub && <p className={`text-[9px] font-medium ${subColor ?? "text-green-400"}`}>{sub}</p>}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [period, setPeriod] = useState("this_week");
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [, setLocation] = useLocation();
  const { user, logout } = useAuth();

  const { data: notifications = [] } = useListNotifications();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: { refetchInterval: 30000 } as any,
  });
  const { data: chartData = [], isLoading: loadingChart } = useGetEarningsChart(
    { period },
    { query: { refetchInterval: 60000 } as any }
  );
  const { data: recentActivity = [], isLoading: loadingActivity } = useGetRecentActivity();
  const { data: botProfit = [], isLoading: loadingBotProfit } = useGetProfitByBot();

  const totalBotProfit = botProfit.reduce((s, b) => s + b.profit, 0);
  const periodLabel = PERIODS.find(p => p.id === period)?.label ?? "This Week";

  // Relative period label for change text
  const changeLabel =
    period.includes("today") || period.includes("yesterday") ? "vs yesterday" :
    period.includes("week") ? "vs last week" :
    period.includes("month") ? "vs last month" :
    period.includes("year") ? "vs last year" : "all time";

  return (
    <Layout showNav>
      <div className="pb-24">
        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="flex items-center justify-between px-4 pt-4 pb-3">
          <Sheet>
            <SheetTrigger asChild>
              <button className="w-10 h-10 flex items-center justify-center">
                <Menu className="w-5 h-5" />
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[280px] bg-background border-border p-0">
              <SheetHeader className="p-5 border-b border-border text-left">
                <SheetTitle className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center text-base font-bold text-white">
                    {user?.fullName?.charAt(0) || "U"}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{user?.fullName || "User"}</p>
                    <p className="text-xs text-muted-foreground font-normal truncate">{user?.email || ""}</p>
                  </div>
                </SheetTitle>
              </SheetHeader>
              <nav className="p-3 flex flex-col gap-1">
                <SheetClose asChild>
                  <Link href="/profile" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-card transition-colors">
                    <User className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Profile</span>
                  </Link>
                </SheetClose>
                <SheetClose asChild>
                  <Link href="/support" className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-card transition-colors">
                    <LifeBuoy className="w-5 h-5 text-muted-foreground" />
                    <span className="text-sm font-medium">Support</span>
                  </Link>
                </SheetClose>
                <button onClick={() => logout()} className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-card transition-colors text-left">
                  <LogOut className="w-5 h-5 text-red-500" />
                  <span className="text-sm font-medium text-red-500">Sign Out</span>
                </button>
              </nav>
            </SheetContent>
          </Sheet>

          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-primary rounded-lg flex items-center justify-center">
              <Zap className="w-4 h-4 text-white fill-white" />
            </div>
            <span className="font-bold tracking-tight text-sm">VIXUS AI</span>
          </div>

          <div className="flex items-center gap-2">
            <Link href="/profile/notifications">
              <button className="w-10 h-10 flex items-center justify-center relative">
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 bg-primary text-primary-foreground text-[9px] font-bold rounded-full flex items-center justify-center px-1">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>
            </Link>
            <Link href="/profile">
              <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center text-sm font-bold text-white">
                {user?.fullName?.charAt(0) || "U"}
              </div>
            </Link>
          </div>
        </div>

        {/* ── Welcome ────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-4 pb-4">
          <div className="w-12 h-12 rounded-full bg-gradient-to-tr from-primary to-purple-400 flex items-center justify-center text-base font-bold text-white shrink-0">
            {user?.fullName?.charAt(0) || "U"}
          </div>
          <div>
            <h1 className="text-lg font-bold leading-tight">Welcome back, {user?.fullName?.split(" ")[0] || "User"}</h1>
            <p className="text-xs text-muted-foreground">Here's your trading overview for today.</p>
          </div>
        </div>

        {/* ── Balance hero card ───────────────────────────────────── */}
        <div className="px-4 mb-4">
          <div
            style={{
              background: "linear-gradient(135deg, #4C1D95 0%, #3730A3 60%, #1E1B4B 100%)",
              borderRadius: 20, padding: "20px 20px 18px",
              position: "relative", overflow: "hidden",
              boxShadow: "0 8px 32px rgba(124,58,237,0.35)",
            }}
          >
            {/* Glow orbs */}
            <div style={{ position: "absolute", top: -40, right: -40, width: 140, height: 140, borderRadius: "50%", background: "radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: -20, left: "30%", width: 100, height: 100, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 70%)", pointerEvents: "none" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14, position: "relative" }}>
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 4, letterSpacing: "0.04em", textTransform: "uppercase" }}>Total Balance</p>
                {loadingSummary ? (
                  <Skeleton className="h-8 w-32 bg-white/10" />
                ) : balanceVisible ? (
                  <p style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", fontFamily: "monospace", lineHeight: 1 }}>
                    {formatUSD(summary?.availableBalance)}
                  </p>
                ) : (
                  <p style={{ fontSize: 30, fontWeight: 800, color: "#fff", letterSpacing: "0.15em", lineHeight: 1 }}>••••••</p>
                )}
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button
                  onClick={() => setBalanceVisible(v => !v)}
                  style={{ width: 34, height: 34, borderRadius: 10, background: "rgba(255,255,255,0.1)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                >
                  {balanceVisible ? <EyeOff className="w-4 h-4 text-white/60" /> : <Eye className="w-4 h-4 text-white/60" />}
                </button>
              </div>
            </div>

            {!loadingSummary && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.15)", borderRadius: 8, padding: "3px 8px" }}>
                  <ArrowUpRight style={{ width: 12, height: 12, color: "#4ade80" }} />
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#4ade80" }}>+{summary?.earningsChangePercent ?? 0}%</span>
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>Total Profit: {formatUSD(summary?.totalProfit)}</span>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display: "flex", gap: 8 }}>
              {[
                { label: "Deposit",  href: "/cashier/deposit",  icon: "↓" },
                { label: "Withdraw", href: "/cashier/withdraw", icon: "↑" },
                { label: "Transfer", href: "/cashier",          icon: "⇄" },
              ].map((a) => (
                <Link key={a.href} href={a.href} style={{ flex: 1, textDecoration: "none" }}>
                  <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 12, padding: "8px 6px", textAlign: "center", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(4px)" }}>
                    <div style={{ fontSize: 16, color: "#fff", marginBottom: 3 }}>{a.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.7)", letterSpacing: "0.02em" }}>{a.label}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Mini stat cards ─────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 px-4 mb-4">
          <div className="bg-card rounded-2xl p-4" style={{ border: "1px solid rgba(124,58,237,0.15)" }}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.15)" }}>
                <Activity className="w-4 h-4 text-primary" />
              </div>
              <p className="text-[10px] text-muted-foreground">Total Profit</p>
            </div>
            {loadingSummary ? <Skeleton className="h-5 w-20" /> : (
              <p className="text-base font-bold" style={{ color: "#A78BFA" }}>{formatUSD(summary?.totalProfit)}</p>
            )}
          </div>
          <Link href="/bots">
            <div className="bg-card rounded-2xl p-4 cursor-pointer" style={{ border: "1px solid rgba(124,58,237,0.15)" }}>
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "rgba(124,58,237,0.15)" }}>
                  <Bot className="w-4 h-4 text-primary" />
                </div>
                <p className="text-[10px] text-muted-foreground">Active Bots</p>
              </div>
              {loadingSummary ? <Skeleton className="h-5 w-12" /> : (
                <p className="text-base font-bold text-foreground">{summary?.activeBots ?? 0} running</p>
              )}
            </div>
          </Link>
        </div>

        {/* ── Market Overview ─────────────────────────────────────── */}
        <div className="mx-4 mb-4 bg-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold">Market Overview</span>
            <Link href="/trade">
              <span className="text-[10px] text-primary font-semibold">See All</span>
            </Link>
          </div>
          <div className="space-y-2.5">
            {[
              { pair: "EUR/USD", price: "1.08412", change: "+0.23%", positive: true },
              { pair: "GBP/USD", price: "1.27105", change: "+0.41%", positive: true },
              { pair: "USD/JPY", price: "153.420", change: "-0.18%", positive: false },
              { pair: "BTC/USD", price: "67,821.50", change: "+1.25%", positive: true },
              { pair: "XAU/USD", price: "2,342.80", change: "-0.09%", positive: false },
            ].map((m) => (
              <div key={m.pair} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <span className="text-[8px] font-bold text-primary">{m.pair.split("/")[0]}</span>
                  </div>
                  <div>
                    <p className="text-[11px] font-bold">{m.pair}</p>
                    <p className="text-[9px] text-muted-foreground">FX</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[11px] font-bold">{m.price}</p>
                  <p className={`text-[10px] font-semibold ${m.positive ? "text-green-400" : "text-red-400"}`}>{m.change}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Earnings Overview ───────────────────────────────────── */}
        <div className="mx-4 mb-4 bg-card rounded-2xl p-4">
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1.5">
              <span className="text-sm font-bold">Earnings Overview</span>
              <Info className="w-3.5 h-3.5 text-muted-foreground/60" />
            </div>
            <PeriodDropdown value={period} onChange={setPeriod} />
          </div>

          {/* Total + change */}
          <div className="flex items-end gap-3 mb-4">
            <div>
              {loadingSummary ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <p className="text-3xl font-bold tracking-tight">
                  +{formatUSD(summary?.totalEarnings)}
                </p>
              )}
              <p className="text-[11px] text-muted-foreground mt-0.5">Total Profit</p>
            </div>
            {!loadingSummary && (summary?.earningsChangePercent ?? 0) > 0 && (
              <div className="flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded-lg mb-4">
                <TrendingUp className="w-3 h-3 text-green-400" />
                <span className="text-[11px] font-semibold text-green-400">
                  {summary?.earningsChangePercent}%
                </span>
                <span className="text-[10px] text-muted-foreground">{changeLabel}</span>
              </div>
            )}
          </div>

          {/* Stats row */}
          <div className="flex gap-3 mb-5">
            <StatCard
              label="Win Rate"
              value={`${summary?.winRate ?? 0}%`}
              sub={`↑ ${((summary?.winRate ?? 0) * 0.07).toFixed(1)}%`}
            />
            <div className="w-px bg-border/40" />
            <StatCard
              label="ROI"
              value={`${summary?.roi ?? 0}%`}
              sub={`↑ ${((summary?.roi ?? 0) * 0.18).toFixed(1)}%`}
            />
            <div className="w-px bg-border/40" />
            <StatCard
              label="Total Trades"
              value={`${summary?.totalTrades ?? 0}`}
              sub={summary?.totalTrades ? `+${Math.round((summary.totalTrades) * 0.22)}` : undefined}
            />
            <div className="w-px bg-border/40" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground mb-1">Active Bots</p>
              <div className="flex items-center gap-1">
                <p className="text-sm font-bold text-foreground">{summary?.activeBots ?? 0}</p>
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            </div>
          </div>

          {/* Chart legend */}
          <div className="flex items-center gap-4 mb-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-primary" />
              <span className="text-[10px] text-muted-foreground">Profit (USD)</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-[2px] bg-green-400" style={{ borderTop: "2px dashed #4ade80" }} />
              <span className="text-[10px] text-muted-foreground">Cumulative Profit (USD)</span>
            </div>
          </div>

          {/* Chart */}
          <div className="h-[200px] -mx-2">
            {loadingChart ? (
              <Skeleton className="w-full h-full rounded-xl" />
            ) : chartData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-xs text-muted-foreground">
                No data yet
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 20, right: 4, left: -28, bottom: 28 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={<MultiLineTick />}
                    tickLine={false}
                    axisLine={false}
                    interval={0}
                    height={40}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "#64748b", fontSize: 9 }}
                    tickFormatter={(v) => `$${v}`}
                  />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f1729", borderColor: "#1e293b", borderRadius: "12px", fontSize: "11px" }}
                    labelStyle={{ color: "#94a3b8", marginBottom: "4px" }}
                    formatter={(value: number, name: string) => [
                      `$${value.toFixed(2)}`,
                      name === "profit" ? "Profit" : "Cumulative",
                    ]}
                  />
                  <Bar dataKey="profit" fill="#7C3AED" radius={[3, 3, 0, 0]} maxBarSize={28}>
                    <LabelList content={<BarLabel />} />
                  </Bar>
                  <Line
                    type="monotone"
                    dataKey="cumulative"
                    stroke="#4ade80"
                    strokeWidth={2}
                    dot={{ fill: "#4ade80", r: 3, strokeWidth: 0 }}
                    strokeDasharray="4 2"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Bottom row: Profit by Bot + Recent Profits ──────────── */}
        <div className="grid grid-cols-2 gap-3 px-4">
          {/* Profit by Bot */}
          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center gap-1 mb-3">
              <span className="text-xs font-bold">Profit by Bot</span>
              <Info className="w-3 h-3 text-muted-foreground/60" />
            </div>

            {loadingBotProfit ? (
              <Skeleton className="w-full h-32 rounded-xl" />
            ) : botProfit.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <Bot className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-[10px] text-muted-foreground">No bot profits yet</p>
              </div>
            ) : (
              <>
                {/* Donut */}
                <div className="flex justify-center mb-3">
                  <PieChart width={120} height={120}>
                    <Pie
                      data={botProfit}
                      cx={60}
                      cy={60}
                      innerRadius={38}
                      outerRadius={55}
                      dataKey="profit"
                      strokeWidth={0}
                    >
                      {botProfit.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <DonutCenter cx={60} cy={60} total={totalBotProfit} />
                  </PieChart>
                </div>

                {/* Legend */}
                <div className="space-y-1.5">
                  {botProfit.slice(0, 4).map((b) => (
                    <div key={b.botId} className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
                      <span className="text-[9px] text-muted-foreground truncate flex-1">{b.botName}</span>
                      <span className="text-[9px] font-semibold shrink-0">${b.profit.toFixed(2)}</span>
                      <span className="text-[9px] text-muted-foreground shrink-0">{b.percentage}%</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <Link href="/bots">
              <button className="mt-3 flex items-center gap-1 text-[10px] text-primary font-semibold">
                View All Bots <ChevronRight className="w-3 h-3" />
              </button>
            </Link>
          </div>

          {/* Recent Profits */}
          <div className="bg-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-bold">Recent Profits</span>
              <Link href="/cashier/transactions">
                <span className="text-[10px] text-primary font-semibold">View All</span>
              </Link>
            </div>

            {loadingActivity ? (
              <div className="space-y-2">
                {Array(4).fill(0).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
              </div>
            ) : recentActivity.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 text-center">
                <TrendingUp className="w-8 h-8 text-muted-foreground/30 mb-2" />
                <p className="text-[10px] text-muted-foreground">No profits yet</p>
              </div>
            ) : (
              <div className="space-y-2">
                {recentActivity.slice(0, 5).map((item) => {
                  const isProfit = item.type === "trade_profit" || item.type === "deposit";
                  const isLoss = item.type === "trade_loss" || item.type === "withdrawal";
                  return (
                    <div key={item.id} className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        isProfit ? "bg-green-500/10" : isLoss ? "bg-red-500/10" : "bg-primary/10"
                      }`}>
                        <ArrowUpRight className={`w-3.5 h-3.5 ${isProfit ? "text-green-400" : isLoss ? "text-red-400" : "text-primary"}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-semibold truncate">{item.description}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {format(new Date(item.createdAt), "MMM d, hh:mm aa")}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-[10px] font-bold ${isProfit ? "text-green-400" : isLoss ? "text-red-400" : "text-foreground"}`}>
                          {isProfit ? "+" : isLoss ? "-" : ""}{formatUSD(item.amount)}
                        </p>
                        <p className="text-[9px] text-muted-foreground">USDT</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
