import { Router } from "express";
import { GetMarketCandlesQueryParams, MarketCandle } from "@workspace/api-zod";

const router = Router();

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
type Candle = MarketCandle;
type Provider = "yahoo" | "coinbase";

type Instrument = {
  provider: Provider;
  symbol: string;
  twelveSymbol?: string;
};

const INSTRUMENTS: Record<string, Instrument> = {
  "EUR-USD": { provider: "yahoo", symbol: "EURUSD=X", twelveSymbol: "EUR/USD" },
  "GBP-USD": { provider: "yahoo", symbol: "GBPUSD=X", twelveSymbol: "GBP/USD" },
  "USD-JPY": { provider: "yahoo", symbol: "USDJPY=X", twelveSymbol: "USD/JPY" },
  "USD-CHF": { provider: "yahoo", symbol: "USDCHF=X", twelveSymbol: "USD/CHF" },
  "AUD-USD": { provider: "yahoo", symbol: "AUDUSD=X", twelveSymbol: "AUD/USD" },
  "NZD-USD": { provider: "yahoo", symbol: "NZDUSD=X", twelveSymbol: "NZD/USD" },
  "USD-CAD": { provider: "yahoo", symbol: "USDCAD=X", twelveSymbol: "USD/CAD" },
  "EUR-GBP": { provider: "yahoo", symbol: "EURGBP=X", twelveSymbol: "EUR/GBP" },
  "EUR-JPY": { provider: "yahoo", symbol: "EURJPY=X", twelveSymbol: "EUR/JPY" },
  "GBP-JPY": { provider: "yahoo", symbol: "GBPJPY=X", twelveSymbol: "GBP/JPY" },
  "XAU-USD": { provider: "yahoo", symbol: "GC=F", twelveSymbol: "XAU/USD" },
  "XAG-USD": { provider: "yahoo", symbol: "SI=F" },
  "OIL-USD": { provider: "yahoo", symbol: "CL=F" },
  "GAS-USD": { provider: "yahoo", symbol: "NG=F" },
  "BTC-USD": { provider: "coinbase", symbol: "BTC-USD" },
  "ETH-USD": { provider: "coinbase", symbol: "ETH-USD" },
  "BNB-USD": { provider: "coinbase", symbol: "BNB-USD" },
  "SOL-USD": { provider: "coinbase", symbol: "SOL-USD" },
  "XRP-USD": { provider: "coinbase", symbol: "XRP-USD" },
  "ADA-USD": { provider: "coinbase", symbol: "ADA-USD" },
  "AVAX-USD": { provider: "coinbase", symbol: "AVAX-USD" },
  "MATIC-USD": { provider: "coinbase", symbol: "MATIC-USD" },
};

const YAHOO_INTERVALS: Record<Interval, { interval: string; range: string; pageSeconds: number; aggregateHours?: number }> = {
  "1m": { interval: "1m", range: "1d", pageSeconds: 24 * 60 * 60 },
  "5m": { interval: "5m", range: "5d", pageSeconds: 5 * 24 * 60 * 60 },
  "15m": { interval: "15m", range: "1mo", pageSeconds: 31 * 24 * 60 * 60 },
  "1h": { interval: "1h", range: "3mo", pageSeconds: 90 * 24 * 60 * 60 },
  "4h": { interval: "1h", range: "6mo", pageSeconds: 180 * 24 * 60 * 60, aggregateHours: 4 },
  "1d": { interval: "1d", range: "1y", pageSeconds: 365 * 24 * 60 * 60 },
};

const COINBASE_INTERVALS: Record<Interval, { granularity: number; pageSeconds: number; aggregateHours?: number }> = {
  "1m": { granularity: 60, pageSeconds: 300 * 60 },
  "5m": { granularity: 300, pageSeconds: 300 * 300 },
  "15m": { granularity: 900, pageSeconds: 300 * 900 },
  "1h": { granularity: 3600, pageSeconds: 300 * 3600 },
  "4h": { granularity: 3600, pageSeconds: 300 * 3600, aggregateHours: 4 },
  "1d": { granularity: 86400, pageSeconds: 300 * 86400 },
};

