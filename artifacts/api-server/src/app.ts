import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "node:path";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

// Ultra-simple health check before any middleware — responds instantly even if
// pinoHttp or static-file middleware is slow to initialize on cold start.
app.get("/api/healthz", (_req, res) => {
  res.setHeader("Content-Type", "application/json");
  res.end('{"status":"ok"}');
});

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
// A bare `cors()` responds with `Access-Control-Allow-Origin: *`, which
// browsers reject for credentialed requests (e.g. `xhr.withCredentials =
// true`, used by the file upload flow to send the session cookie). Since
// the user-app/admin-app (vixus.trade / admin) and the API
// (api.vixus.trade) are on different origins in production, we must echo
// back a specific allowed origin and explicitly allow credentials —
// wildcard + credentials silently breaks every cross-origin request in
// real browsers, even though server-side test scripts (which don't
// enforce CORS) don't reveal it.
const DEFAULT_ALLOWED_ORIGINS = [
  "https://vixus.trade",
  "https://www.vixus.trade",
  "https://vixus-user-app.vercel.app",
  "https://vixus-ai-admin.vercel.app",
];
const configuredOrigins = (process.env.ALLOWED_ORIGINS ?? "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([...DEFAULT_ALLOWED_ORIGINS, ...configuredOrigins]);

app.use(
  cors({
    origin: (origin, callback) => {
      // No Origin header (server-to-server, curl, health checks) — allow.
      if (!origin) return callback(null, true);
      if (allowedOrigins.has(origin)) return callback(null, true);
      // Allow any Replit dev/preview domain and any Vercel preview deployment
      // for this project so staging/dev testing isn't blocked.
      if (/\.replit\.dev$/.test(new URL(origin).hostname)) return callback(null, true);
      if (/\.vercel\.app$/.test(new URL(origin).hostname)) return callback(null, true);
      return callback(new Error(`Origin ${origin} not allowed by CORS`));
    },
    credentials: true,
  }),
);
app.use(express.json({
  limit: "1mb",
  verify: (_req, _res, buf) => {
    (_req as any).rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

app.use("/api", router);

// Single-service deployments (e.g. Render) serve the built React app from the
// same Express server. Gated behind SERVE_CLIENT so Replit's split
// frontend/backend setup (shared reverse proxy) is unaffected.
if (process.env.SERVE_CLIENT === "true") {
  const clientDist = path.resolve(
    process.cwd(),
    process.env.CLIENT_DIST ?? "artifacts/admin-app/dist/public",
  );

  app.use(express.static(clientDist));

  // SPA fallback: non-API, non-admin-app GET requests return index.html.
  // Must exclude /admin-app/* so the admin panel's own static files (sw.js,
  // assets, etc.) are not shadowed by this fallback.
  app.use((req, res, next) => {
    if (req.method !== "GET" || req.path.startsWith("/api") || req.path.startsWith("/admin-app")) {
      return next();
    }
    res.sendFile(path.join(clientDist, "index.html"));
  });

  logger.info({ clientDist }, "Serving frontend static assets");
}

// Serve the admin panel from /admin-app/ on the same server.
// Bypasses the unreliable Render static site builder entirely.
// The dist is committed to the repo so no separate build step is needed.
if (process.env.SERVE_ADMIN === "true") {
  const adminDist = path.resolve(
    process.cwd(),
    process.env.ADMIN_DIST ?? "artifacts/admin-app/dist/public",
  );

  // Serve static assets prefixed at /admin-app
  app.use("/admin-app", express.static(adminDist));

  // SPA fallback: non-file requests under /admin-app return index.html.
  // Express 5 does not allow bare wildcards in get(); use middleware instead.
  app.use("/admin-app", (_req, res) => {
    res.sendFile(path.join(adminDist, "index.html"));
  });

  logger.info({ adminDist }, "Serving admin panel static assets");
}

// Global JSON error handler. Without this, any error thrown before a route
// handler runs (e.g. express.json()/express.urlencoded() rejecting an
// oversized or malformed body) falls through to Express's *default* error
// handler, which — in production mode — renders a bare HTML page
// (`<pre>Payload Too Large</pre>`) instead of JSON. Clients (our React
// apps) expect JSON everywhere, so that HTML response breaks error parsing
// and shows users a cryptic, undiagnosable message. This middleware makes
// every failure mode (past or future — new routes, new limits, malformed
// input) fail the same predictable, debuggable way instead of relying on
// each individual route to anticipate it.
app.use(
  (
    err: unknown,
    req: express.Request,
    res: express.Response,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _next: express.NextFunction,
  ) => {
    const error = err as { status?: number; statusCode?: number; type?: string; message?: string };
    const status = error?.status ?? error?.statusCode ?? 500;

    if (status === 413 || error?.type === "entity.too.large") {
      req.log?.warn({ err }, "Request body too large");
      res.status(413).json({
        error: "Request is too large. Please reduce the size of the data you're sending and try again.",
      });
      return;
    }

    if (error?.type === "entity.parse.failed") {
      req.log?.warn({ err }, "Malformed request body");
      res.status(400).json({ error: "Malformed request body." });
      return;
    }

    req.log?.error({ err }, "Unhandled error");
    res.status(status >= 400 && status < 600 ? status : 500).json({
      error: "An unexpected error occurred. Please try again later.",
    });
  },
);

export default app;
