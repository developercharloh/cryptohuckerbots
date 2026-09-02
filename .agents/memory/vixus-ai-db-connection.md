---
name: VIXUS AI database connection mismatch
description: executeSql (database skill sandbox) and the app's own DB pool can point at different Postgres databases — always verify before trusting either for schema changes.
---

The `executeSql` tool (database skill) connects using `DATABASE_URL` (host `helium`, db `heliumdb`), while the running app (api-server, via `lib/db`) connects using `NEON_DATABASE_URL` (a separate Neon Postgres instance, db `neondb`). These are two different physical databases.

**Why:** Running `ALTER TABLE` / schema-fixup SQL via `executeSql` silently succeeds against `heliumdb` but has zero effect on the app's real data — the app then throws `column ... does not exist` even though `executeSql` shows the column present. This wasted significant time before being diagnosed (confirmed via `current_database()` / `inet_server_addr()` comparison and a direct `pg.Pool` test using `NEON_DATABASE_URL`).

**How to apply:** Before trusting `executeSql` results for THIS project, run `SELECT current_database()` and compare against the host/db parsed from `NEON_DATABASE_URL`. If they differ, do manual schema fixes by connecting directly with the app's own `pg` `Pool`/`NEON_DATABASE_URL` (e.g. a short-lived script run via `tsx` from inside `artifacts/api-server`, importing `pool` from `lib/db/src/index.ts`) — not via `executeSql`. Also remember `drizzle-kit push` needs a TTY for interactive rename prompts and will fail non-interactively; prefer direct `ALTER TABLE` SQL for additive/simple schema changes instead.

The migrated Neon target can contain the original 19-table schema while the current API expects later VIP and signal tables/columns. Startup migration may stop at the first non-idempotent `CREATE TABLE "bots"` error, leaving those later migrations unapplied. Verify the live target schema before debugging a VIP 500; repair missing pieces additively and idempotently, without changing wallet records.

The Neon migration journal can also contain a newer historical `created_at` than the latest local migration entry. Drizzle then considers a newly added migration older and skips it; use a strictly later journal timestamp when adding the migration so the app applies it on startup.

**Why:** The referral table was initially absent even though startup reported migrations applied because the target already had an out-of-band migration timestamp newer than the local journal.

**How to apply:** If a migration is skipped without an error, compare `drizzle.__drizzle_migrations.created_at` with the local journal `when` values on the app's actual `NEON_DATABASE_URL` database before changing application code.
