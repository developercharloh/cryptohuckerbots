import { useState, useMemo } from "react";
import { Layout } from "@/components/Layout";
import { Search, Star, TrendingUp, TrendingDown, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";

type Pair = {
  symbol: string;
  base: string;
  quote: string;
  price: string;
  change: number;
  volume: string;
  category: "forex" | "crypto" | "commodities";
  icon: string;
};

const ALL_PAIRS: Pair[] = [
  // Forex
  { symbol: "EUR/USD", base: "EUR", quote: "USD", price: "1.08412", change: 0.23,  volume: "$482B", category: "forex",       icon: "🇪🇺" },
  { symbol: "GBP/USD", base: "GBP", quote: "USD", price: "1.27105", change: 0.41,  volume: "$251B", category: "forex",       icon: "🇬🇧" },
  { symbol: "USD/JPY", base: "USD", quote: "JPY", price: "153.420", change: -0.18, volume: "$371B", category: "forex",       icon: "🇯🇵" },
  { symbol: "USD/CHF", base: "USD", quote: "CHF", price: "0.90215", change: -0.09, volume: "$134B", category: "forex",       icon: "🇨🇭" },
  { symbol: "AUD/USD", base: "AUD", quote: "USD", price: "0.65340", change: 0.57,  volume: "$163B", category: "forex",       icon: "🇦🇺" },
  { symbol: "NZD/USD", base: "NZD", quote: "USD", price: "0.59820", change: 0.32,  volume: "$82B",  category: "forex",       icon: "🇳🇿" },
  { symbol: "USD/CAD", base: "USD", quote: "CAD", price: "1.36105", change: -0.14, volume: "$119B", category: "forex",       icon: "🇨🇦" },
  { symbol: "EUR/GBP", base: "EUR", quote: "GBP", price: "0.85310", change: -0.11, volume: "$72B",  category: "forex",       icon: "🇪🇺" },
  { symbol: "EUR/JPY", base: "EUR", quote: "JPY", price: "166.240", change: 0.08,  volume: "$98B",  category: "forex",       icon: "🇪🇺" },
  { symbol: "GBP/JPY", base: "GBP", quote: "JPY", price: "195.420", change: 0.19,  volume: "$61B",  category: "forex",       icon: "🇬🇧" },
  // Crypto
  { symbol: "BTC/USD", base: "BTC", quote: "USD", price: "67,821.50", change: 1.25,  volume: "$38B",  category: "crypto", icon: "₿"  },
  { symbol: "ETH/USD", base: "ETH", quote: "USD", price: "3,512.80",  change: 2.04,  volume: "$22B",  category: "crypto", icon: "Ξ"  },
  { symbol: "BNB/USD", base: "BNB", quote: "USD", price: "598.40",    change: -0.87, volume: "$4B",   category: "crypto", icon: "B"  },
  { symbol: "SOL/USD", base: "SOL", quote: "USD", price: "182.50",    change: 3.41,  volume: "$6B",   category: "crypto", icon: "◎"  },
  { symbol: "XRP/USD", base: "XRP", quote: "USD", price: "0.5824",    change: -1.12, volume: "$3B",   category: "crypto", icon: "✕"  },
  { symbol: "ADA/USD", base: "ADA", quote: "USD", price: "0.4521",    change: 0.88,  volume: "$1B",   category: "crypto", icon: "A"  },
  { symbol: "AVAX/USD",base: "AVAX",quote: "USD", price: "38.21",     change: 4.12,  volume: "$1.2B", category: "crypto", icon: "▲"  },
  { symbol: "MATIC/USD",base:"MATIC",quote:"USD", price: "0.8810",    change: 1.55,  volume: "$890M", category: "crypto", icon: "M"  },
  // Commodities
  { symbol: "XAU/USD", base: "XAU", quote: "USD", price: "2,342.80", change: -0.09, volume: "$142B", category: "commodities", icon: "🥇" },
  { symbol: "XAG/USD", base: "XAG", quote: "USD", price: "29.450",   change: 0.34,  volume: "$28B",  category: "commodities", icon: "🥈" },
  { symbol: "OIL/USD", base: "OIL", quote: "USD", price: "82.340",   change: -0.61, volume: "$51B",  category: "commodities", icon: "🛢" },
  { symbol: "GAS/USD", base: "GAS", quote: "USD", price: "2.1840",   change: 1.22,  volume: "$18B",  category: "commodities", icon: "⛽" },
];

type Tab = "all" | "forex" | "crypto" | "commodities";

function MiniChart({ positive }: { positive: boolean }) {
  const pts = positive
    ? "0,16 8,12 16,10 24,8 32,11 40,6 48,4 56,7 64,3"
    : "0,4  8,7  16,6  24,10 32,8  40,11 48,14 56,12 64,16";
  return (
    <svg width={64} height={20} viewBox="0 0 64 20" fill="none">
      <polyline
        points={pts}
        stroke={positive ? "#22c55e" : "#ef4444"}
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function Markets() {
  const [tab, setTab] = useState<Tab>("all");
  const [search, setSearch] = useState("");
  const [, setLocation] = useLocation();

  const filtered = useMemo(() => {
    return ALL_PAIRS.filter((p) => {
      const matchTab = tab === "all" || p.category === tab;
      const q = search.toLowerCase();
      const matchSearch = !q || p.symbol.toLowerCase().includes(q) || p.base.toLowerCase().includes(q);
      return matchTab && matchSearch;
    });
  }, [tab, search]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "all",          label: "All"         },
    { id: "forex",        label: "Forex"       },
    { id: "crypto",       label: "Crypto"      },
    { id: "commodities",  label: "Commodities" },
  ];

  return (
    <Layout showNav>
      <div className="pb-24 min-h-screen" style={{ background: "#07091A" }}>
        {/* Header */}
        <div style={{ padding: "20px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Markets</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "4px 10px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e" }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: "#22c55e" }}>LIVE</span>
          </div>
        </div>

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
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              style={{
                padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none",
                background: tab === t.id
                  ? "linear-gradient(135deg, #7C3AED, #4F46E5)"
                  : "rgba(255,255,255,0.06)",
                color: tab === t.id ? "#fff" : "#9CA3AF",
                cursor: "pointer", whiteSpace: "nowrap",
                boxShadow: tab === t.id ? "0 4px 12px rgba(124,58,237,0.4)" : "none",
                transition: "all 0.2s",
              }}
            >
              {t.label}
            </button>
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
          {filtered.map((pair) => {
            const up = pair.change >= 0;
            return (
              <button
                key={pair.symbol}
                onClick={() => setLocation(`/trade?pair=${encodeURIComponent(pair.symbol)}`)}
                style={{
                  width: "100%", display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 0", borderBottom: "1px solid rgba(255,255,255,0.05)",
                  background: "none", border: "none", cursor: "pointer", textAlign: "left",
                  borderBottomWidth: 1, borderBottomStyle: "solid", borderBottomColor: "rgba(255,255,255,0.05)",
                }}
              >
                {/* Icon */}
                <div style={{
                  width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
                  background: up ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                  border: `1px solid ${up ? "rgba(34,197,94,0.2)" : "rgba(239,68,68,0.2)"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 15,
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
                  <MiniChart positive={up} />
                </div>

                {/* Price + change */}
                <div style={{ width: 80, textAlign: "right", flexShrink: 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{pair.price}</p>
                  <div style={{
                    display: "inline-flex", alignItems: "center", gap: 2,
                    background: up ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
                    borderRadius: 6, padding: "2px 6px",
                  }}>
                    {up
                      ? <TrendingUp style={{ width: 9, height: 9, color: "#22c55e" }} />
                      : <TrendingDown style={{ width: 9, height: 9, color: "#ef4444" }} />
                    }
                    <span style={{ fontSize: 10, fontWeight: 700, color: up ? "#22c55e" : "#ef4444" }}>
                      {up ? "+" : ""}{pair.change.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "48px 16px" }}>
            <Star style={{ width: 32, height: 32, color: "#374151", margin: "0 auto 8px" }} />
            <p style={{ fontSize: 13, color: "#6B7280" }}>No pairs found</p>
          </div>
        )}
      </div>
    </Layout>
  );
}
