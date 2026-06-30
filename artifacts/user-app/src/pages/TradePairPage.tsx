import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { createChart, CandlestickSeries, LineSeries, UTCTimestamp } from "lightweight-charts";
import { Layout } from "@/components/Layout";
import { ArrowLeft, TrendingUp, TrendingDown, Activity, ChevronDown } from "lucide-react";

const PURPLE = "#6C47FF";

/* ── Pair metadata ─────────────────────────────────────────────── */
interface PairMeta {
  label: string;
  price: number;
  change: number;
  vol: string;
  category: "crypto" | "forex" | "commodities";
  binanceSymbol?: string;
  yahooSymbol?: string;
}

const PAIR_META: Record<string, PairMeta> = {
  "EUR-USD":  { label:"EUR/USD",  price:1.08412,    change:0.23,  vol:"$482B", category:"forex",       yahooSymbol:"EURUSD=X" },
  "GBP-USD":  { label:"GBP/USD",  price:1.27105,    change:0.41,  vol:"$251B", category:"forex",       yahooSymbol:"GBPUSD=X" },
  "USD-JPY":  { label:"USD/JPY",  price:153.42,     change:-0.18, vol:"$371B", category:"forex",       yahooSymbol:"USDJPY=X" },
  "USD-CHF":  { label:"USD/CHF",  price:0.90215,    change:-0.09, vol:"$134B", category:"forex",       yahooSymbol:"USDCHF=X" },
  "AUD-USD":  { label:"AUD/USD",  price:0.6534,     change:0.57,  vol:"$163B", category:"forex",       yahooSymbol:"AUDUSD=X" },
  "NZD-USD":  { label:"NZD/USD",  price:0.5982,     change:0.32,  vol:"$82B",  category:"forex",       yahooSymbol:"NZDUSD=X" },
  "USD-CAD":  { label:"USD/CAD",  price:1.36105,    change:-0.14, vol:"$119B", category:"forex",       yahooSymbol:"USDCAD=X" },
  "EUR-GBP":  { label:"EUR/GBP",  price:0.8531,     change:-0.11, vol:"$72B",  category:"forex",       yahooSymbol:"EURGBP=X" },
  "EUR-JPY":  { label:"EUR/JPY",  price:166.24,     change:0.08,  vol:"$98B",  category:"forex",       yahooSymbol:"EURJPY=X" },
  "GBP-JPY":  { label:"GBP/JPY",  price:195.42,     change:0.19,  vol:"$61B",  category:"forex",       yahooSymbol:"GBPJPY=X" },
  "BTC-USD":  { label:"BTC/USDT", price:67821.5,    change:1.25,  vol:"$38B",  category:"crypto",      binanceSymbol:"BTCUSDT" },
  "ETH-USD":  { label:"ETH/USDT", price:3512.8,     change:2.04,  vol:"$22B",  category:"crypto",      binanceSymbol:"ETHUSDT" },
  "BNB-USD":  { label:"BNB/USDT", price:598.4,      change:-0.87, vol:"$4B",   category:"crypto",      binanceSymbol:"BNBUSDT" },
  "SOL-USD":  { label:"SOL/USDT", price:182.5,      change:3.41,  vol:"$6B",   category:"crypto",      binanceSymbol:"SOLUSDT" },
  "XRP-USD":  { label:"XRP/USDT", price:0.5824,     change:-1.12, vol:"$3B",   category:"crypto",      binanceSymbol:"XRPUSDT" },
  "ADA-USD":  { label:"ADA/USDT", price:0.4521,     change:0.88,  vol:"$1B",   category:"crypto",      binanceSymbol:"ADAUSDT" },
  "AVAX-USD": { label:"AVAX/USDT",price:38.21,      change:4.12,  vol:"$1.2B", category:"crypto",      binanceSymbol:"AVAXUSDT" },
  "MATIC-USD":{ label:"MATIC/USDT",price:0.881,     change:1.55,  vol:"$890M", category:"crypto",      binanceSymbol:"MATICUSDT" },
  "XAU-USD":  { label:"XAU/USD",  price:2342.8,     change:-0.09, vol:"$142B", category:"commodities", yahooSymbol:"GC=F" },
  "XAG-USD":  { label:"XAG/USD",  price:29.45,      change:0.34,  vol:"$28B",  category:"commodities", yahooSymbol:"SI=F" },
  "OIL-USD":  { label:"OIL/USD",  price:82.34,      change:-0.61, vol:"$51B",  category:"commodities", yahooSymbol:"CL=F" },
  "GAS-USD":  { label:"GAS/USD",  price:2.184,      change:1.22,  vol:"$18B",  category:"commodities", yahooSymbol:"NG=F" },
};

