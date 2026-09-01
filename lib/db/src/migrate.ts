import path from "node:path";
import fs from "node:fs";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
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

async function bootstrapLegacyMigrationJournal(migrationsFolder: string): Promise<void> {
  const journalPath = path.join(migrationsFolder, "meta", "_journal.json");
  const journal = JSON.parse(fs.readFileSync(journalPath, "utf8")) as {
    entries?: Array<{ tag: string; when: number }>;
  };
  const legacyEntries = (journal.entries ?? []).filter((entry) =>
    /^000[0-3]_/.test(entry.tag),
  );
  if (legacyEntries.length !== 4) return;

  await db.execute(sql`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (
      id SERIAL PRIMARY KEY,
      hash text NOT NULL,
      created_at bigint
    )
  `);

  const existingTables = await db.execute(sql`
    SELECT
      to_regclass('public.users') AS users,
      to_regclass('public.bots') AS bots,
      to_regclass('public.settings') AS settings,
      to_regclass('public.vip_package_purchases') AS vip_package_purchases,
      to_regclass('public.vip_investment_capital') AS vip_investment_capital
  `);
  const schemaIsAlreadyProvisioned = Object.values(existingTables.rows[0] ?? {}).every(Boolean);
  if (!schemaIsAlreadyProvisioned) return;

  const applied = await db.execute(sql`
    SELECT 1
    FROM "drizzle"."__drizzle_migrations"
    LIMIT 1
  `);
  if (applied.rows.length > 0) return;

  for (const entry of legacyEntries) {
    await db.execute(sql`
      INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at")
      VALUES (${`legacy-bootstrap:${entry.tag}`}, ${entry.when})
    `);
  }
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
  await bootstrapLegacyMigrationJournal(migrationsFolder);
  await migrate(db, { migrationsFolder });
  return migrationsFolder;
}