type CacheEntry = { candles: Candle[]; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
type QuoteEntry = { price: number; fetchedAt: number };
const quoteCache = new Map<string, QuoteEntry>();
const quoteInFlight = new Map<string, Promise<number | null>>();

function cacheTtlMs(interval: Interval): number {
  switch (interval) {
    case "1m":
      return 5_000;
    case "5m":
      return 10_000;
    case "15m":
      return 15_000;
    case "1h":
    case "4h":
      return 30_000;
    case "1d":
      return 60_000;
  }
}

function aggregateCandles(candles: Candle[], hours: number): Candle[] {
  const bucketSeconds = hours * 60 * 60;
  const buckets = new Map<number, Candle>();

  for (const candle of candles) {
    const time = Math.floor(candle.time / bucketSeconds) * bucketSeconds;
    const existing = buckets.get(time);
    if (!existing) {
      buckets.set(time, { time, open: candle.open, high: candle.high, low: candle.low, close: candle.close });
      continue;
    }
    existing.high = Math.max(existing.high, candle.high);
    existing.low = Math.min(existing.low, candle.low);
    existing.close = candle.close;
  }

  return [...buckets.values()].sort((a, b) => a.time - b.time);
}

function normalizeCandles(candles: Candle[], aggregateHours?: number): Candle[] {
  const normalized = candles
    .filter((candle) =>
      Number.isFinite(candle.time) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close) &&
      candle.open > 0 &&
      candle.high > 0 &&
      candle.low > 0 &&
      candle.close > 0 &&
      candle.high >= Math.max(candle.open, candle.close) &&
      candle.low <= Math.min(candle.open, candle.close),
    )
    .sort((a, b) => a.time - b.time);

  return aggregateHours ? aggregateCandles(normalized, aggregateHours) : normalized;
}

function addSampledMovement(candles: Candle[]): Candle[] {
  return candles.map((candle, index) => {
    if (candle.high !== candle.low || candle.open !== candle.close) return candle;
    const previousClose = candles[index - 1]?.close ?? candle.open;
    const open = previousClose;
    return {
      ...candle,
      open,
      high: Math.max(open, candle.close),
      low: Math.min(open, candle.close),
    };
  });
}

const TWELVE_INTERVALS: Record<Interval, string> = {
  "1m": "1min",
  "5m": "5min",
  "15m": "15min",
  "1h": "1h",
  "4h": "4h",
  "1d": "1day",
};

function twelveOutputSize(interval: Interval): number {
  return interval === "1m" || interval === "5m" || interval === "15m" ? 5000 : 2000;
}

function parseTwelveDate(value: unknown): number {
  if (typeof value !== "string") return NaN;
  const parsed = Date.parse(`${value.replace(" ", "T")}Z`);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : NaN;
}

function parseTwelveValues(value: unknown, aggregateHours?: number): Candle[] {
  if (!Array.isArray(value)) return [];
  const candles: Candle[] = value.map((row) => {
    const item = row && typeof row === "object" ? row as Record<string, unknown> : {};
    return {
      time: parseTwelveDate(item.datetime),
      open: Number(item.open),
      high: Number(item.high),
      low: Number(item.low),
      close: Number(item.close),
    };
  });
  return normalizeCandles(candles, aggregateHours);
}

