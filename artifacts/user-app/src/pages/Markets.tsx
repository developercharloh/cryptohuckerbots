import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Layout } from "@/components/Layout";
import { Search, Star, TrendingUp, TrendingDown } from "lucide-react";
import { useLocation } from "wouter";

/* ── Live pair state ────────────────────────────────────────────── */
type LivePair = {
  symbol: string;
  base: string;
  quote: string;
  price: number;
  prev: number;
  change: number;   // 24h % change (drifts with simulation)
  volume: string;
  category: "forex" | "crypto" | "commodities";
  icon: string;
  binance: string;  // binance symbol or "" for forex/commodities
  flash: boolean;
  up: boolean;
};

const BASE_PAIRS: LivePair[] = [
  // Forex
  { symbol:"EUR/USD", base:"EUR", quote:"USD", price:1.08412,   prev:1.08412,   change:0.23,  volume:"$482B", category:"forex",        icon:"🇪🇺", binance:"",         flash:false, up:true  },
  { symbol:"GBP/USD", base:"GBP", quote:"USD", price:1.27105,   prev:1.27105,   change:0.41,  volume:"$251B", category:"forex",        icon:"🇬🇧", binance:"",         flash:false, up:true  },
  { symbol:"USD/JPY", base:"USD", quote:"JPY", price:153.420,   prev:153.420,   change:-0.18, volume:"$371B", category:"forex",        icon:"🇯🇵", binance:"",         flash:false, up:false },
  { symbol:"USD/CHF", base:"USD", quote:"CHF", price:0.90215,   prev:0.90215,   change:-0.09, volume:"$134B", category:"forex",        icon:"🇨🇭", binance:"",         flash:false, up:false },
  { symbol:"AUD/USD", base:"AUD", quote:"USD", price:0.65340,   prev:0.65340,   change:0.57,  volume:"$163B", category:"forex",        icon:"🇦🇺", binance:"",         flash:false, up:true  },
  { symbol:"NZD/USD", base:"NZD", quote:"USD", price:0.59820,   prev:0.59820,   change:0.32,  volume:"$82B",  category:"forex",        icon:"🇳🇿", binance:"",         flash:false, up:true  },
  { symbol:"USD/CAD", base:"USD", quote:"CAD", price:1.36105,   prev:1.36105,   change:-0.14, volume:"$119B", category:"forex",        icon:"🇨🇦", binance:"",         flash:false, up:false },
  { symbol:"EUR/GBP", base:"EUR", quote:"GBP", price:0.85310,   prev:0.85310,   change:-0.11, volume:"$72B",  category:"forex",        icon:"🇪🇺", binance:"",         flash:false, up:false },
  { symbol:"EUR/JPY", base:"EUR", quote:"JPY", price:166.240,   prev:166.240,   change:0.08,  volume:"$98B",  category:"forex",        icon:"🇪🇺", binance:"",         flash:false, up:true  },
  { symbol:"GBP/JPY", base:"GBP", quote:"JPY", price:195.420,   prev:195.420,   change:0.19,  volume:"$61B",  category:"forex",        icon:"🇬🇧", binance:"",         flash:false, up:true  },
  // Crypto
  { symbol:"BTC/USD", base:"BTC", quote:"USD", price:67821.50,  prev:67821.50,  change:1.25,  volume:"$38B",  category:"crypto",       icon:"₿",   binance:"BTCUSDT",  flash:false, up:true  },
  { symbol:"ETH/USD", base:"ETH", quote:"USD", price:3512.80,   prev:3512.80,   change:2.04,  volume:"$22B",  category:"crypto",       icon:"Ξ",   binance:"ETHUSDT",  flash:false, up:true  },
  { symbol:"BNB/USD", base:"BNB", quote:"USD", price:598.40,    prev:598.40,    change:-0.87, volume:"$4B",   category:"crypto",       icon:"B",   binance:"BNBUSDT",  flash:false, up:false },
  { symbol:"SOL/USD", base:"SOL", quote:"USD", price:182.50,    prev:182.50,    change:3.41,  volume:"$6B",   category:"crypto",       icon:"◎",   binance:"SOLUSDT",  flash:false, up:true  },
  { symbol:"XRP/USD", base:"XRP", quote:"USD", price:0.5824,    prev:0.5824,    change:-1.12, volume:"$3B",   category:"crypto",       icon:"✕",   binance:"XRPUSDT",  flash:false, up:false },
  { symbol:"ADA/USD", base:"ADA", quote:"USD", price:0.4521,    prev:0.4521,    change:0.88,  volume:"$1B",   category:"crypto",       icon:"A",   binance:"ADAUSDT",  flash:false, up:true  },
  { symbol:"AVAX/USD",base:"AVAX",quote:"USD", price:38.21,     prev:38.21,     change:4.12,  volume:"$1.2B", category:"crypto",       icon:"▲",   binance:"AVAXUSDT", flash:false, up:true  },
  { symbol:"MATIC/USD",base:"MATIC",quote:"USD",price:0.8810,   prev:0.8810,    change:1.55,  volume:"$890M", category:"crypto",       icon:"M",   binance:"MATICUSDT",flash:false, up:true  },
  // Commodities
  { symbol:"XAU/USD", base:"XAU", quote:"USD", price:2342.80,   prev:2342.80,   change:-0.09, volume:"$142B", category:"commodities",  icon:"🥇",  binance:"XAUUSDT",  flash:false, up:false },
  { symbol:"XAG/USD", base:"XAG", quote:"USD", price:29.450,    prev:29.450,    change:0.34,  volume:"$28B",  category:"commodities",  icon:"🥈",  binance:"",         flash:false, up:true  },
  { symbol:"OIL/USD", base:"OIL", quote:"USD", price:82.340,    prev:82.340,    change:-0.61, volume:"$51B",  category:"commodities",  icon:"🛢",  binance:"",         flash:false, up:false },
  { symbol:"GAS/USD", base:"GAS", quote:"USD", price:2.1840,    prev:2.1840,    change:1.22,  volume:"$18B",  category:"commodities",  icon:"⛽",  binance:"",         flash:false, up:true  },
];

