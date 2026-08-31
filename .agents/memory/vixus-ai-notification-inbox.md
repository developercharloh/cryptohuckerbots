---
name: VIXUS AI notification inbox
description: User notification badge and unread-only inbox behavior.
---

The user notification surface shows only unread notifications. The dashboard badge displays the exact count through 9, then `+10`; marking one or all as read removes it from the visible inbox immediately, while polling allows new notifications to appear.

**Why:** Read history should not keep the notification inbox visually noisy, while the badge must make pending user attention obvious.

**How to apply:** Keep the unread filter and cache removal behavior together whenever notification list, badge, or mark-read mutations are changed.