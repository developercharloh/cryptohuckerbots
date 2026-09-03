---
name: VIXUS AI public error boundaries
description: Safe public failures and private operational visibility for the VIXUS web apps and API.
---

The browser-facing error boundary must never copy arbitrary API bodies, upstream provider text, URLs, tokens, or exception messages into user/admin toasts. Shared API errors are classified by HTTP status and otherwise use safe retry copy. Direct-fetch routes use fixed public messages.

**Why:** Provider configuration and upstream response details can contain credentials, deployment topology, or internal diagnostics. The user-facing site should fail clearly without turning those details into a disclosure.

**How to apply:** Preserve raw details only in controlled server logs when needed, and record a sanitized fixed-message incident in the authenticated Admin Health workspace for infrastructure failures such as storage, database, or provider outages.