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

/**
 * Retry an async operation with exponential backoff.
 *
 * Useful for operations that touch the database on cold start, where a
 * free-tier Postgres host (Neon, Supabase) may need a few seconds to wake up.
 *
 * @param fn       - async operation to attempt
 * @param label    - human-readable name used in log messages
 * @param maxTries - maximum number of attempts (default 5)
 * @param baseMs   - initial backoff delay in ms, doubles each attempt (default 500)
 */
async function retryWithBackoff(
  fn: () => Promise<unknown>,
  label: string,
  maxTries = 5,
  baseMs = 500,
): Promise<void> {
  let attempt = 0;
  while (true) {
    try {
      await fn();
      return;
    } catch (err) {
      attempt++;
      if (attempt >= maxTries) {
        logger.error({ err, attempt }, `${label} failed after ${maxTries} attempts`);
        throw err;
      }
      const delayMs = baseMs * Math.pow(2, attempt - 1);
      logger.warn(
        { err, attempt, delayMs },
        `${label} failed (attempt ${attempt}/${maxTries}), retrying in ${delayMs}ms`,
      );
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

async function runStartupTasks(): Promise<void> {
  await retryWithBackoff(
    () => runMigrations(),
    "Database migrations",
  ).catch((err) =>
    logger.warn(
      { err },
      "Database migrations ultimately failed — schema may already be current",
    ),
  );

  await retryWithBackoff(
    () =>
      db.execute(sql`
        CREATE TABLE IF NOT EXISTS admin_push_subscriptions (
          id SERIAL PRIMARY KEY,
          endpoint TEXT NOT NULL UNIQUE,
          p256dh TEXT NOT NULL,
          auth TEXT NOT NULL,
          created_at TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `),
    "Ensure admin_push_subscriptions table",
  ).catch((err) =>
    logger.warn({ err }, "Could not ensure admin_push_subscriptions table"),
  );

  await retryWithBackoff(
    () =>
      db.execute(sql`
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
      `),
    "Ensure admin_login_notifications table",
  ).catch((err) =>
    logger.warn({ err }, "Could not ensure admin_login_notifications table"),
  );

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
