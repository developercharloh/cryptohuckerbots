---
name: VIXUS AI API origin
description: The deployment-specific API origin rule for the user and admin browser applications.
---

Use one shared API-base helper for every browser request that targets the VIXUS API. In production, the fallback origin is `https://api.vixus.trade`; in local development, same-origin requests are appropriate unless `VITE_API_URL` is explicitly configured.

**Why:** Mixing a stale generated-client fallback with same-origin direct fetches made authenticated wallet and VIP requests appear unavailable in the production UI even though the API and cookies were healthy.

**How to apply:** When adding a direct `fetch`, logout request, SSE/push request, or manually configured API client, import the app's API-base helper rather than reading `VITE_API_URL` inline or inventing another production hostname.