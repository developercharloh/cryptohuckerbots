import { API_BASE } from "./api-base";

type TechnicalErrorInput = {
  source?: "client" | "api" | "health";
  event: string;
  route?: string;
  message?: string;
  statusCode?: number;
};

const recentReports = new Map<string, number>();
const REPORT_COOLDOWN_MS = 60_000;

function sanitize(value: string, maxLength: number): string {
  return value
    .replace(/bearer\s+[a-z0-9._-]+/gi, "bearer [redacted]")
    .replace(/(?:password|passwd|secret|token|authorization|cookie)\s*[:=]\s*[^\s,;]+/gi, "sensitive=[redacted]")
    .replace(/https?:\/\/\S+/gi, "[url redacted]")
    .replace(/\b(?:sk|pk|api|key|secret|token)[_-]?[a-z0-9]{12,}\b/gi, "[credential redacted]")
    .replace(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi, "[redacted-email]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

export function reportTechnicalError(input: TechnicalErrorInput): void {
  if (typeof window === "undefined") return;

  const source = input.source ?? "client";
  const event = sanitize(input.event || "client_error", 100) || "client_error";
  const route = sanitize(input.route || window.location.pathname || "unknown", 255) || "unknown";
  const message = sanitize(input.message || "Unexpected technical error", 320) || "Unexpected technical error";
  const key = `${source}:${event}:${route}:${input.statusCode ?? ""}`;
  const now = Date.now();
  const lastReportedAt = recentReports.get(key);
  if (lastReportedAt && now - lastReportedAt < REPORT_COOLDOWN_MS) return;
  recentReports.set(key, now);

  void fetch(`${API_BASE}/api/technical-errors`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "omit",
    keepalive: true,
    body: JSON.stringify({ source, event, route, message, statusCode: input.statusCode }),
  }).catch(() => {
    // Reporting must never create a visible error or a retry loop.
  });
}