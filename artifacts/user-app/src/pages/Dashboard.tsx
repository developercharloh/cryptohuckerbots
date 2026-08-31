import { useState } from "react";
import { Layout } from "@/components/Layout";
import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useListBots,
  useListNotifications,
} from "@workspace/api-client-react";
import {
  Bell, Eye, EyeOff, ArrowDownLeft, ArrowUpRight, ArrowLeftRight,
  TrendingUp, TrendingDown, ChevronRight, Bot, Zap, Plus,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { VixusLogo } from "@/components/VixusLogo";
import { Link } from "wouter";
import { formatUSD } from "@/lib/format";
import { useLivePairs, fmtPrice } from "@/hooks/useLivePairs";

const MARKET_COLORS: Record<string, string> = {
  "BTC/USD": "#F7931A",
  "ETH/USD": "#627EEA",
  "EUR/USD": "#3B82F6",
  "GBP/USD": "#38BDF8",
  "XAU/USD": "#F59E0B",
  "USD/JPY": "#EC4899",
  "SOL/USD": "#14F195",
  "AUD/USD": "#22D3EE",
  "USD/CAD": "#F87171",
  "BNB/USD": "#F0B90B",
};

const MARKET_SYMBOLS = ["BTC/USD", "ETH/USD", "EUR/USD", "GBP/USD", "XAU/USD", "USD/JPY", "SOL/USD", "AUD/USD"];

const ASSETS = [
  { name: "USDT",    symbol: "Tether",        icon: "₮", color: "#26A17B", pct: 60 },
  { name: "BTC",     symbol: "Bitcoin",       icon: "₿", color: "#F7931A", pct: 20 },
  { name: "ETH",     symbol: "Ethereum",      icon: "Ξ", color: "#627EEA", pct: 12 },
  { name: "EUR/USD", symbol: "Forex",         icon: "€", color: "#3B82F6", pct: 8  },
];

export default function Dashboard() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const { user } = useAuth();
  const livePairs = useLivePairs();
  const marketData = MARKET_SYMBOLS
    .map(sym => livePairs.find(p => p.symbol === sym))
    .filter((p): p is NonNullable<typeof p> => !!p);

  const { data: notifications = [] } = useListNotifications();
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary({
    query: { refetchInterval: 5000, refetchOnWindowFocus: true } as any,
  });
  const { data: recentActivity = [] } = useGetRecentActivity();
  const { data: bots = [] } = useListBots();
  const activeBots = bots.filter(b => b.status === "active");

  const initials = user?.fullName?.charAt(0)?.toUpperCase() ?? "U";
  const mainWalletBalance = summary?.mainWalletBalance;
  const totalProfit = summary?.totalProfit ?? 0;
  const vaultCapital = summary?.vaultCapital ?? summary?.lockedInvestmentCapital;
  const portfolioBalance = mainWalletBalance !== undefined && vaultCapital !== undefined
    ? Math.max(0, mainWalletBalance + vaultCapital)
    : summary?.totalBalance;

  return (
    <Layout showNav>
      <div className="user-dashboard" style={{ background: "#07091A", minHeight: "100vh", paddingBottom: 88 }}>

        {/* ── Header ─────────────────────────────────────────────── */}
        <div className="user-dashboard-header" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 16px 12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
             <VixusLogo className="h-8 w-8 rounded-[10px] border border-amber-300/30 object-cover shadow-[0_0_18px_rgba(37,99,235,0.25)]" />
            <span style={{ fontSize: 16, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>VIXUS AI</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Link href="/profile/notifications">
              <button style={{ width: 36, height: 36, borderRadius: 12, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative", cursor: "pointer" }}>
                <Bell style={{ width: 16, height: 16, color: "#9CA3AF" }} />
                {unreadCount > 0 && (
                  <span style={{ position: "absolute", top: 6, right: 6, width: 8, height: 8, borderRadius: "50%", background: "#F5B942", border: "2px solid #07091A" }} />
                )}
              </button>
            </Link>
            <Link href="/profile">
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: "linear-gradient(135deg, #F5B942, #D99B18)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, fontWeight: 700, color: "#111827", cursor: "pointer" }}>
                {initials}
              </div>
            </Link>
          </div>
        </div>

        {/* ── Greeting ────────────────────────────────────────────── */}
        <div className="user-dashboard-greeting" style={{ padding: "0 16px 16px" }}>
          <p style={{ fontSize: 12, color: "#6B7280" }}>Good day,</p>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
            {user?.fullName?.split(" ")[0] ?? "Trader"} 👋
          </h2>
        </div>

        {/* ── Portfolio Card ──────────────────────────────────────── */}
        <div className="user-dashboard-portfolio" style={{ padding: "0 16px 16px" }}>
          <div style={{
            borderRadius: 24, padding: "22px 20px 20px",
            background: "linear-gradient(135deg, #3A2B0D 0%, #17130A 55%, #0B1220 100%)",
             boxShadow: "0 8px 40px rgba(245,185,66,0.22), inset 0 1px 0 rgba(255,255,255,0.1)",
            position: "relative", overflow: "hidden",
          }}>
            {/* Glow orbs */}
             <div style={{ position: "absolute", top: -60, right: -40, width: 180, height: 180, borderRadius: "50%", background: "radial-gradient(circle, rgba(245,185,66,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />
             <div style={{ position: "absolute", bottom: -40, left: "20%", width: 120, height: 120, borderRadius: "50%", background: "radial-gradient(circle, rgba(37,99,235,0.25) 0%, transparent 70%)", pointerEvents: "none" }} />

            {/* Balance label + eye */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6, position: "relative" }}>
               <span style={{ fontSize: 11, color: "rgba(255,255,255,0.5)", letterSpacing: "0.06em", textTransform: "uppercase", fontWeight: 600 }}>Portfolio Wallet</span>
              <button
                onClick={() => setBalanceVisible(v => !v)}
                style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: 8, width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
              >
                {balanceVisible
                  ? <Eye style={{ width: 13, height: 13, color: "rgba(255,255,255,0.6)" }} />
                  : <EyeOff style={{ width: 13, height: 13, color: "rgba(255,255,255,0.6)" }} />
                }
              </button>
            </div>

            {/* Balance amount */}
            <div style={{ marginBottom: 12, position: "relative" }}>
              {loadingSummary ? (
                <Skeleton className="h-10 w-40 bg-white/10" />
              ) : balanceVisible ? (
                <p style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "-0.04em", fontFamily: "monospace", lineHeight: 1 }}>
                   {formatUSD(portfolioBalance)}
                </p>
              ) : (
                <p style={{ fontSize: 36, fontWeight: 900, color: "#fff", letterSpacing: "0.18em", lineHeight: 1 }}>••••••</p>
              )}
            </div>

            {!loadingSummary && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 18, position: "relative" }}>
                <div style={{ borderRadius: 12, padding: "9px 10px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Main wallet</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginTop: 3 }}>{balanceVisible ? formatUSD(mainWalletBalance ?? summary?.availableBalance) : "••••••"}</p>
                </div>
                <div style={{ borderRadius: 12, padding: "9px 10px", background: "rgba(37,99,235,0.12)", border: "1px solid rgba(96,165,250,0.18)" }}>
                  <p style={{ fontSize: 9, color: "rgba(191,219,254,0.65)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Vault Capital</p>
                  <p style={{ fontSize: 14, fontWeight: 800, color: "#bfdbfe", marginTop: 3 }}>{balanceVisible ? formatUSD(vaultCapital) : "••••••"}</p>
                </div>
              </div>
            )}
            {!loadingSummary && Number(summary?.pendingOutflow ?? 0) > 0 && (
              <p style={{ fontSize: 10, color: "rgba(255,255,255,0.52)", margin: "-8px 0 16px", position: "relative" }}>
                Available to withdraw: {formatUSD(summary?.availableBalance ?? 0)}
                {" · "}Pending withdrawals: {formatUSD(summary?.pendingOutflow ?? 0)}
              </p>
            )}

            {/* P&L badge */}
            {!loadingSummary && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, position: "relative" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 10, padding: "4px 10px" }}>
                  <TrendingUp style={{ width: 12, height: 12, color: "#4ade80" }} />
                  <span style={{ fontSize: 12, fontWeight: 700, color: "#4ade80" }}>+{summary?.earningsChangePercent ?? 0}%</span>
                </div>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)" }}>
                  Total Profit: {formatUSD(totalProfit)}
                </span>
              </div>
            )}

            {/* Quick actions */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 8, position: "relative" }}>
              {[
                { label: "Deposit",  href: "/cashier/deposit",  Icon: ArrowDownLeft,  bg: "rgba(34,197,94,0.15)",   color: "#4ade80" },
                { label: "Withdraw", href: "/cashier/withdraw", Icon: ArrowUpRight,   bg: "rgba(239,68,68,0.15)",   color: "#f87171" },
                { label: "Transfer", href: "/cashier",          Icon: ArrowLeftRight, bg: "rgba(59,130,246,0.15)",  color: "#60a5fa" },
                { label: "Trade",    href: "/trade",            Icon: TrendingUp,     bg: "rgba(245,185,66,0.15)", color: "#FFD86B" },
              ].map(a => (
                <Link key={a.href} href={a.href} style={{ textDecoration: "none" }}>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                    <div style={{ width: 44, height: 44, borderRadius: 14, background: a.bg, border: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <a.Icon style={{ width: 18, height: 18, color: a.color }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.65)", textAlign: "center" }}>{a.label}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Stats Row ──────────────────────────────────────────── */}
        <div className="user-dashboard-stats" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, padding: "0 16px 16px" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 14px", border: "1px solid rgba(255,255,255,0.07)" }}>
            <p style={{ fontSize: 10, color: "#6B7280", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Total Profit</p>
            {loadingSummary ? <Skeleton className="h-5 w-20" /> : (
              <p style={{ fontSize: 18, fontWeight: 800, color: "#FFD86B" }}>{formatUSD(totalProfit)}</p>
            )}
            <p style={{ fontSize: 10, color: "#22c55e", marginTop: 4 }}>↑ Win Rate {summary?.winRate ?? 0}%</p>
          </div>
          <Link href="/bots" style={{ textDecoration: "none" }}>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 16, padding: "14px 14px", border: "1px solid rgba(255,255,255,0.07)", cursor: "pointer" }}>
              <p style={{ fontSize: 10, color: "#6B7280", marginBottom: 6, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Active Signals</p>
              {loadingSummary ? <Skeleton className="h-5 w-12" /> : (
                <p style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{summary?.activeBots ?? 0} <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 500 }}>running</span></p>
              )}
              <p style={{ fontSize: 10, color: "#FFD86B", marginTop: 4 }}>View all →</p>
            </div>
          </Link>
        </div>

        {/* ── Markets ─────────────────────────────────────────────── */}
        <div className="user-dashboard-markets" style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Markets</h3>
              <div style={{ display: "flex", alignItems: "center", gap: 4, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "2px 8px" }}>
                <div style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.5s infinite", boxShadow: "0 0 6px #22c55e" }} />
                <span style={{ fontSize: 9, fontWeight: 700, color: "#22c55e" }}>LIVE</span>
              </div>
            </div>
            <Link href="/markets" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 11, color: "#FFD86B", fontWeight: 700 }}>See all →</span>
            </Link>
          </div>

          {/* Horizontal scroll */}
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
            {marketData.map(m => {
              const up = m.up;
              const color = MARKET_COLORS[m.symbol] ?? "#F5B942";
              return (
                <Link key={m.symbol} href={`/trade/${m.symbol.replace("/", "-")}`} style={{ textDecoration: "none", flexShrink: 0 }}>
                  <div style={{
                    width: 130, background: m.flash ? (up ? "rgba(34,197,94,0.06)" : "rgba(239,68,68,0.06)") : "rgba(255,255,255,0.04)",
                    border: "1px solid rgba(255,255,255,0.07)",
                    borderRadius: 16, padding: "12px 12px 10px", cursor: "pointer",
                    transition: "background 0.3s",
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: `${color}20`, border: `1px solid ${color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12 }}>
                        {m.icon}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>{m.symbol.split("/")[0]}</span>
                    </div>
                    <p style={{
                      fontSize: 13, fontWeight: 800, marginBottom: 4,
                      color: m.flash ? (up ? "#22c55e" : "#ef4444") : "#fff",
                      transition: "color 0.3s",
                      fontFamily: "'JetBrains Mono', monospace",
                    }}>
                      {fmtPrice(m.price)}
                    </p>
                    <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                      {up
                        ? <TrendingUp style={{ width: 10, height: 10, color: "#22c55e" }} />
                        : <TrendingDown style={{ width: 10, height: 10, color: "#ef4444" }} />
                      }
                      <span style={{ fontSize: 11, fontWeight: 700, color: up ? "#22c55e" : "#ef4444" }}>
                        {up ? "+" : ""}{m.change.toFixed(2)}%
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* ── Portfolio Assets ─────────────────────────────────────── */}
        <div className="user-dashboard-assets" style={{ padding: "0 16px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>My Assets</h3>
            <Link href="/cashier" style={{ textDecoration: "none" }}>
              <span style={{ fontSize: 11, color: "#FFD86B", fontWeight: 700 }}>Manage →</span>
            </Link>
          </div>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
            {ASSETS.map((asset, i) => {
              const assetBalance = i === 0 ? (summary?.availableBalance ?? 0) : (summary?.availableBalance ?? 0) * (asset.pct / 100) * 0.3;
              return (
                <div key={asset.name} style={{ display: "flex", alignItems: "center", gap: 12, padding: "14px 14px", borderBottom: i < ASSETS.length - 1 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: `${asset.color}20`, border: `1px solid ${asset.color}30`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
                    {asset.icon}
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{asset.name}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{formatUSD(assetBalance)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: "#6B7280" }}>{asset.symbol}</span>
                      <span style={{ fontSize: 10, color: "#6B7280" }}>{asset.pct}%</span>
                    </div>
                    <div style={{ height: 3, background: "rgba(255,255,255,0.06)", borderRadius: 2 }}>
                      <div style={{ height: 3, borderRadius: 2, background: asset.color, width: `${asset.pct}%`, opacity: 0.8 }} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Active Signals ──────────────────────────────────────── */}
        {activeBots.length > 0 && (
          <div className="user-dashboard-active-bots" style={{ padding: "0 16px 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Active Signals</h3>
              <Link href="/bots" style={{ textDecoration: "none" }}>
                <span style={{ fontSize: 11, color: "#FFD86B", fontWeight: 700 }}>View all →</span>
              </Link>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {activeBots.slice(0, 2).map(bot => (
                <Link key={bot.id} href={`/bots/${bot.id}`} style={{ textDecoration: "none" }}>
                   <div style={{ background: "rgba(245,185,66,0.08)", borderRadius: 16, padding: "12px 14px", border: "1px solid rgba(245,185,66,0.2)", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #F5B942, #D99B18)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <Bot style={{ width: 18, height: 18, color: "#fff" }} />
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{bot.name}</p>
                       <p style={{ fontSize: 10, color: "#6B7280" }}>AI Signal Strategy · Active</p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e" }} />
                      <ChevronRight style={{ width: 14, height: 14, color: "#6B7280" }} />
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* ── Recent Activity ──────────────────────────────────────── */}
        {recentActivity.length > 0 && (
          <div className="user-dashboard-activity" style={{ padding: "0 16px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>Recent Activity</h3>
              <Link href="/cashier/transactions" style={{ textDecoration: "none" }}>
                <span style={{ fontSize: 11, color: "#FFD86B", fontWeight: 700 }}>History →</span>
              </Link>
            </div>
            <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.07)", overflow: "hidden" }}>
              {recentActivity.slice(0, 4).map((tx: any, i: number) => {
                const isIn = tx.amount > 0;
                return (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 14px", borderBottom: i < 3 ? "1px solid rgba(255,255,255,0.05)" : "none" }}>
                    <div style={{ width: 38, height: 38, borderRadius: 12, background: isIn ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      {isIn
                        ? <ArrowDownLeft style={{ width: 16, height: 16, color: "#22c55e" }} />
                        : <ArrowUpRight style={{ width: 16, height: 16, color: "#ef4444" }} />
                      }
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>
                        {tx.type === "trade_loss" ? "Contract Opened" :
                         tx.type === "trade_profit" || tx.type === "trade_loss_return" ? "Contract Closed" :
                         tx.type === "signal_reward" ? "Signal Reward" :
                          tx.type === "vault_trade_stake" ? "Vault Capital Reserved" :
                          tx.type === "vault_trade_return" ? "Vault Capital Returned" :
                          tx.type === "vault_trade_fee" ? "Vault Capital Trading Fee" :
                         tx.type ? tx.type.replace(/_/g, " ") : (isIn ? "Deposit" : "Withdrawal")}
                      </p>
                      <p style={{ fontSize: 10, color: "#6B7280" }}>{tx.createdAt ? new Date(tx.createdAt).toLocaleDateString() : "—"}</p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 700, color: isIn ? "#22c55e" : "#ef4444" }}>
                      {isIn ? "+" : "-"}{formatUSD(Math.abs(tx.amount))}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </Layout>
  );
}
