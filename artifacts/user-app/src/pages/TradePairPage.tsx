import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { createChart, CandlestickSeries, UTCTimestamp } from "lightweight-charts";
import { Layout } from "@/components/Layout";
import { getMarketCandles, useGetTradeAccess } from "@workspace/api-client-react";
import type { MarketCandle } from "@workspace/api-client-react";
import { ArrowLeft, TrendingUp, TrendingDown, Activity, ChevronDown, ArrowRight, Zap, ShieldCheck, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";

const PURPLE = "#F5B942";

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
type Candle = MarketCandle;

/* ── Timeframes ─────────────────────────────────────────────────── */
const TIMEFRAMES = ["1m","5m","15m","1h","4h","1d"] as const;
type TF = typeof TIMEFRAMES[number];

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

/* ── Main component ─────────────────────────────────────────────── */
export default function TradePairPage() {
  const params = useParams<{ symbol: string }>();
  const symbol = params.symbol ?? "BTC-USD";
  const [, setLocation] = useLocation();
  const { data: vipAccess } = useGetTradeAccess({ query: { refetchInterval: 15000 } as any });
  const meta = PAIR_META[symbol] ?? {
    label: symbol.replace("-", "/"), price: 1, change: 0, vol: "-", category: "forex" as const
  };

  const [tf, setTf] = useState<TF>("1h");
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState(true);
  const [chartError, setChartError] = useState<string | null>(null);
  const [currentPrice, setCurrentPrice] = useState(meta.price);
  const [priceUp, setPriceUp] = useState(meta.change >= 0);
  const [marketChange, setMarketChange] = useState(meta.change);
  const [rsi, setRsi] = useState(50);

  const chartRef      = useRef<HTMLDivElement>(null);
  const chartApiRef   = useRef<ReturnType<typeof createChart> | null>(null);

  /* ── Load candles ─────────────────────────────────────── */
  const loadCandles = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setLoading(true);
    setChartError(null);
    try {
      const data = await getMarketCandles({ symbol, interval: tf });
      setCandles(data);
      if (data.length) {
        const last = data[data.length - 1].close;
        const previous = data[data.length - 2]?.close ?? meta.price;
        const lookback = tf === "1d" ? 1 : tf === "4h" ? 6 : tf === "1h" ? 24 : tf === "15m" ? 96 : tf === "5m" ? 100 : 100;
        const reference = data[Math.max(0, data.length - 1 - lookback)]?.close ?? previous;
        setCurrentPrice(last);
        setPriceUp(last >= previous);
        setMarketChange(reference ? ((last - reference) / reference) * 100 : meta.change);
        setRsi(calcRSI(data));
      }
    } catch {
      if (showSpinner) setCandles([]);
      setChartError("Live market data is temporarily unavailable.");
    } finally {
      if (showSpinner) setLoading(false);
    }
  }, [symbol, tf, meta.price]);

  useEffect(() => {
    void loadCandles(true);
    const refreshMs = tf === "1m" || tf === "5m" || tf === "15m"
      ? 15_000
      : tf === "1h"
        ? 30_000
      : tf === "4h"
        ? 120_000
        : 300_000;
    const id = setInterval(() => { void loadCandles(false); }, refreshMs);
    return () => clearInterval(id);
  }, [loadCandles, tf]);

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
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: true,
        secondsVisible: false,
        rightOffset: 3,
        minBarSpacing: 1,
      },
      handleScale: {
        mouseWheel: true,
        pinch: true,
        axisPressedMouseMove: true,
        axisDoubleClickReset: true,
      },
      handleScroll: {
        mouseWheel: true,
        pressedMouseMove: true,
        horzTouchDrag: true,
        vertTouchDrag: true,
      },
    });
    chartApiRef.current = chart;
    const decimals = meta.price < 10 ? 5 : meta.price < 100 ? 3 : 2;
    const candleSeries = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e", downColor: "#ef4444",
      borderVisible: false,
      wickUpColor: "#22c55e", wickDownColor: "#ef4444",
      priceFormat: { type: "price", precision: decimals, minMove: 1 / Math.pow(10, decimals) },
    });
    const mapped = candles.map(c => ({ ...c, time: c.time as UTCTimestamp }));
    candleSeries.setData(mapped);
    let hasFittedToContainer = false;
    const fitToContainer = () => {
      const width = chartRef.current?.clientWidth ?? 0;
      if (width <= 0) return;
      chart.applyOptions({ width });
      chart.timeScale().fitContent();
      hasFittedToContainer = true;
    };
    fitToContainer();
    requestAnimationFrame(fitToContainer);

    const obs = new ResizeObserver(() => {
      const width = chartRef.current?.clientWidth ?? 0;
      if (width <= 0) return;
      chart.applyOptions({ width });
      // On mobile the first effect can run before the grid settles. Fit once
      // after the container receives its real width so candles start at the
      // left edge instead of leaving a blank time range.
      if (!hasFittedToContainer) chart.timeScale().fitContent();
    });
    obs.observe(chartRef.current);
    return () => {
      obs.disconnect();
      if (chartApiRef.current === chart) chartApiRef.current = null;
      chart.remove();
    };
  }, [candles]);

  const zoomIn = () => chartApiRef.current?.timeScale().zoom(0.5);
  const zoomOut = () => chartApiRef.current?.timeScale().zoom(-0.5);
  const resetZoom = () => chartApiRef.current?.timeScale().fitContent();

  const up = marketChange >= 0;
  function formatPrice(p: number) {
    if (p > 1000) return p.toLocaleString("en-US", { maximumFractionDigits: 2 });
    if (p > 10)   return p.toFixed(3);
    return p.toFixed(5);
  }

  return (
    <Layout>
      <div className="user-pair-page" style={{ background: "#0F1117", minHeight: "100vh", paddingBottom: 80 }}>

        {/* ── Header ─────────────────────────────────────── */}
        <div className="user-pair-header" style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 16px 0" }}>
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
                {up ? "+" : ""}{marketChange.toFixed(2)}%
              </span>
            </div>
            <span style={{
              fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace",
              color: "#fff",
            }}>
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
        <div className="user-pair-chart" style={{ margin: "10px 0 0", position: "relative" }}>
          <div style={{ position: "absolute", top: 8, right: 48, zIndex: 5, display: "flex", gap: 4 }}>
            {[
              { label: "Zoom in", icon: <ZoomIn size={14} />, action: zoomIn },
              { label: "Zoom out", icon: <ZoomOut size={14} />, action: zoomOut },
              { label: "Fit chart", icon: <RotateCcw size={14} />, action: resetZoom },
            ].map(control => (
              <button
                key={control.label}
                type="button"
                aria-label={control.label}
                title={control.label}
                onClick={control.action}
                style={{
                  width: 28, height: 28, padding: 0, display: "grid", placeItems: "center",
                  border: "1px solid rgba(255,255,255,0.12)", borderRadius: 7,
                  background: "rgba(15,17,23,0.88)", color: "#D1D5DB", cursor: "pointer",
                }}
              >
                {control.icon}
              </button>
            ))}
          </div>
          {loading && (
            <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "#0F1117" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", border: `3px solid ${PURPLE}`, borderTopColor: "transparent", animation: "spin 0.7s linear infinite" }} />
            </div>
          )}
          {chartError && !loading && (
            <div style={{ position: "absolute", inset: 0, zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, textAlign: "center", background: "#0F1117", color: "#9CA3AF", fontSize: 12 }}>
              {chartError}
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

        {/* ── AI Signals panel ─────────────────────────────── */}
        <div className="user-pair-panel" style={{ padding: "16px" }}>
          <div style={{ display: "flex", background: "rgba(255,255,255,0.05)", borderRadius: 12, padding: 4, marginBottom: 16 }}>
            <div style={{ flex: 1, padding: "9px 0", borderRadius: 9, background: "#fff", color: "#111", textAlign: "center", fontSize: 13, fontWeight: 800 }}>
              AI Signal
            </div>
            <div style={{ flex: 1, padding: "9px 0", color: "#6B7280", textAlign: "center", fontSize: 13, fontWeight: 700 }}>
              Signal history
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            <button onClick={() => setLocation(`/trade?pair=${encodeURIComponent(meta.label)}&direction=BUY`)} style={{
              flex: 1, padding: "13px 0", borderRadius: 12, border: "1px solid rgba(34,197,94,0.25)", cursor: "pointer",
              fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", background: "rgba(34,197,94,0.10)", color: "#22c55e",
            }}>
              <TrendingUp size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} /> LONG / BUY
            </button>
            <button onClick={() => setLocation(`/trade?pair=${encodeURIComponent(meta.label)}&direction=SELL`)} style={{
              flex: 1, padding: "13px 0", borderRadius: 12, border: "1px solid rgba(239,68,68,0.25)", cursor: "pointer",
              fontSize: 13, fontWeight: 800, letterSpacing: "0.04em", background: "rgba(239,68,68,0.10)", color: "#ef4444",
            }}>
              <TrendingDown size={14} style={{ display: "inline", marginRight: 6, verticalAlign: "middle" }} /> SHORT / SELL
            </button>
          </div>

          <div style={{ borderRadius: 18, padding: 16, border: `1px solid ${PURPLE}44`, background: "linear-gradient(145deg, rgba(245,185,66,0.12), rgba(37,99,235,0.08))", marginBottom: 14 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(245,185,66,0.2)", color: PURPLE }}>
                  <Activity size={19} />
                </div>
                <div>
                  <p style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>AI Signal for {meta.label}</p>
                  <p style={{ fontSize: 11, color: "#9CA3AF", marginTop: 3 }}>Review before you execute</p>
                </div>
              </div>
              <span style={{ display: "flex", alignItems: "center", gap: 4, borderRadius: 20, padding: "4px 8px", background: "rgba(34,197,94,0.12)", color: "#22c55e", fontSize: 10, fontWeight: 800 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#22c55e" }} /> SIGNALS LIVE
              </span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 10, marginBottom: 14 }}>
              <div style={{ padding: "10px 12px", borderRadius: 12, background: "rgba(0,0,0,0.18)" }}>
                <p style={{ fontSize: 10, color: "#6B7280", textTransform: "uppercase", letterSpacing: "0.08em" }}>Signal access</p>
                <p style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 5, fontSize: 13, color: "#fff", fontWeight: 700 }}><Zap size={13} color={PURPLE} /> Ready when available</p>
              </div>
            </div>
            <p style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.5, marginBottom: 14 }}>
              Review the live signal and confirm consent before execution.
            </p>
            {vipAccess && (
              <div style={{ borderRadius: 10, padding: "9px 10px", marginBottom: 12, background: vipAccess.vipLevel > 0 ? "rgba(245,185,66,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${vipAccess.vipLevel > 0 ? "rgba(245,185,66,0.18)" : "rgba(239,68,68,0.18)"}` }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <p style={{ fontSize: 10, color: vipAccess.vipLevel > 0 ? "#FFD86B" : "#FCA5A5", fontWeight: 700 }}>
                    {vipAccess.withdrawalGateActive
                      ? `Signal access paused · refer ${vipAccess.withdrawalReferralRequirement} users or upgrade to VIP 2`
                      : vipAccess.vipLevel > 0
                        ? `VIP ${vipAccess.vipLevel} · ${vipAccess.remainingToday} signal${vipAccess.remainingToday === 1 ? "" : "s"} remaining today`
                      : "VIP 1 access required before signal execution"}
                  </p>
                  {vipAccess.vipLevel > 0 && (vipAccess.nextLevel || vipAccess.withdrawalGateActive) && (
                    <button onClick={() => setLocation("/vip-packages")} style={{ flexShrink: 0, border: "none", background: "transparent", color: "#FFD86B", fontSize: 10, fontWeight: 800, cursor: "pointer" }}>
                      {vipAccess.withdrawalGateActive ? "Unlock VIP 2" : "Upgrade"}
                    </button>
                  )}
                </div>
              </div>
            )}
            <button onClick={() => setLocation(vipAccess?.vipLevel === 0 ? "/vip-packages" : `/trade?pair=${encodeURIComponent(meta.label)}`)} style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "14px 0", borderRadius: 12,
              border: "none", cursor: "pointer", fontSize: 14, fontWeight: 900, color: "#fff",
              background: "linear-gradient(135deg, #F5B942, #2563EB)",
            }}>
              {vipAccess?.vipLevel === 0 ? "BUY VIP PACKAGE" : vipAccess?.withdrawalGateActive ? "UNLOCK VIP 2" : "REVIEW AI SIGNAL"} <ArrowRight size={16} />
            </button>
          </div>

          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "12px 13px", borderRadius: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
            <ShieldCheck size={16} color="#9CA3AF" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: "#9CA3AF", lineHeight: 1.5 }}>
              No direct orders or leverage on this screen. You stay in control and approve each signal before execution.
            </p>
          </div>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </Layout>
  );
}
