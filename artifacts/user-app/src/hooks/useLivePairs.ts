import { useEffect, useState } from "react";
import { getMarketQuotes } from "@workspace/api-client-react";
import type { MarketQuote } from "@workspace/api-client-react";

export type LivePair = {
  symbol: string;
  base: string;
  quote: string;
  price: number | null;
  prev: number | null;
  change: number | null;
  volume: string;
  category: "forex" | "crypto" | "commodities";
  icon: string;
  binance: string;
  flash: boolean;
  up: boolean;
  status: "loading" | "live" | "unavailable";
  sparkline: MarketQuote["sparkline"];
};

function pair(
  symbol: string,
  category: LivePair["category"],
  icon: string,
  binance = "",
): LivePair {
  const [base, quote] = symbol.split("/");
  return {
    symbol,
    base,
    quote,
    price: null,
    prev: null,
    change: null,
    volume: "—",
    category,
    icon,
    binance,
    flash: false,
    up: true,
    status: "loading",
    sparkline: [],
  };
}

export const BASE_PAIRS: LivePair[] = [
  pair("EUR/USD", "forex", "🇪🇺"),
  pair("GBP/USD", "forex", "🇬🇧"),
  pair("USD/JPY", "forex", "🇯🇵"),
  pair("USD/CHF", "forex", "🇨🇭"),
  pair("AUD/USD", "forex", "🇦🇺"),
  pair("NZD/USD", "forex", "🇳🇿"),
  pair("USD/CAD", "forex", "🇨🇦"),
  pair("EUR/GBP", "forex", "🇪🇺"),
  pair("EUR/JPY", "forex", "🇪🇺"),
  pair("GBP/JPY", "forex", "🇬🇧"),
  pair("BTC/USD", "crypto", "₿", "BTCUSDT"),
  pair("ETH/USD", "crypto", "Ξ", "ETHUSDT"),
  pair("BNB/USD", "crypto", "B", "BNBUSDT"),
  pair("SOL/USD", "crypto", "◎", "SOLUSDT"),
  pair("XRP/USD", "crypto", "✕", "XRPUSDT"),
  pair("ADA/USD", "crypto", "A", "ADAUSDT"),
  pair("AVAX/USD", "crypto", "▲", "AVAXUSDT"),
  pair("MATIC/USD", "crypto", "M", "MATICUSDT"),
  pair("XAU/USD", "commodities", "🥇"),
  pair("XAG/USD", "commodities", "🥈"),
  pair("OIL/USD", "commodities", "🛢"),
  pair("GAS/USD", "commodities", "⛽"),
];

export function fmtPrice(p: number | null): string {
  if (p === null || !Number.isFinite(p)) return "—";
  if (p > 10000) return p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  if (p > 100) return p.toFixed(2);
  if (p > 1) return p.toFixed(5);
  return p.toFixed(5);
}

/** Shared server-authoritative market data hook used by Markets and Dashboard. */
export function useLivePairs() {
  const [pairs, setPairs] = useState<LivePair[]>(BASE_PAIRS);

  useEffect(() => {
    let cancelled = false;
    const symbols = BASE_PAIRS.map((item) => item.symbol.replace("/", "-")).join(",");

    const fetchQuotes = async () => {
      try {
        const quotes = await getMarketQuotes({ symbols });
        if (cancelled) return;
        const bySymbol = new Map(quotes.map((quote) => [quote.symbol, quote]));
        setPairs((previous) => previous.map((item) => {
          const quote = bySymbol.get(item.symbol.replace("/", "-"));
          if (!quote) return { ...item, flash: false, status: "unavailable" };
          const changed = item.price !== null && item.price !== quote.price;
          return {
            ...item,
            price: quote.price,
            prev: quote.previousClose,
            change: quote.changePercent,
            up: quote.changePercent >= 0,
            flash: changed,
            status: "live",
            sparkline: quote.sparkline,
          };
        }));
        window.setTimeout(() => {
          if (!cancelled) setPairs((previous) => previous.map((item) => ({ ...item, flash: false })));
        }, 400);
      } catch {
        if (!cancelled) setPairs((previous) => previous.map((item) => ({ ...item, flash: false, status: item.price === null ? "unavailable" : item.status })));
      }
    };

    void fetchQuotes();
    const interval = window.setInterval(fetchQuotes, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return pairs;
}