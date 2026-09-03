---
name: VIXUS AI deposit reconciliation
description: Rules for making deposit transaction-hash reconciliation globally one-time and auditable.
---

Deposit transaction hashes must be treated as globally unique across both deposit sessions and completed/pending transactions, not merely unique within each table. A session hash can otherwise be reused by the legacy deposit endpoint.

**Why:** The workflow has two historical deposit record shapes, and separate database unique indexes cannot enforce uniqueness across tables.

**How to apply:** Any endpoint that accepts or reconciles a deposit hash must validate the BNB hash format, check both record tables, and perform the final credit/status transition atomically.