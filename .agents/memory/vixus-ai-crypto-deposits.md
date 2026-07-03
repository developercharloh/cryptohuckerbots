---
name: VIXUS AI crypto deposits
description: How BTC/ETH deposits convert to USDT and when the exchange rate is locked in.
---

## Rule

Deposits made via a coin-priced payment method (BTC, ETH) are entered by the user in the coin's own units, not USD. The USDT-equivalent conversion rate is fetched live from Binance and locked in at **session-creation (submission) time** — stored on the deposit session row — not recalculated at admin-approval time.

**Why:** User explicitly requested the rate be locked when they submit the deposit, so later price movement between submission and admin review doesn't change what they're credited.

**How to apply:** Stable-value methods (USDT TRC20/ERC20/BEP20) are unaffected — they keep the simple USD-amount flow. Only methods with a live pair mapping (BTC→BTCUSDT, ETH→ETHUSDT) use the coin-amount + locked-rate flow. If adding another coin-priced method, add it to the rate-lookup map on both backend and frontend, and expose the stored crypto amount/asset/rate through the API schema so admin review UI can show what was actually locked in.
