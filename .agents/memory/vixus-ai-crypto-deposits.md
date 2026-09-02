---
name: VIXUS AI crypto deposits
description: The single supported USDT settlement network and wallet validation rules.
---

## Rule

Deposits use a single stable-value settlement method: USDT on BNB Smart Chain (BEP-20). Users enter the USD-equivalent amount, and the server creates the session against the canonical BSC deposit address.

**Why:** The platform was explicitly narrowed to one network so users cannot accidentally choose an unsupported chain and so deposit/withdrawal behavior remains consistent.

**How to apply:** Keep the cashier API and all wallet screens limited to USDT on BNB Smart Chain (BEP-20). Withdrawal requests must validate a user-provided EVM-format wallet address server-side; never restore alternate networks through admin-configurable payment methods.
