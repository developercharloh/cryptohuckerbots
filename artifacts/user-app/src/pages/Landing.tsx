import { useEffect, useRef, useState, useCallback } from "react";
import { useLocation, Link } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { VixusLogo } from "@/components/VixusLogo";
import {
  ShieldCheck, Lock, Zap, Star, ArrowRight,
  ArrowUpRight, ArrowDownRight, ChevronRight,
  Globe, Clock, TrendingUp, Bot, Cpu, BarChart2,
  Menu, X, Shield, HeadphonesIcon, CheckCircle2,
  Activity,
} from "lucide-react";
import { createChart, ColorType, CrosshairMode, CandlestickSeries } from "lightweight-charts";

const BG = "#07091A";
const DARK_CARD = "rgba(10,8,30,0.92)";
const BORDER = "rgba(124,58,237,0.18)";
const PURPLE = "#7C3AED";
const LIGHT_PURPLE = "#A78BFA";
const GREEN = "#10B981";
const RED = "#EF4444";

const NAV_LINKS = ["Markets", "Trading", "Features", "Pricing", "Company", "Support"];

const TRUST_BADGES = [
  { icon: Shield,         label: "Bank Level Security" },
  { icon: Lock,           label: "Encrypted Platform" },
  { icon: Zap,            label: "Fast Withdrawals" },
  { icon: HeadphonesIcon, label: "24/7 Support" },
  { icon: CheckCircle2,   label: "Regulated Partners" },
];

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
    photo: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=80&h=80&fit=crop&crop=face&q=80",
    quote: "Setup took five minutes. Dashboard is clean, withdrawals hit same day. I've tried four platforms — this one I actually stuck with.",
    stat: "+$4,200 first month",
  },
  {
    name: "James K.", loc: "Dallas, TX", init: "J",
    photo: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=80&h=80&fit=crop&crop=face&q=80",
    quote: "I trade my own account too, so I know what fast execution looks like. These bots fill at the right price — no requotes, no surprise slippage.",
    stat: "5 years trading exp.",
  },
  {
    name: "Danielle R.", loc: "Chicago, IL", init: "D",
    photo: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=80&h=80&fit=crop&crop=face&q=80",
    quote: "The risk controls are what sold me. I set a 5% drawdown cap and it has never been breached. Everything transparent, no hidden fees.",
    stat: "Consistent since month 1",
  },
];

const WHY_CHOOSE = [
  { icon: Lock,       label: "Bank Level Security",        sub: "256-bit AES" },
  { icon: Zap,        label: "Fast & Secure Transactions", sub: "Instant" },
  { icon: Bot,        label: "24/7 Customer Support",      sub: "Always on" },
  { icon: BarChart2,  label: "Advanced Charting Tools",    sub: "Real-time" },
  { icon: Cpu,        label: "AI-Powered Automation",      sub: "Smart bots" },
  { icon: TrendingUp, label: "Trusted by Traders",         sub: "128K+ users" },
];

const HERO_PHOTOS = [
  "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=1200&q=80",
  "https://images.unsplash.com/photo-1642790106117-e829e14a795f?w=1200&q=80",
  "https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=1200&q=80",
];

