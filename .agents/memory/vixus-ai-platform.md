---
name: VIXUS AI Platform
description: FX trading bot admin panel — architecture, credentials, seeding, and rebrand notes from the Quantum-FX-Bot import.
---

## Key facts

- Rebranded from Quantum-FX-Bot; all "quantum/qfx/QFX" strings replaced with "vixus/VIXUS/VAI"
- Password salt: `vixus_salt_2024` (SHA-256, not bcrypt)
- Account UID prefix: `VAI`
- Browser sessions use server-set HttpOnly cookies; bearer session tokens are not stored in browser storage.
- User sessions are persistent across reloads and browser restarts; the cross-origin API renews the HttpOnly cookie when `/api/auth/me` confirms it, and explicit logout or security revocation ends access.
- AI Signal settlement is a disclosed fixed +$2.25 positive outcome across all supported pairs and directions; the server finalizes it even when the app is closed, while non-signal bot trades retain simulated outcomes.
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
- Test/demo account cleanup is explicit opt-in via `PURGE_TEST_USERS=true`; normal startup never infers that an account is disposable from its email.

**Why:** Recorded to avoid re-discovering rebrand details and credential conventions in future sessions.

**How to apply:** Keep browser API calls credentialed, avoid client-side token storage, and do not reintroduce age-based user-session expiry without an explicit product decision.

**Why:** The product explicitly chose a transparent fixed AI Signal outcome after users were shown a negative signal result despite the disclosed +$2.50 credit.

**How to apply:** Keep signal settlement server-controlled and idempotent; do not apply this fixed outcome to unrelated bot positions.

## Current VIP economics

- VIP 1 requires $350 in completed deposits and a $350 wallet activation; VIP 2–10 are free referral upgrades requiring 5, 10, 20, 35, 55, 80, 110, 145, and 185 credited referrals.
- New referral bonuses are $20 when the referred user activates VIP 1; already-credited historical payouts remain unchanged, while pending legacy referrals are normalized to $20.
- Admin-assigned demo referrals satisfy an existing VIP level and display the standard $20 credited bonus per referral, while keeping reserved amount at $0 and creating no wallet transaction.

**Why:** The product changed from paid doubling tiers and $25 referral bonuses to a $350 entry tier with referral-only progression and a $20 referral reward.

**How to apply:** Treat credited referrals as the qualification source, preserve historical paid ledger amounts, and use the current tier ladder for new upgrades.
