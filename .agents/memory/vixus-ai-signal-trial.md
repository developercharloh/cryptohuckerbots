---
name: VIXUS AI signal access window
description: Durable decisions for VIXUS AI's usage-based VIP 1 signal allowance.
---

VIP 1 signal access is a nullable, server-owned allowance initialized at VIP 1 activation. It begins with 60 pair units; one unit is consumed only after two successful signal claims occur on the same local day. Skipped days and partial/failed transactions do not consume a unit.

**Why:** The product promise is 60 completed daily pairs, not 60 calendar days. Persisting the balance and guarding updates inside the per-user transaction lock prevents retries and concurrent tabs from double-counting.

Legacy VIP 1 accounts without a pair balance are initialized from their VIP 1 activation date, counting only full local-day pairs executed after activation. VIP 2 bypasses the VIP 1 allowance gate.

**How to apply:** Keep enforcement in the API access, opportunity, and both execution paths. Treat the client counter as presentation only; the API remains the source of truth.