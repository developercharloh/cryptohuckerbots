---
name: VIXUS AI signal access window
description: Durable decisions for the new-user signal window and its serverless reminder behavior.
---

New-user signal access is identified by nullable start/end timestamps on the user. Existing users have both values NULL and must remain on the legacy access path; never infer eligibility from account age.

**Why:** The feature was explicitly limited to users joining after launch, so a nullable record is safer than backfilling or deriving a window for existing accounts.

The three-day Support Center reminder is written as an admin chat message and guarded by a database-backed per-user idempotency marker plus a transaction lock. Signal access reads and admin workspace reads can safely trigger the due-reminder sweep in the serverless deployment model.

**Why:** The API does not depend on a persistent worker or cron process, and concurrent requests must not create duplicate reminders.

**How to apply:** Keep enforcement in the API access/opportunity/execution paths. Treat the client countdown as presentation only and calculate it from the server-provided end timestamp.