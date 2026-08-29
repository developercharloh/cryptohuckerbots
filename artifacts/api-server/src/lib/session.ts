import type { Request, Response } from "express";

export const USER_SESSION_COOKIE = "vixus_session";
export const ADMIN_SESSION_COOKIE = "vixus_admin_session";

export const USER_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ADMIN_SESSION_TTL_MS = 24 * 60 * 60 * 1000;

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

export function setUserSessionCookie(res: Response, token: string): void {
  res.cookie(USER_SESSION_COOKIE, token, cookieOptions(USER_SESSION_TTL_MS));
}

export function clearUserSessionCookie(res: Response): void {
  res.clearCookie(USER_SESSION_COOKIE, cookieOptions(USER_SESSION_TTL_MS));
}

export function setAdminSessionCookie(res: Response, token: string): void {
  res.cookie(ADMIN_SESSION_COOKIE, token, cookieOptions(ADMIN_SESSION_TTL_MS));
}

export function clearAdminSessionCookie(res: Response): void {
  res.clearCookie(ADMIN_SESSION_COOKIE, cookieOptions(ADMIN_SESSION_TTL_MS));
}

export function isUserSessionExpired(createdAt: Date): boolean {
  return createdAt.getTime() + USER_SESSION_TTL_MS <= Date.now();
}