import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import {
  ShieldCheck, Lock, Zap, Star, ArrowRight,
  Globe, Clock, TrendingUp, Bot, Cpu, BarChart2,
  Menu, X, Activity, CheckCircle2,
} from "lucide-react";
import { createChart, ColorType, CrosshairMode, CandlestickSeries } from "lightweight-charts";

/* ─── Design tokens ─────────────────────────────────────────── */
const WHITE       = "#FFFFFF";
const BG          = "#F5F5FA";
const PURPLE      = "#6D4AFF";
const PURPLE_DARK = "#5538DD";
const CYAN        = "#06C8F0";
const DARK        = "#0D0F1E";
const DARK2       = "#161829";
const TEXT        = "#1A1A2E";
const TEXT2       = "#64748B";
const TEXT3       = "#94A3B8";
const GREEN       = "#10B981";
const RED         = "#EF4444";
const GOLD        = "#F59E0B";
const CARD_SHADOW = "0 2px 20px rgba(0,0,0,0.07)";

/* ─── Static data ────────────────────────────────────────────── */
const NAV_LINKS = ["Markets", "Trading", "Features", "Pricing"];

const FEATURES = [
  { icon: Zap,         title: "Sub-ms Execution",    desc: "Orders filled in microseconds across all 11 markets. No requotes, no slippage." },
  { icon: Activity,    title: "Live P&L Tracking",   desc: "Every open trade visible in real time. Watch your portfolio move tick by tick." },
  { icon: ShieldCheck, title: "Hard Risk Limits",    desc: "Set max drawdown per bot. Positions close automatically — your capital stays protected." },
  { icon: Globe,       title: "11 Markets Covered",  desc: "Forex, crypto, commodities, and indices. One platform, all automated." },
];

const STEPS = [
  { n: "01", title: "Fund your account",  desc: "Deposit via bank transfer, card, or crypto. Funds reflect in under two minutes.", tag: "Instant funding" },
  { n: "02", title: "Choose your bot",    desc: "Browse AI strategies by risk profile, asset class, and verified track record.", tag: "11 bots available" },
  { n: "03", title: "Let it trade",       desc: "The bot runs 24/7. You get real-time P&L, full trade logs, and one-click withdrawals.", tag: "24/7 automation" },
];

const TESTIMONIALS = [
  {
    name: "Marcus T.", loc: "Austin, TX", init: "M",
    quote: "Setup took five minutes. Dashboard is clean, withdrawals hit same day. I've tried four platforms — this one I actually stuck with. No requotes, no slippage surprises.",
    stat: "+$4,200 first month",
  },
  {
    name: "James K.", loc: "Dallas, TX", init: "J",
    quote: "I trade my own account too, so I know what fast execution looks like. These bots fill at the right price — no requotes, no surprise slippage surprises.",
    stat: "5 years trading exp.",
  },
  {
    name: "Danielle R.", loc: "Chicago, IL", init: "D",
    quote: "The risk controls are what sold me. I set a 5% drawdown cap and it has never been breached. Everything is upfront.",
    stat: "Consistent since month 1",
  },
];

const MARKETS = [
  { name: "BTC",    full: "Bitcoin",       signal: "STRONG BUY", sig_color: "#10B981", chg: "+2.34%",  up: true  },
  { name: "ETH",    full: "Ethereum",      signal: "BUY",        sig_color: "#10B981", chg: "+1.82%",  up: true  },
  { name: "SOL",    full: "Solana",        signal: "NEUTRAL",    sig_color: "#F59E0B", chg: "-0.41%",  up: false },
  { name: "XAU",    full: "Gold",          signal: "BUY",        sig_color: "#10B981", chg: "+0.67%",  up: true  },
  { name: "EUR",    full: "EUR/USD",       signal: "NEUTRAL",    sig_color: "#F59E0B", chg: "-0.12%",  up: false },
  { name: "GBP",    full: "GBP/USD",       signal: "BUY",        sig_color: "#10B981", chg: "+0.33%",  up: true  },
];

const STATS = [
  { value: "$482M+", label: "Volume Traded" },
  { value: "128K+",  label: "Active Traders" },
  { value: "11",     label: "Markets Covered" },
  { value: "99.9%",  label: "Uptime" },
];

/* ─── Live prices hook ───────────────────────────────────────── */
type PriceData = {
  pair: string; symbol: string; price: number; prev: number;
  chg: number; chgPct: number; up: boolean; flash: boolean;
};

const INITIAL_PAIRS: PriceData[] = [
  { pair: "BTC/USD",  symbol: "BTCUSDT",  price: 67812.5,  prev: 67812.5,  chg: 0, chgPct: 0, up: true,  flash: false },
  { pair: "ETH/USD",  symbol: "ETHUSDT",  price: 3412.8,   prev: 3412.8,   chg: 0, chgPct: 0, up: true,  flash: false },
  { pair: "EUR/USD",  symbol: "",          price: 1.0847,   prev: 1.0847,   chg: 0, chgPct: 0, up: true,  flash: false },
  { pair: "GBP/USD",  symbol: "",          price: 1.2703,   prev: 1.2703,   chg: 0, chgPct: 0, up: true,  flash: false },
  { pair: "USD/JPY",  symbol: "",          price: 157.42,   prev: 157.42,   chg: 0, chgPct: 0, up: false, flash: false },
  { pair: "XAU/USD",  symbol: "XAUUSDT",  price: 2341.5,   prev: 2341.5,   chg: 0, chgPct: 0, up: true,  flash: false },
  { pair: "AUD/USD",  symbol: "",          price: 0.6548,   prev: 0.6548,   chg: 0, chgPct: 0, up: true,  flash: false },
  { pair: "USD/CHF",  symbol: "",          price: 0.9071,   prev: 0.9071,   chg: 0, chgPct: 0, up: false, flash: false },
  { pair: "NAS100",   symbol: "BNBUSDT",  price: 18942.0,  prev: 18942.0,  chg: 0, chgPct: 0, up: true,  flash: false },
  { pair: "ETH/BTC",  symbol: "ETHBTC",   price: 0.0503,   prev: 0.0503,   chg: 0, chgPct: 0, up: true,  flash: false },
];

