---
name: VIXUS AI social preview cache
description: Social platforms may retain older Open Graph metadata after the live Vercel HTML has been updated.
---

The canonical VIXUS AI page can return the current metadata to WhatsApp-, Telegram-, Facebook-, and Twitter-style crawlers while an existing WhatsApp preview still displays older text.

**Why:** Social platforms cache link previews independently of the website and may not immediately re-fetch a URL after deployment.

**How to apply:** Verify the live HTML with crawler user agents first. If it is clean, treat an old WhatsApp card as cached preview data; share the canonical URL again after refreshing the preview rather than changing application functionality or serving different content by user agent.