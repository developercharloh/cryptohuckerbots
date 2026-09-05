---
name: VIXUS AI market feed
description: Browser market feeds may be blocked by provider CORS or regional restrictions.
---

The market chart uses server-side Yahoo Finance for forex/commodities and Coinbase for crypto; do not fabricate candles when a provider or market session has no new bar. Browser-side providers can fail with CORS or regional restrictions, so live chart data must stay behind the API.

**Why:** Real source-backed candles are required for the chart, while closed FX/commodity sessions legitimately stop producing new minute bars. Direct browser feeds are less reliable than the server-side path.

**How to apply:** Preserve the Yahoo/Coinbase provider contract and reject invalid source rows. Refresh 1-minute data frequently enough to append the next real bar when the market is open, but never synthesize movement during a closed session.

Weekend signal scheduling must use only the supported Coinbase crypto pairs and keep alternating BUY/SELL definitions so bulk signal selection remains directionally balanced.

**Why:** Forex and commodity opportunities cannot be executed against a live weekend candle; surfacing them creates stale signals while users with open crypto markets should still receive automated opportunities.

**How to apply:** Filter non-crypto signal definitions out of Saturday/Sunday opportunity creation, keep the crypto list aligned with market-provider instruments, and let the trade screen fall back to an available crypto pair when the selected pair has no active signal.