type PriceData = {
  pair: string;
  symbol: string;
  price: number;
  prev: number;
  chg: number;
  chgPct: number;
  up: boolean;
  flash: boolean;
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

  // Realistic random walk simulation — always runs, keeps prices moving
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

  // Binance WebSocket — overrides simulation with real prices when available
  useEffect(() => {
    const symbols = ["btcusdt", "ethusdt", "xauusdt", "ethbtc"];
    const streams = symbols.map(s => `${s}@miniTicker`).join("/");
    let ws: WebSocket | null = null;
    let retryTimer: ReturnType<typeof setTimeout>;
    let attempts = 0;

    const connect = () => {
      if (attempts > 3) return; // give up after 3 tries, simulation takes over
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

  // FX rates — try open.er-api.com (CORS-friendly), fallback to frankfurter.app
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

function LiveTicker({ pairs }: { pairs: PriceData[] }) {
  const items = [...pairs, ...pairs];
  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.06)", background: "rgba(255,255,255,0.015)", overflow: "hidden" }}>
      <div className="flex whitespace-nowrap" style={{ animation: "ticker 40s linear infinite" }}>
        {items.map((t, i) => (
          <div key={i} className="flex items-center gap-2 px-5 py-2 shrink-0" style={{ borderRight: "1px solid rgba(255,255,255,0.05)" }}>
            <span style={{ fontSize: 11, fontFamily: "monospace", fontWeight: 600, color: "#94A3B8" }}>{t.pair}</span>
            <span
              style={{
                fontSize: 12, fontFamily: "monospace", fontWeight: 700, color: "#F1F5F9",
                transition: "color 0.3s",
                ...(t.flash ? { color: t.up ? GREEN : RED } : {}),
              }}
            >
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

function CandlestickMockup() {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<ReturnType<typeof createChart> | null>(null);
  const seriesRef = useRef<any>(null);
  const [btcPrice, setBtcPrice] = useState("67,812.50");
  const [btcChg, setBtcChg] = useState("+1.25%");
  const [btcUp, setBtcUp] = useState(true);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#64748B",
        fontSize: 10,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      crosshair: { mode: CrosshairMode.Normal },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.06)", visible: true },
      timeScale: { borderColor: "rgba(255,255,255,0.06)", timeVisible: true, secondsVisible: false },
      handleScroll: false,
      handleScale: false,
    });
    chartRef.current = chart;

    const series = chart.addSeries(CandlestickSeries, {
      upColor: GREEN,
      downColor: RED,
      borderUpColor: GREEN,
      borderDownColor: RED,
      wickUpColor: GREEN,
      wickDownColor: RED,
    });
    seriesRef.current = series;

    // Generate realistic fallback candles when APIs unavailable
    const genFallbackCandles = (basePrice: number, count: number) => {
      const now = Math.floor(Date.now() / 1000);
      const interval = 300; // 5m in seconds
      let price = basePrice;
      return Array.from({ length: count }, (_, i) => {
        const open = price;
        const move = (Math.random() - 0.48) * price * 0.004;
        const close = +(open + move).toFixed(2);
        const high = +(Math.max(open, close) * (1 + Math.random() * 0.003)).toFixed(2);
        const low = +(Math.min(open, close) * (1 - Math.random() * 0.003)).toFixed(2);
        price = close;
        return { time: (now - (count - i) * interval) as any, open, high, low, close };
      });
    };

    const loadChart = async () => {
      // Try Binance first
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

      // Try CoinGecko as fallback (CORS-friendly)
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

      // Fallback: realistic local simulation
      const candles = genFallbackCandles(67800, 60);
      series.setData(candles);
      chart.timeScale().fitContent();
      const last = candles[candles.length - 1];
      setBtcPrice(last.close.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
      setBtcChg("+1.25%"); setBtcUp(true);
    };
    loadChart();

    // Live updates via Binance WebSocket
    let wsKline: WebSocket | null = null;
    const connectKline = () => {
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
    };
    connectKline();

    // Simulate live candle updates when WebSocket unavailable
    const simKline = setInterval(() => {
      if (wsKline?.readyState === 1) return; // WS working, skip simulation
      const now = Math.floor(Date.now() / 1000);
      const intervalSec = 300;
      const base = Math.floor(now / intervalSec) * intervalSec;
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
  }, []);

  return (
    <div style={{ position: "relative", width: "100%", maxWidth: 580 }}>
      {/* Glow */}
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "radial-gradient(ellipse at 50% 60%, rgba(124,58,237,0.3) 0%, transparent 70%)", filter: "blur(40px)", zIndex: 0, pointerEvents: "none" }} />

      {/* Screen frame */}
      <div style={{ position: "relative", zIndex: 1, background: "linear-gradient(145deg, #0d0b22, #130f38)", border: "1.5px solid rgba(124,58,237,0.35)", borderRadius: 16, padding: "12px 12px 8px", boxShadow: "0 0 80px rgba(124,58,237,0.18), 0 40px 100px rgba(0,0,0,0.7)" }}>

        {/* Window chrome */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
          <div style={{ display: "flex", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#EF4444" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#F59E0B" }} />
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#10B981" }} />
          </div>
          <div style={{ fontSize: 9, fontFamily: "monospace", color: "#475569" }}>VIXUS AI — Live Trading</div>
          <div style={{ width: 40 }} />
        </div>

        {/* Pair header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 4px", marginBottom: 6 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#F1F5F9", fontFamily: "monospace" }}>BTC/USDT</span>
            <span style={{ fontSize: 9, color: "#64748B", background: "rgba(255,255,255,0.05)", padding: "2px 6px", borderRadius: 4 }}>5m</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 800, fontFamily: "monospace", color: btcUp ? GREEN : RED }}>{btcPrice}</span>
            <span style={{ fontSize: 10, color: btcUp ? GREEN : RED, fontFamily: "monospace" }}>{btcChg}</span>
          </div>
        </div>

        {/* REAL candlestick chart */}
        <div ref={containerRef} style={{ width: "100%", height: 220, borderRadius: 8, overflow: "hidden" }} />

        {/* Market rows */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginTop: 8 }}>
          {[
            { pair: "EUR/USD", color: LIGHT_PURPLE },
            { pair: "XAU/USD", color: GREEN },
            { pair: "ETH/USD", color: "#60A5FA" },
          ].map(r => (
            <div key={r.pair} style={{ background: "rgba(255,255,255,0.03)", borderRadius: 6, padding: "5px 6px", border: "1px solid rgba(255,255,255,0.05)" }}>
              <div style={{ fontSize: 8, color: "#64748B", marginBottom: 2 }}>{r.pair}</div>
              <div style={{ fontSize: 9, fontFamily: "monospace", color: r.color, fontWeight: 600 }}>LIVE</div>
            </div>
          ))}
        </div>
      </div>

      {/* Laptop base */}
      <div style={{ height: 14, background: "linear-gradient(180deg, #1a1535 0%, #0e0b24 100%)", borderRadius: "0 0 6px 6px", margin: "0 12px" }} />
      <div style={{ height: 8, background: "#070515", borderRadius: "0 0 24px 24px" }} />

      {/* Floating: live trade badge */}
      <div style={{ position: "absolute", bottom: 36, left: -24, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: "10px 14px", backdropFilter: "blur(16px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, animation: "pulse 1.5s infinite" }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: GREEN, letterSpacing: "0.06em" }}>TRADE EXECUTED</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 800, color: "#F1F5F9", fontFamily: "monospace" }}>BUY EUR/USD</div>
        <div style={{ fontSize: 9, color: "#64748B", marginTop: 1 }}>+$48.20 · 0.50 lot</div>
      </div>

      {/* Floating: AI bot badge */}
      <div style={{ position: "absolute", top: 24, right: -20, background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 12, padding: "10px 14px", backdropFilter: "blur(16px)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", zIndex: 2 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: LIGHT_PURPLE, animation: "pulse 2s infinite" }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: LIGHT_PURPLE, letterSpacing: "0.06em" }}>AI BOT ACTIVE</span>
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#F1F5F9", marginTop: 2 }}>5 positions open</div>
        <div style={{ fontSize: 9, color: GREEN, marginTop: 1 }}>Total P&L: +$312.40</div>
      </div>
    </div>
  );
}

export default function Landing() {
  const [, setLocation] = useLocation();
  const { token, isLoading } = useAuth();
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [heroPhoto] = useState(() => HERO_PHOTOS[0]);
  const pairs = useLivePrices();

  useEffect(() => {
    if (!isLoading && token) setLocation("/dashboard");
  }, [token, isLoading, setLocation]);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const handleStart = () => {
    const seen = localStorage.getItem("vixus_onboarding_seen");
    setLocation(seen ? "/register" : "/onboarding");
  };

  const stats = [
    { value: "$482M+", label: "Volume Traded" },
    { value: "128K+",  label: "Active Traders" },
    { value: "99.9%",  label: "Uptime" },
    { value: "24/7",   label: "Support" },
  ];

  return (
    <div style={{ background: BG, color: "#F1F5F9", fontFamily: "inherit", minHeight: "100dvh", overflowX: "hidden" }}>

      {/* ── NAVBAR ── */}
      <header className="sticky top-0 z-50 transition-all" style={{ background: scrolled ? "rgba(7,9,26,0.96)" : "rgba(7,9,26,0.75)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(124,58,237,0.12)" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "0 24px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <VixusLogo className="w-7 h-7" />
            <span style={{ fontWeight: 900, fontSize: 16, letterSpacing: "0.04em" }}>VIXUS<span style={{ color: LIGHT_PURPLE }}> AI</span></span>
          </div>
          <nav className="hidden md:flex items-center gap-1">
            {NAV_LINKS.map(link => (
              <button key={link} style={{ fontSize: 13, fontWeight: 500, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: "6px 14px", borderRadius: 8, transition: "color 0.15s" }}
                onMouseEnter={e => (e.currentTarget.style.color = "#F1F5F9")}
                onMouseLeave={e => (e.currentTarget.style.color = "#64748B")}>
                {link}
              </button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <button onClick={() => setLocation("/login")} className="hidden sm:block"
              style={{ fontSize: 13, fontWeight: 500, color: "#64748B", background: "none", border: "none", cursor: "pointer", padding: "8px 16px" }}>
              Login
            </button>
            <button onClick={handleStart}
              style={{ fontSize: 13, fontWeight: 700, color: "#fff", background: "linear-gradient(135deg, #7C3AED, #4F46E5)", border: "none", borderRadius: 10, cursor: "pointer", padding: "9px 22px", boxShadow: "0 0 24px rgba(124,58,237,0.35)" }}>
              Get Started
            </button>
            <button className="md:hidden" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              style={{ background: "none", border: "none", cursor: "pointer", color: "#64748B", padding: 6 }}>
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
        {mobileMenuOpen && (
          <div style={{ borderTop: "1px solid rgba(124,58,237,0.12)", background: "rgba(7,9,26,0.98)", padding: "10px 24px 20px" }}>
            {[...NAV_LINKS, "Login"].map(link => (
              <button key={link} onClick={() => { setMobileMenuOpen(false); if (link === "Login") setLocation("/login"); }}
                style={{ display: "block", width: "100%", textAlign: "left", fontSize: 14, color: "#94A3B8", background: "none", border: "none", cursor: "pointer", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                {link}
              </button>
            ))}
          </div>
        )}
      </header>

      {/* ── LIVE TICKER ── */}
      <LiveTicker pairs={pairs} />

      {/* ── BG GLOWS ── */}
      <div style={{ position: "fixed", top: 0, left: 0, right: 0, height: 800, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
        <div style={{ position: "absolute", top: -120, left: "10%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)" }} />
        <div style={{ position: "absolute", top: 80, right: "5%", width: 350, height: 350, borderRadius: "50%", background: "radial-gradient(circle, rgba(79,70,229,0.08) 0%, transparent 70%)" }} />
      </div>

      {/* ── HERO ── */}
      <section className="hero-section" style={{ position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto", padding: "80px 24px 60px" }}>
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left */}
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.3)", borderRadius: 100, padding: "5px 16px", marginBottom: 28, whiteSpace: "nowrap" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, flexShrink: 0, animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: LIGHT_PURPLE, letterSpacing: "0.08em" }}>AI-POWERED TRADING PLATFORM</span>
            </div>

            <h1 style={{ fontSize: "clamp(32px, 3.5vw, 54px)", lineHeight: 1.07, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 22 }}>
              Trade Smarter.<br />
              <span style={{ background: "linear-gradient(135deg, #A78BFA 0%, #7C3AED 50%, #4F46E5 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Automate</span>{" "}the Rest.
            </h1>

            <p style={{ fontSize: 16, lineHeight: 1.72, color: "#94A3B8", maxWidth: 460, marginBottom: 36 }}>
              Advanced AI trading bots, real-time market data, and professional tools — all in one secure platform. Built for traders who want results, not complexity.
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 28 }}>
              <button onClick={handleStart}
                style={{ height: 54, borderRadius: 13, fontSize: 16, fontWeight: 700, background: "linear-gradient(135deg, #7C3AED, #4F46E5)", color: "#fff", border: "none", cursor: "pointer", padding: "0 34px", display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 40px rgba(124,58,237,0.5)" }}>
                Get Started <ArrowRight size={18} />
              </button>
              <button onClick={() => setLocation("/login")}
                style={{ height: 54, borderRadius: 13, fontSize: 15, fontWeight: 600, background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.3)", color: LIGHT_PURPLE, cursor: "pointer", padding: "0 28px" }}>
                View Platform
              </button>
            </div>

            <p style={{ fontSize: 12, color: "#334155" }}>No credit card &nbsp;·&nbsp; Fast registration &nbsp;·&nbsp; Secured &amp; Trusted</p>

            {/* Mini live price strip */}
            <div style={{ display: "flex", gap: 16, marginTop: 28, flexWrap: "wrap" }}>
              {pairs.slice(0, 4).map(p => (
                <div key={p.pair} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <span style={{ fontSize: 10, color: "#475569", fontFamily: "monospace" }}>{p.pair}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, fontFamily: "monospace", color: p.up ? GREEN : RED, transition: "color 0.3s" }}>
                    {formatPrice(p)}
                  </span>
                  <span style={{ fontSize: 10, color: p.up ? GREEN : RED, fontFamily: "monospace" }}>
                    {p.up ? "▲" : "▼"} {Math.abs(p.chgPct).toFixed(2)}%
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Live candlestick mockup */}
          <div className="hidden md:flex justify-center items-center">
            <CandlestickMockup />
          </div>
        </div>

        {/* Stats bar */}
        <div className="stats-bar" style={{ marginTop: 72, background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "28px 36px", backdropFilter: "blur(16px)" }}>
          <div style={{ textAlign: "center", fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#475569", marginBottom: 22, textTransform: "uppercase" }}>
            Trusted by Traders Worldwide
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((s, i) => (
              <div key={s.label} style={{ textAlign: "center" }}>
                <div style={{ fontSize: "clamp(24px, 2.5vw, 36px)", fontWeight: 900, letterSpacing: "-0.02em", fontFamily: "monospace", color: i % 2 === 0 ? LIGHT_PURPLE : "#F1F5F9" }}>{s.value}</div>
                <div style={{ fontSize: 12, color: "#475569", marginTop: 5 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Trust badges */}
        <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 12 }}>
          {TRUST_BADGES.map(b => (
            <div key={b.label} style={{ display: "flex", alignItems: "center", gap: 7, padding: "7px 16px", background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 100 }}>
              <b.icon size={13} style={{ color: LIGHT_PURPLE }} />
              <span style={{ fontSize: 12, fontWeight: 600, color: "#94A3B8" }}>{b.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── REAL TRADER PHOTO SECTION ── */}
      <section style={{ position: "relative", zIndex: 1, overflow: "hidden", maxWidth: 1280, margin: "60px auto 0", padding: "0 16px" }}>
        <div className="trader-photo-wrap" style={{ position: "relative", borderRadius: 20, overflow: "hidden", height: 420 }}>
          <img
            src={heroPhoto}
            alt="Professional trader at multi-screen trading desk"
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center" }}
            loading="lazy"
          />
          {/* Overlay */}
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, rgba(7,9,26,0.92) 0%, rgba(7,9,26,0.6) 40%, rgba(7,9,26,0.2) 100%)" }} />
          <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "linear-gradient(0deg, rgba(7,9,26,1) 0%, transparent 100%)", height: 120 }} />

          {/* Text overlay */}
          <div className="trader-text-overlay" style={{ position: "absolute", top: "50%", left: "5%", transform: "translateY(-50%)", maxWidth: 480 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: LIGHT_PURPLE, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>Professional-grade infrastructure</div>
            <h2 style={{ fontSize: "clamp(18px, 3vw, 38px)", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1.15, marginBottom: 16 }}>
              The same tools institutional<br />desks use. Now in your hands.
            </h2>
            <p className="trader-desc" style={{ fontSize: 14, color: "#94A3B8", lineHeight: 1.7, marginBottom: 24 }}>
              Real-time order execution, AI-driven signal generation, and multi-asset portfolio management — no Bloomberg terminal required.
            </p>
            <button onClick={handleStart}
              style={{ height: 44, borderRadius: 12, fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg, #7C3AED, #4F46E5)", color: "#fff", border: "none", cursor: "pointer", padding: "0 22px", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "0 8px 32px rgba(124,58,237,0.5)" }}>
              Start Trading Free <ArrowRight size={15} />
            </button>
          </div>

          {/* Live price overlay cards — hidden on mobile */}
          <div className="trader-price-cards" style={{ position: "absolute", right: "4%", top: "50%", transform: "translateY(-50%)", display: "flex", flexDirection: "column", gap: 10 }}>
            {pairs.slice(0, 3).map(p => (
              <div key={p.pair} style={{ background: "rgba(7,9,26,0.85)", border: `1px solid ${p.up ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`, borderRadius: 12, padding: "10px 14px", backdropFilter: "blur(16px)", minWidth: 140 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: "#94A3B8" }}>{p.pair}</span>
                  <span style={{ fontSize: 10, color: p.up ? GREEN : RED }}>{p.up ? "▲" : "▼"}</span>
                </div>
                <div style={{ fontSize: 15, fontWeight: 800, fontFamily: "monospace", color: "#F1F5F9", transition: "color 0.3s" }}>{formatPrice(p)}</div>
                <div style={{ fontSize: 10, color: p.up ? GREEN : RED, fontFamily: "monospace", marginTop: 2 }}>
                  {Math.abs(p.chgPct).toFixed(2)}% {p.up ? "↑" : "↓"}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEATURES ── */}
      <section style={{ padding: "80px 16px 0", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 38px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>What's under the hood</h2>
          <p style={{ fontSize: 15, color: "#64748B" }}>Built by traders, for traders. Every feature has a purpose.</p>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.title} style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "26px 22px", backdropFilter: "blur(8px)" }}>
              <div style={{ width: 48, height: 48, borderRadius: 14, marginBottom: 18, background: i % 2 === 0 ? "rgba(124,58,237,0.15)" : "rgba(79,70,229,0.15)", border: `1px solid ${i % 2 === 0 ? "rgba(124,58,237,0.25)" : "rgba(79,70,229,0.25)"}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <f.icon size={22} style={{ color: LIGHT_PURPLE }} />
              </div>
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.65 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── HOW IT WORKS ── */}
      <section style={{ padding: "80px 16px 0", position: "relative", zIndex: 1, maxWidth: 960, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 48 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 38px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>Up and running in minutes</h2>
          <p style={{ fontSize: 15, color: "#64748B" }}>Three steps. No experience required.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {STEPS.map((s, i) => (
            <div key={s.n} style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 20, padding: "30px 26px", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: -16, right: -10, fontSize: 72, fontWeight: 900, color: "rgba(124,58,237,0.05)", fontFamily: "monospace", lineHeight: 1, userSelect: "none" }}>{s.n}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: LIGHT_PURPLE, letterSpacing: "0.07em", background: "rgba(124,58,237,0.1)", borderRadius: 5, padding: "3px 10px", marginBottom: 16, display: "inline-block", border: "1px solid rgba(124,58,237,0.2)" }}>{s.tag}</div>
              <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>{s.title}</div>
              <div style={{ fontSize: 13, color: "#64748B", lineHeight: 1.7 }}>{s.desc}</div>
              {i < STEPS.length - 1 && (
                <div style={{ marginTop: 18, fontSize: 12, color: LIGHT_PURPLE, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}>
                  Next step <ChevronRight size={14} />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── SECURITY ── */}
      <section className="section-pad" style={{ padding: "80px 16px 0", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
        <div className="security-card" style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 24, padding: "44px 40px", backdropFilter: "blur(12px)" }}>
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>Security &amp; Compliance</div>
              <h3 style={{ fontSize: "clamp(22px, 2.5vw, 32px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 12 }}>Your funds are safe. Always.</h3>
              <p style={{ fontSize: 14, color: "#64748B", lineHeight: 1.75 }}>Enterprise-grade security baked into every layer. We treat your capital the same way institutional desks do — with zero exceptions.</p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              {[
                { icon: Lock,        label: "256-bit AES encryption",  detail: "All data encrypted in transit and at rest" },
                { icon: ShieldCheck, label: "2FA on every account",    detail: "Multi-layer authentication by default" },
                { icon: Clock,       label: "Full trade audit trail",  detail: "Every order timestamped and logged" },
              ].map(item => (
                <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 12, background: "rgba(124,58,237,0.1)", border: "1px solid rgba(124,58,237,0.2)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                    <item.icon size={19} style={{ color: LIGHT_PURPLE }} />
                  </div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>{item.label}</div>
                    <div style={{ fontSize: 12, color: "#475569" }}>{item.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── TESTIMONIALS ── */}
      <section style={{ padding: "80px 16px 0", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 44 }}>
          <h2 style={{ fontSize: "clamp(24px, 3vw, 38px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 10 }}>Real traders. Real results.</h2>
          <p style={{ fontSize: 15, color: "#64748B" }}>No marketing speak. These are the people using VIXUS AI daily.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {TESTIMONIALS.map(t => (
            <div key={t.name} style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 22, padding: "26px 24px", backdropFilter: "blur(8px)" }}>
              <div style={{ display: "flex", gap: 2, marginBottom: 16 }}>
                {[1,2,3,4,5].map(i => <Star key={i} size={14} style={{ color: LIGHT_PURPLE, fill: LIGHT_PURPLE }} />)}
              </div>
              <p style={{ fontSize: 14, lineHeight: 1.75, color: "#CBD5E1", marginBottom: 22 }}>"{t.quote}"</p>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <img src={t.photo} alt={t.name}
                    style={{ width: 38, height: 38, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(124,58,237,0.3)" }}
                    onError={e => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#475569" }}>{t.loc}</div>
                  </div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 700, color: GREEN, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 6, padding: "4px 8px", whiteSpace: "nowrap" }}>{t.stat}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── WHY CHOOSE ── */}
      <section style={{ padding: "80px 16px 0", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 40 }}>
          <h2 style={{ fontSize: "clamp(22px, 3vw, 36px)", fontWeight: 800, letterSpacing: "-0.02em", marginBottom: 8 }}>Why Traders Choose VIXUS AI</h2>
          <p style={{ fontSize: 14, color: "#64748B" }}>Secured &amp; Trusted</p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {WHY_CHOOSE.map(w => (
            <div key={w.label} style={{ background: DARK_CARD, border: `1px solid ${BORDER}`, borderRadius: 18, padding: "22px 14px", textAlign: "center" }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: "rgba(124,58,237,0.12)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                <w.icon size={19} style={{ color: LIGHT_PURPLE }} />
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#F1F5F9", lineHeight: 1.4, marginBottom: 4 }}>{w.label}</div>
              <div style={{ fontSize: 10, color: "#475569" }}>{w.sub}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section style={{ padding: "80px 16px 48px", position: "relative", zIndex: 1, maxWidth: 1280, margin: "0 auto" }}>
        <div className="cta-card" style={{ background: "linear-gradient(135deg, rgba(124,58,237,0.18) 0%, rgba(79,70,229,0.1) 50%, rgba(7,9,26,0.95) 100%)", border: "1px solid rgba(124,58,237,0.28)", borderRadius: 26, padding: "60px 44px", position: "relative", overflow: "hidden", textAlign: "center" }}>
          <div style={{ position: "absolute", top: -80, left: "25%", width: 400, height: 400, borderRadius: "50%", background: "radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)", pointerEvents: "none" }} />
          <div style={{ position: "relative" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", borderRadius: 100, padding: "5px 14px", marginBottom: 22 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: GREEN, display: "inline-block", animation: "pulse 1.5s infinite" }} />
              <span style={{ fontSize: 11, fontWeight: 700, color: GREEN, letterSpacing: "0.06em" }}>128,400+ TRADERS ACTIVE RIGHT NOW</span>
            </div>
            <h2 style={{ fontSize: "clamp(26px, 3.5vw, 48px)", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 14, lineHeight: 1.1 }}>
              Your capital deserves<br />to work harder.
            </h2>
            <p style={{ fontSize: 16, color: "#64748B", marginBottom: 36, maxWidth: 480, margin: "0 auto 36px" }}>
              Join traders who stopped watching charts and started letting AI handle the execution.
            </p>
            <button onClick={handleStart}
              style={{ height: 56, borderRadius: 14, fontSize: 17, fontWeight: 700, background: "linear-gradient(135deg, #7C3AED, #4F46E5)", color: "#fff", border: "none", cursor: "pointer", padding: "0 44px", display: "inline-flex", alignItems: "center", gap: 9, boxShadow: "0 8px 48px rgba(124,58,237,0.5)" }}>
              Open Free Account <ArrowRight size={19} />
            </button>
            <p style={{ textAlign: "center", fontSize: 12, color: "#334155", marginTop: 16 }}>Free to start · Withdraw anytime · No hidden fees</p>
          </div>
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ borderTop: "1px solid rgba(124,58,237,0.08)", position: "relative", zIndex: 1 }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", padding: "48px 24px 32px" }}>
          <div className="grid md:grid-cols-4 gap-10" style={{ marginBottom: 40 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
                <VixusLogo className="w-6 h-6" />
                <span style={{ fontWeight: 900, fontSize: 15, letterSpacing: "0.04em" }}>VIXUS <span style={{ color: LIGHT_PURPLE }}>AI</span></span>
              </div>
              <p style={{ fontSize: 12, color: "#334155", lineHeight: 1.7, maxWidth: 200 }}>Institutional-grade AI trading for everyone. Automate your strategy across 11+ markets.</p>
            </div>
            {[
              { title: "Product", links: ["Markets", "Trading", "AI Bots", "Portfolio", "Analytics"] },
              { title: "Company", links: ["About Us", "Pricing", "Blog", "Careers", "Contact"] },
              { title: "Legal",   links: ["Terms of Service", "Privacy Policy", "Cookie Policy", "Risk Disclosure"] },
            ].map(col => (
              <div key={col.title}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 16 }}>{col.title}</div>
                {col.links.map(l => (
                  <div key={l} style={{ fontSize: 13, color: "#334155", marginBottom: 10, cursor: "pointer" }}>{l}</div>
                ))}
              </div>
            ))}
          </div>
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.04)", paddingTop: 24, display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
            <p style={{ fontSize: 11, color: "#1E293B" }}>© {new Date().getFullYear()} VIXUS AI. All rights reserved.</p>
            <p style={{ fontSize: 10, color: "#1E293B", maxWidth: 520, lineHeight: 1.6, textAlign: "right" }}>Trading involves significant risk of loss. Past performance is not indicative of future results. Capital at risk. Not financial advice.</p>
          </div>
        </div>
      </footer>

      <style>{`
        @keyframes ticker { from { transform: translateX(0) } to { transform: translateX(-50%) } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }

        /* ── Tailwind-compat responsive helpers ── */
        @media (max-width: 767px) {
          .hidden.md\\:flex, .hidden.md\\:block { display: none !important; }
          .md\\:hidden { display: block !important; }
          .hidden.sm\\:block { display: none !important; }
          .md\\:grid-cols-2, .md\\:grid-cols-3, .md\\:grid-cols-4 { grid-template-columns: 1fr !important; }
          .lg\\:grid-cols-4 { grid-template-columns: 1fr 1fr !important; }
          .lg\\:grid-cols-6 { grid-template-columns: 1fr 1fr 1fr !important; }

          /* Hero */
          .hero-section { padding: 48px 16px 40px !important; }

          /* Stats bar */
          .stats-bar { margin-top: 40px !important; padding: 20px 16px !important; }

          /* Trader photo: shorter, text full-width, hide float cards */
          .trader-photo-wrap { height: 300px !important; border-radius: 16px !important; }
          .trader-text-overlay { left: 0 !important; right: 0 !important; max-width: 100% !important; padding: 0 20px !important; }
          .trader-desc { display: none !important; }
          .trader-price-cards { display: none !important; }

          /* Security card */
          .security-card { padding: 28px 20px !important; border-radius: 18px !important; }

          /* CTA card */
          .cta-card { padding: 40px 20px !important; border-radius: 20px !important; }

          /* Footer grid */
          .md\\:grid-cols-4 { grid-template-columns: 1fr 1fr !important; }
        }

        @media (min-width: 768px) {
          .md\\:hidden { display: none !important; }
          .hidden.md\\:flex { display: flex !important; }
          .hidden.md\\:block, .hidden.sm\\:block { display: block !important; }
          .md\\:grid-cols-2 { grid-template-columns: repeat(2, 1fr) !important; }
          .md\\:grid-cols-3 { grid-template-columns: repeat(3, 1fr) !important; }
          .md\\:grid-cols-4 { grid-template-columns: repeat(4, 1fr) !important; }
          .lg\\:grid-cols-4 { grid-template-columns: repeat(4, 1fr) !important; }
          .lg\\:grid-cols-6 { grid-template-columns: repeat(6, 1fr) !important; }
        }

        /* Smooth transitions */
        button { transition: opacity 0.15s, transform 0.12s; }
        button:active { transform: scale(0.97); }
      `}</style>
    </div>
  );
}
