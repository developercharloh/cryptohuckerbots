# VIXUS AI

A full-stack FX trading bot platform with an admin panel for managing users, bots, finance, support, and platform settings.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/admin-app run dev` — run the admin panel (port 18391, path `/admin-app/`)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite, TanStack Query, shadcn/ui, Tailwind CSS, Wouter

## Where things live

- `lib/db/src/schema/index.ts` — DB schema (source of truth)
- `lib/api-spec/openapi.yaml` — API contract (source of truth)
- `lib/api-client-react/src/` — generated React Query hooks
- `lib/api-zod/src/` — generated Zod schemas
- `artifacts/api-server/src/routes/` — Express route handlers
- `artifacts/api-server/src/lib/seed.ts` — DB seeding (bots, FAQ, admin user)
- `artifacts/admin-app/src/pages/` — admin panel pages

## Architecture decisions

- Contract-first API: OpenAPI spec → Orval codegen → typed hooks + Zod schemas
- Admin auth is separate from user auth: uses `admin.vixus-ai` username + platform email + password via `/api/admin/login`
- Token stored in `localStorage` under key `vixus_admin_token`
- Password hashing uses SHA-256 with `vixus_salt_2024` (not bcrypt — intentional for performance)
- Account UIDs prefixed with `VAI` (e.g. `VAI12345`)
- API server serves on `/api` path; admin app on `/admin-app/`

## Product

- Admin dashboard with earnings charts, user metrics, bot performance stats
- User management: list, search, view details, manage KYC, adjust balances
- Bot marketplace management: view/edit bot catalog, user bot assignments
- Finance panel: deposit/withdrawal approvals, transaction history
- Support ticket system with admin reply capability
- Broadcast messaging to all users
- Platform settings: app name, payment methods, deposit/withdrawal limits, maintenance mode

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Admin user is auto-seeded on startup via `ensureAdminEmail()` — default email is `admin@vixus.ai`, set `ADMIN_ACCOUNT_PASSWORD` env var to change the default password (`Admin@VIXUS2027!`)
- DB migrations use Drizzle's push mode (not migration files) — `pnpm --filter @workspace/db run push` for schema changes
- The migration journal warning on startup is non-fatal — schema is managed via push, not migration files
- Web push notifications require `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` env vars
- Set `ADMIN_ACCOUNT_PASSWORD` env var to override the default admin password

## Vercel Deployment

Each app is a **separate Vercel project** pointing at the same GitHub repo (`developercharloh/cryptohuckerbots`). Set **Root Directory** to the path shown below for each project — Vercel will pick up the `vercel.json` inside that directory automatically.

| Vercel project | Root Directory | Framework |
|---|---|---|
| VIXUS AI (user app) | `artifacts/user-app` | Other (no framework) |
| VIXUS AI Admin | `artifacts/admin-app` | Other (no framework) |
| VIXUS AI API | `artifacts/api-server` | Other (no framework) |

### Steps (do once per project on vercel.com)

1. **Import** the GitHub repo → pick the project name & root directory from the table above.
2. **Override build settings** — Vercel auto-detects the `vercel.json`; no manual overrides needed.
3. **Add environment variables** (Settings → Environment Variables):

   **All three projects need:**
   - `DATABASE_URL` — your PostgreSQL connection string

   **API Server project also needs:**
   - `ADMIN_ACCOUNT_PASSWORD` — admin panel password (default `Admin@VIXUS2027!`)
   - `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — for web push notifications (optional)

   **User App & Admin App projects need:**
   - `VITE_API_BASE_URL` — the deployed API server URL (e.g. `https://vixus-api.vercel.app`)

4. **Deploy** — click Deploy. After first deploy, every push to `main` auto-deploys.

### How the API server works on Vercel

The API server runs as a **Vercel Serverless Function**. The build command (`pnpm --filter @workspace/api-server run build`) bundles the entire Express app (including all workspace libraries) into a self-contained `dist/vercel-handler.mjs` file. On each cold start, Vercel runs database migrations and seeds in the background before serving requests.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
- Vercel config lives in `vercel.json` inside each artifact directory; `build.mjs` builds both `dist/index.mjs` (regular server) and `dist/vercel-handler.mjs` (Vercel entry)
