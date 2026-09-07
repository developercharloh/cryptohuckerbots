---
name: VIXUS AI Binance deposits
description: Deposit confirmation constraints for the shared Binance BSC address.
---

The Binance exchange deposit-history API may return HTTP 451 from server locations restricted by Binance eligibility rules. For the shared Binance BSC address, use on-chain USDT Transfer logs and the configured confirmation threshold instead of depending on Binance account history.

**Why:** The API key could be stored securely and signed correctly, but the runtime location was rejected by Binance before account data was returned. The public BSC RPC remained reachable.

**How to apply:** Treat the blockchain TxID as the source record, deduplicate it in the deposit-event ledger, and auto-credit only when the exact USDT amount maps to one active deposit session. Keep ambiguous or unmatched deposits uncredited until an admin workflow exists.