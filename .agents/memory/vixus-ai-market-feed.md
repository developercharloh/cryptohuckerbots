---
name: VIXUS AI market feed
description: Browser market feeds may be blocked by provider CORS or regional restrictions.
---

The landing page must retain a clear fallback when a browser-side market provider is unavailable; direct Binance access can fail with CORS or HTTP 451 in the Replit preview environment.

**Why:** A failed external feed should not make the public landing page blank or freeze its market display, but simulated movement must not be presented as confirmed provider data.

**How to apply:** Prefer a server-side market-data proxy or provider fallback for authoritative prices and quote volumes, and expose stale/fallback state when live data is unavailable.