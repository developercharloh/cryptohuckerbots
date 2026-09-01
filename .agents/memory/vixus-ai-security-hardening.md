---
name: VIXUS AI security hardening
description: Security-hardening constraints and migration behavior for authentication, sessions, rate limits, reset tokens, and provider callbacks.
---

Use PostgreSQL-backed rate limits and idempotency records for serverless API mutations; in-memory guards are not sufficient across instances. Password-reset delivery must fail honestly until a real server-side delivery endpoint is configured.

**Why:** The API runs across serverless instances, and the development database may already contain the application tables while Drizzle's migration journal is empty. Blindly running every historical migration can fail on existing tables.

**How to apply:** Check the live database and migration journal before applying schema changes. Register existing migrations consistently, apply only the new migration when the schema is already present, and verify readiness after startup initialization.