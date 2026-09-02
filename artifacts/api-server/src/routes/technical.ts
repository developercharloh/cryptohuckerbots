import { Router } from "express";
import { consumeRateLimit, rejectRateLimited, requestIp } from "../lib/security";
import { recordTechnicalIncident } from "../lib/technical";

const router = Router();

router.post("/technical-errors", async (req, res) => {
  const limited = await consumeRateLimit({
    key: `technical-errors:ip:${requestIp(req)}`,
    limit: 30,
    windowMs: 10 * 60 * 1000,
    blockMs: 10 * 60 * 1000,
  });
  if (rejectRateLimited(res, limited)) return;

  const body = req.body && typeof req.body === "object" ? req.body as Record<string, unknown> : {};
  const source = body.source === "api" || body.source === "health" ? body.source : "client";
  const event = typeof body.event === "string" ? body.event : "client_error";
  const route = typeof body.route === "string" ? body.route : "unknown";
  const message = typeof body.message === "string" ? body.message : "Unexpected technical error";
  const statusCode = typeof body.statusCode === "number" && Number.isInteger(body.statusCode)
    ? body.statusCode
    : undefined;

  await recordTechnicalIncident({
    source,
    event,
    route,
    message,
    statusCode,
  });

  // Reporting is intentionally opaque to the browser. A technical failure
  // should never produce a second public-facing error while being recorded.
  return res.status(202).json({ accepted: true });
});

export default router;