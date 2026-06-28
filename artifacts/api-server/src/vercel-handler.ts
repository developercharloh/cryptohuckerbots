import { runMigrations } from "@workspace/db/migrate";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import app from "./app.js";
import { logger } from "./lib/logger.js";
import {
  seedBots,
  seedDemoAndFaq,
  ensureAdminEmail,
  purgeTestUsers,
} from "./lib/seed.js";

let initPromise: Promise<void> | null = null;

function getInitPromise(): Promise<void> {
  if (!initPromise) {
    initPromise = runStartupTasks();
  }
  return initPromise;
}

async function runStartupTasks(): Promise<void> {
  try {
    await runMigrations();
    logger.info("Database migrations applied");
  } catch (err) {
    logger.warn(
      { err },
      "Database migration skipped (non-fatal) — schema may already be current",
    );
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

getInitPromise().catch((err) =>
  logger.error({ err }, "Vercel cold-start tasks failed"),
);

export default app;
