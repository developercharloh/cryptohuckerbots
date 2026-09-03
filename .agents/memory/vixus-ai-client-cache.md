---
name: VIXUS AI client cache
description: Deployment verification and stale mobile SPA tab behavior for direct Vercel static deployments.
---

An already-open mobile SPA tab can continue rendering the previous hashed JavaScript bundle after a successful Vercel deployment. The current production index and asset can be correct while that tab still shows removed copy or behavior.

**Why:** A loaded single-page application does not re-read the deployment index until navigation or reload, so changing the hashed asset cannot update an in-memory tab.

**How to apply:** After a user reports old UI after deployment, verify `vixus.trade` serves the new asset and search that asset for the removed copy. If it is correct, have the user close the tab and open a new one, or perform a hard reload/clear site cache.

Keep the service-worker cache versioned when shipping auth or shell changes, and make stale-client recovery clear every VIXUS shell cache prefix, not only legacy names.

**Why:** A valid cached shell can keep an active mobile client on old auth behavior even after the deployment index and hashed assets are correct.

**How to apply:** Bump the shell cache name for shell/auth releases and include all current and legacy VIXUS cache prefixes in recovery cleanup.

The startup animation must remain visible until the route shell and session initialization are ready; it must not disappear on a fixed timer while the app is still loading.

**Why:** A fixed-duration splash can expose a second loading/error state during slow mobile launches, which makes a normal refresh look like an app failure.

**How to apply:** Drive the welcome loader from an app-ready signal, keep route/auth fallbacks as neutral spinners, and use shell cache versioning for installed-app updates.