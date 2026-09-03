import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { API_BASE, fetchWithTimeout } from "@/lib/api-base";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldCheck, Lock, Zap, Star, ArrowRight,
  Globe, TrendingUp, BarChart2, Bot,
  Menu, X, Activity, CheckCircle, ChevronRight,
  Cpu, Clock, Newspaper, ExternalLink, RefreshCw,
} from "lucide-react";
import { createChart, ColorType, CrosshairMode, CandlestickSeries } from "lightweight-charts";

/* ─── Design tokens (extracted from Base44 bundle) ────────────── */
const PURPLE    = "#F5B942";
const CYAN      = "#3B82F6";
const INDIGO    = "#111111";
const GREEN     = "#F5B942";
const RED       = "#3B82F6";
const HERO_GRAD = `linear-gradient(135deg, ${PURPLE} 0%, ${INDIGO} 50%, ${CYAN} 100%)`;
const CARD_SH   = "0 1px 3px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.06)";
const CARD_SH_LG= "0 4px 6px rgba(0,0,0,0.05), 0 10px 30px rgba(0,0,0,0.1)";

/* ─── Static content ──────────────────────────────────────────── */
const NAV_LINKS = [
  { label: "Markets",  href: "#markets"  },
  { label: "News",     href: "#news"     },
  { label: "Trading",  href: "#terminal" },
  { label: "Features", href: "#features" },
  { label: "Company",  href: "#company"  },
];

const MARKETS = [
  { name: "BTC",  pair: "BTC/USD", full: "Bitcoin",   chg: "+2.34%", vol: "$48.2B", signal: "STRONG BUY", sc: GREEN,     up: true  },
  { name: "ETH",  pair: "ETH/USD", full: "Ethereum",  chg: "+1.82%", vol: "$18.1B", signal: "BUY",        sc: GREEN,     up: true  },
  { name: "SOL",  pair: "SOL/USD", full: "Solana",    chg: "-0.41%", vol: "$4.3B",  signal: "NEUTRAL",    sc: "#F59E0B", up: false },
  { name: "XAU",  pair: "XAU/USD", full: "Gold",      chg: "+0.67%", vol: "$12.7B", signal: "BUY",        sc: GREEN,     up: true  },
  { name: "EUR",  pair: "EUR/USD", full: "EUR/USD",   chg: "-0.12%", vol: "$8.9B",  signal: "NEUTRAL",    sc: "#F59E0B", up: false },
  { name: "GBP",  pair: "GBP/USD", full: "GBP/USD",   chg: "+0.33%", vol: "$5.6B",  signal: "BUY",        sc: GREEN,     up: true  },
];

const FEATURES = [
  { icon: Zap,         title: "Sub-ms Execution",         desc: "Orders filled in microseconds across all 11 markets. No requotes, no slippage surprises." },
  { icon: Activity,    title: "Live P&L Tracking",        desc: "Every open trade visible in real time. Watch your portfolio move tick by tick." },
  { icon: ShieldCheck, title: "Hard Risk Limits",         desc: "Set max drawdown per bot. Positions close automatically — your capital stays protected." },
  { icon: Globe,       title: "11 Markets Covered",       desc: "Forex, crypto, commodities, and indices — all automated." },
  { icon: Cpu,         title: "AI-Powered Signals",       desc: "Neural analytics synthesize real-time data into high-confidence trade signals." },
  { icon: BarChart2,   title: "Performance Analytics",    desc: "Win-rate, Sharpe ratio, drawdown curves — all tracked live in your dashboard." },
];

const STEPS = [
  { n: "01", tag: "Instant funding",   title: "Fund your account",  desc: "Deposit USDT on BNB Smart Chain (BEP-20). Funds reflect after network confirmation." },
  { n: "02", tag: "11 bots available", title: "Choose your bot",    desc: "Browse AI strategies by risk profile, asset class, and verified track record." },
  { n: "03", tag: "24/7 automation",   title: "Let it trade",       desc: "The bot runs 24/7. You get real-time P&L, full trade logs, and one-click withdrawals." },
];

const STATS = [
  { value: "$2.5B+", label: "Volume Traded"    },
  { value: "2.7M+",  label: "Active Traders"   },
  { value: "11",     label: "Markets Covered"  },
  { value: "99.9%",  label: "Platform Uptime"  },
];

const TESTIMONIALS = [
  {
    name: "Marcus T.", loc: "Austin, TX", init: "M", color: PURPLE,
    quote: "Setup took five minutes. Dashboard is clean, withdrawals hit same day. I've tried four platforms — this one I actually stuck with.",
    stat: "+$4,200 first month",
  },
  {
    name: "James K.", loc: "Dallas, TX", init: "J", color: "#0891B2",
    quote: "I trade my own account too, so I know what fast execution looks like. These bots fill at the right price — no requotes, no slippage surprises.",
    stat: "5 years trading exp.",
  },
  {
    name: "Danielle R.", loc: "Chicago, IL", init: "D", color: "#059669",
    quote: "The risk controls are what sold me. I set a 5% drawdown cap and it has never been breached. Everything is upfront.",
    stat: "Consistent since month 1",
  },
];

/* ─── Live prices hook ────────────────────────────────────────── */
type PriceData = {
  pair: string; symbol: string; price: number; prev: number;
  chg: number; chgPct: number; up: boolean; flash: boolean;
  volume: string;
};

type LandingNewsArticle = {
  id: string;
  title: string;
  summary: string;
  url: string;
  source: string;
  category: string;
  publishedAt: string;
};

type LandingNewsResponse = {
  articles: LandingNewsArticle[];
  updatedAt: string;
};

const LANDING_API_BASE = API_BASE;
const ASSET_BASE = import.meta.env.BASE_URL;

function formatNewsTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.getTime() === 0) return "Latest";
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(date);
}

const INITIAL_PAIRS: PriceData[] = [
  { pair: "BTC/USD",  symbol: "BTCUSDT", price: 67842.30, prev: 67842.30, chg: 0, chgPct: 0, up: true,  flash: false, volume: "$48.2B" },
  { pair: "ETH/USD",  symbol: "ETHUSDT", price: 3412.80,  prev: 3412.80,  chg: 0, chgPct: 0, up: true,  flash: false, volume: "$18.1B" },
  { pair: "EUR/USD",  symbol: "",         price: 1.0847,   prev: 1.0847,   chg: 0, chgPct: 0, up: true,  flash: false, volume: "$8.9B" },
  { pair: "GBP/USD",  symbol: "",         price: 1.2703,   prev: 1.2703,   chg: 0, chgPct: 0, up: true,  flash: false, volume: "$5.6B" },
  { pair: "USD/JPY",  symbol: "",         price: 157.42,   prev: 157.42,   chg: 0, chgPct: 0, up: false, flash: false, volume: "—" },
  { pair: "XAU/USD",  symbol: "XAUUSDT", price: 2341.50,  prev: 2341.50,  chg: 0, chgPct: 0, up: true,  flash: false, volume: "$12.7B" },
  { pair: "SOL/USD",  symbol: "SOLUSDT", price: 142.30,   prev: 142.30,   chg: 0, chgPct: 0, up: false, flash: false, volume: "$4.3B" },
  { pair: "NAS100",   symbol: "BNBUSDT", price: 18942.0,  prev: 18942.0,  chg: 0, chgPct: 0, up: true,  flash: false, volume: "—" },
];

