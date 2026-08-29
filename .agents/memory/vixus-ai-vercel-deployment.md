---
name: VIXUS AI Vercel deployment
description: Reliable production deployment path when the linked monorepo build exceeds Vercel build memory.
---

Vercel's linked monorepo build can be killed for memory even when the local user-app, admin-app, and API builds pass. The reliable fallback is a direct Vercel API deployment: upload the already-built web `dist/public` files as static output, and upload the API's bundled Vercel handler with a minimal serverless entrypoint.

**Why:** The VIXUS projects are linked to one GitHub monorepo, but Vercel's remote install/build step has previously exceeded its memory limit. Direct deployment keeps the verified artifact live without changing the application architecture.

**How to apply:** Build locally, inject the production API URL into the admin web build, deploy the static bundles and API handler to the existing Vercel project IDs, then verify the production aliases and `/api/healthz`. Keep the repository source separately synchronized when GitHub credentials are available.