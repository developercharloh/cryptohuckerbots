import { Router } from "express";
import {
  GetMarketCandlesQueryParams,
  GetMarketCandlesResponse,
  GetMarketQuotesQueryParams,
  GetMarketQuotesResponse,
  MarketCandle,
  MarketQuote,
} from "@workspace/api-zod";

const router = Router();

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
type Candle = MarketCandle;
type Quote = MarketQuote;

const INSTRUMENTS: Record<string, string> = {
  "EUR-USD": "EUR/USD",
  "GBP-USD": "GBP/USD",
  "USD-JPY": "USD/JPY",
  "USD-CHF": "USD/CHF",
  "AUD-USD": "AUD/USD",
  "NZD-USD": "NZD/USD",
  "USD-CAD": "USD/CAD",
  "EUR-GBP": "EUR/GBP",
  "EUR-JPY": "EUR/JPY",
  "GBP-JPY": "GBP/JPY",
  "XAU-USD": "XAU/USD",
  "XAG-USD": "XAG/USD",
  "OIL-USD": "WTI",
  "GAS-USD": "NATURALGAS",
  "BTC-USD": "BTC/USD",
  "ETH-USD": "ETH/USD",
  "BNB-USD": "BNB/USD",
  "SOL-USD": "SOL/USD",
  "XRP-USD": "XRP/USD",
  "ADA-USD": "ADA/USD",
  "AVAX-USD": "AVAX/USD",
  "MATIC-USD": "MATIC/USD",
};

const TWELVE_DATA_INTERVALS: Record<Interval, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
};

type CacheEntry = { candles: Candle[]; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTLS: Record<Interval, number> = {
  "1m": 15_000,
  "5m": 30_000,
  "15m": 60_000,
  "1h": 120_000,
  "4h": 300_000,
  "1d": 900_000,
};

type QuoteCacheEntry = { quote: Quote; fetchedAt: number };
const quoteCache = new Map<string, QuoteCacheEntry>();
const QUOTE_TTL_MS = 60_000;
const QUOTE_BATCH_SIZE = 6;
let quoteCursor = 0;

class ProviderRateLimitError extends Error {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super("Twelve Data request budget is temporarily exhausted");
    this.name = "ProviderRateLimitError";
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

let providerWindowStartedAt = 0;
let providerCreditsUsed = 0;
let providerQueue = Promise.resolve();

function withProviderCredit<T>(task: () => Promise<T>): Promise<T> {
  const run = async () => {
    const now = Date.now();
    if (now - providerWindowStartedAt >= 60_000) {
      providerWindowStartedAt = now;
      providerCreditsUsed = 0;
    }
    if (providerCreditsUsed >= 8) {
      const retryAfterSeconds = Math.max(1, Math.ceil((60_000 - (now - providerWindowStartedAt)) / 1_000));
      throw new ProviderRateLimitError(retryAfterSeconds);
    }
    providerCreditsUsed += 1;
    return task();
  };
  const next = providerQueue.then(run, run);
  providerQueue = next.then(() => undefined, () => undefined);
  return next;
}

function normalizeCandles(candles: Candle[]): Candle[] {
  return candles
    .filter((candle) =>
      Number.isFinite(candle.time) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close),
    )
    .sort((a, b) => a.time - b.time)
    .slice(-100);
}

function parseTwelveDataTime(value: unknown): number {
  if (typeof value === "number") return Math.floor(value);
  if (typeof value !== "string") return Number.NaN;
  const timestamp = Date.parse(value.includes("T") ? value : `${value.replace(" ", "T")}Z`);
  return Number.isFinite(timestamp) ? Math.floor(timestamp / 1000) : Number.NaN;
}

async function fetchTwelveData(symbol: string, interval: Interval): Promise<Candle[]> {
  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!apiKey) throw new Error("TWELVE_DATA_API_KEY is not configured");

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", TWELVE_DATA_INTERVALS[interval]);
  url.searchParams.set("outputsize", "100");
  url.searchParams.set("timezone", "UTC");
  url.searchParams.set("format", "JSON");
  url.searchParams.set("apikey", apiKey);
  return withProviderCredit(async () => {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "VIXUS-AI-Market/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json() as {
      status?: string;
      code?: number;
      message?: string;
      values?: Array<{
        datetime?: string;
        open?: string | number;
        high?: string | number;
        low?: string | number;
        close?: string | number;
      }>;
    };
    if (!response.ok || payload.status === "error" || !Array.isArray(payload.values)) {
      if (response.status === 429 || payload.code === 429) {
        throw new ProviderRateLimitError(60);
      }
      throw new Error(payload.message || `Twelve Data returned ${response.status}`);
    }

    return normalizeCandles(payload.values.map((value) => ({
      time: parseTwelveDataTime(value.datetime),
      open: Number(value.open),
      high: Number(value.high),
      low: Number(value.low),
      close: Number(value.close),
    })));
  });
}

