---
name: VIXUS AI wallet reconciliation
description: The durable accounting boundary between spendable wallet funds, transaction ledger entries, and locked VIP capital.
---

All spendable wallet balances must be derived from the canonical transaction ledger rules. Admin credits, completed deposits, and realized trade profits credit Main Wallet; withdrawals, bot purchases, and VIP package purchases debit Main Wallet. Vault Capital has its own ledger movements: signal stake reservations and fees debit it, while principal returns credit it. Pending outflows reduce availability without being counted as completed ledger debits.

Vault Capital is not part of the spendable Main Wallet and must be reported separately. Portfolio Wallet may combine Main Wallet and Vault Capital, but trading validation must use only Vault Capital and withdrawal validation must use only Main Wallet.

Deposit sessions are workflow records, not wallet credits. A deposit becomes spendable only after approval creates or completes its corresponding completed deposit transaction. Completion screens must read `mainWalletBalance` or `availableBalance`, not a non-existent generic `balance` field.

**Why:** Multiple route-specific balance formulas caused admin, dashboard, trade, and withdrawal views to disagree about credited deposits, returns, fees, and locked capital.

**How to apply:** Reuse the shared wallet snapshot or its pure transaction-delta helper whenever a route needs a balance. Do not add legacy bot profit totals to wallet balances; use earnings data for profit reporting.