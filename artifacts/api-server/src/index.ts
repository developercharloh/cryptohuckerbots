import { runMigrations } from "@workspace/db/migrate";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "./app";
import { logger } from "./lib/logger";
import { seedBots, seedDemoAndFaq, ensureAdminEmail, purgeTestUsers } from "./lib/seed";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function runStartupTasks() {
  try {
    const migrationsFolder = await runMigrations();
    logger.info({ migrationsFolder }, "Database migrations applied");
  } catch (err) {
    logger.warn({ err }, "Database migration skipped (non-fatal) — schema may already be current");
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
        id SERIAL PRIMARY KEY,
        endpoint TEXT NOT NULL UNIQUE,
        p256dh TEXT NOT NULL,
        auth TEXT NOT NULL,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("admin_push_subscriptions table ensured");
  } catch (err) {
    logger.warn({ err }, "Could not ensure admin_push_subscriptions table");
  }

  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS admin_login_notifications (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL,
        account_uid VARCHAR(15) NOT NULL,
        full_name TEXT NOT NULL,
        email VARCHAR(255) NOT NULL,
        ip VARCHAR(100) NOT NULL DEFAULT 'Unknown',
        country VARCHAR(100) NOT NULL DEFAULT 'Unknown',
        is_read BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    logger.info("admin_login_notifications table ensured");
  } catch (err) {
    logger.warn({ err }, "Could not ensure admin_login_notifications table");
  }

  try {
    await purgeTestUsers();
  } catch (err) {
    logger.error({ err }, "Test user purge failed");
  }

  try {
    await seedBots();
  } catch (err) {
    logger.error({ err }, "Bot seeding failed");
  }

  try {
    await seedDemoAndFaq();
  } catch (err) {
    logger.error({ err }, "Demo/FAQ seeding failed");
  }

  try {
    await ensureAdminEmail();
  } catch (err) {
    logger.error({ err }, "Admin email promotion failed");
  }
}

// Bind the port immediately so Render's health check passes right away,
// then run potentially slow DB operations (migrations, seeding) in the background.
// This prevents free-tier DB wake-up latency from blocking the health check.
app.listen(port, (err?: Error) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }
  logger.info({ port }, "Server listening");

  runStartupTasks().catch((err) => {
    logger.error({ err }, "Startup tasks failed");
  });
});
