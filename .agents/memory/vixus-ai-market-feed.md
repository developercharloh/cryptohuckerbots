---
name: VIXUS AI market feed
description: Browser market feeds may be blocked by provider CORS or regional restrictions.
---

The market chart uses server-side Yahoo Finance for forex/commodities and Coinbase for crypto; do not fabricate candles when a provider or market session has no new bar. Browser-side providers can fail with CORS or regional restrictions, so live chart data must stay behind the API.

**Why:** Real source-backed candles are required for the chart, while closed FX/commodity sessions legitimately stop producing new minute bars. Direct browser feeds are less reliable than the server-side path.

**How to apply:** Preserve the Yahoo/Coinbase provider contract and reject invalid source rows. Refresh 1-minute data frequently enough to append the next real bar when the market is open, but never synthesize movement during a closed session.