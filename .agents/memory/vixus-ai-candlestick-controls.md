---
name: VIXUS AI candlestick controls
description: Interaction and zoom constraints for the mobile live-market chart.
---

Lightweight Charts v5 does not expose a `timeScale().zoom()` method; custom zoom controls should resize the current visible logical range, while native pinch, wheel, and drag interactions remain enabled.

**Why:** Calling a method from older chart-library APIs fails typechecking and can leave the mobile chart without usable zoom controls.

**How to apply:** Keep chart edges unlocked, configure `handleScale` and `handleScroll`, and implement button zoom with `getVisibleLogicalRange()` plus `setVisibleLogicalRange()`. Preserve a separate fit-to-data action.