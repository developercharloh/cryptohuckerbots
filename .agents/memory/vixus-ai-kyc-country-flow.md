---
name: VIXUS AI KYC country-specific flow and fake-ID detection
description: Kenya gets a simplified single-step KYC; all countries run through a shared fake-ID/SSN heuristic detector before storage.
---

Kenyan users get a simplified Tier 1 KYC (ID number, full name, ID document, selfie — no address, no idType, no Tier 2) instead of the standard two-tier flow. Detected via substring match `/kenya/i` on the country string (countries are stored as emoji-prefixed strings like "🇰🇪 Kenya").

**Why:** User requested reduced KYC friction for Kenya specifically while keeping the full two-tier flow (address + proof of address) for everyone else.

**How to apply:** Country selection must be lifted to the parent component (not left local to a per-tier form) so the parent can conditionally hide the Tier 2 section and the child form can hide address/idType fields for Kenya. The `country` field is on `KYCInput`/`AdminKycItem` but intentionally NOT on the lightweight `KYCStatus` list schema — don't add a dependency on `KYCStatus.country` in the frontend, use the locally-tracked selected country state instead.

All KYC submissions (any country) run through a shared heuristic fake-ID/SSN detector (`detectFakeId` in `artifacts/api-server/src/lib/idValidation.ts`) before the record is stored: hard-rejects all-same-digit, sequential, repeating-pattern, and known placeholder numbers (e.g. 123456789, 078051120) with a 400 error; also does structural US SSN checks and Kenya ID length checks. Non-hard-reject anomalies set `idFlagged`/`idFlagReason` on the KYC row for admin review instead of blocking submission.

**Why:** This is intentionally a heuristic, not real identity verification — it only catches obviously fabricated numbers. Kept as a separate importable function so it can be reused/extended for other countries later without touching route logic.
