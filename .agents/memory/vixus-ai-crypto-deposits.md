---
name: VIXUS AI crypto deposits
description: How BTC/ETH deposits convert to USDT and when the exchange rate is locked in.
---

## Rule

Deposits made via a coin-priced payment method (BTC, ETH) are entered by the user in the coin's own units, not USD. The USDT-equivalent conversion rate is fetched live from Binance and locked in at **session-creation (submission) time** — stored on the deposit session row — not recalculated at admin-approval time.

**Why:** User explicitly requested the rate be locked when they submit the deposit, so later price movement between submission and admin review doesn't change what they're credited.

**How to apply:** Stable-value methods (USDT TRC20/ERC20/BEP20) are unaffected — they keep the simple USD-amount flow. Only methods with a live pair mapping (BTC→BTCUSDT, ETH→ETHUSDT) use the coin-amount + locked-rate flow. If adding another coin-priced method, add it to the rate-lookup map on both backend and frontend, and expose the stored crypto amount/asset/rate through the API schema so admin review UI can show what was actually locked in.

## Live rate fetching

Binance's public REST/WS API returns HTTP 451 (blocked) from Vercel's serverless IPs and browser-side from some regions. `getLiveUsdRate` in `cashier.ts` falls back through Binance → CoinGecko → Coinbase in sequence.

**Why:** Cloud/serverless egress IP ranges (Vercel, some AWS regions) are geo/policy-blocked by Binance; CoinGecko and Coinbase are not.

**How to apply:** Any new live-price integration for this app should use the same fallback chain rather than assuming Binance is reachable — do not remove the fallbacks even if Binance looks fine in local dev (dev IPs aren't blocked, prod serverless IPs are).

## Deposit address configuration

Deposit addresses are plain env vars read once at module load in `cashier.ts` (`DEPOSIT_USDT_TRC20/ERC20/BEP20`, `DEPOSIT_BTC_MAINNET` — legacy name `DEPOSIT_BTC_BEP20` still read as fallback, `DEPOSIT_ETH_ERC20`). They are NOT sourced from the admin Settings UI's `payment_methods` JSONB column (`artifacts/admin-app/src/pages/Settings.tsx` writes there but nothing reads it back into cashier.ts) — that's a known, unresolved inconsistency.

**Why:** Two separate address-configuration paths exist (env vars vs. admin UI) and only one is wired up; discovered when all deposit addresses were found empty because they'd never been set anywhere.

**How to apply:** When troubleshooting "empty deposit address" bugs, check the env vars first, not the admin Settings page. Env vars must be set in *both* Replit (dev) and Vercel (prod project settings) — Replit secrets do not auto-sync to Vercel; use the Vercel API (`POST /v10/projects/{id}/env`) to mirror them for production.
