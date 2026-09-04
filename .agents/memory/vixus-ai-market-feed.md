---
name: VIXUS AI market feed
description: Browser market feeds may be blocked by provider CORS or regional restrictions.
---

The landing page must retain a clear fallback when a browser-side market provider is unavailable; direct Binance access can fail with CORS or HTTP 451 in the Replit preview and production network path.

**Why:** A failed external feed should not make the public landing page blank or freeze its market display, but simulated movement must not be presented as confirmed provider data.

**How to apply:** Prefer a server-side market-data proxy or provider fallback for authoritative prices and quote volumes. If the provider is blocked server-side too, remove direct browser attempts, keep the bounded fallback, and label it as fallback rather than confirmed live data.

Twelve Data quote batches consume credits per symbol, not per HTTP request. Keep each live quote refresh within the plan's credit window, rotate stale symbols, and serve the last real cached quote while the next batch refreshes. Use `/quote` for moving prices; candle history may remain unchanged until its interval closes.

**Why:** A single all-symbol quote request can return only a partial set under the provider limit, making the market list look disconnected even though the API itself returns HTTP 200.

**How to apply:** Account for the actual symbol count when throttling batched requests, include conversion symbols in that cost, and never replace missing provider data with simulated movement.