function formatQuoteVolume(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "—";
  if (value >= 1e9) return `$${(value / 1e9).toFixed(value >= 1e10 ? 0 : 1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function useLivePrices() {
  const [pairs, setPairs] = useState<PriceData[]>(INITIAL_PAIRS);

  const updatePrice = useCallback((symbol: string, newPrice: number, quoteVolume?: number) => {
    setPairs(prev => prev.map(p => {
      if (p.symbol !== symbol) return p;
      const chg = newPrice - p.prev;
      const chgPct = (chg / p.prev) * 100;
      return {
        ...p,
        prev: p.price,
        price: newPrice,
        chg,
        chgPct,
        up: newPrice >= p.prev,
        volume: quoteVolume ? formatQuoteVolume(quoteVolume) : p.volume,
        flash: true,
      };
    }));
    setTimeout(() => setPairs(prev => prev.map(p => p.symbol === symbol ? { ...p, flash: false } : p)), 600);
  }, []);

  useEffect(() => {
    const sim = setInterval(() => {
      setPairs(prev => prev.map(p => {
        const v = p.price > 10000 ? 0.0003 : p.price > 100 ? 0.0002 : 0.00015;
        const d = (Math.random() - 0.49) * v;
        const n = +(p.price * (1 + d)).toFixed(p.price > 100 ? 2 : 5);
        const chg = n - p.prev, chgPct = (chg / p.prev) * 100;
        return { ...p, prev: p.price, price: n, chg, chgPct, up: n >= p.prev, flash: true };
      }));
      setTimeout(() => setPairs(prev => prev.map(p => ({ ...p, flash: false }))), 400);
    }, 2000);
    return () => clearInterval(sim);
  }, []);

  useEffect(() => {
    const symbols = ["btcusdt", "ethusdt", "xauusdt", "solusdt"];
    const streams = symbols.map(s => `${s}@miniTicker`).join("/");
    let ws: WebSocket | null = null, retryTimer: ReturnType<typeof setTimeout>, attempts = 0;
    const connect = () => {
      if (attempts > 3) return; attempts++;
      try {
        ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
        ws.onopen = () => { attempts = 0; };
         ws.onmessage = e => {
           try {
             const d = JSON.parse(e.data)?.data;
             if (d?.s && d?.c) updatePrice(d.s, parseFloat(d.c), parseFloat(d.q));
           } catch {}
         };
        ws.onerror = () => {};
        ws.onclose = () => { retryTimer = setTimeout(connect, 8000); };
      } catch {}
    };
    connect();
    return () => { ws?.close(); clearTimeout(retryTimer); };
  }, [updatePrice]);

  useEffect(() => {
    const fetch_ = async () => {
      let rates: Record<string, number> | null = null;
      try { const r = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD"); const d = await r.json(); if (d.result === "success") rates = d.rates; } catch {}
      if (!rates) { try { const r = await fetchWithTimeout("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY"); const d = await r.json(); rates = d.rates; } catch {} }
      if (!rates) return;
      setPairs(prev => prev.map(p => {
        let n: number | null = null;
        if (p.pair === "EUR/USD" && rates!.EUR) n = +(1 / rates!.EUR).toFixed(5);
        if (p.pair === "GBP/USD" && rates!.GBP) n = +(1 / rates!.GBP).toFixed(5);
        if (p.pair === "USD/JPY" && rates!.JPY) n = +rates!.JPY.toFixed(3);
        if (n === null) return p;
        const chg = n - p.prev, chgPct = p.prev ? (chg / p.prev) * 100 : 0;
        return { ...p, prev: p.price, price: n, chg, chgPct, up: n >= p.prev };
      }));
    };
    fetch_();
    const iv = setInterval(fetch_, 60000);
    return () => clearInterval(iv);
  }, []);

  return pairs;
}

function fmt(p: PriceData): string {
  const v = p.price;
  if (v > 10000) return v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (v > 100) return v.toFixed(2);
  if (v > 1) return v.toFixed(4);
  return v.toFixed(5);
}

/* ─── Sparkline ───────────────────────────────────────────────── */
function Spark({ up }: { up: boolean }) {
  const pts = Array.from({ length: 8 }, (_, i) => ({
    x: i * 8,
    y: 14 + (Math.random() - (up ? 0.38 : 0.62)) * 10,
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg width="56" height="28" viewBox="0 0 56 28">
      <path d={d} stroke={up ? GREEN : RED} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Live Ticker ─────────────────────────────────────────────── */
function LiveTicker({ pairs }: { pairs: PriceData[] }) {
  const items = [...pairs, ...pairs];
  return (
    <div style={{ background: "#fff", borderTop: "1px solid #F0F0F5", borderBottom: "1px solid #F0F0F5", overflow: "hidden", position: "relative", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
      <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 48, background: "linear-gradient(to right, #fff, transparent)", zIndex: 2, pointerEvents: "none" }} />
      <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 48, background: "linear-gradient(to left, #fff, transparent)", zIndex: 2, pointerEvents: "none" }} />
      <div style={{ display: "flex", whiteSpace: "nowrap", animation: "ticker 40s linear infinite" }}>
        {items.map((t, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 20px", borderRight: "1px solid #F0F0F5", flexShrink: 0 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: "#9CA3AF" }}>{t.pair}</span>
            <span style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: t.flash ? (t.up ? GREEN : RED) : "#111827", transition: "color 0.3s" }}>{fmt(t)}</span>
            <span style={{ fontSize: 11, color: t.up ? GREEN : RED, fontFamily: "'JetBrains Mono', monospace" }}>{t.up ? "▲" : "▼"} {Math.abs(t.chgPct).toFixed(2)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Terminal candlestick card ───────────────────────────────── */
function TerminalCard({ pairs }: { pairs: PriceData[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const seriesRef = useRef<any>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const [price, setPrice] = useState("67,842.30");
  const [chg, setChg] = useState("+2.34%");
  const [up, setUp] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: "#9CA3AF", fontSize: 10 },
      grid: { vertLines: { color: "rgba(0,0,0,0.04)" }, horzLines: { color: "rgba(0,0,0,0.04)" } },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(0,0,0,0.06)" },
      timeScale: { borderColor: "rgba(0,0,0,0.06)", timeVisible: true, secondsVisible: false },
      handleScroll: false, handleScale: false,
    });
    const series = chart.addSeries(CandlestickSeries, {
      upColor: GREEN, downColor: RED, borderUpColor: GREEN, borderDownColor: RED, wickUpColor: GREEN, wickDownColor: RED,
    });
    seriesRef.current = series;

    const fallback = (base: number, n: number) => {
      const now = Math.floor(Date.now() / 1000); let p = base;
      return Array.from({ length: n }, (_, i) => {
        const o = p, move = (Math.random() - 0.48) * p * 0.004, c = +(o + move).toFixed(2);
        const h = +(Math.max(o, c) * (1 + Math.random() * 0.003)).toFixed(2);
        const l = +(Math.min(o, c) * (1 - Math.random() * 0.003)).toFixed(2);
        p = c; return { time: (now - (n - i) * 300) as any, open: o, high: h, low: l, close: c };
      });
    };

    (async () => {
      try {
        const r = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=60");
        const data: any[] = await r.json();
        const candles = data.map((k: any) => ({ time: Math.floor(k[0] / 1000) as any, open: +k[1], high: +k[2], low: +k[3], close: +k[4] }));
        series.setData(candles); chart.timeScale().fitContent();
        const last = candles[candles.length - 1];
        setPrice(last.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        const pct = ((last.close - candles[0].open) / candles[0].open) * 100;
        setChg(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`); setUp(pct >= 0);
        return;
      } catch {}
      const candles = fallback(67800, 60);
      series.setData(candles); chart.timeScale().fitContent();
    })();

    try {
      const ws = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_5m");
      wsRef.current = ws;
      ws.onmessage = e => {
        try {
          const { k } = JSON.parse(e.data);
          series.update({ time: Math.floor(k.t / 1000) as any, open: +k.o, high: +k.h, low: +k.l, close: +k.c });
          const p = +k.c, pct = ((p - +k.o) / +k.o) * 100;
          setPrice(p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          setChg(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`); setUp(pct >= 0);
        } catch {}
      };
      ws.onerror = () => {};
    } catch {}

    const handleResize = () => { if (containerRef.current) chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight }); };
    window.addEventListener("resize", handleResize);
    return () => { wsRef.current?.close(); chart.remove(); window.removeEventListener("resize", handleResize); };
  }, []);

  const btcPair = pairs.find(p => p.pair === "BTC/USD");

  return (
    <div id="terminal" style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #F0F0F5", boxShadow: CARD_SH_LG }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", background: "#FAFAFA", borderBottom: "1px solid #F0F0F5" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ width: 28, height: 28, borderRadius: 8, background: HERO_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#fff" }}>V</span>
          </div>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#111827", fontFamily: "'Inter Tight', sans-serif" }}>VIXUS TERMINAL v4.2.1</div>
            <div style={{ fontSize: 10, color: GREEN, display: "flex", alignItems: "center", gap: 3 }}>
              <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, display: "inline-block", animation: "pulse 1.5s infinite" }} />
              LIVE CONNECTED
            </div>
          </div>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", color: up ? GREEN : RED }}>{price}</div>
          <div style={{ fontSize: 10, color: up ? GREEN : RED, fontFamily: "'JetBrains Mono', monospace" }}>{chg}</div>
        </div>
      </div>

      {/* Pair sub-header */}
      <div style={{ padding: "8px 20px", borderBottom: "1px solid #F8F8FC", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827", fontFamily: "'JetBrains Mono', monospace" }}>BTC/USDT</span>
        <span style={{ fontSize: 10, background: "#FFF8E1", color: PURPLE, fontWeight: 600, borderRadius: 6, padding: "2px 8px" }}>5m</span>
        <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 600, color: GREEN, background: "#ECFDF5", borderRadius: 20, padding: "2px 8px", display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, display: "inline-block" }} />
          BTC/USD · {btcPair ? fmt(btcPair) : "67,821.50"}
        </span>
      </div>

      {/* Chart */}
      <div ref={containerRef} style={{ width: "100%", height: 200 }} />

      {/* Trade UI */}
      <div style={{ padding: "12px 20px 16px" }}>
        {/* Long/Short tabs */}
        <div style={{ display: "flex", gap: 4, background: "#F9FAFB", borderRadius: 12, padding: 4, marginBottom: 10 }}>
          <button style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "none", background: GREEN, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", boxShadow: "0 2px 8px rgba(16,185,129,0.3)" }}>LONG / BUY</button>
          <button style={{ flex: 1, padding: "8px 0", borderRadius: 10, border: "1px solid #E5E7EB", background: "none", color: "#9CA3AF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>SHORT / SELL</button>
        </div>
        {/* Leverage */}
        <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
          {["5x", "10x", "20x"].map(lv => (
            <button key={lv} style={{ flex: 1, padding: "6px 0", borderRadius: 8, border: lv === "10x" ? `1px solid ${PURPLE}` : "1px solid #E5E7EB", background: lv === "10x" ? "#FFF8E1" : "none", color: lv === "10x" ? PURPLE : "#9CA3AF", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>{lv}</button>
          ))}
        </div>
        {/* TP / SL */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 10 }}>
          <div style={{ background: "#ECFDF5", border: "1px solid #A7F3D0", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 9, color: "#6B7280", marginBottom: 3 }}>Take Profit</div>
            <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: GREEN }}>69,200.00</div>
          </div>
          <div style={{ background: "#FEF2F2", border: "1px solid #FECACA", borderRadius: 10, padding: "8px 10px" }}>
            <div style={{ fontSize: 9, color: "#6B7280", marginBottom: 3 }}>Stop Loss</div>
            <div style={{ fontSize: 12, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: RED }}>66,800.00</div>
          </div>
        </div>
        {/* Execute */}
        <button style={{ width: "100%", padding: "14px 0", borderRadius: 12, border: "none", background: HERO_GRAD, color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer", boxShadow: `0 4px 20px rgba(108,71,255,0.35)` }}>
          EXECUTE — BTC/USDT LONG
        </button>
      </div>

      {/* Mini market rows */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderTop: "1px solid #F0F0F5" }}>
        {pairs.slice(0, 3).map((p, i) => (
          <div key={p.pair} style={{ padding: "10px 12px", borderRight: i < 2 ? "1px solid #F0F0F5" : "none", textAlign: "center" }}>
            <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 2 }}>{p.pair}</div>
            <div style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: p.up ? GREEN : RED, transition: "color 0.3s" }}>{fmt(p)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Dashboard mockup (shown in hero on desktop) ─────────────── */
function DashboardCard({ pairs }: { pairs: PriceData[] }) {
  const btc = pairs.find(p => p.pair === "BTC/USD");
  const eth = pairs.find(p => p.pair === "ETH/USD");
  const eur = pairs.find(p => p.pair === "EUR/USD");

  return (
    <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", border: "1px solid #E5E7EB", boxShadow: CARD_SH_LG, width: "100%", maxWidth: 360 }}>
      {/* Header */}
      <div style={{ background: "#F9FAFB", padding: "10px 14px", borderBottom: "1px solid #F0F0F5", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div style={{ width: 20, height: 20, borderRadius: 6, background: HERO_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 900, color: "#fff" }}>V</span>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#374151" }}>VIXUS — Dashboard</span>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444" }} />
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B" }} />
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }} />
        </div>
      </div>
      {/* P&L row */}
      <div style={{ padding: "12px 14px", borderBottom: "1px solid #F8F8FC", display: "flex", gap: 20 }}>
        <div>
          <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 2 }}>Portfolio Value</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#111827", fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em" }}>$24,530.75</div>
          <div style={{ fontSize: 10, color: GREEN, fontWeight: 600, marginTop: 2 }}>+4.32% today</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "#9CA3AF", marginBottom: 2 }}>Total P&L</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: GREEN, fontFamily: "'JetBrains Mono', monospace" }}>+$1,082.45</div>
        </div>
      </div>
      {/* Mini price grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", borderBottom: "1px solid #F0F0F5" }}>
        {[btc, eth, eur].map((p, i) => p && (
          <div key={p.pair} style={{ padding: "8px 10px", borderRight: i < 2 ? "1px solid #F0F0F5" : "none", textAlign: "center" }}>
            <div style={{ fontSize: 8, color: "#9CA3AF", marginBottom: 2 }}>{p.pair}</div>
            <div style={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700, color: p.up ? GREEN : RED, transition: "color 0.3s" }}>{fmt(p)}</div>
            <div style={{ fontSize: 8, color: p.up ? GREEN : RED }}>{p.up ? "▲" : "▼"} {Math.abs(p.chgPct).toFixed(2)}%</div>
          </div>
        ))}
      </div>
      {/* AI Bot row */}
      <div style={{ padding: "10px 14px", background: "linear-gradient(to right, #F3F0FF, #ECFEFF)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, display: "inline-block", animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>AI Bot Active</span>
        </div>
        <span style={{ fontSize: 10, color: "#6B7280" }}>Active bot running</span>
        <span style={{ fontSize: 10, color: GREEN, fontWeight: 700 }}>Last trade: 4s ago</span>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export default function Landing() {
  const [, setLocation] = useLocation();
  const { user, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const pairs = useLivePrices();
  const { data: landingNews, isLoading: landingNewsLoading, isError: landingNewsError, refetch: refetchLandingNews, isFetching: landingNewsFetching } = useQuery<LandingNewsResponse>({
    queryKey: ["/api/news", "landing"],
    queryFn: async () => {
      const response = await fetchWithTimeout(`${LANDING_API_BASE}/api/news`);
      if (!response.ok) throw new Error("Live market news unavailable");
      return response.json() as Promise<LandingNewsResponse>;
    },
    staleTime: 5 * 60 * 1000,
    refetchInterval: 10 * 60 * 1000,
  });

  // The in-memory token marker is present before the HttpOnly cookie has been
  // validated. Only redirect an already-known user, otherwise a public visit
  // to the landing page would bounce through the protected dashboard.
  useEffect(() => { if (!isLoading && user) setLocation("/dashboard"); }, [user, isLoading, setLocation]);
  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const handleStart = () => {
    const seen = localStorage.getItem("vixus_onboarding_seen");
    setLocation(seen ? "/register" : "/onboarding");
  };

  const liveMarkets = MARKETS.map(m => {
    const live = pairs.find(p => p.pair === m.pair);
    const hasLiveChange = live && (live.chgPct !== 0 || live.flash);
    return {
      ...m,
      live,
      chg: hasLiveChange ? `${live!.chgPct >= 0 ? "+" : ""}${live!.chgPct.toFixed(2)}%` : m.chg,
      vol: live?.volume ?? m.vol,
      up: live?.up ?? m.up,
    };
  });

  return (
    <div style={{ background: "#fff", color: "#111827", fontFamily: "'Inter Tight', Inter, system-ui, sans-serif", minHeight: "100dvh", overflowX: "hidden" }}>
      {/* ── GOOGLE FONTS ──────────────────────────────────────── */}
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700&family=Inter+Tight:wght@300;400;500;600;700;800;900&display=swap"
        rel="stylesheet"
        media="print"
        onLoad={(event) => { event.currentTarget.media = "all"; }}
      />

      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <header style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? "rgba(255,255,255,0.97)" : "#fff",
        backdropFilter: "blur(16px)",
        borderBottom: "1px solid #F0F0F5",
        boxShadow: scrolled ? "0 1px 8px rgba(0,0,0,0.06)" : "none",
        transition: "box-shadow 0.2s",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: HERO_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>V</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 16, color: "#111827", fontFamily: "'Inter Tight', sans-serif" }}>
              VIXUS
            </span>
          </div>

          {/* Desktop nav */}
          <nav style={{ display: "flex", alignItems: "center", gap: 4 }} className="hidden-mobile">
            {NAV_LINKS.map(link => (
              <a key={link.label} href={link.href}
                style={{ fontSize: 13, fontWeight: 500, color: "#6B7280", textDecoration: "none", padding: "6px 12px", borderRadius: 8, transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#111827")}
                onMouseLeave={e => (e.currentTarget.style.color = "#6B7280")}>
                {link.label}
              </a>
            ))}
          </nav>

          {/* CTA buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={() => setLocation("/login")} className="hidden-mobile"
              style={{ fontSize: 13, fontWeight: 500, color: "#6B7280", background: "none", border: "none", cursor: "pointer", padding: "8px 14px" }}>
              Log in
            </button>
            <button onClick={handleStart}
              style={{ fontSize: 13, fontWeight: 600, color: "#fff", background: HERO_GRAD, border: "none", borderRadius: 10, cursor: "pointer", padding: "9px 22px", boxShadow: `0 4px 12px rgba(108,71,255,0.35)` }}>
              Get Started
            </button>
            <button onClick={() => setMenuOpen(!menuOpen)} className="show-mobile"
              style={{ background: "none", border: "none", cursor: "pointer", color: "#6B7280", padding: 4, display: "flex", alignItems: "center" }}>
              {menuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <div style={{ borderTop: "1px solid #F0F0F5", background: "#fff", padding: "8px 16px 20px" }}>
            {NAV_LINKS.map(link => (
              <a key={link.label} href={link.href} onClick={() => setMenuOpen(false)}
                style={{ display: "block", fontSize: 14, fontWeight: 500, color: "#374151", textDecoration: "none", padding: "10px 8px", borderBottom: "1px solid #F8F8FC" }}>
                {link.label}
              </a>
            ))}
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
              <button onClick={() => { setMenuOpen(false); setLocation("/login"); }}
                style={{ padding: "11px 0", background: "none", border: "1px solid #E5E7EB", borderRadius: 10, fontSize: 14, fontWeight: 500, color: "#374151", cursor: "pointer" }}>
                Log in
              </button>
              <button onClick={() => { setMenuOpen(false); handleStart(); }}
                style={{ padding: "11px 0", background: HERO_GRAD, border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
                Get Started
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section style={{ paddingTop: 64, background: "#fff", overflow: "hidden" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 16px" }}>
          <div style={{ borderRadius: 24, overflow: "hidden", background: HERO_GRAD, minHeight: 520, display: "flex", alignItems: "center", position: "relative" }}>
            {/* decorative circles */}
            <div style={{ position: "absolute", top: 0, right: 0, width: 384, height: 384, background: "rgba(255,255,255,0.05)", borderRadius: "50%", transform: "translate(25%, -50%)", pointerEvents: "none" }} />
            <div style={{ position: "absolute", bottom: 0, left: "33%", width: 256, height: 256, background: "rgba(6,182,212,0.1)", borderRadius: "50%", transform: "translateY(50%)", pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr", gap: 32, alignItems: "center", width: "100%", padding: "48px 32px" }} className="hero-grid">
              {/* Left */}
              <div>
                {/* Badge */}
                <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", borderRadius: 100, padding: "6px 16px", marginBottom: 24 }}>
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: CYAN, display: "inline-block", animation: "pulse 1.5s infinite" }} />
                  <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "0.08em", textTransform: "uppercase" }}>AI-Powered Trading Platform</span>
                </div>

                {/* Headline */}
                <h1 style={{ fontFamily: "'Inter Tight', sans-serif", fontWeight: 900, lineHeight: 1.05, color: "#fff", marginBottom: 16 }}>
                  <span style={{ display: "block", fontSize: "clamp(36px,5vw,60px)" }}>Trade Smarter.</span>
                  <span style={{ display: "block", fontSize: "clamp(36px,5vw,60px)", color: CYAN, marginTop: 4 }}>Automate the Rest.</span>
                </h1>

                <p style={{ fontSize: "clamp(14px, 1.5vw, 18px)", color: "rgba(255,255,255,0.75)", lineHeight: 1.65, maxWidth: 480, marginBottom: 28 }}>
                  Advanced AI trading bots, real-time market data, and professional tools — all in one secure platform. Built for traders who want results, not complexity.
                </p>

                <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 20 }}>
                  <button onClick={handleStart}
                    style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 28px", background: "#fff", color: PURPLE, fontWeight: 700, fontSize: 14, borderRadius: 12, border: "none", cursor: "pointer", boxShadow: "0 4px 20px rgba(0,0,0,0.15)" }}>
                    Get Started <ArrowRight size={16} />
                  </button>
                </div>

                <p style={{ fontSize: 12, color: "rgba(255,255,255,0.4)" }}>
                  Free to start · Withdraw anytime · No hidden fees
                </p>
              </div>

              {/* Right: Dashboard card (desktop only) */}
              <div className="hero-card-desktop" style={{ display: "flex", justifyContent: "flex-end" }}>
                <DashboardCard pairs={pairs} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── LIVE TICKER ────────────────────────────────────────── */}
      <LiveTicker pairs={pairs} />

      {/* ── DASHBOARD CARD (mobile only) ────────────────────────── */}
      <section className="hero-card-mobile" style={{ padding: "20px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <DashboardCard pairs={pairs} />
      </section>

      {/* ── TRADE FROM ANYWHERE — 4-image grid (exact Base44 layout) ── */}
      <section id="trading" style={{ maxWidth: 1200, margin: "64px auto 0", padding: "0 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.1em", background: "#F3F0FF", padding: "6px 16px", borderRadius: 100, display: "inline-block" }}>Real Traders. Real Results.</span>
          <h2 style={{ fontSize: "clamp(26px,3vw,42px)", fontWeight: 800, color: "#111827", lineHeight: 1.15, marginTop: 12, marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>
            Trade from anywhere,<br />
            <span style={{ color: PURPLE }}>on any device.</span>
          </h2>
          <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 520, margin: "0 auto" }}>
            Whether you're at your desk, on the go, or running automated bots — VIXUS keeps you in control.
          </p>
        </div>

        {/* Row 1: laptop (2col) + mobile (1col) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16, marginBottom: 16 }} className="photo-grid">
          {/* img2 — laptop with trading charts — 2 cols wide */}
          <div style={{ gridColumn: "span 2", borderRadius: 16, overflow: "hidden", height: 288, position: "relative" }} className="photo-large">
            <img src={`${ASSET_BASE}images/img2.png`} alt="Laptop trading dashboard with candlestick charts"
              loading="lazy" decoding="async"
              style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.7s" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(17,24,39,0.6) 0%, transparent 55%)" }} />
            <div style={{ position: "absolute", bottom: 20, left: 20 }}>
              <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "10px 16px", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: CARD_SH }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: GREEN, display: "inline-block", animation: "pulse 1.5s infinite", flexShrink: 0 }} />
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>Live Charts · Professional Terminal</span>
              </div>
            </div>
          </div>
          {/* img3 — hand holding phone with mobile trading app — 1 col */}
          <div style={{ borderRadius: 16, overflow: "hidden", height: 288, position: "relative" }}>
            <img src={`${ASSET_BASE}images/img3.png`} alt="Mobile trading app with candlestick charts"
              loading="lazy" decoding="async"
              style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.7s" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(17,24,39,0.6) 0%, transparent 55%)" }} />
            <div style={{ position: "absolute", bottom: 20, left: 16 }}>
              <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "10px 14px", display: "inline-flex", alignItems: "center", gap: 7, boxShadow: CARD_SH }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>📱 Mobile Trading</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: woman at desk (1col) + trading floor (2col) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 16 }} className="photo-grid">
          {/* img4 — woman smiling at desk with trading laptop — 1 col */}
          <div style={{ borderRadius: 16, overflow: "hidden", height: 288, position: "relative" }}>
            <img src={`${ASSET_BASE}images/img4.png`} alt="Trader using VIXUS platform"
              loading="lazy" decoding="async"
              style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.7s" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(17,24,39,0.6) 0%, transparent 55%)" }} />
            <div style={{ position: "absolute", bottom: 20, left: 16 }}>
              <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "10px 14px", boxShadow: CARD_SH }}>
                <div style={{ fontSize: 11, color: "#6B7280", marginBottom: 2 }}>Average monthly gain</div>
                <div style={{ fontSize: 16, fontWeight: 800, color: GREEN }}>+$4,200</div>
              </div>
            </div>
          </div>
          {/* img5 — institutional trading floor with multiple monitors — 2 cols wide */}
          <div style={{ gridColumn: "span 2", borderRadius: 16, overflow: "hidden", height: 288, position: "relative" }} className="photo-large">
            <img src={`${ASSET_BASE}images/img5.png`} alt="Institutional trading floor"
              loading="lazy" decoding="async"
              style={{ width: "100%", height: "100%", objectFit: "cover", transition: "transform 0.7s" }}
              onMouseEnter={e => (e.currentTarget.style.transform = "scale(1.05)")}
              onMouseLeave={e => (e.currentTarget.style.transform = "scale(1)")} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, rgba(17,24,39,0.6) 0%, transparent 55%)" }} />
            <div style={{ position: "absolute", bottom: 20, left: 20 }}>
              <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(8px)", borderRadius: 12, padding: "10px 16px", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: CARD_SH }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>🏛️ Institutional-Grade Infrastructure</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── MARKETS TABLE ──────────────────────────────────────── */}
      <section id="markets" style={{ maxWidth: 1200, margin: "64px auto 0", padding: "0 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.1em", background: "#F3F0FF", padding: "6px 16px", borderRadius: 100, display: "inline-block" }}>Real-Time Signals</span>
          <h2 style={{ fontSize: "clamp(24px,3vw,40px)", fontWeight: 800, color: "#111827", marginTop: 12, marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Live Market Data</h2>
          <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 560, margin: "0 auto" }}>
            Forex, crypto, commodities, and indices — all tracked and signalled by the VIXUS neural engine.
          </p>
        </div>

        <div style={{ background: "#fff", borderRadius: 16, overflow: "hidden", boxShadow: CARD_SH_LG, border: "1px solid #F0F0F5" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.2fr", padding: "12px 24px", background: "#FAFAFA", borderBottom: "1px solid #F0F0F5" }}>
            {["INSTRUMENT", "24H CHANGE", "VOLUME", "CHART", "SIGNAL"].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.07em" }}>{h}</div>
            ))}
          </div>
          {/* Rows */}
          {liveMarkets.map((m, i) => (
            <div key={m.name} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.2fr", padding: "14px 24px", borderBottom: i < MARKETS.length - 1 ? "1px solid #F8F8FC" : "none", alignItems: "center", cursor: "pointer", transition: "background 0.15s" }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(0,0,0,0.015)")}
              onMouseLeave={e => (e.currentTarget.style.background = "none")}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{m.name}</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{m.full}</div>
                {m.live && <div style={{ fontSize: 10, color: "#6B7280", fontFamily: "'JetBrains Mono', monospace", marginTop: 2 }}>{fmt(m.live)}</div>}
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: m.up ? GREEN : RED, fontFamily: "'JetBrains Mono', monospace" }}>{m.chg}</div>
              <div style={{ fontSize: 12, color: "#6B7280" }}>{m.vol}</div>
              <Spark up={m.up} />
              <div>
                <span style={{ fontSize: 10, fontWeight: 700, color: m.sc, background: m.sc + "18", borderRadius: 6, padding: "4px 10px", whiteSpace: "nowrap" }}>{m.signal}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── LIVE MARKET BRIEF ──────────────────────────────────── */}
      <section id="news" className="landing-news-section" style={{ maxWidth: 1200, margin: "72px auto 0", padding: "0 16px" }}>
        <div className="landing-news-panel">
          <div className="landing-news-heading">
            <div>
              <span className="landing-news-kicker"><span className="landing-news-pulse" /> Global Market Brief</span>
              <h2>Stay ahead of<br /><span>the next move.</span></h2>
              <p>Live headlines from the world’s leading financial desks, curated for traders watching forex, stocks, commodities and crypto.</p>
            </div>
            <div className="landing-news-heading-mark"><Newspaper size={48} strokeWidth={1.2} /></div>
          </div>

          <div className="landing-news-toolbar">
            <span><span className="landing-news-live-line" /> Live sources · refreshed throughout the day</span>
            <button onClick={() => refetchLandingNews()} disabled={landingNewsFetching}>
              <RefreshCw size={13} className={landingNewsFetching ? "landing-news-spin" : ""} />
              {landingNewsFetching ? "Updating" : "Refresh brief"}
            </button>
          </div>

          {landingNewsLoading && <div className="landing-news-state">Loading the latest market brief…</div>}
          {landingNewsError && <div className="landing-news-state landing-news-error">The live brief is temporarily unavailable. Please check again shortly.</div>}
          {!landingNewsLoading && !landingNewsError && landingNews?.articles.length === 0 && (
            <div className="landing-news-state">No live stories are available right now.</div>
          )}
          {landingNews?.articles.length ? (
            <div className="landing-news-grid">
              {landingNews.articles.slice(0, 3).map((article, index) => (
                <a key={article.id} href={article.url} target="_blank" rel="noreferrer" className={`landing-news-card ${index === 0 ? "landing-news-card-featured" : ""}`}>
                  <div className="landing-news-card-meta">
                    <span>{article.category === "markets" ? "Markets" : article.category}</span>
                    <ExternalLink size={13} />
                  </div>
                  <h3>{article.title}</h3>
                  {index === 0 && article.summary && <p>{article.summary}</p>}
                  <div className="landing-news-card-footer"><span>{article.source}</span><span>{formatNewsTime(article.publishedAt)}</span></div>
                </a>
              ))}
            </div>
          ) : null}
          {landingNews?.updatedAt && <div className="landing-news-updated">Last checked {formatNewsTime(landingNews.updatedAt)} · CNBC Markets · MarketWatch · Yahoo Finance</div>}
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────── */}
      <section id="features" style={{ maxWidth: 1200, margin: "64px auto 0", padding: "0 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.1em", background: "#F3F0FF", padding: "6px 16px", borderRadius: 100, display: "inline-block" }}>Platform</span>
          <h2 style={{ fontSize: "clamp(24px,3vw,40px)", fontWeight: 800, color: "#111827", marginTop: 12, marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>What's Under the Hood</h2>
          <p style={{ fontSize: 16, color: "#6B7280", maxWidth: 480, margin: "0 auto" }}>Every feature serves a purpose. No bloat, no complexity — just tools that make you money.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }} className="features-grid">
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1px solid #F0F0F5", boxShadow: CARD_SH, transition: "all 0.3s", cursor: "default" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = CARD_SH_LG; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = CARD_SH; e.currentTarget.style.transform = "none"; }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: HERO_GRAD, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14, boxShadow: `0 4px 16px rgba(108,71,255,0.3)` }}>
                <f.icon size={22} style={{ color: "#fff" }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", marginBottom: 6, fontFamily: "'Inter Tight', sans-serif" }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: "64px auto 0", padding: "0 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 16, marginBottom: 40 }} className="stats-grid">
          {STATS.map((s, i) => (
            <div key={s.label} style={{ background: "#fff", border: "1px solid #F0F0F5", borderRadius: 16, padding: "24px 16px", boxShadow: CARD_SH, textAlign: "center" }}>
              <div style={{ fontSize: "clamp(28px,3vw,40px)", fontWeight: 900, fontFamily: "'JetBrains Mono', monospace", letterSpacing: "-0.02em", color: i % 2 === 0 ? PURPLE : "#111827", marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: "#9CA3AF" }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* Trust strip */}
        <div style={{ background: "linear-gradient(to right, #F3F0FF, #ECFEFF, #EFF6FF)", borderRadius: 16, padding: "20px 32px", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "center", gap: 24 }}>
          {[
            { icon: Lock, label: "Bank-Level Encryption" },
            { icon: ShieldCheck, label: "2FA Account Protection" },
            { icon: Activity, label: "99.9% Uptime" },
            { icon: Clock, label: "24/7 Support" },
            { icon: CheckCircle, label: "No Credit Card" },
          ].map(b => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <b.icon size={16} style={{ color: PURPLE }} />
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS + TERMINAL ────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: "64px auto 0", padding: "0 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "start" }} className="terminal-grid">
          {/* Left: steps */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.1em", background: "#F3F0FF", padding: "6px 16px", borderRadius: 100, display: "inline-block", marginBottom: 16 }}>How It Works</span>
            <h2 style={{ fontSize: "clamp(24px,2.5vw,38px)", fontWeight: 800, color: "#111827", lineHeight: 1.15, marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>
              Up and running<br /><span style={{ color: PURPLE }}>in minutes.</span>
            </h2>
            <p style={{ fontSize: 15, color: "#6B7280", marginBottom: 28, lineHeight: 1.65 }}>Three steps. No experience required.</p>

            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {STEPS.map(s => (
                <div key={s.n} style={{ background: "#fff", borderRadius: 16, padding: "18px 20px", border: "1px solid #F0F0F5", boxShadow: CARD_SH, display: "flex", alignItems: "flex-start", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: HERO_GRAD, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: `0 4px 16px rgba(108,71,255,0.3)` }}>
                    <span style={{ fontSize: 14, fontWeight: 900, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>{s.n}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, fontWeight: 600, color: PURPLE, background: "#F3F0FF", borderRadius: 6, padding: "2px 8px", display: "inline-block", marginBottom: 5 }}>{s.tag}</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 4, fontFamily: "'Inter Tight', sans-serif" }}>{s.title}</div>
                    <div style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.6 }}>{s.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Terminal */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.1em", background: "#F3F0FF", padding: "6px 16px", borderRadius: 100, display: "inline-block", marginBottom: 16 }}>Live Charts · Professional Terminal</span>
            <h2 style={{ fontSize: "clamp(24px,2.5vw,38px)", fontWeight: 800, color: "#111827", lineHeight: 1.15, marginBottom: 24, fontFamily: "'Inter Tight', sans-serif" }}>
              One interface.<br /><span style={{ color: PURPLE }}>Total control.</span>
            </h2>
            <TerminalCard pairs={pairs} />
          </div>
        </div>
      </section>

      {/* ── SECURITY SECTION ──────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: "64px auto 0", padding: "0 16px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 40, alignItems: "center" }} className="security-grid">
          {/* Left: security card — img1 as photo background */}
          <div style={{ borderRadius: 24, overflow: "hidden", height: 320, position: "relative", padding: 28, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <img src={`${ASSET_BASE}images/img1.png`} alt="Institutional trading infrastructure"
              loading="lazy" decoding="async"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
            <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, rgba(245,185,66,0.92) 0%, rgba(17,17,17,0.9) 52%, rgba(59,130,246,0.82) 100%)" }} />
            <div style={{ position: "absolute", top: 0, right: 0, width: 200, height: 200, background: "rgba(255,255,255,0.05)", borderRadius: "50%", transform: "translate(30%, -30%)", pointerEvents: "none" }} />
            <div>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "rgba(52,211,153,0.2)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: 100, padding: "4px 12px", marginBottom: 16 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#34D399", display: "inline-block", animation: "pulse 1.5s infinite" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#6EE7B7" }}>Real-time threat monitoring active</span>
              </div>
              <div style={{ fontSize: 22, fontWeight: 800, color: "#fff", lineHeight: 1.2, fontFamily: "'Inter Tight', sans-serif" }}>Account Security<br /><span style={{ color: "rgba(255,255,255,0.6)", fontSize: 16, fontWeight: 400 }}>Enterprise-grade protection</span></div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Encryption",       pct: 100 },
                { label: "Authentication",   pct: 100 },
                { label: "Fund Segregation", pct: 98  },
                { label: "System Uptime",    pct: 100 },
              ].map(b => (
                <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 12, background: "rgba(255,255,255,0.1)", backdropFilter: "blur(8px)", borderRadius: 10, padding: "8px 12px" }}>
                  <span style={{ fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.85)", flex: 1 }}>{b.label}</span>
                  <div style={{ width: 64, height: 5, background: "rgba(255,255,255,0.2)", borderRadius: 3, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${b.pct}%`, background: "linear-gradient(to right, #F5B942, #3B82F6)", borderRadius: 3 }} />
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", width: 32, textAlign: "right" }}>{b.pct}%</span>
                </div>
              ))}
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 12px" }}>
                <CheckCircle size={14} style={{ color: "#A7F3D0" }} />
                <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>✓ All Systems Secure</span>
              </div>
            </div>
          </div>

          {/* Right: text */}
          <div>
            <span style={{ fontSize: 12, fontWeight: 600, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.1em", background: "#F3F0FF", padding: "6px 16px", borderRadius: 100, display: "inline-block", marginBottom: 16 }}>Security</span>
            <h2 style={{ fontSize: "clamp(24px,2.5vw,38px)", fontWeight: 800, color: "#111827", lineHeight: 1.15, marginBottom: 12, fontFamily: "'Inter Tight', sans-serif" }}>
              Your funds are safe.<br /><span style={{ color: PURPLE }}>Always.</span>
            </h2>
            <p style={{ fontSize: 15, color: "#6B7280", lineHeight: 1.75, marginBottom: 24 }}>
              Enterprise-grade security baked into every layer of the platform. We treat your capital the way institutional desks do.
            </p>
            {[
              { icon: Lock,       title: "256-bit AES encryption",  sub: "All data encrypted in transit and at rest" },
              { icon: ShieldCheck,title: "2FA on every account",    sub: "Multi-layer authentication by default" },
              { icon: Clock,      title: "Full trade audit trail",  sub: "Every order timestamped and logged" },
            ].map(item => (
              <div key={item.title} style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#F3F0FF", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <item.icon size={18} style={{ color: PURPLE }} />
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{item.title}</div>
                  <div style={{ fontSize: 12, color: "#9CA3AF" }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ──────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: "64px auto 0", padding: "0 16px" }}>
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: PURPLE, textTransform: "uppercase", letterSpacing: "0.1em", background: "#F3F0FF", padding: "6px 16px", borderRadius: 100, display: "inline-block" }}>Testimonials</span>
          <h2 style={{ fontSize: "clamp(24px,3vw,40px)", fontWeight: 800, color: "#111827", marginTop: 12, marginBottom: 8, fontFamily: "'Inter Tight', sans-serif" }}>Real Traders. Real Results.</h2>
          <p style={{ fontSize: 16, color: "#6B7280" }}>No marketing speak.</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 20 }} className="testimonials-grid">
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: "#fff", borderRadius: 16, padding: "22px 20px", border: "1px solid #F0F0F5", boxShadow: CARD_SH, display: "flex", flexDirection: "column", transition: "all 0.3s" }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = CARD_SH_LG; }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = CARD_SH; }}>
              <div style={{ display: "flex", gap: 2, marginBottom: 12 }}>
                {[1,2,3,4,5].map(i => <Star key={i} size={14} style={{ color: "#F59E0B", fill: "#F59E0B" }} />)}
              </div>
              <p style={{ fontSize: 14, color: "#374151", lineHeight: 1.7, marginBottom: 18, flex: 1 }}>"{t.quote}"</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: t.color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>{t.init}</span>
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#9CA3AF" }}>{t.loc}</div>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 600, color: GREEN, background: "#ECFDF5", borderRadius: 6, padding: "3px 8px", whiteSpace: "nowrap" }}>{t.stat}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── BOTTOM CTA ─────────────────────────────────────────── */}
      <section style={{ maxWidth: 1200, margin: "64px auto 0", padding: "0 16px 64px" }}>
        <div style={{ borderRadius: 24, overflow: "hidden", background: HERO_GRAD, padding: "64px 32px", textAlign: "center", position: "relative" }}>
          <div style={{ position: "absolute", top: 0, right: 0, width: 320, height: 320, background: "rgba(255,255,255,0.05)", borderRadius: "50%", transform: "translate(25%, -25%)", pointerEvents: "none" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.12)", backdropFilter: "blur(8px)", borderRadius: 100, padding: "6px 16px", marginBottom: 24 }}>
              <div style={{ width: 8, height: 8, borderRadius: 8, background: HERO_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 6, fontWeight: 900, color: "#fff" }}>V</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.9)", letterSpacing: "0.08em", textTransform: "uppercase" }}>128,400+ Traders Active</span>
            </div>
            <h2 style={{ fontSize: "clamp(28px,4vw,52px)", fontWeight: 900, color: "#fff", lineHeight: 1.1, marginBottom: 14, fontFamily: "'Inter Tight', sans-serif" }}>
              Your capital deserves<br />
              <span style={{ color: CYAN }}>to work harder.</span>
            </h2>
            <p style={{ fontSize: 16, color: "rgba(255,255,255,0.7)", marginBottom: 32, maxWidth: 480, margin: "0 auto 32px" }}>
              Join traders who stopped watching charts and started letting the bots handle it.
            </p>
            <div style={{ display: "flex", justifyContent: "center", flexWrap: "wrap", gap: 12 }}>
              <button onClick={handleStart}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 36px", background: "#fff", color: PURPLE, fontWeight: 700, fontSize: 15, borderRadius: 12, border: "none", cursor: "pointer", boxShadow: "0 4px 24px rgba(0,0,0,0.2)" }}>
                Open Free Account <ArrowRight size={17} />
              </button>
              <button onClick={() => setLocation("/login")}
                style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "16px 36px", background: "rgba(255,255,255,0.12)", color: "#fff", fontWeight: 600, fontSize: 15, borderRadius: 12, border: "1px solid rgba(255,255,255,0.2)", cursor: "pointer", backdropFilter: "blur(8px)" }}>
                View Platform
              </button>
            </div>
            <p style={{ marginTop: 20, fontSize: 12, color: "rgba(255,255,255,0.4)" }}>No credit card · Fast registration · Secured &amp; Trusted</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer id="company" style={{ background: "#0D0F1E", color: "#fff" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "56px 24px 0" }}>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1.5fr", gap: 32, marginBottom: 40 }} className="footer-grid">
            {/* Brand */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: HERO_GRAD, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>V</span>
                </div>
                <span style={{ fontWeight: 800, fontSize: 16, color: "#fff", fontFamily: "'Inter Tight', sans-serif" }}>VIXUS</span>
              </div>
              <p style={{ fontSize: 13, color: "#6B7280", lineHeight: 1.7, maxWidth: 240, marginBottom: 20 }}>
                Institutional-grade AI trading for everyone. Automate your strategy across 11+ markets.
              </p>
              <div style={{ display: "flex", gap: 8 }}>
                {[Globe, X, TrendingUp, Bot].map((Icon, i) => (
                  <div key={i} style={{ width: 32, height: 32, borderRadius: 8, background: "#1E2235", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "background 0.15s" }}
                    onMouseEnter={e => (e.currentTarget.style.background = "#2D3148")}
                    onMouseLeave={e => (e.currentTarget.style.background = "#1E2235")}>
                    <Icon size={14} style={{ color: "#6B7280" }} />
                  </div>
                ))}
              </div>
            </div>

            {/* Product */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>PRODUCT</div>
              {["Markets", "Trading", "AI Signals", "Portfolio", "Analytics"].map(l => (
                <div key={l} style={{ fontSize: 13, color: "#9CA3AF", marginBottom: 10, cursor: "pointer", transition: "color 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}>{l}</div>
              ))}
            </div>

            {/* Company */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>COMPANY</div>
              {[["About Us", "/about"], ["Contact", "/contact"]].map(([l, href]) => (
                <a key={l} href={href} style={{ display: "block", fontSize: 13, color: "#9CA3AF", marginBottom: 10, cursor: "pointer", transition: "color 0.15s", textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}>{l}</a>
              ))}
            </div>

            {/* Legal */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 16 }}>LEGAL</div>
              {[["Terms of Service", "/legal/terms"], ["Privacy Policy", "/legal/privacy"]].map(([l, href]) => (
                <a key={l} href={href} style={{ display: "block", fontSize: 13, color: "#9CA3AF", marginBottom: 10, cursor: "pointer", transition: "color 0.15s", textDecoration: "none" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}>{l}</a>
              ))}
            </div>

            {/* Newsletter */}
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#4B5563", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>NEWSLETTER</div>
              <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14, lineHeight: 1.6 }}>Market insights delivered weekly.</p>
              <div style={{ display: "flex", borderRadius: 10, overflow: "hidden", border: "1px solid #2D3148" }}>
                <input type="email" placeholder="Email..." style={{ flex: 1, background: "#1E2235", border: "none", outline: "none", padding: "11px 14px", fontSize: 13, color: "#fff" }} />
                <button style={{ background: HERO_GRAD, border: "none", padding: "0 16px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <ChevronRight size={16} style={{ color: "#fff" }} />
                </button>
              </div>
            </div>
          </div>

          <div style={{ borderTop: "1px solid #1E2235", padding: "20px 0 28px", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
            <p style={{ fontSize: 12, color: "#374151" }}>© 2026 VIXUS. All rights reserved.</p>
            <p style={{ fontSize: 11, color: "#2D3148", maxWidth: 500, lineHeight: 1.6, textAlign: "right" }}>Trading involves significant risk. Past performance is not indicative of future results. Capital at risk.</p>
          </div>
        </div>
      </footer>

      <style>{`
        .landing-news-panel {
          position: relative; overflow: hidden; border-radius: 26px; padding: 42px 42px 30px;
          color: #fff; background: radial-gradient(circle at 100% 0%, rgba(59,130,246,.16), transparent 32%), linear-gradient(135deg, #17130A, #090A0B 70%);
          border: 1px solid rgba(245,185,66,.28); box-shadow: 0 20px 70px rgba(9,10,11,.16);
        }
        .landing-news-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 24px; }
        .landing-news-kicker { display: inline-flex; align-items: center; gap: 8px; color: #FFD86B; font-size: 11px; font-weight: 800; letter-spacing: .13em; text-transform: uppercase; }
        .landing-news-pulse { width: 7px; height: 7px; border-radius: 50%; background: #F5B942; box-shadow: 0 0 14px #F5B942; animation: pulse 1.6s infinite; }
        .landing-news-heading h2 { margin: 15px 0 10px; font-size: clamp(28px, 4vw, 48px); line-height: .98; letter-spacing: -.055em; font-weight: 900; }
        .landing-news-heading h2 span { color: #F5B942; }
        .landing-news-heading p { max-width: 570px; margin: 0; color: #B9B2A2; font-size: 14px; line-height: 1.65; }
        .landing-news-heading-mark { display: flex; align-items: center; justify-content: center; width: 88px; height: 88px; flex: 0 0 88px; color: #F5B942; border: 1px solid rgba(245,185,66,.26); border-radius: 24px; background: rgba(245,185,66,.08); transform: rotate(7deg); }
        .landing-news-toolbar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin: 30px 0 14px; padding-top: 18px; border-top: 1px solid rgba(245,185,66,.15); color: #8F897C; font-size: 10px; letter-spacing: .08em; text-transform: uppercase; font-weight: 700; }
        .landing-news-live-line { display: inline-block; width: 6px; height: 6px; margin-right: 6px; border-radius: 50%; background: #3B82F6; box-shadow: 0 0 10px rgba(59,130,246,.8); }
        .landing-news-toolbar button { display: inline-flex; align-items: center; gap: 6px; border: 1px solid rgba(245,185,66,.3); border-radius: 9px; padding: 8px 11px; color: #FFD86B; background: rgba(245,185,66,.08); font-size: 10px; font-weight: 800; cursor: pointer; }
        .landing-news-toolbar button:disabled { opacity: .6; cursor: wait; }
        .landing-news-grid { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 12px; }
        .landing-news-card { min-height: 175px; display: flex; flex-direction: column; padding: 18px; color: #fff; text-decoration: none; border: 1px solid rgba(255,255,255,.1); border-radius: 16px; background: rgba(255,255,255,.045); transition: transform .2s, border-color .2s, background .2s; }
        .landing-news-card:hover { transform: translateY(-3px); border-color: rgba(245,185,66,.65); background: rgba(245,185,66,.08); }
        .landing-news-card-featured { background: linear-gradient(145deg, rgba(245,185,66,.16), rgba(255,255,255,.04)); border-color: rgba(245,185,66,.36); }
        .landing-news-card-meta, .landing-news-card-footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: #CBAE68; font-size: 9px; letter-spacing: .08em; font-weight: 800; text-transform: uppercase; }
        .landing-news-card-meta svg { color: #3B82F6; }
        .landing-news-card h3 { margin: 14px 0 8px; font-size: 16px; line-height: 1.25; letter-spacing: -.025em; }
        .landing-news-card p { margin: 0; color: #AAA59A; font-size: 12px; line-height: 1.55; }
        .landing-news-card-footer { margin-top: auto; padding-top: 18px; color: #777267; font-size: 9px; letter-spacing: .04em; text-transform: none; }
        .landing-news-card-footer span:first-child { color: #CBAE68; }
        .landing-news-state { padding: 30px; text-align: center; color: #A5A095; border: 1px dashed rgba(245,185,66,.22); border-radius: 14px; }
        .landing-news-error { color: #8DB7F4; border-color: rgba(59,130,246,.32); }
        .landing-news-updated { margin-top: 18px; color: #6F6B61; font-size: 9px; }
        .landing-news-spin { animation: landing-news-spin 1s linear infinite; }
        @keyframes landing-news-spin { to { transform: rotate(360deg); } }
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes pulse  { 0%,100% { opacity:1 } 50% { opacity:0.35 } }
        * { box-sizing: border-box; margin: 0; }
        input::placeholder { color: #4B5270; }
        button { transition: opacity 0.15s, transform 0.12s; }
        button:active { transform: scale(0.97); }
        a { transition: color 0.15s; }

        /* Desktop grid helpers */
        .hero-grid { grid-template-columns: 1fr 1fr !important; }
        .hero-card-desktop { display: flex !important; }
        .hero-card-mobile { display: none !important; }
        .hidden-mobile { display: flex !important; }
        .show-mobile { display: none !important; }

        @media (max-width: 900px) {
          .hero-grid { grid-template-columns: 1fr !important; }
          .hero-card-desktop { display: none !important; }
          .hero-card-mobile { display: block !important; }
          .photo-grid { grid-template-columns: 1fr !important; }
          .photo-large { grid-column: span 1 !important; }
          .features-grid { grid-template-columns: 1fr 1fr !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .terminal-grid { grid-template-columns: 1fr !important; }
          .security-grid { grid-template-columns: 1fr !important; }
          .testimonials-grid { grid-template-columns: 1fr !important; }
          .footer-grid { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 640px) {
          .hidden-mobile { display: none !important; }
          .show-mobile { display: flex !important; }
          .features-grid { grid-template-columns: 1fr !important; }
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .landing-news-panel { padding: 28px 18px 20px; border-radius: 20px; }
          .landing-news-heading-mark { width: 58px; height: 58px; flex-basis: 58px; border-radius: 17px; }
          .landing-news-heading-mark svg { width: 30px; height: 30px; }
          .landing-news-toolbar { align-items: flex-start; flex-direction: column; }
          .landing-news-grid { grid-template-columns: 1fr; }
          .landing-news-card { min-height: 145px; }
        }
      `}</style>
    </div>
  );
}
