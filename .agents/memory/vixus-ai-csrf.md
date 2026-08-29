---
name: VIXUS AI cross-origin security
description: Durable constraints for cookie-authenticated requests across separate frontend and API origins.
---

Cookie-authenticated browser mutations must validate an exact configured frontend origin (or an explicitly configured CSRF header); SameSite settings and broad Vercel preview matching are not sufficient.

**Why:** The production frontends and API are separate origins and session cookies use cross-site-compatible settings. Treating every `*.vercel.app` preview as trusted would let unrelated deployments send credentialed requests or read CORS responses.

**How to apply:** Keep production frontend origins in `ALLOWED_ORIGINS`, add temporary preview origins explicitly, and preserve trusted-origin protection for auth mutations and authenticated realtime streams. Keep signed server-to-server webhooks separate from browser CSRF checks.