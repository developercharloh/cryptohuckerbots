---
name: VIXUS AI support attachments
description: Security and storage constraints for private support-chat file uploads.
---

Private support-chat files use direct client uploads to Vercel Blob, while PostgreSQL stores only attachment metadata. The Blob client's cross-origin token request does not reliably carry HttpOnly API cookies, so token issuance must be gated by a short-lived, signed upload capability. The final chat-message request must re-authorize the proof against the authenticated conversation owner or admin target before persisting metadata.

**Why:** The web apps and API are separate origins, and exposing Blob URLs or forwarding file bytes through the API would either break authentication or exceed serverless request limits.

**How to apply:** Keep Blob objects private, serve them through an authenticated API proxy, never trust client-supplied ownership or URLs, and keep upload/session proofs short-lived and path-scoped.