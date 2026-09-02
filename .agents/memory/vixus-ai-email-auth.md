---
name: VIXUS AI email auth
description: Durable rules for email verification, OTP gating, and stale browser-session handling.
---

Password authentication is a three-stage flow: valid credentials, verified email, then OTP. A browser session must not be restored on public auth pages, and a valid password login must clear any stale cookie before returning an email-verification or OTP requirement.

**Why:** A stale authenticated cookie could make the UI appear logged in before the user completed the current account's verification or OTP steps, and old unverified accounts need a reachable resend path instead of being stranded at login.

**How to apply:** Keep public auth routes outside session restoration, treat the server's verification/OTP responses as hard gates, and preserve an explicit resend-verification route for legacy unverified accounts.