---
name: VIXUS AI support inbox
description: Private support chat lifecycle, inbox state, and conversation boundary behavior.
---

Support chat keeps its full history in the existing message stream. A `system` message marks a closed conversation; the admin inbox treats the latest system message as closed and the latest user message as awaiting reply. The user's first message after closure starts a new conversation boundary without deleting history.

**Why:** This gives Support an auditable full conversation while avoiding a destructive migration of existing chat records.

**How to apply:** Preserve the system-marker lifecycle when changing chat routes or UI. Closing must notify the user; admin replies are blocked until the user starts a new conversation.