---
name: VIXUS AI scheduled bot trades
description: How the mandatory 24h always-win bot trade + countdown is implemented, and why it's lazy-executed rather than cron-based.
---

Each running bot must execute exactly one guaranteed-win trade every 24h, with a live countdown shown in the UI.

**Why lazy execution on read (not a cron/background worker):** api-server deploys to Vercel serverless functions, which have no persistent long-running process to host a scheduler. The codebase already used this "resolve on read" pattern for position TP/SL resolution in `trade.ts`, so the scheduled-trade check follows the same convention — it runs inside the `GET /api/bots` and `GET /api/bots/:id` handlers, checking `userBotsTable.nextTradeAt` against `now()` and firing the trade inline if due, then resetting `nextTradeAt` to `now + 24h`.

**Why single catch-up, not backlog replay:** if a user doesn't open the app for multiple days, only one trade fires (not N missed trades) — the reset baseline is `now`, not the old scheduled time — to avoid runaway profit farming from inactivity.

**Why always-win:** the codebase's core trade simulator (`getTradeOutcome` in `trade.ts`) is already hardcoded to return `"profit"` for all trades platform-wide; the scheduled bot trade reuses this convention by inserting a pre-resolved `tp_hit` position directly rather than an open one, so it's a win by construction, never a loss path.

**How to apply:** if adding more bot-driven automated financial logic, keep it in the lazy-on-read pattern unless a real background worker/queue is introduced — do not assume a cron job will fire in production.
