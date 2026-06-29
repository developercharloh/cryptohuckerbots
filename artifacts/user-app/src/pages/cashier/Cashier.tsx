import { Link } from "wouter";
import { Layout } from "@/components/Layout";
import { useGetDashboardSummary } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowDownCircle, ArrowUpCircle, History, ChevronRight, Eye, EyeOff } from "lucide-react";
import { useState } from "react";
import { formatUSD } from "@/lib/format";
import { SiTether, SiBitcoin, SiEthereum } from "react-icons/si";

const ACCOUNTS = [
  {
    name: "USDT",
    sub: "Main Account",
    Icon: SiTether,
    iconColor: "text-[#26A17B]",
    iconBg: "bg-[#26A17B]/15",
    balance: null,
    isMain: true,
  },
  {
    name: "USDT",
    sub: "TRC20",
    Icon: SiTether,
    iconColor: "text-[#26A17B]",
    iconBg: "bg-[#26A17B]/15",
    balance: 0,
    isMain: false,
  },
  {
    name: "ETH",
    sub: "Ethereum",
    Icon: SiEthereum,
    iconColor: "text-[#627EEA]",
    iconBg: "bg-[#627EEA]/15",
    balance: 0,
    isMain: false,
  },
  {
    name: "BTC",
    sub: "Bitcoin",
    Icon: SiBitcoin,
    iconColor: "text-[#F7931A]",
    iconBg: "bg-[#F7931A]/15",
    balance: 0,
    isMain: false,
  },
];

export default function Cashier() {
  const [balanceVisible, setBalanceVisible] = useState(true);
  const { data: summary, isLoading } = useGetDashboardSummary();

  return (
    <Layout showNav>
      <div className="pb-28">
        {/* ── Balance Hero Card ── */}
        <div className="px-4 pt-5 pb-2">
          <div
            style={{
              background: "linear-gradient(135deg, #4C1D95 0%, #3730A3 60%, #1E1B4B 100%)",
              borderRadius: 20,
              padding: "22px 20px 20px",
              position: "relative",
              overflow: "hidden",
              boxShadow: "0 8px 32px rgba(124,58,237,0.35)",
            }}
          >
            {/* Glow orbs */}
            <div
              style={{
                position: "absolute",
                top: -40,
                right: -40,
                width: 140,
                height: 140,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(167,139,250,0.25) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -20,
                left: "30%",
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(79,70,229,0.2) 0%, transparent 70%)",
                pointerEvents: "none",
              }}
            />

            {/* Top row */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12, position: "relative" }}>
              <div>
                <p style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                  Total Balance
                </p>
                {isLoading ? (
                  <Skeleton className="h-9 w-36 bg-white/10" />
                ) : balanceVisible ? (
                  <p style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "-0.03em", lineHeight: 1 }}>
                    {formatUSD(summary?.availableBalance)}
                  </p>
                ) : (
                  <p style={{ fontSize: 32, fontWeight: 800, color: "#fff", letterSpacing: "0.15em", lineHeight: 1 }}>••••••</p>
                )}
              </div>
              <button
                onClick={() => setBalanceVisible((v) => !v)}
                style={{
                  width: 34,
                  height: 34,
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.1)",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {balanceVisible ? (
                  <EyeOff className="w-4 h-4 text-white/60" />
                ) : (
                  <Eye className="w-4 h-4 text-white/60" />
                )}
              </button>
            </div>

            {/* Quick actions */}
            <div style={{ display: "flex", gap: 8, position: "relative" }}>
              {[
                { label: "Deposit", href: "/cashier/deposit", icon: <ArrowDownCircle className="w-5 h-5 text-white" /> },
                { label: "Withdraw", href: "/cashier/withdraw", icon: <ArrowUpCircle className="w-5 h-5 text-white" /> },
                { label: "History", href: "/cashier/transactions", icon: <History className="w-5 h-5 text-white" /> },
              ].map((a) => (
                <Link key={a.href} href={a.href} style={{ flex: 1, textDecoration: "none" }}>
                  <div
                    style={{
                      background: "rgba(255,255,255,0.1)",
                      borderRadius: 14,
                      padding: "10px 6px",
                      textAlign: "center",
                      border: "1px solid rgba(255,255,255,0.08)",
                      backdropFilter: "blur(4px)",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "center", marginBottom: 4 }}>{a.icon}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.75)", letterSpacing: "0.02em" }}>
                      {a.label}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>

        {/* ── Accounts Section ── */}
        <div className="px-4 mt-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-3">Accounts</p>
          <div className="space-y-2">
            {ACCOUNTS.map((acc, i) => {
              const Icon = acc.Icon;
              const displayBalance = acc.isMain
                ? balanceVisible
                  ? formatUSD(summary?.availableBalance ?? 0)
                  : "••••••"
                : balanceVisible
                ? "$0.00"
                : "••••••";

              return (
                <div
                  key={i}
                  className="flex items-center justify-between p-4 rounded-2xl border border-border/30"
                  style={{ background: "rgba(13,10,32,0.9)" }}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-full flex items-center justify-center ${acc.iconBg}`}>
                      <Icon className={`w-6 h-6 ${acc.iconColor}`} />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{acc.name}</p>
                      <p className="text-[11px] text-muted-foreground">{acc.sub}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    {isLoading && acc.isMain ? (
                      <Skeleton className="h-4 w-20" />
                    ) : (
                      <p className="text-sm font-bold">{displayBalance}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Transactions Link ── */}
        <div className="px-4 mt-4">
          <Link href="/cashier/transactions">
            <div
              className="flex items-center justify-between p-4 rounded-2xl border border-border/30 cursor-pointer"
              style={{ background: "rgba(13,10,32,0.9)" }}
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <History className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-semibold text-sm">Transaction History</p>
                  <p className="text-[11px] text-muted-foreground">View all deposits & withdrawals</p>
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-muted-foreground/40" />
            </div>
          </Link>
        </div>
      </div>
    </Layout>
  );
}
