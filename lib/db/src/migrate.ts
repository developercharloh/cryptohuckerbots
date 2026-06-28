import path from "node:path";
import fs from "node:fs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "./index";

// Locate the committed SQL migrations folder at runtime. We walk up from the
// current working directory to the workspace root (identified by
// pnpm-workspace.yaml) so this works whether the process was started from the
// repo root (Render: `node artifacts/api-server/dist/index.mjs`) or from a
// package directory (Replit: `pnpm --filter ... run dev`). An explicit
// MIGRATIONS_DIR env var overrides the lookup.
function resolveMigrationsFolder(): string {
  if (process.env.MIGRATIONS_DIR) return process.env.MIGRATIONS_DIR;
  let dir = process.cwd();
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return path.join(dir, "lib", "db", "migrations");
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(process.cwd(), "lib", "db", "migrations");
}

// Apply any pending SQL migrations. Drizzle tracks applied migrations in its own
// `drizzle.__drizzle_migrations` table, so this is idempotent and safe to run on
// every boot. This is what keeps the production schema in sync on Render's free
// plan, where `preDeployCommand` does not run. Returns the resolved folder so the
// caller can log it. Throws loudly if the folder/journal is missing rather than
// silently applying zero migrations.
export async function runMigrations(): Promise<string> {
  const migrationsFolder = resolveMigrationsFolder();
  const journal = path.join(migrationsFolder, "meta", "_journal.json");
  if (!fs.existsSync(journal)) {
    throw new Error(
      `Migrations journal not found at ${journal} (resolved folder: ${migrationsFolder}). ` +
        "Ensure lib/db/migrations is present at runtime or set MIGRATIONS_DIR.",
    );
  }
  await migrate(db, { migrationsFolder });
  return migrationsFolder;
}
