---
name: VIXUS AI form resolver compatibility
description: Zod and React Hook Form resolver version alignment for the user app.
---

The user app uses `zod` 3.25.x. Keep `@hookform/resolvers` on the 5.x line so its optional Zod peer resolves to the app's Zod version; the older 3.x resolver can resolve a different workspace Zod generation under pnpm and make valid form schemas fail typechecking.

**Why:** The older resolver package did not declare Zod as a peer dependency, so pnpm's virtual store exposed Zod 4 resolver types alongside the app's Zod 3 schemas.

**How to apply:** When adding or changing form validation, preserve the resolver/Zod peer alignment and run the full workspace typecheck rather than relying only on the frontend build.