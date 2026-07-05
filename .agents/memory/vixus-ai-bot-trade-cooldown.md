---
name: VIXUS AI bot trade cooldown
description: How the 24h trade cooldown is unified across scheduled auto-trades and the manual "Start Bot" flow.
---

## Rule

There is exactly one cooldown clock per owned bot: `user_bots.next_trade_at`. Both the scheduled auto-trade system (`bots.ts`) and the manual "Start Bot" flow (`POST /api/trade/manual` in `trade.ts`) read/write this same field. A manual trade is rejected with 400 + `secondsUntilNextTrade` if `next_trade_at` is still in the future; on success it sets `next_trade_at = now + 24h` and increments `total_trades`.

**Why:** The manual trade endpoint originally had no cooldown check at all, letting users trade the same bot unlimited times back-to-back, bypassing the already-built 24h scheduled-trade cooldown. Unifying on one field avoids double-trading and keeps a single source of truth instead of adding a second cooldown field.

**How to apply:** Any new way to trigger a trade for an owned bot (new endpoint, admin override, etc.) must check and update `next_trade_at` the same way, not invent its own cooldown state. Frontend lock/disable state (bot list buttons, Start Bot selection, submit button) all derive from `secondsUntilNextTrade` on the Bot API response — reuse the shared `TradeCountdown` component and an `isBotLocked()` check rather than re-deriving lock state ad hoc per screen.

## Test data cleanup gotcha

This project's `psql`/`executeSql` default target can differ — `executeSql` in the code_execution sandbox hit an almost-empty default DB, while the app actually runs on `NEON_DATABASE_URL`. Always use `psql "$NEON_DATABASE_URL"` (via bash) for manual verification/cleanup queries against this app's real data, not the sandbox's `executeSql`.