function fmtPrice(p: number): string {
  if (p > 10000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p > 100)   return p.toFixed(2);
  if (p > 1)     return p.toFixed(5);
  return p.toFixed(5);
}

/* ── Live prices hook ───────────────────────────────────────────── */
function useLivePairs() {
  const [pairs, setPairs] = useState<LivePair[]>(BASE_PAIRS);

  const applyPrice = useCallback((binance: string, newPrice: number) => {
    setPairs(prev => prev.map(p => {
      if (p.binance !== binance) return p;
      const change = p.prev ? ((newPrice - p.prev) / p.prev) * 100 : p.change;
      return { ...p, prev: p.price, price: newPrice, change, up: newPrice >= p.price, flash: true };
    }));
    setTimeout(() => setPairs(prev => prev.map(p => p.binance === binance ? { ...p, flash: false } : p)), 500);
  }, []);

  // 2-second simulation for every pair
  useEffect(() => {
    const id = setInterval(() => {
      setPairs(prev => prev.map(p => {
        const v = p.price > 10000 ? 0.0003 : p.price > 100 ? 0.0002 : 0.00015;
        const d = (Math.random() - 0.49) * v;
        const n = +(p.price * (1 + d)).toFixed(p.price > 1 ? (p.price > 10 ? 2 : 5) : 5);
        const change = p.prev ? ((n - p.prev) / p.prev) * 100 : p.change;
        return { ...p, prev: p.price, price: n, change, up: n >= p.price, flash: true };
      }));
      setTimeout(() => setPairs(prev => prev.map(p => ({ ...p, flash: false }))), 400);
    }, 1500);
    return () => clearInterval(id);
  }, []);

  // Binance WebSocket for real crypto prices
  const wsRef = useRef<WebSocket | null>(null);
  useEffect(() => {
    const symbols = BASE_PAIRS.filter(p => p.binance).map(p => `${p.binance.toLowerCase()}@miniTicker`).join("/");
    let attempts = 0;
    let retryTimer: ReturnType<typeof setTimeout>;
    const connect = () => {
      if (attempts > 3) return; attempts++;
      try {
        const ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${symbols}`);
        wsRef.current = ws;
        ws.onopen = () => { attempts = 0; };
        ws.onmessage = e => {
          try {
            const d = JSON.parse(e.data)?.data;
            if (d?.s && d?.c) applyPrice(d.s, parseFloat(d.c));
          } catch {}
        };
        ws.onerror = () => {};
        ws.onclose = () => { retryTimer = setTimeout(connect, 8000); };
      } catch {}
    };
    connect();
    return () => { wsRef.current?.close(); clearTimeout(retryTimer); };
  }, [applyPrice]);

  // Forex rates every 60s
  useEffect(() => {
    const fetch_ = async () => {
      let rates: Record<string, number> | null = null;
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/USD");
        const d = await r.json();
        if (d.result === "success") rates = d.rates;
      } catch {}
      if (!rates) {
        try {
          const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,AUD,NZD,CAD");
          const d = await r.json(); rates = d.rates;
        } catch {}
      }
      if (!rates) return;
      setPairs(prev => prev.map(p => {
        let n: number | null = null;
        if (p.symbol === "EUR/USD" && rates!.EUR) n = +(1 / rates!.EUR).toFixed(5);
        if (p.symbol === "GBP/USD" && rates!.GBP) n = +(1 / rates!.GBP).toFixed(5);
        if (p.symbol === "USD/JPY" && rates!.JPY) n = +rates!.JPY.toFixed(3);
        if (p.symbol === "USD/CHF" && rates!.CHF) n = +rates!.CHF.toFixed(5);
        if (p.symbol === "AUD/USD" && rates!.AUD) n = +(1 / rates!.AUD).toFixed(5);
        if (p.symbol === "NZD/USD" && rates!.NZD) n = +(1 / rates!.NZD).toFixed(5);
        if (p.symbol === "USD/CAD" && rates!.CAD) n = +rates!.CAD.toFixed(5);
        if (n === null) return p;
        const change = p.prev ? ((n - p.prev) / p.prev) * 100 : p.change;
        return { ...p, prev: p.price, price: n, change, up: n >= p.price, flash: true };
      }));
      setTimeout(() => setPairs(prev => prev.map(p => ({ ...p, flash: false }))), 400);
    };
    fetch_();
    const iv = setInterval(fetch_, 60000);
    return () => clearInterval(iv);
  }, []);

  return pairs;
}

/* ── Animated mini chart (sparkline shifts on each tick) ────────── */
function MiniChart({ up, seed }: { up: boolean; seed: number }) {
  const pts = useMemo(() => {
    const r = (n: number) => { let s = n; return () => { s=(s*9301+49297)%233280; return s/233280; }; };
    const rand = r(seed);
    const pts: string[] = [];
    let y = 10;
    for (let x = 0; x <= 64; x += 8) {
      y = Math.max(2, Math.min(18, y + (rand() - (up ? 0.4 : 0.6)) * 6));
      pts.push(`${x},${y.toFixed(1)}`);
    }
    return pts.join(" ");
  }, [up, seed]);
  return (
    <svg width={64} height={20} viewBox="0 0 64 20" fill="none">
      <polyline points={pts} stroke={up ? "#22c55e" : "#ef4444"} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
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

  const filtered = useMemo(() => pairs.filter(p => {
    const matchTab    = tab === "all" || p.category === tab;
    const q           = search.toLowerCase();
    const matchSearch = !q || p.symbol.toLowerCase().includes(q) || p.base.toLowerCase().includes(q);
    return matchTab && matchSearch;
  }), [pairs, tab, search]);

  return (
    <Layout showNav>
      <div className="pb-24 min-h-screen" style={{ background: "#07091A" }}>

        {/* Header */}
        <div style={{ padding: "20px 16px 0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <h1 style={{ fontSize: 20, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>Markets</h1>
          <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.2)", borderRadius: 20, padding: "4px 10px" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", animation: "pulse 1.5s infinite", boxShadow: "0 0 6px #22c55e" }} />
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
            <button key={t.id} onClick={() => setTab(t.id)} style={{
              padding: "6px 14px", borderRadius: 20, fontSize: 12, fontWeight: 600, border: "none",
              background: tab === t.id ? "linear-gradient(135deg, #7C3AED, #4F46E5)" : "rgba(255,255,255,0.06)",
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
          {filtered.map((pair, i) => (
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
                <MiniChart up={pair.up} seed={i * 137 + (pair.up ? 1 : 0)} />
              </div>

              {/* Price + change — flash color on tick */}
              <div style={{ width: 80, textAlign: "right", flexShrink: 0 }}>
                <p style={{
                  fontSize: 12, fontWeight: 700, marginBottom: 3,
                  color: pair.flash ? (pair.up ? "#22c55e" : "#ef4444") : "#fff",
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
                  {pair.up
                    ? <TrendingUp style={{ width: 9, height: 9, color: "#22c55e" }} />
                    : <TrendingDown style={{ width: 9, height: 9, color: "#ef4444" }} />
                  }
                  <span style={{ fontSize: 10, fontWeight: 700, color: pair.up ? "#22c55e" : "#ef4444" }}>
                    {pair.up ? "+" : ""}{pair.change.toFixed(2)}%
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