function useLivePrices() {
  const [pairs, setPairs] = useState<PriceData[]>(INITIAL_PAIRS);

  const updatePrice = useCallback((symbol: string, newPrice: number) => {
    setPairs(prev => prev.map(p => {
      if (p.symbol !== symbol) return p;
      const chg = newPrice - p.prev;
      const chgPct = (chg / p.prev) * 100;
      return { ...p, prev: p.price, price: newPrice, chg, chgPct, up: newPrice >= p.prev, flash: true };
    }));
    setTimeout(() => {
      setPairs(prev => prev.map(p => p.symbol === symbol ? { ...p, flash: false } : p));
    }, 600);
  }, []);

  useEffect(() => {
    const sim = setInterval(() => {
      setPairs(prev => prev.map(p => {
        const volatility = p.price > 10000 ? 0.0003 : p.price > 100 ? 0.0002 : 0.00015;
        const drift = (Math.random() - 0.49) * volatility;
        const newPrice = +(p.price * (1 + drift)).toFixed(p.price > 100 ? 2 : 5);
        const chg = newPrice - p.prev;
        const chgPct = (chg / p.prev) * 100;
        return { ...p, prev: p.price, price: newPrice, chg, chgPct, up: newPrice >= p.prev, flash: true };
      }));
      setTimeout(() => setPairs(prev => prev.map(p => ({ ...p, flash: false }))), 400);
    }, 2000);
    return () => clearInterval(sim);
  }, []);

  useEffect(() => {
    const symbols = ["btcusdt", "ethusdt", "xauusdt", "ethbtc"];
    const streams = symbols.map(s => `${s}@miniTicker`).join("/");
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    let attempts = 0;
    const connect = () => {
      if (attempts > 3) return;
      attempts++;
      try {
        ws = new WebSocket(`wss://stream.binance.com:9443/stream?streams=${streams}`);
        ws.onopen = () => { attempts = 0; };
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            const d = msg.data;
            if (!d || !d.s || !d.c) return;
            updatePrice(d.s, parseFloat(d.c));
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
    const fetchFX = async () => {
      let rates: Record<string, number> | null = null;
      try {
        const r = await fetch("https://open.er-api.com/v6/latest/USD");
        const data = await r.json();
        if (data.result === "success") rates = data.rates;
      } catch {}
      if (!rates) {
        try {
          const r = await fetch("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,AUD");
          const data = await r.json();
          rates = data.rates;
        } catch {}
      }
      if (!rates) return;
      setPairs(prev => prev.map(p => {
        let newPrice: number | null = null;
        if (p.pair === "EUR/USD" && rates!.EUR) newPrice = +(1 / rates!.EUR).toFixed(5);
        if (p.pair === "GBP/USD" && rates!.GBP) newPrice = +(1 / rates!.GBP).toFixed(5);
        if (p.pair === "USD/JPY" && rates!.JPY) newPrice = +rates!.JPY.toFixed(3);
        if (p.pair === "AUD/USD" && rates!.AUD) newPrice = +(1 / rates!.AUD).toFixed(5);
        if (p.pair === "USD/CHF" && rates!.CHF) newPrice = +rates!.CHF.toFixed(5);
        if (newPrice === null) return p;
        const chg = newPrice - p.prev;
        const chgPct = p.prev ? (chg / p.prev) * 100 : 0;
        return { ...p, prev: p.price, price: newPrice, chg, chgPct, up: newPrice >= p.prev };
      }));
    };
    fetchFX();
    const fxInterval = setInterval(fetchFX, 60000);
    return () => clearInterval(fxInterval);
  }, []);

  return pairs;
}

function formatPrice(pair: PriceData): string {
  const p = pair.price;
  if (p > 10000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p > 100) return p.toFixed(2);
  if (p > 1) return p.toFixed(4);
  return p.toFixed(5);
}

/* ─── Live ticker strip ──────────────────────────────────────── */
function LiveTicker({ pairs }: { pairs: PriceData[] }) {
  const items = [...pairs, ...pairs];
  return (
    <div style={{ background: WHITE, borderBottom: "1px solid #E8E8F0", overflow: "hidden", padding: "8px 0" }}>
      <div className="flex whitespace-nowrap" style={{ animation: "ticker 40s linear infinite" }}>
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-2 px-5 shrink-0" style={{ borderRight: "1px solid #E8E8F0" }}>
            <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: TEXT2 }}>{t.pair}</span>
            <span style={{ fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: t.flash ? (t.up ? GREEN : RED) : TEXT, transition: "color 0.3s" }}>
              {formatPrice(t)}
            </span>
            <span style={{ fontSize: 11, fontFamily: "monospace", color: t.up ? GREEN : RED }}>
              {t.up ? "▲" : "▼"} {Math.abs(t.chgPct).toFixed(2)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Candlestick chart (reused in terminal section) ─────────── */
function CandlestickChart({ height = 200, darkBg = false }: { height?: number; darkBg?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<any>(null);
  const [btcPrice, setBtcPrice] = useState("67,842.30");
  const [btcChg, setBtcChg] = useState("+2.34%");
  const [btcUp, setBtcUp] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: darkBg ? "#64748B" : "#94A3B8",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: darkBg ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
        horzLines: { color: darkBg ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: darkBg ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", visible: true },
      timeScale: { borderColor: darkBg ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)", timeVisible: true, secondsVisible: false },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;
    const series = chart.addSeries(CandlestickSeries, {
      upColor: GREEN, downColor: RED,
      borderUpColor: GREEN, borderDownColor: RED,
      wickUpColor: GREEN, wickDownColor: RED,
    });
    seriesRef.current = series;

    const genFallback = (base: number, count: number) => {
      const now = Math.floor(Date.now() / 1000);
      let price = base;
      return Array.from({ length: count }, (_, i) => {
        const open = price;
        const move = (Math.random() - 0.48) * price * 0.004;
        const close = +(open + move).toFixed(2);
        const high = +(Math.max(open, close) * (1 + Math.random() * 0.003)).toFixed(2);
        const low  = +(Math.min(open, close) * (1 - Math.random() * 0.003)).toFixed(2);
        price = close;
        return { time: (now - (count - i) * 300) as any, open, high, low, close };
      });
    };

    const load = async () => {
      try {
        const r = await fetch("https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=5m&limit=60");
        const data: any[] = await r.json();
        const candles = data.map((k: any) => ({
          time: Math.floor(k[0] / 1000) as any,
          open: parseFloat(k[1]), high: parseFloat(k[2]),
          low: parseFloat(k[3]), close: parseFloat(k[4]),
        }));
        series.setData(candles);
        chart.timeScale().fitContent();
        const last = candles[candles.length - 1];
        setBtcPrice(last.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        const pct = ((last.close - candles[0].open) / candles[0].open) * 100;
        setBtcChg(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`);
        setBtcUp(pct >= 0);
        return;
      } catch {}
      try {
        const r = await fetch("https://api.coingecko.com/api/v3/coins/bitcoin/ohlc?vs_currency=usd&days=1");
        const data: any[] = await r.json();
        const candles = data.slice(-60).map((k: any) => ({
          time: Math.floor(k[0] / 1000) as any,
          open: k[1], high: k[2], low: k[3], close: k[4],
        }));
        series.setData(candles);
        chart.timeScale().fitContent();
        const last = candles[candles.length - 1];
        setBtcPrice(last.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        const pct = ((last.close - candles[0].open) / candles[0].open) * 100;
        setBtcChg(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`);
        setBtcUp(pct >= 0);
        return;
      } catch {}
      const candles = genFallback(67800, 60);
      series.setData(candles);
      chart.timeScale().fitContent();
    };
    load();

    let wsKline: WebSocket | null = null;
    try {
      wsKline = new WebSocket("wss://stream.binance.com:9443/ws/btcusdt@kline_5m");
      wsKline.onmessage = (e) => {
        try {
          const { k } = JSON.parse(e.data);
          const candle = { time: Math.floor(k.t / 1000) as any, open: parseFloat(k.o), high: parseFloat(k.h), low: parseFloat(k.l), close: parseFloat(k.c) };
          seriesRef.current?.update(candle);
          const p = parseFloat(k.c), o = parseFloat(k.o);
          const pct = ((p - o) / o) * 100;
          setBtcPrice(p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
          setBtcChg(`${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%`);
          setBtcUp(pct >= 0);
        } catch {}
      };
      wsKline.onerror = () => {};
    } catch {}

    const simKline = setInterval(() => {
      if (wsKline?.readyState === 1) return;
      const now = Math.floor(Date.now() / 1000);
      const base = Math.floor(now / 300) * 300;
      setBtcPrice(prev => {
        const num = parseFloat(prev.replace(/,/g, ""));
        if (!num) return prev;
        const move = (Math.random() - 0.48) * num * 0.001;
        const next = +(num + move).toFixed(2);
        seriesRef.current?.update({ time: base as any, open: num, high: Math.max(num, next) * 1.001, low: Math.min(num, next) * 0.999, close: next });
        return next.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      });
    }, 3000);

    const handleResize = () => {
      if (containerRef.current) {
        chart.applyOptions({ width: containerRef.current.clientWidth, height: containerRef.current.clientHeight });
      }
    };
    window.addEventListener("resize", handleResize);
    return () => {
      wsKline?.close();
      clearInterval(simKline);
      chart.remove();
      window.removeEventListener("resize", handleResize);
    };
  }, [darkBg]);

  return { containerRef, btcPrice, btcChg, btcUp };
}

function CandlestickSection({ pairs }: { pairs: PriceData[] }) {
  const { containerRef, btcPrice, btcChg, btcUp } = CandlestickChart({ height: 180, darkBg: true });

  return (
    <div style={{ background: "linear-gradient(135deg, #1a0a4e 0%, #0d0f2e 50%, #0a1830 100%)", borderRadius: 20, padding: "20px", border: "1px solid rgba(109,74,255,0.25)", boxShadow: "0 20px 60px rgba(0,0,0,0.4)" }}>
      {/* Terminal header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", gap: 5 }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
        </div>
        <div style={{ fontSize: 9, fontFamily: "monospace", color: "#475569" }}>VIXUS TERMINAL v4.2.1</div>
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <div style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 9, fontFamily: "monospace", color: GREEN }}>LIVE</span>
        </div>
      </div>

      {/* Pair header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#F1F5F9", fontFamily: "monospace" }}>BTC/USDT</span>
          <span style={{ fontSize: 9, color: "#475569", background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4, marginLeft: 6 }}>5m</span>
        </div>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: btcUp ? GREEN : RED }}>{btcPrice}</div>
          <div style={{ fontSize: 10, color: btcUp ? GREEN : RED, fontFamily: "monospace" }}>{btcChg}</div>
        </div>
      </div>

      {/* Chart */}
      <div ref={containerRef} style={{ width: "100%", height: 180, borderRadius: 8, overflow: "hidden" }} />

      {/* Trade UI */}
      <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <button style={{ background: "rgba(109,74,255,0.15)", border: "1px solid rgba(109,74,255,0.4)", borderRadius: 8, padding: "6px 0", fontSize: 11, fontWeight: 600, color: "#A78BFA", cursor: "pointer" }}>Market</button>
        <button style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, padding: "6px 0", fontSize: 11, fontWeight: 600, color: "#64748B", cursor: "pointer" }}>Limit</button>
      </div>
      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
        {["5x", "10x", "20x"].map(lv => (
          <button key={lv} style={{ background: lv === "10x" ? "rgba(109,74,255,0.25)" : "rgba(255,255,255,0.04)", border: lv === "10x" ? "1px solid rgba(109,74,255,0.5)" : "1px solid rgba(255,255,255,0.06)", borderRadius: 6, padding: "5px 0", fontSize: 10, fontWeight: 700, color: lv === "10x" ? "#A78BFA" : "#64748B", cursor: "pointer" }}>{lv}</button>
        ))}
      </div>
      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#475569", marginBottom: 3 }}>Take Profit</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: GREEN }}>69,500.00</div>
        </div>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 8, padding: "8px 10px" }}>
          <div style={{ fontSize: 9, color: "#475569", marginBottom: 3 }}>Stop Loss</div>
          <div style={{ fontSize: 11, fontFamily: "monospace", color: RED }}>66,200.00</div>
        </div>
      </div>
      <button style={{ marginTop: 8, width: "100%", background: `linear-gradient(135deg, ${PURPLE}, #4F46E5)`, border: "none", borderRadius: 10, padding: "11px 0", fontSize: 12, fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 20px rgba(109,74,255,0.4)" }}>
        EXECUTE · BTC/USDT LONG
      </button>

      {/* Mini market rows */}
      <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4 }}>
        {pairs.slice(0, 3).map(p => (
          <div key={p.pair} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "5px 6px", border: "1px solid rgba(255,255,255,0.05)" }}>
            <div style={{ fontSize: 8, color: "#475569", marginBottom: 2 }}>{p.pair}</div>
            <div style={{ fontSize: 9, fontFamily: "monospace", color: p.up ? GREEN : RED, fontWeight: 600, transition: "color 0.3s" }}>
              {formatPrice(p)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Spark line (inline SVG) ────────────────────────────────── */
function Sparkline({ up }: { up: boolean }) {
  const pts = Array.from({ length: 10 }, (_, i) => ({
    x: i * 6,
    y: 12 + (Math.random() - (up ? 0.4 : 0.6)) * 8,
  }));
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
  return (
    <svg width="60" height="24" viewBox="0 0 54 24">
      <path d={d} stroke={up ? GREEN : RED} strokeWidth={1.5} fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/* ─── Security progress bar ──────────────────────────────────── */
function SecurityBar({ label, pct }: { label: string; pct: number }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: "rgba(255,255,255,0.85)" }}>{label}</span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{pct}%</span>
      </div>
      <div style={{ height: 6, background: "rgba(255,255,255,0.12)", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, background: "linear-gradient(90deg, #A78BFA, #06C8F0)", borderRadius: 3, transition: "width 1.2s ease" }} />
      </div>
    </div>
  );
}

/* ─── Avatar initials circle ─────────────────────────────────── */
function Avatar({ init, color }: { init: string; color: string }) {
  return (
    <div style={{ width: 38, height: 38, borderRadius: "50%", background: color, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{init}</span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════════════════════ */
export default function Landing() {
  const [, setLocation] = useLocation();
  const { token, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const pairs = useLivePrices();

  useEffect(() => {
    if (!isLoading && token) setLocation("/dashboard");
  }, [token, isLoading, setLocation]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const handleStart = () => {
    const seen = localStorage.getItem("vixus_onboarding_seen");
    setLocation(seen ? "/register" : "/onboarding");
  };

  return (
    <div style={{ background: BG, color: TEXT, fontFamily: "'Inter', 'Plus Jakarta Sans', system-ui, sans-serif", minHeight: "100dvh", overflowX: "hidden" }}>

      {/* ══ NAVBAR ══════════════════════════════════════════════ */}
      <header style={{
        position: "sticky", top: 0, zIndex: 50,
        background: scrolled ? "rgba(255,255,255,0.97)" : WHITE,
        backdropFilter: "blur(16px)",
        borderBottom: scrolled ? "1px solid #E8E8F0" : "1px solid transparent",
        transition: "all 0.2s",
      }}>
        <div style={{ maxWidth: 480, margin: "0 auto", padding: "0 16px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 60 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: PURPLE, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 13, fontWeight: 900, color: "#fff" }}>V</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 17, letterSpacing: "0.02em", color: TEXT }}>
              VIXUS<span style={{ color: PURPLE }}>.AI</span>
            </span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <button key={link} style={{ fontSize: 13, fontWeight: 500, color: TEXT2, background: "none", border: "none", cursor: "pointer", padding: "6px 12px", borderRadius: 8 }}
                onMouseEnter={e => (e.currentTarget.style.color = PURPLE)}
                onMouseLeave={e => (e.currentTarget.style.color = TEXT2)}>
                {link}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => setLocation("/login")} className="hidden sm:block"
              style={{ fontSize: 13, fontWeight: 500, color: TEXT2, background: "none", border: "none", cursor: "pointer", padding: "8px 14px" }}>
              Login
            </button>
            <button onClick={handleStart} className="hidden sm:block"
              style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: PURPLE, border: "none", borderRadius: 10, cursor: "pointer", padding: "9px 20px" }}>
              Get Started
            </button>
            <button onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: "none", border: "none", cursor: "pointer", color: TEXT2, padding: 4, display: "flex", alignItems: "center" }}>
              {mobileMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div style={{ borderTop: "1px solid #E8E8F0", background: WHITE, padding: "8px 16px 20px" }}>
            {[...NAV_LINKS, "Login"].map(link => (
              <button key={link}
                onClick={() => { setMobileMenuOpen(false); if (link === "Login") setLocation("/login"); }}
                style={{ display: "block", width: "100%", textAlign: "left", fontSize: 15, color: TEXT, background: "none", border: "none", cursor: "pointer", padding: "11px 0", borderBottom: "1px solid #F0F0F8" }}>
                {link}
              </button>
            ))}
            <button onClick={() => { setMobileMenuOpen(false); handleStart(); }}
              style={{ marginTop: 12, width: "100%", background: PURPLE, border: "none", borderRadius: 12, padding: "13px 0", fontSize: 15, fontWeight: 700, color: "#fff", cursor: "pointer" }}>
              Get Started
            </button>
          </div>
        )}
      </header>

      {/* ══ LIVE TICKER ═════════════════════════════════════════ */}
      <LiveTicker pairs={pairs} />

      {/* ══ HERO CARD ═══════════════════════════════════════════ */}
      <section style={{ padding: "20px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <div style={{
          background: "linear-gradient(145deg, #6D4AFF 0%, #4F46E5 40%, #312E8F 70%, #0891B2 100%)",
          borderRadius: 24,
          padding: "32px 24px 28px",
          position: "relative",
          overflow: "hidden",
          minHeight: 440,
        }}>
          {/* Decorative circles */}
          <div style={{ position: "absolute", top: -60, right: -60, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -40, right: 20, width: 140, height: 140, borderRadius: "50%", background: "rgba(6,200,240,0.12)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", top: 80, right: 40, width: 80, height: 80, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

          {/* Badge */}
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", borderRadius: 100, padding: "6px 14px", marginBottom: 24, backdropFilter: "blur(8px)" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: "#fff" }}>V</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.06em" }}>128,400+ TRADERS ACTIVE</span>
          </div>

          {/* Headline */}
          <h1 style={{ fontSize: 34, fontWeight: 900, lineHeight: 1.1, letterSpacing: "-0.02em", color: "#fff", marginBottom: 16 }}>
            Your capital deserves<br />
            <span style={{ color: CYAN }}>to work harder.</span>
          </h1>

          {/* Subtitle */}
          <p style={{ fontSize: 15, lineHeight: 1.65, color: "rgba(200,210,255,0.85)", marginBottom: 32, maxWidth: 340 }}>
            Join traders who stopped watching charts and started letting the bots handle it.
          </p>

          {/* Buttons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <button onClick={handleStart}
              style={{ width: "100%", background: WHITE, border: "none", borderRadius: 14, padding: "16px 0", fontSize: 16, fontWeight: 700, color: PURPLE, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>
              Open Free Account <ArrowRight size={17} />
            </button>
            <button onClick={() => setLocation("/login")}
              style={{ width: "100%", background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 14, padding: "16px 0", fontSize: 15, fontWeight: 600, color: "#fff", cursor: "pointer", backdropFilter: "blur(8px)" }}>
              Schedule a Demo
            </button>
          </div>

          {/* Tagline */}
          <p style={{ marginTop: 20, fontSize: 12, color: "rgba(200,210,255,0.7)", textAlign: "center" }}>
            Free to start · Withdraw anytime · No hidden fees
          </p>
        </div>
      </section>

      {/* ══ DASHBOARD MOCKUP CARD ═══════════════════════════════ */}
      <section style={{ padding: "20px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ background: WHITE, borderRadius: 20, padding: "20px", boxShadow: CARD_SHADOW }}>
          {/* Card header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ width: 26, height: 26, borderRadius: "50%", background: PURPLE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 10, fontWeight: 900, color: "#fff" }}>V</span>
              </div>
              <span style={{ fontSize: 12, fontWeight: 700, color: TEXT2 }}>VIXUS AI — Dashboard</span>
            </div>
            <div style={{ display: "flex", gap: 4 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#EF4444" }} />
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B" }} />
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#10B981" }} />
            </div>
          </div>

          {/* Portfolio value */}
          <div style={{ marginBottom: 6 }}>
            <div style={{ fontSize: 11, color: TEXT3, marginBottom: 2 }}>Portfolio Value</div>
            <div style={{ fontSize: 28, fontWeight: 900, color: TEXT, fontFamily: "monospace", letterSpacing: "-0.02em" }}>$24,530.75</div>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(16,185,129,0.1)", borderRadius: 8, padding: "3px 10px", marginBottom: 16 }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: GREEN }}>+$1,082.45</span>
            <span style={{ fontSize: 11, color: GREEN }}>↑ +4.6%</span>
          </div>

          {/* Mini chart placeholder */}
          <div style={{ background: "#F8F8FF", borderRadius: 12, height: 100, marginBottom: 12, overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 200 80" width="100%" height="100%" preserveAspectRatio="none">
              <defs>
                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={PURPLE} stopOpacity="0.3" />
                  <stop offset="100%" stopColor={PURPLE} stopOpacity="0.02" />
                </linearGradient>
              </defs>
              <path d="M0 60 L20 55 L40 58 L60 45 L80 42 L100 38 L120 35 L140 30 L160 25 L180 20 L200 15 L200 80 L0 80 Z" fill="url(#chartGrad)" />
              <path d="M0 60 L20 55 L40 58 L60 45 L80 42 L100 38 L120 35 L140 30 L160 25 L180 20 L200 15" stroke={PURPLE} strokeWidth="2" fill="none" strokeLinecap="round" />
            </svg>
          </div>

          {/* Mini prices */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {pairs.slice(0, 3).map(p => (
              <div key={p.pair} style={{ background: "#F8F8FF", borderRadius: 10, padding: "8px 8px" }}>
                <div style={{ fontSize: 9, color: TEXT3, marginBottom: 2 }}>{p.pair}</div>
                <div style={{ fontSize: 10, fontFamily: "monospace", fontWeight: 700, color: p.up ? GREEN : RED, transition: "color 0.3s" }}>
                  {formatPrice(p)}
                </div>
              </div>
            ))}
          </div>

          {/* AI Bot row */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "rgba(109,74,255,0.06)", borderRadius: 10, padding: "10px 12px", border: "1px solid rgba(109,74,255,0.12)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: GREEN, animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: TEXT }}>AI Bot Active</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: GREEN }}>+$312.40 today</span>
          </div>
        </div>
      </section>

      {/* ══ "TRADE FROM ANYWHERE" ════════════════════════════════ */}
      <section style={{ padding: "36px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 6 }}>Trade from anywhere</h2>
        <p style={{ fontSize: 14, color: TEXT2, marginBottom: 16, lineHeight: 1.6 }}>
          Full platform power in your pocket. Execute, monitor, and manage your entire portfolio on any device.
        </p>
        <div style={{ borderRadius: 20, overflow: "hidden", background: "#E8E8F8", height: 200, display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 12 }}>
          <img
            src="https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800&q=80"
            alt="Trading on laptop"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            loading="lazy"
          />
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ borderRadius: 16, overflow: "hidden", height: 140 }}>
            <img
              src="https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=600&q=80"
              alt="Mobile trading"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
            />
          </div>
          <div style={{ borderRadius: 16, overflow: "hidden", height: 140 }}>
            <img
              src="https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=600&q=80"
              alt="Professional trader"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
              loading="lazy"
            />
          </div>
        </div>
      </section>

      {/* ══ MARKETS TABLE ════════════════════════════════════════ */}
      <section style={{ padding: "36px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 4 }}>Markets</h2>
        <p style={{ fontSize: 14, color: TEXT2, marginBottom: 16 }}>Live signals across 11 instruments</p>
        <div style={{ background: WHITE, borderRadius: 20, overflow: "hidden", boxShadow: CARD_SHADOW }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "12px 16px", borderBottom: "1px solid #F0F0F8" }}>
            {["INSTRUMENT", "24H CHANGE", "CHART", "SIGNAL"].map(h => (
              <div key={h} style={{ fontSize: 10, fontWeight: 700, color: TEXT3, letterSpacing: "0.06em" }}>{h}</div>
            ))}
          </div>
          {/* Rows */}
          {MARKETS.map((m, i) => (
            <div key={m.name} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr", padding: "14px 16px", borderBottom: i < MARKETS.length - 1 ? "1px solid #F8F8FC" : "none", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{m.name}</div>
                <div style={{ fontSize: 10, color: TEXT3 }}>{m.full}</div>
              </div>
              <div style={{ fontSize: 12, fontWeight: 700, color: m.up ? GREEN : RED, fontFamily: "monospace" }}>{m.chg}</div>
              <Sparkline up={m.up} />
              <div style={{ display: "inline-flex", alignItems: "center" }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: m.sig_color, background: m.sig_color + "18", borderRadius: 6, padding: "3px 7px", whiteSpace: "nowrap" }}>{m.signal}</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════ */}
      <section style={{ padding: "40px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 4 }}>Everything you need</h2>
        <p style={{ fontSize: 14, color: TEXT2, marginBottom: 20 }}>Built by traders, for traders.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: WHITE, borderRadius: 18, padding: "20px 18px", boxShadow: CARD_SHADOW, display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(109,74,255,0.08)", border: "1px solid rgba(109,74,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                <f.icon size={20} style={{ color: PURPLE }} />
              </div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{f.title}</div>
                <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>{f.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ HOW IT WORKS ════════════════════════════════════════ */}
      <section style={{ padding: "40px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 4 }}>Up and running in minutes</h2>
        <p style={{ fontSize: 14, color: TEXT2, marginBottom: 20 }}>Three steps. No experience required.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {STEPS.map(s => (
            <div key={s.n} style={{ background: WHITE, borderRadius: 18, padding: "20px 18px", boxShadow: CARD_SHADOW, display: "flex", gap: 16, alignItems: "flex-start" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: `linear-gradient(135deg, ${PURPLE}, #4F46E5)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, boxShadow: "0 4px 16px rgba(109,74,255,0.3)" }}>
                <span style={{ fontSize: 15, fontWeight: 900, color: "#fff" }}>{s.n}</span>
              </div>
              <div>
                <div style={{ display: "inline-block", fontSize: 10, fontWeight: 700, color: PURPLE, background: "rgba(109,74,255,0.08)", borderRadius: 6, padding: "2px 8px", marginBottom: 6 }}>{s.tag}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{s.title}</div>
                <div style={{ fontSize: 13, color: TEXT2, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ STATS GRID ══════════════════════════════════════════ */}
      <section style={{ padding: "40px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {STATS.map((s, i) => (
            <div key={s.label} style={{ background: WHITE, borderRadius: 18, padding: "22px 18px", boxShadow: CARD_SHADOW, textAlign: "center" }}>
              <div style={{ fontSize: 28, fontWeight: 900, fontFamily: "monospace", letterSpacing: "-0.02em", color: i % 2 === 0 ? PURPLE : TEXT, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 12, color: TEXT2 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ TERMINAL SECTION ════════════════════════════════════ */}
      <section style={{ padding: "40px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 4 }}>One interface. Total control.</h2>
        <p style={{ fontSize: 14, color: TEXT2, marginBottom: 20 }}>Professional terminal built for speed and precision.</p>
        <CandlestickSection pairs={pairs} />
      </section>

      {/* ══ MULTI-EXCHANGE / RISK / PERFORMANCE ═════════════════ */}
      <section style={{ padding: "28px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        {[
          {
            icon: Globe, title: "Multi-Exchange", color: "#6D4AFF",
            desc: "Trade across Binance, Bybit, OKX and 8 more — all from one dashboard. No API juggling.",
            tags: ["Binance", "Bybit", "OKX", "+8 more"],
          },
          {
            icon: ShieldCheck, title: "Risk Management", color: "#10B981",
            desc: "Set hard stop-losses, max daily drawdown, and position sizing rules. Capital protection built in.",
            tags: ["Stop Loss", "Drawdown Cap", "Position Sizing"],
          },
          {
            icon: BarChart2, title: "Performance Analytics", color: "#06C8F0",
            desc: "Full trade history, win-rate tracking, Sharpe ratio, and drawdown curves — all in real time.",
            tags: ["Win Rate", "Sharpe Ratio", "P&L Curve"],
          },
        ].map(card => (
          <div key={card.title} style={{ background: WHITE, borderRadius: 18, padding: "20px 18px", boxShadow: CARD_SHADOW, marginBottom: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: card.color + "18", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <card.icon size={19} style={{ color: card.color }} />
              </div>
              <span style={{ fontSize: 15, fontWeight: 700, color: TEXT }}>{card.title}</span>
            </div>
            <p style={{ fontSize: 13, color: TEXT2, lineHeight: 1.65, marginBottom: 12 }}>{card.desc}</p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {card.tags.map(tag => (
                <span key={tag} style={{ fontSize: 11, fontWeight: 600, color: card.color, background: card.color + "12", borderRadius: 8, padding: "3px 10px" }}>{tag}</span>
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* ══ SECURITY SECTION ════════════════════════════════════ */}
      <section style={{ padding: "12px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <div style={{ background: `linear-gradient(135deg, ${PURPLE} 0%, #4F46E5 50%, ${CYAN} 100%)`, borderRadius: 20, padding: "28px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
            <div style={{ width: 40, height: 40, borderRadius: 12, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={20} style={{ color: "#fff" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Security Dashboard</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)" }}>Enterprise-grade protection</div>
            </div>
          </div>

          <SecurityBar label="Encryption" pct={100} />
          <SecurityBar label="Authentication" pct={100} />
          <SecurityBar label="Fund Segregation" pct={98} />
          <SecurityBar label="Compliance" pct={100} />

          <div style={{ marginTop: 18, display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "10px 14px", backdropFilter: "blur(8px)" }}>
            <CheckCircle2 size={16} style={{ color: "#fff" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>All Systems Secure</span>
            <div style={{ marginLeft: "auto", width: 7, height: 7, borderRadius: "50%", background: "#A7F3D0", animation: "pulse 1.5s infinite" }} />
          </div>
        </div>
      </section>

      {/* ══ TESTIMONIALS ════════════════════════════════════════ */}
      <section style={{ padding: "36px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: TEXT, marginBottom: 4 }}>Real traders. Real results.</h2>
        <p style={{ fontSize: 14, color: TEXT2, marginBottom: 20 }}>No marketing speak — people using VIXUS AI daily.</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: WHITE, borderRadius: 20, padding: "20px 18px", boxShadow: CARD_SHADOW }}>
              {/* Stars */}
              <div style={{ display: "flex", gap: 2, marginBottom: 10 }}>
                {[1,2,3,4,5].map(i => <Star key={i} size={15} style={{ color: GOLD, fill: GOLD }} />)}
              </div>
              {/* Quote */}
              <p style={{ fontSize: 14, lineHeight: 1.7, color: TEXT, marginBottom: 16 }}>
                "{t.quote}"
              </p>
              {/* Author row */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Avatar
                    init={t.init}
                    color={t.init === "M" ? "#6D4AFF" : t.init === "J" ? "#0891B2" : "#059669"}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: TEXT }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: TEXT3 }}>{t.loc}</div>
                  </div>
                </div>
                <span style={{ fontSize: 10, fontWeight: 700, color: GREEN, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, padding: "4px 10px", whiteSpace: "nowrap" }}>
                  {t.stat}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ══ BOTTOM CTA CARD ═════════════════════════════════════ */}
      <section style={{ padding: "28px 16px 0", maxWidth: 480, margin: "0 auto" }}>
        <div style={{
          background: "linear-gradient(145deg, #6D4AFF 0%, #4F46E5 40%, #312E8F 70%, #0891B2 100%)",
          borderRadius: 24,
          padding: "32px 24px 28px",
          position: "relative",
          overflow: "hidden",
          textAlign: "center",
        }}>
          <div style={{ position: "absolute", top: -50, right: -50, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.15)", borderRadius: 100, padding: "6px 14px", marginBottom: 20, backdropFilter: "blur(8px)" }}>
            <div style={{ width: 18, height: 18, borderRadius: "50%", background: "rgba(255,255,255,0.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 900, color: "#fff" }}>V</span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 700, color: "rgba(255,255,255,0.9)", letterSpacing: "0.06em" }}>128,400+ TRADERS ACTIVE</span>
          </div>
          <h2 style={{ fontSize: 26, fontWeight: 900, color: "#fff", lineHeight: 1.15, marginBottom: 12, letterSpacing: "-0.02em" }}>
            Your capital deserves<br />to work harder.
          </h2>
          <p style={{ fontSize: 14, color: "rgba(200,210,255,0.8)", marginBottom: 28, lineHeight: 1.65 }}>
            Join traders who stopped watching charts and started letting the bots handle it.
          </p>
          <button onClick={handleStart}
            style={{ width: "100%", background: WHITE, border: "none", borderRadius: 14, padding: "16px 0", fontSize: 16, fontWeight: 700, color: PURPLE, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 12 }}>
            Open Free Account <ArrowRight size={17} />
          </button>
          <p style={{ fontSize: 12, color: "rgba(200,210,255,0.7)" }}>
            Free to start · Withdraw anytime · No hidden fees
          </p>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════ */}
      <footer style={{ background: DARK, marginTop: 36, padding: "40px 16px 0" }}>
        <div style={{ maxWidth: 480, margin: "0 auto" }}>
          {/* Logo + tagline */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
              <div style={{ width: 30, height: 30, borderRadius: "50%", background: PURPLE, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <span style={{ fontSize: 11, fontWeight: 900, color: "#fff" }}>V</span>
              </div>
              <span style={{ fontWeight: 800, fontSize: 17, color: "#fff", letterSpacing: "0.02em" }}>
                VIXUS<span style={{ color: PURPLE }}>.AI</span>
              </span>
            </div>
            <p style={{ fontSize: 13, color: TEXT3, lineHeight: 1.65, maxWidth: 280 }}>
              Institutional-grade AI trading for everyone. Automate your strategy across 11+ markets.
            </p>
          </div>

          {/* Social icons */}
          <div style={{ display: "flex", gap: 10, marginBottom: 32 }}>
            {[Globe, X, TrendingUp, Activity].map((Icon, i) => (
              <div key={i} style={{ width: 38, height: 38, borderRadius: "50%", background: DARK2, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}>
                <Icon size={16} style={{ color: TEXT3 }} />
              </div>
            ))}
          </div>

          {/* Links grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, marginBottom: 32 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>PRODUCT</div>
              {["Markets", "Trading", "AI Bots", "Portfolio", "Analytics"].map(l => (
                <div key={l} style={{ fontSize: 14, color: "#A0A8C0", marginBottom: 10, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#A0A8C0")}>{l}</div>
              ))}
            </div>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>COMPANY</div>
              {["About Us", "Pricing", "Blog", "Careers", "Contact"].map(l => (
                <div key={l} style={{ fontSize: 14, color: "#A0A8C0", marginBottom: 10, cursor: "pointer" }}
                  onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                  onMouseLeave={e => (e.currentTarget.style.color = "#A0A8C0")}>{l}</div>
              ))}
            </div>
          </div>

          {/* Legal */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>LEGAL</div>
            {["Terms of Service", "Privacy Policy", "Cookie Policy", "Risk Disclosure"].map(l => (
              <div key={l} style={{ fontSize: 14, color: "#A0A8C0", marginBottom: 10, cursor: "pointer" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#fff")}
                onMouseLeave={e => (e.currentTarget.style.color = "#A0A8C0")}>{l}</div>
            ))}
          </div>

          {/* Newsletter */}
          <div style={{ marginBottom: 32 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: TEXT3, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>NEWSLETTER</div>
            <p style={{ fontSize: 13, color: TEXT3, marginBottom: 14 }}>Market insights delivered weekly.</p>
            <div style={{ display: "flex", gap: 0, background: DARK2, borderRadius: 12, overflow: "hidden", border: "1px solid rgba(255,255,255,0.08)" }}>
              <input
                type="email"
                placeholder="Email..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", padding: "13px 14px", fontSize: 14, color: "#fff" }}
              />
              <button style={{ background: PURPLE, border: "none", padding: "0 18px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <ArrowRight size={16} style={{ color: "#fff" }} />
              </button>
            </div>
          </div>

          {/* Bottom bar */}
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 20, paddingBottom: 28 }}>
            <p style={{ fontSize: 12, color: "#4A5270", marginBottom: 6 }}>© {new Date().getFullYear()} VIXUS AI. All rights reserved.</p>
            <p style={{ fontSize: 11, color: "#363D58", lineHeight: 1.6 }}>
              Trading involves significant risk of loss. Past performance is not indicative of future results. Capital at risk.
            </p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes pulse  { 0%, 100% { opacity: 1 } 50% { opacity: 0.3 } }
        * { box-sizing: border-box; }
        input::placeholder { color: #4A5270; }
        button { transition: opacity 0.15s, transform 0.12s; }
        button:active { transform: scale(0.97); }
        @media (min-width: 480px) {
          .hidden.sm\\:block { display: block !important; }
        }
        @media (max-width: 479px) {
          .hidden.sm\\:block { display: none !important; }
        }
      `}</style>
    </div>
  );
}
