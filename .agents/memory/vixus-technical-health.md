---
name: VIXUS technical health
description: Security and product boundary for technical incident reporting and admin monitoring
---

Technical failures reported by the public app must be sanitized and aggregated server-side. The public endpoint should return only an opaque accepted response; raw stacks, credentials, request bodies, emails, and internal infrastructure details must never reach the browser UI or public response. Incident inspection, live service checks, and resolve/reopen controls are admin-only.

**Why:** Reliability diagnostics are valuable for fixing the platform, but exposing implementation details or alarming users turns an internal failure into a security and trust problem.

**How to apply:** Keep user-facing technical recovery copy neutral and quiet. Add new diagnostic fields only after redaction and aggregation, and expose them through the protected admin health surface rather than user notifications.