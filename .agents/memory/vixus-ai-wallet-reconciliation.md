---
name: VIXUS AI wallet reconciliation
description: The durable accounting boundary between spendable wallet funds, transaction ledger entries, and locked VIP capital.
---

All spendable wallet balances must be derived from the canonical transaction ledger rules. Admin credits and completed deposits are wallet credits; trade returns are credits; withdrawals, reserved stakes, fees, bot purchases, and VIP package purchases are debits. Pending outflows reduce availability without being counted as completed ledger debits.

Locked VIP investment capital is not part of the spendable wallet and must be reported separately. Portfolio totals may combine available wallet funds and currently locked capital, but withdrawal validation must use only the available wallet.

Deposit sessions are workflow records, not wallet credits. A deposit becomes spendable only after approval creates or completes its corresponding completed deposit transaction. Completion screens must read `mainWalletBalance` or `availableBalance`, not a non-existent generic `balance` field.

**Why:** Multiple route-specific balance formulas caused admin, dashboard, trade, and withdrawal views to disagree about credited deposits, returns, fees, and locked capital.

**How to apply:** Reuse the shared wallet snapshot or its pure transaction-delta helper whenever a route needs a balance. Do not add legacy bot profit totals to wallet balances; use earnings data for profit reporting.