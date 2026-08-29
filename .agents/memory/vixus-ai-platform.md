---
name: VIXUS AI Platform
description: FX trading bot admin panel — architecture, credentials, seeding, and rebrand notes from the Quantum-FX-Bot import.
---

## Key facts

- Rebranded from Quantum-FX-Bot; all "quantum/qfx/QFX" strings replaced with "vixus/VIXUS/VAI"
- Password salt: `vixus_salt_2024` (SHA-256, not bcrypt)
- Account UID prefix: `VAI`
- Browser sessions use server-set HttpOnly cookies; bearer session tokens are not stored in browser storage.
- Theme localStorage key: `vixus_theme`
- Admin login endpoint: `POST /api/admin/login` — checks the configured panel password (not the DB password hash)
- Admin credentials: email `admin@vixus.ai`, username `admin.vixus-ai`, password defaults to `Admin@VIXUS2027!` and can be overridden with `ADMIN_PANEL_PASSWORD`
- `ADMIN_ACCOUNT_PASSWORD` env var only affects the DB password hash (used for regular user auth), NOT the admin panel login

## DB

- Schema managed via Drizzle push (no migration journal) — run `pnpm --filter @workspace/db run push`
- Migration journal warning on startup is non-fatal
- Default settings row: appName = "VIXUS AI", supportEmail = "support@vixus.ai"

## Seeding (api-server startup)

- 5 bots seeded into marketplace
- 8 FAQ entries seeded
- Demo email purged: `demo@vixus.ai`

**Why:** Recorded to avoid re-discovering rebrand details and credential conventions in future sessions.
