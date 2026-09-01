---
name: Vercel serverless initialization
description: Database initialization behavior for Vercel serverless cold starts.
---

Serverless handlers must not rely on fire-and-forget database migrations or seed operations completing after the first fast response. A function can be frozen as soon as the response finishes, leaving a fresh database schema present but catalog, FAQ, auxiliary tables, or bootstrap records unseeded.

**Why:** A fresh deployment returned a healthy response while its asynchronous startup work had not completed, and the database remained empty until initialization was run explicitly.

**How to apply:** Make readiness await required initialization, or run a separate idempotent initialization step before promoting a fresh production deployment. Verify row counts for required public seed data and bootstrap records afterward. If an older Neon schema predates the Drizzle journal, baseline only the confirmed legacy migrations and keep newer migrations idempotent so startup can repair the journal without replaying table creation.