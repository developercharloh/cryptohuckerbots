import { Router } from "express";
import {
  GetMarketCandlesQueryParams,
  GetMarketCandlesResponse,
  MarketCandle,
} from "@workspace/api-zod";

const router = Router();

type Interval = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
type Candle = MarketCandle;

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
const CACHE_TTL_MS = 15_000;

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
  const response = await fetch(url, {
    headers: { accept: "application/json", "user-agent": "VIXUS-AI-Market/1.0" },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error(`Twelve Data returned ${response.status}`);

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
  if (payload.status === "error" || !Array.isArray(payload.values)) {
    throw new Error(payload.message || `Twelve Data error ${payload.code ?? "unknown"}`);
  }

  return normalizeCandles(payload.values.map((value) => ({
    time: parseTwelveDataTime(value.datetime),
    open: Number(value.open),
    high: Number(value.high),
    low: Number(value.low),
    close: Number(value.close),
  })));
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

  const cacheKey = `${parsed.data.symbol}:${parsed.data.interval}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    res.json(cached.candles);
    return;
  }

  try {
    const candles = await fetchTwelveData(instrument, parsed.data.interval);
    if (candles.length < 2) throw new Error("Provider returned too few candles");
    cache.set(cacheKey, { candles, fetchedAt: Date.now() });
    res.json(GetMarketCandlesResponse.parse(candles));
  } catch (error) {
    req.log.warn({ symbol: parsed.data.symbol, interval: parsed.data.interval, error }, "Live market candles unavailable");
    res.status(502).json({ error: "Live market data is temporarily unavailable." });
  }
});

export default router;