/* ── Candle data types ─────────────────────────────────────────── */
interface Candle { time: number; open: number; high: number; low: number; close: number; }

/* ── Timeframes ─────────────────────────────────────────────────── */
const TIMEFRAMES = ["1m","5m","15m","1h","4h","1d"] as const;
type TF = typeof TIMEFRAMES[number];

const BINANCE_INTERVAL: Record<TF, string> = {
  "1m":"1m","5m":"5m","15m":"15m","1h":"1h","4h":"4h","1d":"1d"
};

/* ── Seeded PRNG for realistic-looking forex candles ────────────── */
function seededRand(seed: number) {
  let s = seed;
  return () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
}
function generateCandles(symbol: string, basePrice: number, count = 100): Candle[] {
  let seed = 0;
  for (let i = 0; i < symbol.length; i++) seed += symbol.charCodeAt(i) * (i + 1);
  const rand = seededRand(seed);
  const now = Math.floor(Date.now() / 1000);
  const interval = 3600; // 1h
  let price = basePrice;
  const candles: Candle[] = [];
  for (let i = count; i >= 0; i--) {
    const t = now - i * interval;
    const open = price;
    const body = (rand() - 0.49) * basePrice * 0.003;
    const close = open + body;
    const wick1 = rand() * basePrice * 0.002;
    const wick2 = rand() * basePrice * 0.002;
    const high = Math.max(open, close) + wick1;
    const low  = Math.min(open, close) - wick2;
    candles.push({ time: t, open: +open.toFixed(5), high: +high.toFixed(5), low: +low.toFixed(5), close: +close.toFixed(5) });
    price = close;
  }
  return candles;
}

