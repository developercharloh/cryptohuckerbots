import crypto from "node:crypto";
import { sql } from "drizzle-orm";
import { db, technicalIncidentsTable } from "@workspace/db";

type TechnicalSource = "client" | "api" | "health";

export type TechnicalIncidentInput = {
  source: TechnicalSource;
  event: string;
  route?: string;
  message?: string;
  statusCode?: number;
  userAgent?: string;
};

const MAX_MESSAGE_LENGTH = 320;
const MAX_ROUTE_LENGTH = 255;
const MAX_EVENT_LENGTH = 100;

function shouldIgnore(input: TechnicalIncidentInput): boolean {
  // Rejected cross-origin requests are an intentional security response. They
  // must not pollute the operational incident list or make the system look
  // unhealthy when the CORS policy is doing its job.
  return (
    input.source === "api" &&
    input.statusCode === 403 &&
    /not allowed by cors/i.test(input.message ?? "")
  );
}

function redact(value: string, maxLength: number): string {
  return value
    .replace(/bearer\s+[a-z0-9._-]+/gi, "bearer [redacted]")
    .replace(/(?:password|passwd|secret|token|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, "sensitive=[redacted]")
    .replace(/https?:\/\/\S+/gi, "[url redacted]")
    .replace(/\b(?:sk|pk|api|key|secret|token)[_-]?[a-z0-9]{12,}\b/gi, "[credential redacted]")
    .replace(/\beyJ[a-z0-9_-]{20,}\b/gi, "[jwt redacted]")
    .replace(/\b[a-f0-9]{32,}\b/gi, "[identifier redacted]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[redacted-email]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeRoute(route: string | undefined): string {
  if (!route) return "unknown";
  try {
    const parsed = new URL(route, "https://vixus.invalid");
    return redact(parsed.pathname || "unknown", MAX_ROUTE_LENGTH);
  } catch {
    return redact(route.split("?")[0], MAX_ROUTE_LENGTH) || "unknown";
  }
}

export async function recordTechnicalIncident(input: TechnicalIncidentInput): Promise<void> {
  if (shouldIgnore(input)) return;

  const event = redact(input.event || "unknown_error", MAX_EVENT_LENGTH) || "unknown_error";
  const route = normalizeRoute(input.route);
  const message = redact(input.message || "Unexpected technical error", MAX_MESSAGE_LENGTH) || "Unexpected technical error";
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${input.source}:${event}:${route}:${input.statusCode ?? ""}`)
    .digest("hex");

  try {
    await db.insert(technicalIncidentsTable)
      .values({
        fingerprint,
        source: input.source,
        event,
        route,
        message,
        lastStatusCode: Number.isInteger(input.statusCode) ? input.statusCode : null,
      })
      .onConflictDoUpdate({
        target: technicalIncidentsTable.fingerprint,
        set: {
          message,
          status: "active",
          occurrences: sql`${technicalIncidentsTable.occurrences} + 1`,
          lastStatusCode: Number.isInteger(input.statusCode) ? input.statusCode : null,
          lastSeenAt: new Date(),
          resolvedAt: null,
          resolvedBy: null,
        },
      });
  } catch {
    // Health reporting must never turn a user request into a second failure.
  }
}