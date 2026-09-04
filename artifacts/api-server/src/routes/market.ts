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
  // Twelve Data exposes Polygon as MATIC/CAD on the current plan. Quotes and
  // candles are converted to USD with the same-time USD/CAD market series.
  "MATIC-USD": "MATIC/CAD",
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
const QUOTE_TTL_MS = 15_000;
const QUOTE_BATCH_SIZE = 6;
const MATIC_CONVERSION_SYMBOL = "USD/CAD";
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

function withProviderCredit<T>(cost: number, task: () => Promise<T>): Promise<T> {
  const run = async () => {
    const now = Date.now();
    if (now - providerWindowStartedAt >= 60_000) {
      providerWindowStartedAt = now;
      providerCreditsUsed = 0;
    }
    if (providerCreditsUsed + cost > 8) {
      const retryAfterSeconds = Math.max(1, Math.ceil((60_000 - (now - providerWindowStartedAt)) / 1_000));
      throw new ProviderRateLimitError(retryAfterSeconds);
    }
    providerCreditsUsed += cost;
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
  return withProviderCredit(1, async () => {
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

type ProviderQuote = {
  status?: string;
  code?: number;
  message?: string;
  close?: string | number;
  previous_close?: string | number;
  percent_change?: string | number;
  timestamp?: string | number;
  datetime?: string;
};

async function fetchTwelveDataQuotes(symbols: string[]): Promise<Map<string, ProviderQuote>> {
  const apiKey = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!apiKey) throw new Error("TWELVE_DATA_API_KEY is not configured");

  const url = new URL("https://api.twelvedata.com/quote");
  const uniqueSymbols = [...new Set(symbols)];
  url.searchParams.set("symbol", uniqueSymbols.join(","));
  url.searchParams.set("apikey", apiKey);
  return withProviderCredit(uniqueSymbols.length, async () => {
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "VIXUS-AI-Market/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    const payload = await response.json() as Record<string, ProviderQuote>;
    if (!response.ok || !payload || typeof payload !== "object") {
      throw new Error(`Twelve Data quote request returned ${response.status}`);
    }
    return new Map(Object.entries(payload).filter(([, quote]) => quote && typeof quote === "object"));
  });
}

function quoteTimestamp(quote: ProviderQuote): number {
  const timestamp = Number(quote.timestamp);
  if (Number.isFinite(timestamp)) return Math.floor(timestamp);
  return parseTwelveDataTime(quote.datetime);
}

function toProviderQuote(
  symbol: string,
  quote: ProviderQuote,
  sparkline: Quote["sparkline"],
): Quote | null {
  const price = Number(quote.close);
  const previousClose = Number(quote.previous_close);
  if (
    quote.status === "error" ||
    !Number.isFinite(price) ||
    !Number.isFinite(previousClose) ||
    !Number.isFinite(quoteTimestamp(quote))
  ) {
    return null;
  }
  const providerChange = Number(quote.percent_change);
  const changePercent = Number.isFinite(providerChange)
    ? providerChange
    : previousClose
      ? ((price - previousClose) / previousClose) * 100
      : 0;
  return {
    symbol,
    price,
    previousClose,
    changePercent,
    updatedAt: quoteTimestamp(quote),
    sparkline,
  };
}

function toMaticUsdQuote(
  symbol: string,
  maticCad: ProviderQuote,
  usdCad: ProviderQuote,
  sparkline: Quote["sparkline"],
): Quote | null {
  const matic = Number(maticCad.close);
  const maticPrevious = Number(maticCad.previous_close);
  const cadPerUsd = Number(usdCad.close);
  const previousCadPerUsd = Number(usdCad.previous_close);
  const updatedAt = quoteTimestamp(maticCad);
  if (
    maticCad.status === "error" ||
    usdCad.status === "error" ||
    !Number.isFinite(matic) ||
    !Number.isFinite(maticPrevious) ||
    !Number.isFinite(cadPerUsd) ||
    !Number.isFinite(previousCadPerUsd) ||
    cadPerUsd <= 0 ||
    previousCadPerUsd <= 0 ||
    !Number.isFinite(updatedAt)
  ) {
    return null;
  }
  const price = matic / cadPerUsd;
  const previousClose = maticPrevious / previousCadPerUsd;
  return {
    symbol,
    price,
    previousClose,
    changePercent: previousClose ? ((price - previousClose) / previousClose) * 100 : 0,
    updatedAt,
    sparkline,
  };
}

async function getLiveCandles(marketSymbol: string, interval: Interval): Promise<Candle[]> {
  const cacheKey = `${marketSymbol}:${interval}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTLS[interval]) {
    return cached.candles;
  }
  const providerSymbol = INSTRUMENTS[marketSymbol];
  if (!providerSymbol) throw new Error("This market symbol is not supported");
  const candles = marketSymbol === "MATIC-USD"
    ? await combineMaticUsdCandles(interval)
    : await fetchTwelveData(providerSymbol, interval);
  if (candles.length < 2) throw new Error("Provider returned too few candles");
  cache.set(cacheKey, { candles, fetchedAt: Date.now() });
  return candles;
}

async function combineMaticUsdCandles(interval: Interval): Promise<Candle[]> {
  const maticCad = await fetchTwelveData("MATIC/CAD", interval);
  let conversionRate = quoteCache.get("USD-CAD")?.quote.price;
  if (!conversionRate || !Number.isFinite(conversionRate) || conversionRate <= 0) {
    const providerQuotes = await fetchTwelveDataQuotes([MATIC_CONVERSION_SYMBOL]);
    const conversionQuote = toProviderQuote(
      "USD-CAD",
      providerQuotes.get(MATIC_CONVERSION_SYMBOL) ?? {},
      [],
    );
    if (conversionQuote) {
      conversionRate = conversionQuote.price;
      quoteCache.set("USD-CAD", { quote: conversionQuote, fetchedAt: Date.now() });
    }
  }
  if (!conversionRate || !Number.isFinite(conversionRate) || conversionRate <= 0) {
    throw new Error("USD conversion rate unavailable");
  }
  return normalizeCandles(
    maticCad.flatMap((matic) => {
      return [{
        time: matic.time,
        open: matic.open / conversionRate,
        high: matic.high / conversionRate,
        low: matic.low / conversionRate,
        close: matic.close / conversionRate,
      }];
    }),
  );
}

router.get("/market/candles", async (req, res): Promise<void> => {
  const parsed = GetMarketCandlesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported market symbol and timeframe." });
    return;
  }

    if (!INSTRUMENTS[parsed.data.symbol]) {
    res.status(400).json({ error: "This market symbol is not supported." });
    return;
  }

  try {
    const candles = await getLiveCandles(parsed.data.symbol, parsed.data.interval);
    res.json(GetMarketCandlesResponse.parse(candles));
  } catch (error) {
    if (error instanceof ProviderRateLimitError) {
      res.set("Retry-After", String(error.retryAfterSeconds));
    }
    req.log.warn({ symbol: parsed.data.symbol, interval: parsed.data.interval, error }, "Live market candles unavailable");
    // Keep the public market screen in an explicit empty/unavailable state
    // instead of surfacing a provider outage as a browser error response.
    res.json([]);
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
  const cachedQuotes = requestedSymbols
    .map((symbol) => quoteCache.get(symbol))
    .filter((entry): entry is QuoteCacheEntry => Boolean(entry))
    .map((entry) => entry.quote);
  const freshQuotes = requestedSymbols
    .map((symbol) => quoteCache.get(symbol))
    .filter((entry): entry is QuoteCacheEntry => Boolean(entry && now - entry.fetchedAt < QUOTE_TTL_MS))
    .map((entry) => entry.quote);
  const freshSymbols = new Set(freshQuotes.map((quote) => quote.symbol));
  const staleSymbols = requestedSymbols.filter((symbol) => !freshSymbols.has(symbol));
  const symbolsToFetch: string[] = [];
  if (staleSymbols.length > 0) {
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
  let fetchedQuotes: Quote[] = [];
  if (symbolsToFetch.length > 0) {
    try {
      const providerSymbols = symbolsToFetch.flatMap((symbol) => [
        INSTRUMENTS[symbol],
        ...(symbol === "MATIC-USD" ? [MATIC_CONVERSION_SYMBOL] : []),
      ]);
      const providerQuotes = await fetchTwelveDataQuotes(providerSymbols);
      const conversionQuote = toProviderQuote(
        "USD-CAD",
        providerQuotes.get(MATIC_CONVERSION_SYMBOL) ?? {},
        [],
      );
      if (conversionQuote) {
        quoteCache.set("USD-CAD", { quote: conversionQuote, fetchedAt: Date.now() });
      }
      fetchedQuotes = symbolsToFetch.flatMap((symbol) => {
        const sparkline = quoteCache.get(symbol)?.quote.sparkline ?? [];
        const quote = symbol === "MATIC-USD"
          ? toMaticUsdQuote(symbol, providerQuotes.get("MATIC/CAD") ?? {}, providerQuotes.get(MATIC_CONVERSION_SYMBOL) ?? {}, sparkline)
          : toProviderQuote(symbol, providerQuotes.get(INSTRUMENTS[symbol]) ?? {}, sparkline);
        if (quote) quoteCache.set(symbol, { quote, fetchedAt: Date.now() });
        return quote ? [quote] : [];
      });
    } catch (error) {
      req.log.warn({ error }, "Live market quotes temporarily unavailable");
    }
  }

  const allQuotes = [...cachedQuotes, ...fetchedQuotes.filter((quote): quote is Quote => Boolean(quote))];
  res.json(GetMarketQuotesResponse.parse(requestedSymbols.flatMap((symbol) => allQuotes.find((quote) => quote.symbol === symbol) ?? [])));
});

export default router;