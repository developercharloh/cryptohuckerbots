---
name: VIXUS AI video audio fallback
description: Fallback path for narrated video audio when hosted generation is unavailable.
---

When hosted ElevenLabs generation is unavailable, a narrated video can still ship with a generic local male-sounding voice from FFmpeg's built-in Flite filter and a simple FFmpeg-generated instrumental bed. Pre-mix music and delayed scene narration into one MP3 for export parity.

**Why:** Hosted voice and music callbacks may return payment-required errors even after the workspace's approval flow, which should not block a requested tutorial from being completed.

**How to apply:** Keep narration short enough for each scene, delay each clip by the cumulative scene duration, duck the music beneath speech, and wire the resulting composite through the artifact's base URL.