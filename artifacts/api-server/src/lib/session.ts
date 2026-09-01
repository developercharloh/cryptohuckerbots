import type { Request, Response } from "express";
import { and, eq, ne } from "drizzle-orm";
import { db, sessionsTable, usersTable } from "@workspace/db";

export const USER_SESSION_COOKIE = "vixus_session";
export const ADMIN_SESSION_COOKIE = "vixus_admin_session";

// User sessions have both an absolute lifetime and an idle timeout. The cookie
// is renewed for active users, but a stolen token cannot remain valid forever.
export const USER_SESSION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;
export const USER_SESSION_IDLE_TIMEOUT_MS = 24 * 60 * 60 * 1000;
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const SESSION_ACTIVITY_REFRESH_MS = 5 * 60 * 1000;

const secureCookies =
  process.env.NODE_ENV === "production" || process.env.COOKIE_SECURE === "true";

function cookieOptions(maxAge: number) {
  const sameSite: "none" | "lax" = secureCookies ? "none" : "lax";
  return {
    httpOnly: true,
    secure: secureCookies,
    sameSite,
    maxAge,
    path: "/",
  };
}

export function getCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator < 0) continue;
    if (part.slice(0, separator).trim() !== name) continue;
    const value = part.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

/**
 * Cookies are the browser authentication mechanism. The Authorization fallback
 * keeps existing non-browser clients working during the cookie migration.
 */
export function getRequestToken(req: Request, cookieName = USER_SESSION_COOKIE): string | undefined {
  const cookieToken = getCookie(req, cookieName);
  if (cookieToken) return cookieToken;

  const authorization = req.headers.authorization;
  return authorization?.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : undefined;
}

export async function getUserSession(token: string | undefined) {
  if (!token) return null;

  const [record] = await db
    .select({ session: sessionsTable, user: usersTable })
    .from(sessionsTable)
    .innerJoin(usersTable, eq(usersTable.id, sessionsTable.userId))
    .where(eq(sessionsTable.token, token))
    .limit(1);

  if (!record) return null;
  if (isUserSessionExpired(record.session.createdAt, record.session.lastActive)) {
    await db.delete(sessionsTable).where(eq(sessionsTable.id, record.session.id));
    return null;
  }

  if (Date.now() - record.session.lastActive.getTime() >= SESSION_ACTIVITY_REFRESH_MS) {
    await db.update(sessionsTable)
      .set({ lastActive: new Date() })
      .where(eq(sessionsTable.id, record.session.id));
  }

  return record;
}

export async function getUserForSession(token: string | undefined) {
  return (await getUserSession(token))?.user ?? null;
}

export function setUserSessionCookie(res: Response, token: string): void {
  res.cookie(USER_SESSION_COOKIE, token, cookieOptions(USER_SESSION_MAX_AGE_MS));
}

export function clearUserSessionCookie(res: Response): void {
  res.clearCookie(USER_SESSION_COOKIE, cookieOptions(USER_SESSION_MAX_AGE_MS));
}

export function setAdminSessionCookie(res: Response, token: string): void {
  res.cookie(ADMIN_SESSION_COOKIE, token, cookieOptions(ADMIN_SESSION_TTL_MS));
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(ADMIN_SESSION_COOKIE, cookieOptions(ADMIN_SESSION_TTL_MS));
}

/**
 * Invalidate every session belonging to a user after a credential change.
 *
 * A caller may provide a session token when a credential-change flow
 * explicitly re-establishes one session. Password changes in the web app do
 * not pass one so the current browser is required to sign in again.
 */
export async function revokeUserSessions(userId: number, exceptToken?: string): Promise<void> {
  const conditions = [eq(sessionsTable.userId, userId)];
  if (exceptToken) {
    conditions.push(ne(sessionsTable.token, exceptToken));
  }
  await db.delete(sessionsTable).where(and(...conditions));
}

/**
 * A session expires after either its absolute lifetime or its idle lifetime.
 */
export function isUserSessionExpired(createdAt: Date, lastActive: Date): boolean {
  const now = Date.now();
  return (
    now - createdAt.getTime() > USER_SESSION_MAX_AGE_MS ||
    now - lastActive.getTime() > USER_SESSION_IDLE_TIMEOUT_MS
  );
}