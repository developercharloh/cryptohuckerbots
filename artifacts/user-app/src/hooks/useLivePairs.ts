import { useState, useEffect, useCallback, useRef } from "react";
import { fetchWithTimeout } from "@/lib/api-base";

export type LivePair = {
  symbol: string;
  base: string;
  quote: string;
  price: number;
  prev: number;
  change: number; // 24h % change (drifts with simulation)
  volume: string;
  category: "forex" | "crypto" | "commodities";
  icon: string;
  binance: string; // binance symbol or "" for forex/commodities
  flash: boolean;
  up: boolean;
};

export const BASE_PAIRS: LivePair[] = [
  // Forex
  { symbol: "EUR/USD", base: "EUR", quote: "USD", price: 1.08412, prev: 1.08412, change: 0.23, volume: "$482B", category: "forex", icon: "🇪🇺", binance: "", flash: false, up: true },
  { symbol: "GBP/USD", base: "GBP", quote: "USD", price: 1.27105, prev: 1.27105, change: 0.41, volume: "$251B", category: "forex", icon: "🇬🇧", binance: "", flash: false, up: true },
  { symbol: "USD/JPY", base: "USD", quote: "JPY", price: 153.420, prev: 153.420, change: -0.18, volume: "$371B", category: "forex", icon: "🇯🇵", binance: "", flash: false, up: false },
  { symbol: "USD/CHF", base: "USD", quote: "CHF", price: 0.90215, prev: 0.90215, change: -0.09, volume: "$134B", category: "forex", icon: "🇨🇭", binance: "", flash: false, up: false },
  { symbol: "AUD/USD", base: "AUD", quote: "USD", price: 0.65340, prev: 0.65340, change: 0.57, volume: "$163B", category: "forex", icon: "🇦🇺", binance: "", flash: false, up: true },
  { symbol: "NZD/USD", base: "NZD", quote: "USD", price: 0.59820, prev: 0.59820, change: 0.32, volume: "$82B", category: "forex", icon: "🇳🇿", binance: "", flash: false, up: true },
  { symbol: "USD/CAD", base: "USD", quote: "CAD", price: 1.36105, prev: 1.36105, change: -0.14, volume: "$119B", category: "forex", icon: "🇨🇦", binance: "", flash: false, up: false },
  { symbol: "EUR/GBP", base: "EUR", quote: "GBP", price: 0.85310, prev: 0.85310, change: -0.11, volume: "$72B", category: "forex", icon: "🇪🇺", binance: "", flash: false, up: false },
  { symbol: "EUR/JPY", base: "EUR", quote: "JPY", price: 166.240, prev: 166.240, change: 0.08, volume: "$98B", category: "forex", icon: "🇪🇺", binance: "", flash: false, up: true },
  { symbol: "GBP/JPY", base: "GBP", quote: "JPY", price: 195.420, prev: 195.420, change: 0.19, volume: "$61B", category: "forex", icon: "🇬🇧", binance: "", flash: false, up: true },
  // Crypto
  { symbol: "BTC/USD", base: "BTC", quote: "USD", price: 67821.50, prev: 67821.50, change: 1.25, volume: "$38B", category: "crypto", icon: "₿", binance: "BTCUSDT", flash: false, up: true },
  { symbol: "ETH/USD", base: "ETH", quote: "USD", price: 3512.80, prev: 3512.80, change: 2.04, volume: "$22B", category: "crypto", icon: "Ξ", binance: "ETHUSDT", flash: false, up: true },
  { symbol: "BNB/USD", base: "BNB", quote: "USD", price: 598.40, prev: 598.40, change: -0.87, volume: "$4B", category: "crypto", icon: "B", binance: "BNBUSDT", flash: false, up: false },
  { symbol: "SOL/USD", base: "SOL", quote: "USD", price: 182.50, prev: 182.50, change: 3.41, volume: "$6B", category: "crypto", icon: "◎", binance: "SOLUSDT", flash: false, up: true },
  { symbol: "XRP/USD", base: "XRP", quote: "USD", price: 0.5824, prev: 0.5824, change: -1.12, volume: "$3B", category: "crypto", icon: "✕", binance: "XRPUSDT", flash: false, up: false },
  { symbol: "ADA/USD", base: "ADA", quote: "USD", price: 0.4521, prev: 0.4521, change: 0.88, volume: "$1B", category: "crypto", icon: "A", binance: "ADAUSDT", flash: false, up: true },
  { symbol: "AVAX/USD", base: "AVAX", quote: "USD", price: 38.21, prev: 38.21, change: 4.12, volume: "$1.2B", category: "crypto", icon: "▲", binance: "AVAXUSDT", flash: false, up: true },
  { symbol: "MATIC/USD", base: "MATIC", quote: "USD", price: 0.8810, prev: 0.8810, change: 1.55, volume: "$890M", category: "crypto", icon: "M", binance: "MATICUSDT", flash: false, up: true },
  // Commodities
  { symbol: "XAU/USD", base: "XAU", quote: "USD", price: 2342.80, prev: 2342.80, change: -0.09, volume: "$142B", category: "commodities", icon: "🥇", binance: "XAUUSDT", flash: false, up: false },
  { symbol: "XAG/USD", base: "XAG", quote: "USD", price: 29.450, prev: 29.450, change: 0.34, volume: "$28B", category: "commodities", icon: "🥈", binance: "", flash: false, up: true },
  { symbol: "OIL/USD", base: "OIL", quote: "USD", price: 82.340, prev: 82.340, change: -0.61, volume: "$51B", category: "commodities", icon: "🛢", binance: "", flash: false, up: false },
  { symbol: "GAS/USD", base: "GAS", quote: "USD", price: 2.1840, prev: 2.1840, change: 1.22, volume: "$18B", category: "commodities", icon: "⛽", binance: "", flash: false, up: true },
];

export function fmtPrice(p: number): string {
  if (p > 10000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p > 100) return p.toFixed(2);
  if (p > 1) return p.toFixed(5);
  return p.toFixed(5);
}

/**
 * Shared real-time market data hook.
 * - Crypto prices stream live from Binance WebSocket (miniTicker).
 * - Forex prices poll from a live FX rates API every 60s.
 * - A light simulation layer keeps all pairs ticking between real updates.
 * Used by both the Markets page and the Dashboard "Markets" preview so prices
 * stay consistent across the app.
 */
export function useLivePairs() {
  const [pairs, setPairs] = useState<LivePair[]>(BASE_PAIRS);

  const applyPrice = useCallback((binance: string, newPrice: number) => {
    setPairs(prev => prev.map(p => {
      if (p.binance !== binance) return p;
      const change = p.prev ? ((newPrice - p.prev) / p.prev) * 100 : p.change;
      return { ...p, prev: p.price, price: newPrice, change, up: newPrice >= p.price, flash: true };
    }));
    setTimeout(() => setPairs(prev => prev.map(p => p.binance === binance ? { ...p, flash: false } : p)), 500);
  }, []);

  // 1.5-second simulation for every pair (keeps things moving between real ticks)
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
      if (attempts > 3) return;
      attempts++;
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
        const r = await fetchWithTimeout("https://open.er-api.com/v6/latest/USD");
        const d = await r.json();
        if (d.result === "success") rates = d.rates;
      } catch {}
      if (!rates) {
        try {
          const r = await fetchWithTimeout("https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY,CHF,AUD,NZD,CAD");
          const d = await r.json();
          rates = d.rates;
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
