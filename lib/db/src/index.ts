import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

const connectionString = process.env.NEON_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "NEON_DATABASE_URL or DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

function boundedIntegerEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(process.env[name]);
  if (!Number.isInteger(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

// Vercel creates multiple short-lived API instances. A small per-instance pool
// prevents a traffic spike from exhausting the shared Postgres connection
// budget, while still allowing concurrent requests to make progress.
const serverless = process.env.VERCEL === "1";
const poolMax = boundedIntegerEnv("DB_POOL_MAX", serverless ? 5 : 10, 1, 20);

export const pool = new Pool({
  connectionString,
  max: poolMax,
  min: 0,
  idleTimeoutMillis: boundedIntegerEnv("DB_IDLE_TIMEOUT_MS", 10_000, 1_000, 120_000),
  connectionTimeoutMillis: boundedIntegerEnv("DB_CONNECTION_TIMEOUT_MS", 5_000, 1_000, 30_000),
  keepAlive: true,
  keepAliveInitialDelayMillis: 10_000,
  maxUses: boundedIntegerEnv("DB_MAX_USES", 10_000, 100, 100_000),
});
export const db = drizzle(pool, { schema });

export * from "./schema";
