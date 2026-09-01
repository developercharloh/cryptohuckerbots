import type { Request, Response } from "express";
import { and, lt, sql } from "drizzle-orm";
import { authRateLimitsTable, db, securityEventsTable } from "@workspace/db";
import { logger } from "./logger";

type RateLimitOptions = {
  key: string;
  limit: number;
  windowMs: number;
  blockMs?: number;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanupAt = 0;

export function requestIp(req: Request): string {
  return (req.ip || "0.0.0.0").replace("::ffff:", "").slice(0, 100);
}

export function normalizeEmail(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

/**
 * Uses PostgreSQL as the shared limiter store so Vercel instances do not each
 * get an independent unlimited bucket. The upsert is atomic for each key.
 */
export async function consumeRateLimit({
  key,
  limit,
  windowMs,
  blockMs = windowMs,
}: RateLimitOptions): Promise<RateLimitResult> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);
  const blockedUntil = new Date(now.getTime() + blockMs);

  const result = await db.execute(sql`
    INSERT INTO ${authRateLimitsTable} ("key", "count", "window_started_at", "updated_at")
    VALUES (${key}, 1, ${now}, ${now})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN ${authRateLimitsTable.windowStartedAt} <= ${windowStart}
          THEN 1
        ELSE ${authRateLimitsTable.count} + 1
      END,
      "window_started_at" = CASE
        WHEN ${authRateLimitsTable.windowStartedAt} <= ${windowStart}
          THEN ${now}
        ELSE ${authRateLimitsTable.windowStartedAt}
      END,
      "blocked_until" = CASE
        WHEN ${authRateLimitsTable.windowStartedAt} <= ${windowStart}
          THEN NULL
        WHEN ${authRateLimitsTable.count} + 1 >= ${limit}
          THEN ${blockedUntil}
        ELSE ${authRateLimitsTable.blockedUntil}
      END,
      "updated_at" = ${now}
    RETURNING "count", "window_started_at", "blocked_until"
  `);

  const row = result.rows[0] as {
    count: number;
    blocked_until: Date | string | null;
  } | undefined;
  const blockedUntilMs = row?.blocked_until
    ? row.blocked_until instanceof Date
      ? row.blocked_until.getTime()
      : Date.parse(row.blocked_until)
    : null;
  const activeBlock = blockedUntilMs !== null && blockedUntilMs > now.getTime();
  const overLimit = Number(row?.count ?? limit) > limit;

  if (Date.now() - lastCleanupAt > CLEANUP_INTERVAL_MS) {
    lastCleanupAt = Date.now();
    void db.delete(authRateLimitsTable).where(
      and(
        lt(authRateLimitsTable.updatedAt, new Date(Date.now() - 24 * 60 * 60 * 1000)),
        sql`${authRateLimitsTable.blockedUntil} IS NULL`,
      ),
    ).catch((err) => logger.warn({ err }, "Rate-limit cleanup failed"));
  }

  if (activeBlock || overLimit) {
    const retryAt = blockedUntilMs ?? now.getTime() + blockMs;
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((retryAt - now.getTime()) / 1000)),
    };
  }
  return { allowed: true, retryAfterSeconds: 0 };
}

export function rejectRateLimited(
  res: Response,
  result: RateLimitResult,
): boolean {
  if (result.allowed) return false;
  res.status(429).set("Retry-After", String(result.retryAfterSeconds)).json({
    error: "Too many attempts. Please try again later.",
  });
  return true;
}

export async function recordSecurityEvent(
  req: Request,
  event: string,
  userId?: number,
  metadata?: Record<string, unknown>,
): Promise<void> {
  try {
    await db.insert(securityEventsTable).values({
      userId: userId ?? null,
      event,
      ip: requestIp(req),
      metadata: metadata ?? null,
    });
  } catch (err) {
    logger.warn({ err, event }, "Security event could not be recorded");
  }
}

export function addNoStore(res: { set: (name: string, value: string) => unknown }): void {
  res.set("Cache-Control", "no-store");
}