/* ── Fetch candles from Binance ─────────────────────────────────── */
async function fetchBinanceCandles(binanceSymbol: string, interval: string): Promise<Candle[]> {
  const limit = interval === "1d" ? 90 : 100;
  const url = `https://api.binance.com/api/v3/klines?symbol=${binanceSymbol}&interval=${interval}&limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json() as [number, string, string, string, string, ...unknown[]][];
  return data.map(k => ({
    time: Math.floor(k[0] / 1000),
    open:  parseFloat(k[1]),
    high:  parseFloat(k[2]),
    low:   parseFloat(k[3]),
    close: parseFloat(k[4]),
  }));
}

/* ── Simple RSI calculation ─────────────────────────────────────── */
function calcRSI(candles: Candle[], period = 14): number {
  if (candles.length < period + 1) return 50;
  const closes = candles.map(c => c.close);
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const rs = gains / (losses || 0.0001);
  return +(100 - 100 / (1 + rs)).toFixed(1);
}

/* ── Leverage options ───────────────────────────────────────────── */
const LEVERAGES = [5, 10, 20, 50, 100];

/* ── Main component ─────────────────────────────────────────────── */
export default function TradePairPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = params.symbol ?? "BTC-USD";
  const [, setLocation] = useLocation();

  const meta = PAIR_META[symbol] ?? {
    label: symbol.replace("-", "/"), price: 1, change: 0, vol: "-", category: "forex" as const
  };

  const [tf, setTf] = useState<TF>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPrice, setCurrentPrice] = useState(meta.price);
  const [rsi, setRsi] = useState(50);

  // Trade panel state
  const [tradeType, setTradeType] = useState<"market" | "limit">("market");
  const [side, setSide] = useState<"long" | "short">("long");
  const [amount, setAmount] = useState("1,000.00");
  const [leverage, setLeverage] = useState(10);
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [executed, setExecuted] = useState(false);

  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<ReturnType<typeof createChart> | null>(null);

  /* ── Load candles ─────────────────────────────────────── */
  const loadCandles = useCallback(async () => {
    setLoading(true);
    try {
      let data: Candle[];
      if (meta.binanceSymbol) {
        data = await fetchBinanceCandles(meta.binanceSymbol, BINANCE_INTERVAL[tf]);
      } else {
        data = generateCandles(symbol + tf, meta.price, 100);
      }
      setCandles(data);
      if (data.length) {
        const last = data[data.length - 1].close;
        setCurrentPrice(last);
        setRsi(calcRSI(data));
        const tp = last * (side === "long" ? 1.02 : 0.98);
        const sl = last * (side === "long" ? 0.985 : 1.015);
        setTakeProfit(tp.toFixed(meta.price < 10 ? 5 : 2));
        setStopLoss(sl.toFixed(meta.price < 10 ? 5 : 2));
      }
    } catch {
      const data = generateCandles(symbol + tf, meta.price, 100);
      setCandles(data);
      setCurrentPrice(meta.price);
    } finally {
      setLoading(false);
    }
  }, [symbol, tf, meta.binanceSymbol, meta.price, side]);

  useEffect(() => { loadCandles(); }, [loadCandles]);

  /* ── Build chart ──────────────────────────────────────── */
  useEffect(() => {
    if (!chartRef.current || candles.length === 0) return;
    chartRef.current.innerHTML = "";

    const chart = createChart(chartRef.current, {
      width: chartRef.current.clientWidth,
      height: 260,
      layout: { background: { color: "#0F1117" }, textColor: "#9CA3AF" },
      grid: { vertLines: { color: "rgba(255,255,255,0.04)" }, horzLines: { color: "rgba(255,255,255,0.04)" } },
      crosshair: { mode: 1 },
      rightPriceScale: { borderColor: "rgba(255,255,255,0.08)" },
      timeScale: { borderColor: "rgba(255,255,255,0.08)", timeVisible: true, secondsVisible: false },
    });
    chartInstance.current = chart;

    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor:       "#22c55e",
      downColor:     "#ef4444",
      borderVisible: false,
      wickUpColor:   "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeries.setData(candles.map(c => ({ ...c, time: c.time as UTCTimestamp })));
    chart.timeScale().fitContent();

    const obs = new ResizeObserver(() => {
      if (chartRef.current) chart.applyOptions({ width: chartRef.current.clientWidth });
    });
    obs.observe(chartRef.current);
    return () => { obs.disconnect(); chart.remove(); };
  }, [candles]);

  const up = meta.change >= 0;
  const risk = leverage <= 10 ? "Low" : leverage <= 20 ? "Medium" : "High";
  const riskColor = risk === "Low" ? "#22c55e" : risk === "Medium" ? "#F59E0B" : "#ef4444";

  function formatPrice(p: number) {
    if (p > 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (p > 10)   return p.toFixed(3);
    return p.toFixed(5);
  }

  function handleExecute() {
    setExecuted(true);
    setTimeout(() => setExecuted(false), 2500);
  }

  return (
    <Layout>
      <div style={{ background: "#0F1117", minHeight: "100vh", paddingBottom: 80 }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 0" }}>
          <button onClick={() => setLocation("/markets")}
            style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, padding: 8, cursor: "pointer", color: "#fff", display: "flex" }}>
            <ArrowLeft size={18} />
          </button>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>{meta.label}</span>
              <span style={{
                fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6,
                background: up ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                color: up ? "#22c55e" : "#ef4444",
              }}>
                {up ? "+" : ""}{meta.change.toFixed(2)}%
              </span>
            </div>
            <span style={{ fontSize: 22, fontWeight: 800, color: "#fff", fontFamily: "'JetBrains Mono', monospace" }}>
              {formatPrice(currentPrice)}
            </span>
          </div>
          <button style={{ background: "rgba(255,255,255,0.06)", border: "none", borderRadius: 10, padding: "6px 12px", cursor: "pointer", color: "#9CA3AF", display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 600 }}>
            {tf} <ChevronDown size={13} />
          </button>
        </div>

        {/* ── Timeframe tabs ──────────────────────────────── */}
        <div style={{ display: "flex", gap: 4, padding: "10px 16px 0", overflowX: "auto" }}>
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)} style={{
              padding: "4px 12px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 11, fontWeight: 700,
              background: tf === t ? PURPLE : "rgba(255,255,255,0.06)",
              color: tf === t ? "#fff" : "#9CA3AF", whiteSpace: "nowrap",
            }}>{t}</button>
          ))}
        </div>

        {/* ── Candlestick chart ───────────────────────────── */}
        <div style={{ margin: "10px 0 0", position: "relative" }}>
          {loading && (
            <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#0F1117" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${PURPLE}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
            </div>
          )}
          <div ref={chartRef} style={{ width: "100%", height: 260 }} />
        </div>

        {/* ── Indicators bar ──────────────────────────────── */}
        <div style={{ display: "flex", gap: 16, padding: "10px 16px", overflowX: "auto", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          {[
            { label: "RSI (14)", value: rsi.toString(), color: rsi > 70 ? "#ef4444" : rsi < 30 ? "#22c55e" : "#9CA3AF" },
            { label: "MACD",  value: up ? "Bullish ↑" : "Bearish ↓", color: up ? "#22c55e" : "#ef4444" },
            { label: "Vol (24h)", value: meta.vol, color: "#9CA3AF" },
            { label: "Trend",  value: up ? "Up" : "Down", color: up ? "#22c55e" : "#ef4444" },
          ].map(ind => (
            <div key={ind.label} style={{ flexShrink: 0 }}>
              <span style={{ fontSize: 10, color: "#6B7280", display: "block" }}>{ind.label}</span>
              <span style={{ fontSize: 12, fontWeight: 700, color: ind.color }}>{ind.value}</span>
            </div>
          ))}
        </div>

        {/* ── Trade panel ─────────────────────────────────── */}
        <div style={{ padding: "16px" }}>

          {/* Market / Limit tabs */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, marginBottom: 16 }}>
            {(["market","limit"] as const).map(t => (
              <button key={t} onClick={() => setTradeType(t)} style={{
                flex: 1, padding: "8px 0", borderRadius: 9, border: "none", cursor: "pointer",
                fontSize: 13, fontWeight: 700, textTransform: "capitalize",
                background: tradeType === t ? "#fff" : "transparent",
                color: tradeType === t ? "#111" : "#6B7280",
              }}>{t.charAt(0).toUpperCase() + t.slice(1)}</button>
            ))}
          </div>

          {/* Long / Short toggle */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <button onClick={() => setSide("long")} style={{
              flex: 1, padding: "12px 0", borderRadius: 12, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 800, letterSpacing: "0.05em",
              background: side === "long" ? "#22c55e" : "rgba(34,197,94,0.1)",
              color: side === "long" ? "#fff" : "#22c55e",
            }}>
              <TrendingUp size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              LONG / BUY
            </button>
            <button onClick={() => setSide("short")} style={{
              flex: 1, padding: "12px 0", borderRadius: 12, border: "none", cursor: "pointer",
              fontSize: 14, fontWeight: 800, letterSpacing: "0.05em",
              background: side === "short" ? "#ef4444" : "rgba(239,68,68,0.1)",
              color: side === "short" ? "#fff" : "#ef4444",
            }}>
              <TrendingDown size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} />
              SHORT / SELL
            </button>
          </div>

          {/* Amount */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Amount (USDT)</label>
            <input
              value={amount}
              onChange={e => setAmount(e.target.value)}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12, fontSize: 16, fontWeight: 700,
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "#fff", outline: "none", boxSizing: "border-box", fontFamily: "'JetBrains Mono', monospace",
              }}
            />
          </div>

          {/* Leverage */}
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Leverage</label>
            <div style={{ display: "flex", gap: 8 }}>
              {LEVERAGES.map(lv => (
                <button key={lv} onClick={() => setLeverage(lv)} style={{
                  flex: 1, padding: "8px 0", borderRadius: 10, border: "none", cursor: "pointer",
                  fontSize: 12, fontWeight: 700,
                  background: leverage === lv ? PURPLE : "rgba(255,255,255,0.06)",
                  color: leverage === lv ? "#fff" : "#9CA3AF",
                }}>{lv}x</button>
              ))}
            </div>
          </div>

          {/* Take Profit / Stop Loss */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Take Profit</label>
              <input value={takeProfit} onChange={e => setTakeProfit(e.target.value)} style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: "rgba(34,197,94,0.08)", border: "1px solid rgba(34,197,94,0.3)",
                color: "#22c55e", outline: "none", boxSizing: "border-box", fontFamily: "'JetBrains Mono', monospace",
              }} />
            </div>
            <div>
              <label style={{ fontSize: 10, fontWeight: 600, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em", display: "block", marginBottom: 6 }}>Stop Loss</label>
              <input value={stopLoss} onChange={e => setStopLoss(e.target.value)} style={{
                width: "100%", padding: "10px 12px", borderRadius: 10, fontSize: 13, fontWeight: 700,
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)",
                color: "#ef4444", outline: "none", boxSizing: "border-box", fontFamily: "'JetBrains Mono', monospace",
              }} />
            </div>
          </div>

          {/* Risk indicator */}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 14 }}>
            <Activity size={13} style={{ color: riskColor }} />
            <span style={{ fontSize: 11, color: "#6B7280" }}>Risk: <span style={{ color: riskColor, fontWeight: 700 }}>{risk}</span></span>
          </div>

          {/* Execute button */}
          <button onClick={handleExecute} style={{
            width: "100%", padding: "16px 0", borderRadius: 14, border: "none", cursor: "pointer",
            fontSize: 15, fontWeight: 900, letterSpacing: "0.08em", color: "#fff",
            background: executed
              ? "#22c55e"
              : `linear-gradient(135deg, ${PURPLE} 0%, #4F46E5 100%)`,
            transition: "background 0.3s",
          }}>
            {executed
              ? "✓ ORDER PLACED"
              : `EXECUTE — ${meta.label} ${side === "long" ? "L" : "S"}`
            }
          </button>

          {/* Feature cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 20 }}>
            {[
              { icon: "🔄", title: "Multi-Exchange", desc: "Execute across 40+ exchanges from a single interface" },
              { icon: "🛡", title: "Risk Management", desc: "Automated stop-loss, take-profit, and portfolio hedging" },
              { icon: "⚡", title: "Instant Execution", desc: "Sub-millisecond order routing for optimal fill price" },
            ].map(c => (
              <div key={c.title} style={{
                display: "flex", alignItems: "flex-start", gap: 14, padding: "14px 16px",
                background: "rgba(255,255,255,0.04)", borderRadius: 14, border: "1px solid rgba(255,255,255,0.07)",
              }}>
                <div style={{ width: 38, height: 38, borderRadius: 10, background: "rgba(108,71,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 17, flexShrink: 0 }}>
                  {c.icon}
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#fff", marginBottom: 3 }}>{c.title}</p>
                  <p style={{ fontSize: 11, color: "#6B7280", lineHeight: 1.5 }}>{c.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}
