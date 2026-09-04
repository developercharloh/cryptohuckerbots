import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Search, Star, TrendingUp, TrendingDown } from "lucide-react";
import { useLocation } from "wouter";
import { useLivePairs, fmtPrice } from "@/hooks/useLivePairs";
import { useGetTradeAccess } from "@workspace/api-client-react";

/* ── Mini chart from the server-provided candle history ──────────── */
function MiniChart({ up, points }: { up: boolean; points: { close: number }[] }) {
  const line = useMemo(() => {
    if (points.length < 2) return "";
    const values = points.map((point) => point.close);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const spread = max - min || Math.max(Math.abs(max) * 0.0001, 0.00001);
    return values.map((value, index) => {
      const x = (index / (values.length - 1)) * 64;
      const y = 18 - ((value - min) / spread) * 16;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");
  }, [points]);
  return (
    <svg width={64} height={20} viewBox="0 0 64 20" fill="none">
      {line ? (
        <polyline points={line} stroke={up ? "#22c55e" : "#ef4444"} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <line x1="4" y1="10" x2="60" y2="10" stroke="#4B5563" strokeWidth="1.5" strokeDasharray="2 2" />
      )}
    </svg>
  );
}

type Tab = "all" | "forex" | "crypto" | "commodities";

const TABS: { id: Tab; label: string }[] = [
  { id: "all",         label: "All"         },
  { id: "forex",       label: "Forex"       },
  { id: "crypto",      label: "Crypto"      },
  { id: "commodities", label: "Commodities" },
];

export default function Markets() {
  const [tab, setTab]       = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [, setLocation]     = useLocation();
  const pairs               = useLivePairs();
  const { data: vipAccess } = useGetTradeAccess({ query: { refetchInterval: 15000 } as any });

  const filtered = useMemo(() => pairs.filter(p => {
    const matchTab    = tab === "all" || p.category === tab;
    const q           = search.toLowerCase();
    const matchSearch = !q || p.symbol.toLowerCase().includes(q) || p.base.toLowerCase().includes(q);
    return matchTab && matchSearch;
  }), [pairs, tab, search]);

  return (
    <Layout showNav>
      <div className="user-markets pb-24 min-h-screen" style={{ background: "#07091A" }}>

        {/* Header */}
        <div style={{ padding: "20px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Markets</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "4px 10px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.5s infinite", boxShadow: "0 0 6px #22c55e" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e" }}>LIVE</span>
          </div>
        </div>
        {vipAccess && (
          <div style={{ margin: "12px 16px 0", padding: "10px 12px", borderRadius: 12, background: vipAccess.vipLevel > 0 ? "rgba(245,185,66,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${vipAccess.vipLevel > 0 ? "rgba(245,185,66,0.18)" : "rgba(239,68,68,0.18)"}` }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
              <p style={{ fontSize: 11, color: vipAccess.vipLevel > 0 ? "#FFD86B" : "#FCA5A5", fontWeight: 700 }}>
                {vipAccess.withdrawalGateActive
                  ? `Signal access paused · refer ${vipAccess.withdrawalReferralRequirement} users or upgrade to VIP 2`
                  : vipAccess.vipLevel > 0
                    ? `VIP ${vipAccess.vipLevel} · ${vipAccess.remainingToday} fixed-price signal${vipAccess.remainingToday === 1 ? "" : "s"} remaining`
                  : "Markets are viewable. VIP 1 access is required to execute signals."}
              </p>
              {(vipAccess.vipLevel === 0 || vipAccess.nextLevel || vipAccess.withdrawalGateActive) && (
                <button onClick={() => setLocation("/vip-packages")} style={{ flexShrink: 0, border: "none", borderRadius: 9, padding: "7px 9px", background: "linear-gradient(135deg, #F5B942, #2563EB)", color: "#fff", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                  {vipAccess.vipLevel === 0 ? "Buy VIP" : vipAccess.withdrawalGateActive ? "Unlock VIP 2" : "Upgrade VIP"}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Search */}
        <div style={{ padding: "12px 16px" }}>
          <div style={{ position: "relative" }}>
            <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#6B7280" }} />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search pairs..."
              style={{
                width: "100%", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 12, padding: "10px 12px 10px 36px", fontSize: 13, color: "#fff",
                outline: "none", boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: 6, padding: "0 16px 12px", overflowX: "auto" }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none",
              background: tab === t.id ? "linear-gradient(135deg, #F5B942, #D99B18)" : "rgba(255,255,255,0.06)",
              color: tab === t.id ? "#fff" : "#9CA3AF", cursor: "pointer", whiteSpace: "nowrap",
              boxShadow: tab === t.id ? "0 4px 12px rgba(124,58,237,0.4)" : "none", transition: "all 0.2s",
            }}>{t.label}</button>
          ))}
        </div>

        {/* Column headers */}
        <div style={{ display: "flex", alignItems: "center", padding: "0 16px 8px", gap: 8 }}>
          <span style={{ flex: 1, fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em" }}>Pair</span>
          <span style={{ width: 64, fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "center" }}>7D Chart</span>
          <span style={{ width: 80, fontSize: 10, color: "#6B7280", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.04em", textAlign: "right" }}>Price / 24H</span>
        </div>

        {/* Pairs list */}
        <div style={{ padding: "0 16px" }}>
           {filtered.map((pair) => (
            <button
              key={pair.symbol}
              onClick={() => setLocation(`/trade/${pair.symbol.replace("/", "-")}`)}
              style={{
                width: "100%", display: "flex", alignItems: "center", gap: 10,
                padding: "12px 0", background: pair.flash
                  ? pair.up ? "rgba(34,197,94,0.04)" : "rgba(239,68,68,0.04)"
                  : "transparent",
                border: "none", borderBottom: "1px solid rgba(255,255,255,0.05)",
                cursor: "pointer", textAlign: "left",
                transition: "background 0.3s",
              }}
            >
              {/* Icon */}
              <div style={{
                width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                background: pair.up ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                border: `1px solid ${pair.up ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15,
              }}>
                {pair.icon}
              </div>

              {/* Name + volume */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 2 }}>{pair.symbol}</p>
                <p style={{ fontSize: 10, color: "#6B7280" }}>Vol {pair.volume}</p>
              </div>

              {/* Mini chart */}
              <div style={{ width: 64, flexShrink: 0 }}>
               <MiniChart up={pair.up} points={pair.sparkline} />
              </div>

              {/* Price + change — flash color on tick */}
              <div style={{ width: 80, textAlign: "right", flexShrink: 0 }}>
                <p style={{
                  fontSize: 12, fontWeight: 700, marginBottom: 3,
                   color: pair.flash ? (pair.up ? "#22c55e" : "#ef4444") : pair.price === null ? "#6B7280" : "#fff",
                  transition: "color 0.3s",
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                   {fmtPrice(pair.price)}
                </p>
                <div style={{
                  display: "inline-flex", alignItems: "center", gap: 2,
                  background: pair.up ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                  borderRadius: 6, padding: "2px 6px",
                }}>
                    {pair.price === null
                      ? <span style={{ fontSize: 9, color: "#6B7280" }}>{pair.status === "loading" ? "CONNECTING LIVE DATA" : "LIVE DATA UNAVAILABLE"}</span>
                     : pair.up
                       ? <TrendingUp style={{ width: 9, height: 9, color: "#22c55e" }} />
                       : <TrendingDown style={{ width: 9, height: 9, color: "#ef4444" }} />
                   }
                  <span style={{ fontSize: 10, fontWeight: 700, color: pair.up ? "#22c55e" : "#ef4444" }}>
                    {pair.change === null ? "—" : `${pair.up ? "+" : ""}${pair.change.toFixed(2)}%`}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px" }}>
            <Star style={{ width: 32, height: 32, color: "#374151", margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13, color: "#6B7280" }}>No pairs found</p>
          </div>
        )}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.4} }
      `}</style>
    </Layout>
  );
}