async function getLiveCandles(symbol: string, interval: Interval): Promise<Candle[]> {
  const cacheKey = `${symbol}:${interval}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTLS[interval]) {
    return cached.candles;
  }
  const candles = await fetchTwelveData(symbol, interval);
  if (candles.length < 2) throw new Error("Provider returned too few candles");
  cache.set(cacheKey, { candles, fetchedAt: Date.now() });
  return candles;
}

function toQuote(symbol: string, candles: Candle[]): Quote {
  const latest = candles.at(-1)!;
  const previous = candles.at(-2)?.close ?? latest.close;
  const reference = candles[Math.max(0, candles.length - 25)]?.close ?? previous;
  return {
    symbol,
    price: latest.close,
    previousClose: previous,
    changePercent: reference ? ((latest.close - reference) / reference) * 100 : 0,
    updatedAt: latest.time,
    sparkline: candles.slice(-24).map((candle) => ({ time: candle.time, close: candle.close })),
  };
}

router.get("/market/candles", async (req, res): Promise<void> => {
  const parsed = GetMarketCandlesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported market symbol and timeframe." });
    return;
  }

  const instrument = INSTRUMENTS[parsed.data.symbol];
  if (!instrument) {
    res.status(400).json({ error: "This market symbol is not supported." });
    return;
  }

  try {
    const candles = await getLiveCandles(instrument, parsed.data.interval);
    res.json(GetMarketCandlesResponse.parse(candles));
  } catch (error) {
    if (error instanceof ProviderRateLimitError) {
      res.set("Retry-After", String(error.retryAfterSeconds));
    }
    req.log.warn({ symbol: parsed.data.symbol, interval: parsed.data.interval, error }, "Live market candles unavailable");
    res.status(error instanceof ProviderRateLimitError ? 503 : 502).json({ error: "Live market data is temporarily unavailable." });
  }
});

router.get("/market/quotes", async (req, res): Promise<void> => {
  const parsed = GetMarketQuotesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose one or more supported market symbols." });
    return;
  }

  const requestedSymbols = [...new Set(parsed.data.symbols.split(",").map((symbol) => symbol.trim()).filter(Boolean))];
  if (requestedSymbols.length === 0 || requestedSymbols.some((symbol) => !INSTRUMENTS[symbol])) {
    res.status(400).json({ error: "One or more market symbols are not supported." });
    return;
  }

  const now = Date.now();
  const freshQuotes = requestedSymbols
    .map((symbol) => quoteCache.get(symbol))
    .filter((entry): entry is QuoteCacheEntry => Boolean(entry && now - entry.fetchedAt < QUOTE_TTL_MS))
    .map((entry) => entry.quote);
  const freshSymbols = new Set(freshQuotes.map((quote) => quote.symbol));
  const staleSymbols = requestedSymbols.filter((symbol) => !freshSymbols.has(symbol));
  const symbolsToFetch: string[] = [];
  if (requestedSymbols.length > 0 && staleSymbols.length > 0) {
    let scanned = 0;
    let cursor = quoteCursor % requestedSymbols.length;
    while (scanned < requestedSymbols.length && symbolsToFetch.length < QUOTE_BATCH_SIZE) {
      const symbol = requestedSymbols[cursor];
      if (!freshSymbols.has(symbol)) symbolsToFetch.push(symbol);
      cursor = (cursor + 1) % requestedSymbols.length;
      scanned += 1;
    }
    quoteCursor = cursor;
  }

  const fetchedQuotes = await Promise.all(symbolsToFetch.map(async (symbol) => {
    try {
      const candles = await getLiveCandles(INSTRUMENTS[symbol], "1h");
      const quote = toQuote(symbol, candles);
      quoteCache.set(symbol, { quote, fetchedAt: Date.now() });
      return quote;
    } catch (error) {
      req.log.warn({ symbol, error }, "Live market quote unavailable");
      return null;
    }
  }));

  const allQuotes = [...freshQuotes, ...fetchedQuotes.filter((quote): quote is Quote => Boolean(quote))];
  res.json(GetMarketQuotesResponse.parse(requestedSymbols.flatMap((symbol) => allQuotes.find((quote) => quote.symbol === symbol) ?? [])));
});

export default router;