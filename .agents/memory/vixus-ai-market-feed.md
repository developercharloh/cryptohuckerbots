---
name: VIXUS AI market feed
description: Browser market feeds may be blocked by provider CORS or regional restrictions.
---

The landing page must retain a clear fallback when a browser-side market provider is unavailable; direct Binance access can fail with CORS or HTTP 451 in the Replit preview and production network path. The current product decision is to use the restored simulated market display and candles rather than Twelve Data.

**Why:** A failed external feed should not make the public landing page blank or freeze its market display, and the Twelve Data rollout was intentionally reversed after production testing showed plan coverage and UI-state problems.

**How to apply:** Do not reintroduce Twelve Data or another live-provider contract into the market UI/API without confirming that product decision first. If live data is revisited, preserve an explicit bounded fallback and label it accurately.