---
name: VIXUS support test isolation
description: Database safety boundary for support integration tests.
---

Support integration tests create users, messages, escalations, and tickets in the database configured by `NEON_DATABASE_URL`. In this workspace that connection can point at the live Neon database, so running the suite against it creates anonymous-looking inbox records that resemble real support requests.

**Why:** A verification run populated the live support inbox with multiple test escalations, which appeared in the admin UI as separate `Unknown` users.

**How to apply:** Before running mutating support tests, verify the database target is isolated test data. If only the production connection is available, do not run the suite against it; use a non-mutating production query or provision an isolated test database first.