async function fetchTwelveQuote(symbol: string): Promise<number | null> {
  const key = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!key) return null;

  const cached = quoteCache.get(symbol);
  if (cached && Date.now() - cached.fetchedAt < 10_000) return cached.price;

  const existingRequest = quoteInFlight.get(symbol);
  if (existingRequest) return existingRequest;

  const request = (async () => {
    const url = new URL("https://api.twelvedata.com/price");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("apikey", key);
    const response = await fetch(url, {
      headers: { accept: "application/json", "user-agent": "VIXUS-AI-Market/1.0" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const payload = await response.json() as { price?: string | number; status?: string };
    const price = Number(payload.price);
    if (payload.status === "error" || !Number.isFinite(price) || price <= 0) return null;
    quoteCache.set(symbol, { price, fetchedAt: Date.now() });
    return price;
  })()
    .catch(() => null)
    .finally(() => {
      quoteInFlight.delete(symbol);
    });

  quoteInFlight.set(symbol, request);
  return request;
}

async function fetchTwelve(
  instrument: Instrument,
  interval: Interval,
  before?: number,
): Promise<Candle[]> {
  const key = process.env.TWELVE_DATA_API_KEY?.trim();
  if (!key || !instrument.twelveSymbol) throw new Error("Twelve Data is not configured");

  const url = new URL("https://api.twelvedata.com/time_series");
  url.searchParams.set("symbol", instrument.twelveSymbol);
  url.searchParams.set("interval", TWELVE_INTERVALS[interval]);
  url.searchParams.set("outputsize", String(twelveOutputSize(interval)));
  url.searchParams.set("timezone", "UTC");
  if (before !== undefined) {
    url.searchParams.set(
      "end_date",
      new Date(before * 1000).toISOString().replace("T", " ").slice(0, 19),
    );
  }

  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "VIXUS-AI-Market/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Twelve Data returned ${response.status}`);

  const payload = await response.json() as {
    status?: string;
    code?: number;
    message?: string;
    values?: unknown;
  };
  if (payload.status === "error") {
    throw new Error(payload.message ?? `Twelve Data returned ${payload.code ?? "an error"}`);
  }

  const candles = parseTwelveValues(payload.values, interval === "4h" ? 4 : undefined)
    .filter((candle) => before === undefined || candle.time < before);
  if (before === undefined && candles.length < 2) {
    throw new Error("Twelve Data returned too few candles");
  }

  // A quote is deliberately applied only to the newest page. Historical pages
  // must remain source OHLC and must never be manufactured from a live price.
  if (before === undefined && candles.length > 0) {
    const livePrice = await fetchTwelveQuote(instrument.twelveSymbol);
    const latest = candles[candles.length - 1];
    if (livePrice !== null && latest.time >= Math.floor(Date.now() / 60_000) * 60 - 120) {
      latest.high = Math.max(latest.high, livePrice);
      latest.low = Math.min(latest.low, livePrice);
      latest.close = livePrice;
    }
  }

  return candles;
}

async function fetchYahoo(instrument: Instrument, interval: Interval, before?: number): Promise<Candle[]> {
  const config = YAHOO_INTERVALS[interval];
  const url = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(instrument.symbol)}`);
  url.searchParams.set("interval", config.interval);
  if (before) {
    url.searchParams.set("period1", String(Math.max(0, before - config.pageSeconds)));
    url.searchParams.set("period2", String(before));
  } else {
    url.searchParams.set("range", config.range);
  }
  url.searchParams.set("includePrePost", "false");
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "VIXUS-AI-Market/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Yahoo returned ${response.status}`);

  const payload = await response.json() as {
    chart?: {
      result?: Array<{
        timestamp?: number[];
        meta?: { regularMarketPrice?: number };
        indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null> }> };
      }>;
    };
  };
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) return [];

  let candles: Candle[] = timestamps.map((time, index) => ({
    time,
    open: Number(quote.open?.[index]),
    high: Number(quote.high?.[index]),
    low: Number(quote.low?.[index]),
    close: Number(quote.close?.[index]),
  }));
  candles = normalizeCandles(
    before === undefined ? candles : candles.filter((candle) => candle.time < before),
    config.aggregateHours,
  );
  candles = addSampledMovement(candles);

  const livePrice = Number(result.meta?.regularMarketPrice);
  const latest = candles[candles.length - 1];
  if (
    before === undefined &&
    latest &&
    Number.isFinite(livePrice) &&
    livePrice > 0 &&
    latest.time >= Math.floor(Date.now() / 60_000) * 60 - 120
  ) {
    latest.high = Math.max(latest.high, livePrice);
    latest.low = Math.min(latest.low, livePrice);
    latest.close = livePrice;
  }
  return candles;
}

