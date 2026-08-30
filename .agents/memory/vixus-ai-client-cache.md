---
name: VIXUS AI client cache
description: Deployment verification and stale mobile SPA tab behavior for direct Vercel static deployments.
---

An already-open mobile SPA tab can continue rendering the previous hashed JavaScript bundle after a successful Vercel deployment. The current production index and asset can be correct while that tab still shows removed copy or behavior.

**Why:** A loaded single-page application does not re-read the deployment index until navigation or reload, so changing the hashed asset cannot update an in-memory tab.

**How to apply:** After a user reports old UI after deployment, verify `vixus.trade` serves the new asset and search that asset for the removed copy. If it is correct, have the user close the tab and open a new one, or perform a hard reload/clear site cache.