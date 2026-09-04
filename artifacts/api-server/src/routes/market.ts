import { Router } from "express";
import { GetMarketCandlesQuery, MarketCandle } from "@workspace/api-zod";

const router = Router();

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
type Candle = MarketCandle;
type Provider = "yahoo" | "coinbase";

type Instrument = {
  provider: Provider;
  symbol: string;
};

const INSTRUMENTS: Record<string, Instrument> = {
  "EUR-USD": { provider: "yahoo", symbol: "EURUSD=X" },
  "GBP-USD": { provider: "yahoo", symbol: "GBPUSD=X" },
  "USD-JPY": { provider: "yahoo", symbol: "USDJPY=X" },
  "USD-CHF": { provider: "yahoo", symbol: "USDCHF=X" },
  "AUD-USD": { provider: "yahoo", symbol: "AUDUSD=X" },
  "NZD-USD": { provider: "yahoo", symbol: "NZDUSD=X" },
  "USD-CAD": { provider: "yahoo", symbol: "USDCAD=X" },
  "EUR-GBP": { provider: "yahoo", symbol: "EURGBP=X" },
  "EUR-JPY": { provider: "yahoo", symbol: "EURJPY=X" },
  "GBP-JPY": { provider: "yahoo", symbol: "GBPJPY=X" },
  "XAU-USD": { provider: "yahoo", symbol: "GC=F" },
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

const YAHOO_INTERVALS: Record<Interval, { interval: string; range: string; aggregateHours?: number }> = {
  "1m": { interval: "1m", range: "1d" },
  "5m": { interval: "5m", range: "5d" },
  "15m": { interval: "15m", range: "1mo" },
  "1h": { interval: "1h", range: "3mo" },
  "4h": { interval: "1h", range: "6mo", aggregateHours: 4 },
  "1d": { interval: "1d", range: "1y" },
};

const COINBASE_INTERVALS: Record<Interval, { granularity: number; aggregateHours?: number }> = {
  "1m": { granularity: 60 },
  "5m": { granularity: 300 },
  "15m": { granularity: 900 },
  "1h": { granularity: 3600 },
  "4h": { granularity: 3600, aggregateHours: 4 },
  "1d": { granularity: 86400 },
};

type CacheEntry = { candles: Candle[]; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 15_000;

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

  return [...buckets.values()].sort((a, b) => a.time - b.time).slice(-100);
}

function normalizeCandles(candles: Candle[], aggregateHours?: number): Candle[] {
  const normalized = candles
    .filter((candle) =>
      Number.isFinite(candle.time) &&
      Number.isFinite(candle.open) &&
      Number.isFinite(candle.high) &&
      Number.isFinite(candle.low) &&
      Number.isFinite(candle.close),
    )
    .sort((a, b) => a.time - b.time);

  return aggregateHours ? aggregateCandles(normalized, aggregateHours) : normalized.slice(-100);
}

async function fetchYahoo(instrument: Instrument, interval: Interval): Promise<Candle[]> {
  const config = YAHOO_INTERVALS[interval];
  const url = new URL(`https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(instrument.symbol)}`);
  url.searchParams.set("interval", config.interval);
  url.searchParams.set("range", config.range);
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
        indicators?: { quote?: Array<{ open?: Array<number | null>; high?: Array<number | null>; low?: Array<number | null>; close?: Array<number | null> }> };
      }>;
    };
  };
  const result = payload.chart?.result?.[0];
  const timestamps = result?.timestamp ?? [];
  const quote = result?.indicators?.quote?.[0];
  if (!quote) return [];

  const candles: Candle[] = timestamps.map((time, index) => ({
    time,
    open: Number(quote.open?.[index]),
    high: Number(quote.high?.[index]),
    low: Number(quote.low?.[index]),
    close: Number(quote.close?.[index]),
  }));
  return normalizeCandles(candles, config.aggregateHours);
}

async function fetchCoinbase(instrument: Instrument, interval: Interval): Promise<Candle[]> {
  const config = COINBASE_INTERVALS[interval];
  const url = new URL(`https://api.exchange.coinbase.com/products/${encodeURIComponent(instrument.symbol)}/candles`);
  url.searchParams.set("granularity", String(config.granularity));
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
  return normalizeCandles(candles, config.aggregateHours);
}

router.get("/market/candles", async (req, res): Promise<void> => {
  const parsed = GetMarketCandlesQuery.safeParse(req.query);
  if (!parsed.success) {
    res.status(400).json({ error: "Choose a supported market symbol and timeframe." });
    return;
  }

  const instrument = INSTRUMENTS[parsed.data.symbol];
  if (!instrument) {
    res.status(400).json({ error: "This market symbol is not supported." });
    return;
  }

  const cacheKey = `${parsed.data.symbol}:${parsed.data.interval}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    res.json(cached.candles);
    return;
  }

  try {
    const candles = instrument.provider === "yahoo"
      ? await fetchYahoo(instrument, parsed.data.interval)
      : await fetchCoinbase(instrument, parsed.data.interval);
    if (candles.length < 2) throw new Error("Provider returned too few candles");
    cache.set(cacheKey, { candles, fetchedAt: Date.now() });
    res.json(candles);
  } catch (error) {
    req.log.warn({ symbol: parsed.data.symbol, interval: parsed.data.interval, error }, "Live market candles unavailable");
    res.status(502).json({ error: "Live market data is temporarily unavailable." });
  }
});

export default router;