async function fetchCoinbase(instrument: Instrument, interval: Interval, before?: number): Promise<Candle[]> {
  const config = COINBASE_INTERVALS[interval];
  const end = before ?? Math.floor(Date.now() / 1000);
  const start = end - config.pageSeconds;
  const url = new URL(`https://api.exchange.coinbase.com/products/${encodeURIComponent(instrument.symbol)}/candles`);
  url.searchParams.set("granularity", String(config.granularity));
  url.searchParams.set("start", new Date(start * 1000).toISOString());
  url.searchParams.set("end", new Date(end * 1000).toISOString());

  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "VIXUS-AI-Market/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Coinbase returned ${response.status}`);

  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) return [];
  const candles: Candle[] = payload.map((row) => {
    const values = Array.isArray(row) ? row : [];
    return {
      time: Number(values[0]),
      low: Number(values[1]),
      high: Number(values[2]),
      open: Number(values[3]),
      close: Number(values[4]),
    };
  });
  return normalizeCandles(
    before === undefined ? candles : candles.filter((candle) => candle.time < before),
    config.aggregateHours,
  );
}

router.get("/market/candles", async (req, res): Promise<void> => {
  const parsed = GetMarketCandlesQueryParams.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported market symbol and timeframe." });
    return;
  }

  const rawBefore = req.query.before;
  const before = rawBefore === undefined
    ? undefined
    : typeof rawBefore === "string" && /^\d+$/.test(rawBefore)
      ? Number(rawBefore)
      : NaN;
  if (before !== undefined && (!Number.isSafeInteger(before) || before <= 0)) {
    res.status(400).json({ error: "The candle history cursor must be a positive Unix timestamp." });
    return;
  }

  const instrument = INSTRUMENTS[parsed.data.symbol];
  if (!instrument) {
    res.status(400).json({ error: "This market symbol is not supported." });
    return;
  }

  const cacheKey = `${parsed.data.symbol}:${parsed.data.interval}:${before ?? "latest"}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < cacheTtlMs(parsed.data.interval)) {
    res.json(cached.candles);
    return;
  }

  try {
    let candles: Candle[];
    if (instrument.provider === "yahoo") {
      if (instrument.twelveSymbol && process.env.TWELVE_DATA_API_KEY?.trim()) {
        try {
          candles = await fetchTwelve(instrument, parsed.data.interval, before);
        } catch (error) {
          req.log.warn({
            symbol: parsed.data.symbol,
            interval: parsed.data.interval,
            error: error instanceof Error ? error.message : String(error),
          }, "Preferred live market source unavailable; using sampled fallback");
          candles = await fetchYahoo(instrument, parsed.data.interval, before);
        }
      } else {
        candles = await fetchYahoo(instrument, parsed.data.interval, before);
      }
    } else {
      candles = await fetchCoinbase(instrument, parsed.data.interval, before);
    }
    if (before === undefined && candles.length < 2) throw new Error("Provider returned too few candles");
    cache.set(cacheKey, { candles, fetchedAt: Date.now() });
    res.json(candles);
  } catch (error) {
    req.log.warn({
      symbol: parsed.data.symbol,
      interval: parsed.data.interval,
      before,
      error: error instanceof Error ? error.message : String(error),
    }, "Live market candles unavailable");
    res.status(502).json({ error: "Live market data is temporarily unavailable." });
  }
});

export default router;