import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  FileText,
  Gauge,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Users,
  WalletCards,
} from "lucide-react";
import {
  useGetDashboardSummary,
  useGetEarningsChart,
  useGetProfitByBot,
  useGetReferralSummary,
  useListNotifications,
  useListTransactions,
} from "@workspace/api-client-react";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatUSD } from "@/lib/format";

type ChartPeriod = "7d" | "30d" | "90d";

const periodLabels: Record<ChartPeriod, string> = {
  "7d": "7D",
  "30d": "30D",
  "90d": "90D",
};

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function titleCase(value: string) {
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function transactionLabel(type: string) {
  const labels: Record<string, string> = {
    deposit: "Deposit",
    withdrawal: "Withdrawal",
    trade_profit: "Trade profit",
    trade_loss: "Trade opened",
    trade_loss_return: "Trade return",
    signal_reward: "Signal reward",
    referral_bonus: "Referral bonus",
    vip_package_purchase: "Vault capital transfer",
    vault_trade_stake: "Vault capital reserved",
    vault_trade_return: "Vault capital returned",
    vault_trade_fee: "Vault trading fee",
  };
  return labels[type] ?? titleCase(type);
}

function transactionTone(type: string) {
  if (["deposit", "trade_profit", "signal_reward", "referral_bonus", "vault_trade_return"].includes(type)) {
    return "positive";
  }
  if (["withdrawal", "trade_loss", "trade_loss_return", "vip_package_purchase", "vault_trade_fee"].includes(type)) {
    return "negative";
  }
  return "neutral";
}

function ErrorNote({ message = "This section is temporarily unavailable." }: { message?: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-rose-400/15 bg-rose-400/[0.06] px-4 py-3 text-xs text-rose-200">
      <CircleHelp className="h-4 w-4 shrink-0 text-rose-300" />
      <span>{message}</span>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  action,
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-end justify-between gap-4">
      <div>
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">{eyebrow}</p>
        <h2 className="text-[17px] font-bold tracking-[-0.02em] text-slate-100">{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
  accent = "gold",
  loading,
}: {
  label: string;
  value: string;
  detail: string;
  accent?: "gold" | "green" | "blue" | "slate";
  loading?: boolean;
}) {
  const accentClass = {
    gold: "text-amber-200",
    green: "text-emerald-300",
    blue: "text-sky-300",
    slate: "text-slate-100",
  }[accent];
  return (
    <div className="min-w-0 rounded-2xl border border-white/[0.07] bg-white/[0.035] p-4">
      <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">{label}</p>
      {loading ? (
        <Skeleton className="mt-3 h-6 w-24 bg-white/[0.09]" />
      ) : (
        <p className={`mt-2 truncate font-mono text-[19px] font-bold tracking-[-0.04em] ${accentClass}`}>{value}</p>
      )}
      <p className="mt-1 truncate text-[10px] text-slate-500">{detail}</p>
    </div>
  );
}

export default function Portfolio() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [period, setPeriod] = useState<ChartPeriod>("30d");

  const summaryQuery = useGetDashboardSummary({
    query: { refetchInterval: 10000, refetchOnWindowFocus: true } as any,
  });
  const chartQuery = useGetEarningsChart({ period });
  const botQuery = useGetProfitByBot();
  const transactionsQuery = useListTransactions({ type: "all" });
  const referralQuery = useGetReferralSummary();
  const notificationsQuery = useListNotifications({
    query: { refetchInterval: 15000, refetchOnWindowFocus: true } as any,
  });

  const summary = summaryQuery.data;
  const chart = Array.isArray(chartQuery.data) ? chartQuery.data : [];
  const bots = Array.isArray(botQuery.data) ? botQuery.data : [];
  const transactions = Array.isArray(transactionsQuery.data) ? transactionsQuery.data : [];
  const notifications = Array.isArray(notificationsQuery.data) ? notificationsQuery.data : [];
  const referralSummary = referralQuery.data;
  const unreadCount = notifications.filter((notification) => !notification.isRead).length;

  const total = safeNumber(summary?.portfolioBalance);
  const wallet = safeNumber(summary?.mainWalletBalance);
  const vault = safeNumber(summary?.vaultCapital ?? summary?.lockedInvestmentCapital);
  const pending = safeNumber(summary?.pendingOutflow);
  const available = safeNumber(summary?.availableBalance);
  const settledTrades = safeNumber(summary?.totalTrades);
  const hasSettledTrades = settledTrades > 0;
  const walletShare = total > 0 ? Math.min(100, Math.max(0, (wallet / total) * 100)) : 0;

  const chartGeometry = useMemo(() => {
    if (chart.length === 0) return { line: "", area: "", min: 0, max: 0 };
    const values = chart.map((point) => safeNumber(point.cumulative));
    const min = Math.min(...values, 0);
    const max = Math.max(...values, 0);
    const range = max - min || 1;
    const xStep = chart.length > 1 ? 640 / (chart.length - 1) : 640;
    const coords = chart.map((point, index) => {
      const x = index * xStep;
      const y = 178 - ((safeNumber(point.cumulative) - min) / range) * 150;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    });
    return {
      line: `M ${coords.join(" L ")}`,
      area: `M 0,190 L ${coords.join(" L ")} L 640,190 Z`,
      min,
      max,
    };
  }, [chart]);

  const exportStatement = () => {
    if (transactions.length === 0) return;
    const headers = ["ID", "Type", "Amount", "Status", "Payment method", "Created at", "Wallet address"];
    const rows = transactions.map((transaction) => [
      transaction.id,
      transactionLabel(transaction.type),
      safeNumber(transaction.amount).toFixed(2),
      transaction.status,
      transaction.paymentMethod ?? "",
      transaction.createdAt,
      transaction.walletAddress ?? "",
    ]);
    const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
    const csv = [headers, ...rows].map((row) => row.map(csvCell).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vixus-statement-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  const primaryError = summaryQuery.isError && !summaryQuery.isLoading;
  const chartError = chartQuery.isError && !chartQuery.isLoading;
  const activityError = transactionsQuery.isError && !transactionsQuery.isLoading;

  return (
    <Layout showNav>
      <main className="min-h-[100dvh] bg-[#080d18] pb-28 text-slate-100">
        <div className="pointer-events-none fixed inset-0 -z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute left-[-12%] top-[-8%] h-80 w-80 rounded-full bg-amber-300/[0.035] blur-3xl" />
          <div className="absolute right-[-15%] top-[24%] h-96 w-96 rounded-full bg-sky-400/[0.03] blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto max-w-[1380px] px-4 pt-6 sm:px-6 lg:px-10 lg:pt-8">
          <header className="mb-7 flex flex-wrap items-start justify-between gap-5">
            <div>
              <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-300/80">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.7)]" />
                Capital cockpit
              </div>
              <h1 className="text-[30px] font-bold tracking-[-0.045em] text-slate-50 sm:text-[38px]">Portfolio</h1>
              <p className="mt-1 max-w-xl text-sm text-slate-400">
                A clear read on what is spendable, what is working, and what needs your attention.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/profile/notifications"
                aria-label={`Open notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
                className="relative flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-slate-400 transition-colors hover:bg-white/[0.08] hover:text-slate-100"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-amber-300" />}
              </Link>
              <Link href="/support" className="hidden h-10 items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.08] sm:flex">
                <CircleHelp className="h-4 w-4 text-sky-300" />
                Support
              </Link>
            </div>
          </header>

          <section className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
            <div className="relative overflow-hidden rounded-[26px] border border-amber-200/15 bg-[linear-gradient(135deg,#1d1b16_0%,#111723_60%,#0e1b27_100%)] p-5 shadow-[0_20px_60px_rgba(0,0,0,0.22)] sm:p-7">
              <div className="absolute right-[-60px] top-[-80px] h-64 w-64 rounded-full bg-amber-300/[0.08] blur-2xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">Portfolio wallet</p>
                    {summaryQuery.isLoading ? (
                      <Skeleton className="mt-3 h-11 w-48 bg-white/[0.1]" />
                    ) : primaryError ? (
                      <p className="mt-3 text-sm text-rose-200">Balance unavailable</p>
                    ) : (
                      <p className="mt-2 font-mono text-[35px] font-bold tracking-[-0.06em] text-slate-50 sm:text-[44px]">
                        {balanceVisible ? formatUSD(total) : "••••••"}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    aria-label={balanceVisible ? "Hide portfolio balances" : "Show portfolio balances"}
                    onClick={() => setBalanceVisible((visible) => !visible)}
                    className="rounded-xl border border-white/10 bg-white/[0.08] px-3 py-2 text-[10px] font-semibold text-slate-300 transition-colors hover:bg-white/[0.14]"
                  >
                    {balanceVisible ? "Hide" : "Show"}
                  </button>
                </div>

                {primaryError ? (
                  <div className="mt-5">
                    <ErrorNote message="We could not load the latest wallet snapshot." />
                  </div>
                ) : (
                  <>
                    <div className="mt-6 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-2xl border border-amber-200/10 bg-white/[0.055] p-3.5">
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                          <WalletCards className="h-3.5 w-3.5 text-amber-200" /> Main wallet
                        </div>
                        <p className="mt-2 font-mono text-lg font-bold text-amber-100">
                          {balanceVisible ? formatUSD(wallet) : "••••••"}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">Spendable balance</p>
                      </div>
                      <div className="rounded-2xl border border-sky-300/10 bg-sky-300/[0.055] p-3.5">
                        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-slate-400">
                          <LockKeyhole className="h-3.5 w-3.5 text-sky-300" /> Vault capital
                        </div>
                        <p className="mt-2 font-mono text-lg font-bold text-sky-200">
                          {balanceVisible ? formatUSD(vault) : "••••••"}
                        </p>
                        <p className="mt-1 text-[10px] text-slate-500">Locked in VIP strategy</p>
                      </div>
                    </div>
                    <div className="mt-5">
                      <div className="mb-2 flex items-center justify-between text-[10px] text-slate-500">
                        <span>Capital composition</span>
                        <span>{walletShare.toFixed(1)}% spendable</span>
                      </div>
                      <div className="flex h-2 overflow-hidden rounded-full bg-white/[0.08]" aria-label={`${walletShare.toFixed(1)} percent spendable and ${(100 - walletShare).toFixed(1)} percent locked`}>
                        <div className="bg-amber-300 transition-[width] duration-500" style={{ width: `${walletShare}%` }} />
                        <div className="bg-sky-400/70" style={{ width: `${Math.max(0, 100 - walletShare)}%` }} />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px] text-slate-500">
                        <span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />Main wallet</span>
                        <span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-sky-400" />Vault capital</span>
                      </div>
                    </div>
                    {pending > 0 && (
                      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-white/[0.07] bg-black/10 px-3 py-2 text-[10px] text-slate-400">
                        <span>Available to withdraw <strong className="font-mono text-slate-200">{formatUSD(available)}</strong></span>
                        <span className="hidden text-slate-600 sm:inline">/</span>
                        <span>Pending outflow <strong className="font-mono text-amber-200">{formatUSD(pending)}</strong></span>
                      </div>
                    )}
                  </>
                )}

                <div className="mt-6 flex flex-wrap gap-2">
                  <Link href="/cashier/deposit" className="inline-flex h-10 items-center gap-2 rounded-xl bg-amber-300 px-4 text-xs font-bold text-slate-950 transition-transform hover:-translate-y-0.5">
                    <ArrowDownLeft className="h-4 w-4" /> Deposit
                  </Link>
                  <Link href="/cashier/withdraw" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-4 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.13]">
                    <ArrowUpRight className="h-4 w-4" /> Withdraw
                  </Link>
                  <Link href="/cashier/transactions" className="inline-flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.07] px-4 text-xs font-semibold text-slate-200 transition-colors hover:bg-white/[0.13]">
                    <FileText className="h-4 w-4" /> Statement
                  </Link>
                </div>
              </div>
            </div>

            <div className="rounded-[26px] border border-white/[0.08] bg-[#0d1421] p-5 sm:p-6">
              <SectionHeading
                eyebrow="Today's read"
                title="Performance pulse"
                action={<Gauge className="h-5 w-5 text-emerald-300" />}
              />
              <div className="flex items-end justify-between gap-4">
                <div>
                  {summaryQuery.isLoading ? <Skeleton className="h-9 w-32 bg-white/[0.08]" /> : (
                    <p className={`font-mono text-[31px] font-bold tracking-[-0.06em] ${safeNumber(summary?.todayProfit) >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {safeNumber(summary?.todayProfit) >= 0 ? "+" : ""}{formatUSD(summary?.todayProfit)}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-slate-500">Realized today</p>
                </div>
                <div className={`rounded-lg px-2.5 py-1.5 text-xs font-bold ${safeNumber(summary?.todayProfitPercent) >= 0 ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>
                  {safeNumber(summary?.todayProfitPercent) >= 0 ? "+" : ""}{safeNumber(summary?.todayProfitPercent).toFixed(2)}%
                </div>
              </div>
              <div className="my-6 h-px bg-white/[0.07]" />
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-slate-400"><CheckCircle2 className="h-4 w-4 text-emerald-300" /> Win rate</span>
                  <strong className="font-mono text-sm text-slate-100">{hasSettledTrades ? `${safeNumber(summary?.winRate).toFixed(1)}%` : "—"}</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-slate-400"><TrendingUp className="h-4 w-4 text-sky-300" /> Return on investment</span>
                  <strong className="font-mono text-sm text-sky-200">{safeNumber(summary?.roi).toFixed(2)}%</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-xs text-slate-400"><Activity className="h-4 w-4 text-amber-200" /> Total trades</span>
                  <strong className="font-mono text-sm text-slate-100">{settledTrades.toLocaleString()}</strong>
                </div>
              </div>
              <Link href="/dashboard" className="mt-6 flex items-center justify-between rounded-xl border border-white/[0.07] bg-white/[0.035] px-3.5 py-3 text-xs font-semibold text-slate-300 transition-colors hover:bg-white/[0.08]">
                Open dashboard overview <ChevronRight className="h-4 w-4 text-slate-500" />
              </Link>
            </div>
          </section>

          <section className="mt-7">
            <SectionHeading
              eyebrow="At a glance"
              title="Portfolio measures"
              action={<span className="text-[10px] text-slate-500">Updated with your latest account data</span>}
            />
            <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              <Metric label="Total profit" value={formatUSD(summary?.totalProfit)} detail={`${safeNumber(summary?.earningsChangePercent) >= 0 ? "+" : ""}${safeNumber(summary?.earningsChangePercent).toFixed(2)}% vs prior period`} accent="gold" loading={summaryQuery.isLoading} />
              <Metric label="Today profit" value={formatUSD(summary?.todayProfit)} detail="Closed positions only" accent="green" loading={summaryQuery.isLoading} />
              <Metric label="Win rate" value={hasSettledTrades ? `${safeNumber(summary?.winRate).toFixed(1)}%` : "—"} detail={hasSettledTrades ? `${settledTrades.toLocaleString()} settled trades` : "Not recorded yet"} accent="blue" loading={summaryQuery.isLoading} />
              <Metric label="Active bots" value={safeNumber(summary?.activeBots).toLocaleString()} detail={`${safeNumber(summary?.totalBots).toLocaleString()} strategies connected`} accent="slate" loading={summaryQuery.isLoading} />
            </div>
          </section>

          <section className="mt-8 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(310px,0.7fr)]">
            <div className="rounded-[24px] border border-white/[0.08] bg-[#0d1421] p-5 sm:p-6">
              <SectionHeading
                eyebrow="Performance history"
                title="Cumulative earnings"
                action={
                  <div className="flex rounded-lg border border-white/[0.07] bg-white/[0.03] p-0.5">
                    {(Object.keys(periodLabels) as ChartPeriod[]).map((item) => (
                      <button
                        type="button"
                        key={item}
                        onClick={() => setPeriod(item)}
                        className={`rounded-md px-2.5 py-1 text-[10px] font-bold transition-colors ${period === item ? "bg-amber-300 text-slate-950" : "text-slate-500 hover:text-slate-200"}`}
                        aria-pressed={period === item}
                      >
                        {periodLabels[item]}
                      </button>
                    ))}
                  </div>
                }
              />
              {chartError ? <ErrorNote message="Earnings history could not be loaded." /> : chartQuery.isLoading ? (
                <Skeleton className="h-[220px] w-full rounded-xl bg-white/[0.05]" />
              ) : chart.length === 0 ? (
                <div className="flex h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.1] bg-white/[0.02] text-center">
                  <BarChart3 className="mb-3 h-6 w-6 text-slate-600" />
                  <p className="text-sm font-semibold text-slate-300">No earnings history yet</p>
                  <p className="mt-1 max-w-xs text-xs text-slate-500">Completed activity will shape this view as your portfolio grows.</p>
                </div>
              ) : (
                <div>
                  <div className="mb-3 flex items-center justify-between">
                    <p className={`font-mono text-xl font-bold ${chartGeometry.max >= 0 ? "text-emerald-300" : "text-rose-300"}`}>
                      {chartGeometry.max >= 0 ? "+" : ""}{formatUSD(chartGeometry.max)}
                    </p>
                    <p className="text-[10px] text-slate-500">{chart.length} observations</p>
                  </div>
                  <div className="relative h-[220px] overflow-hidden rounded-xl border border-white/[0.06] bg-[#0a111d]">
                    <div className="pointer-events-none absolute inset-x-4 top-6 border-t border-dashed border-white/[0.06]" />
                    <div className="pointer-events-none absolute inset-x-4 top-1/2 border-t border-dashed border-white/[0.06]" />
                    <div className="pointer-events-none absolute inset-x-4 bottom-7 border-t border-dashed border-white/[0.06]" />
                    <svg viewBox="0 0 640 200" preserveAspectRatio="none" className="absolute inset-x-3 bottom-4 h-[185px] w-[calc(100%-24px)]" role="img" aria-label={`Cumulative earnings over the last ${periodLabels[period]}`}>
                      <defs>
                        <linearGradient id="portfolio-chart-fill" x1="0" x2="0" y1="0" y2="1">
                          <stop offset="0%" stopColor="#f6d365" stopOpacity="0.25" />
                          <stop offset="100%" stopColor="#f6d365" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path d={chartGeometry.area} fill="url(#portfolio-chart-fill)" />
                      <path d={chartGeometry.line} fill="none" stroke="#f6d365" strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" />
                    </svg>
                    <div className="absolute inset-x-4 bottom-2 flex justify-between text-[9px] text-slate-600">
                      <span>{chart[0]?.label ?? ""}</span>
                      <span>{chart[chart.length - 1]?.label ?? ""}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-white/[0.08] bg-[#0d1421] p-5 sm:p-6">
              <SectionHeading eyebrow="Allocation" title="Profit by strategy" action={<Link href="/dashboard" className="text-[10px] font-bold text-amber-200 hover:text-amber-100">Overview</Link>} />
              {botQuery.isError ? <ErrorNote message="Strategy performance is unavailable right now." /> : botQuery.isLoading ? (
                <div className="space-y-3">{[1, 2, 3].map((item) => <Skeleton key={item} className="h-12 w-full rounded-xl bg-white/[0.05]" />)}</div>
              ) : bots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.1] px-4 py-8 text-center">
                  <Gauge className="mx-auto mb-2 h-5 w-5 text-slate-600" />
                  <p className="text-xs font-semibold text-slate-300">No strategy data</p>
                  <p className="mt-1 text-[10px] text-slate-500">Strategy performance appears after your first completed trade.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {bots.slice(0, 5).map((bot) => {
                    const botProfit = safeNumber(bot.profit);
                    const botColor = bot.color || "#f6d365";
                    return (
                      <div key={bot.botId} className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: botColor }} />
                            <span className="truncate text-xs font-semibold text-slate-300">{bot.botName}</span>
                          </div>
                          <span className={`shrink-0 font-mono text-xs font-bold ${botProfit >= 0 ? "text-emerald-300" : "text-rose-300"}`}>{botProfit >= 0 ? "+" : ""}{formatUSD(botProfit)}</span>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.07]">
                            <div className="h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, safeNumber(bot.percentage)))}%`, backgroundColor: botColor }} />
                          </div>
                          <span className="w-10 text-right font-mono text-[10px] text-slate-500">{safeNumber(bot.percentage).toFixed(1)}%</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="mt-8 grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.65fr)]">
            <div className="rounded-[24px] border border-white/[0.08] bg-[#0d1421] p-5 sm:p-6">
              <SectionHeading
                eyebrow="Ledger"
                title="Recent activity"
                action={
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="ghost" size="sm" onClick={exportStatement} disabled={transactions.length === 0 || transactionsQuery.isLoading} className="h-8 gap-1.5 rounded-lg px-2 text-[10px] font-bold text-slate-400 hover:bg-white/[0.07] hover:text-slate-100">
                      <Download className="h-3.5 w-3.5" /> Export CSV
                    </Button>
                    <Link href="/cashier/transactions" className="text-[10px] font-bold text-amber-200 hover:text-amber-100">View all</Link>
                  </div>
                }
              />
              {activityError ? <ErrorNote message="Recent activity could not be loaded." /> : transactionsQuery.isLoading ? (
                <div className="space-y-2">{[1, 2, 3, 4].map((item) => <Skeleton key={item} className="h-[68px] w-full rounded-xl bg-white/[0.05]" />)}</div>
              ) : transactions.length === 0 ? (
                <div className="rounded-xl border border-dashed border-white/[0.1] px-4 py-10 text-center">
                  <Clock3 className="mx-auto mb-2 h-5 w-5 text-slate-600" />
                  <p className="text-xs font-semibold text-slate-300">Your ledger is quiet</p>
                  <p className="mt-1 text-[10px] text-slate-500">Deposits, withdrawals, and trading activity will appear here.</p>
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06]">
                  {transactions.slice(0, 6).map((transaction) => {
                    const tone = transactionTone(transaction.type);
                    const positive = tone === "positive";
                    const negative = tone === "negative";
                    return (
                      <div key={transaction.id} className="flex items-center gap-3 py-3.5 first:pt-0 last:pb-0">
                        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${positive ? "bg-emerald-400/10 text-emerald-300" : negative ? "bg-rose-400/10 text-rose-300" : "bg-sky-400/10 text-sky-300"}`}>
                          {positive ? <ArrowDownLeft className="h-4 w-4" /> : negative ? <ArrowUpRight className="h-4 w-4" /> : <Activity className="h-4 w-4" />}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-200">{transactionLabel(transaction.type)}</p>
                          <p className="mt-1 truncate text-[10px] text-slate-500">
                            {new Date(transaction.createdAt).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })} · {transaction.status}
                          </p>
                        </div>
                        <p className={`shrink-0 font-mono text-xs font-bold ${positive ? "text-emerald-300" : negative ? "text-rose-300" : "text-slate-300"}`}>
                          {positive ? "+" : negative ? "−" : ""}{formatUSD(Math.abs(safeNumber(transaction.amount)))}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="rounded-[24px] border border-amber-200/15 bg-[linear-gradient(145deg,rgba(58,47,20,0.65),rgba(13,20,33,0.9))] p-5 sm:p-6">
              <SectionHeading eyebrow="Your network" title="Referral balance" action={<Users className="h-5 w-5 text-amber-200" />} />
              {referralQuery.isError ? <ErrorNote message="Referral details are unavailable right now." /> : referralQuery.isLoading ? (
                <div className="space-y-3"><Skeleton className="h-8 w-32 bg-white/[0.08]" /><Skeleton className="h-12 w-full rounded-xl bg-white/[0.05]" /><Skeleton className="h-10 w-full rounded-xl bg-white/[0.05]" /></div>
              ) : (
                <>
                  <p className="font-mono text-[28px] font-bold tracking-[-0.05em] text-amber-100">{formatUSD(referralSummary?.totalEarned)}</p>
                  <p className="mt-1 text-xs text-slate-500">Total earned from qualified referrals</p>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Invited</p>
                      <p className="mt-1 font-mono text-lg font-bold text-slate-200">{referralSummary?.referrals?.length ?? 0}</p>
                    </div>
                    <div className="rounded-xl border border-white/[0.07] bg-black/10 p-3">
                      <p className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Pending</p>
                      <p className="mt-1 font-mono text-lg font-bold text-slate-200">{safeNumber(referralSummary?.pendingCount)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-white/[0.07] bg-black/10 px-3 py-2.5">
                    <span className="text-[10px] uppercase tracking-[0.1em] text-slate-500">Referral code</span>
                    <code className="font-mono text-xs font-bold text-amber-200">{referralSummary?.referralCode ?? "—"}</code>
                  </div>
                   <Link href="/profile" className="mt-4 flex h-10 items-center justify-center gap-2 rounded-xl border border-amber-200/15 bg-amber-200/[0.08] text-xs font-bold text-amber-100 transition-colors hover:bg-amber-200/[0.14]">
                    Manage referrals <ChevronRight className="h-4 w-4" />
                  </Link>
                </>
              )}
            </div>
          </section>

          <section className="mt-8">
            <SectionHeading eyebrow="Account controls" title="Keep the cockpit in order" />
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {[
                { href: "/profile/security", Icon: ShieldCheck, title: "Security", detail: "Password, 2FA, sessions", color: "text-emerald-300", bg: "bg-emerald-400/10" },
                { href: "/profile/notifications", Icon: Bell, title: "Notifications", detail: unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? "" : "s"}` : "All caught up", color: "text-amber-200", bg: "bg-amber-300/10" },
                { href: "/support", Icon: CircleHelp, title: "Support", detail: "Get help from the VIXUS team", color: "text-sky-300", bg: "bg-sky-400/10" },
              ].map(({ href, Icon, title, detail, color, bg }) => (
                <Link key={href} href={href} className="group flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-[#0d1421] p-3.5 transition-colors hover:border-white/[0.14] hover:bg-white/[0.05]">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${bg}`}>
                    <Icon className={`h-4.5 w-4.5 ${color}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-slate-200">{title}</p>
                    <p className="mt-1 truncate text-[10px] text-slate-500">{detail}</p>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-slate-600 transition-transform group-hover:translate-x-0.5 group-hover:text-slate-300" />
                </Link>
              ))}
            </div>
          </section>

          <footer className="mt-8 flex items-start gap-3 rounded-2xl border border-sky-300/10 bg-sky-300/[0.045] px-4 py-4">
            <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-sky-300" />
            <div>
              <p className="text-xs font-semibold text-sky-100">A measured view is a safer view</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
                Vault Capital is locked to the active VIP strategy and is not available for withdrawal. Performance figures describe past activity; they do not guarantee future results.
              </p>
            </div>
          </footer>
        </div>
      </main>
    </Layout>
  );
}