---
name: VIXUS AI Vercel deployment
description: Reliable production deployment path when the linked monorepo build exceeds Vercel build memory.
---

Vercel's linked monorepo build can be killed for memory even when the local user-app, admin-app, and API builds pass. The reliable fallback is a direct Vercel API deployment: upload the already-built web `dist/public` files as static output, and upload the API's bundled Vercel handler with a minimal serverless entrypoint.

**Why:** The VIXUS projects are linked to one GitHub monorepo, but Vercel's remote install/build step has previously exceeded its memory limit. Direct deployment keeps the verified artifact live without changing the application architecture.

**How to apply:** Build locally, inject the production API URL into the admin web build, deploy the static bundles and API handler to the existing Vercel project IDs, then verify the production aliases and `/api/healthz`. Keep the repository source separately synchronized when GitHub credentials are available.

Pushing the current `main` branch to the linked GitHub repository can also trigger a normal Vercel deployment, even when Replit native publishing is unavailable. Verify the live hashed frontend asset and protected API responses after the push.

**Why:** The GitHub-to-Vercel connection remained active independently of Replit's publishing status and successfully promoted the latest source commit.

**How to apply:** Treat a successful GitHub push as a deployment trigger, then confirm the public frontend returns `200`, the new bundle contains the latest user-visible fix, and unauthenticated protected routes return `401` rather than assuming the build completed.

Vercel's direct deployment API can reject otherwise valid prebuilt uploads after its free daily deployment quota is exhausted, while a linked frontend project may still deploy from GitHub. A successful frontend deployment does not prove the separately linked API project promoted the same commit.

**Why:** The monorepo's user app and API are separate Vercel projects, and their deployment triggers can diverge.

**How to apply:** Verify each project independently by deployment commit and live protected-route behavior; if the API project is still on an older commit, do not claim the backend fix is live and wait for quota reset or a working Git/deploy hook.

The Vercel Git-based deployment endpoint can still accept a fresh production deployment for the static user app after the linked GitHub hook has not reacted to a push, while the separate API project can remain blocked by its exhausted deployment quota.

**Why:** The two Vercel projects have independent deployment limits and triggers, so a manual Git-source deployment can promote one without changing the other's state.

**How to apply:** After pushing a verified user-app commit, check the project-specific latest deployment and production aliases before treating the push as live; retry the API project separately only when its quota resets.

For file-only static deployments to a monorepo-linked Vercel project, the project-level `rootDirectory` can override deployment payload settings and force a build against a missing source tree. Temporarily clear `rootDirectory`, `buildCommand`, `installCommand`, and `outputDirectory` while creating the prebuilt deployment, then restore the original settings after Vercel accepts it.

**Why:** Vercel may ignore a `rootDirectory: null` value supplied only in the deployment payload and leave the direct upload queued or fail it with `NOW_SANDBOX_WORKER_ROOTDIR_NOT_EXIST`.

**How to apply:** Preserve the original project settings, patch the project to static/no-build settings for the create request, submit the prebuilt files (inline data for smaller files and previously uploaded hashes for large assets), and restore the saved settings in a `finally` path.

When supplying legacy `routes` for an SPA file deployment, put `{ "handle": "filesystem" }` before the catch-all route so hashed JS, CSS, and images are served as files; otherwise the catch-all can return `index.html` for asset requests.

**Why:** A catch-all route alone can make deep links return 200 while silently replacing the JavaScript response with HTML, leaving the app unusable.

**How to apply:** Use filesystem handling first, then `{ "src": "/(.*)", "dest": "/index.html" }` for the SPA fallback, and verify both a deep link and the referenced hashed asset after promotion.