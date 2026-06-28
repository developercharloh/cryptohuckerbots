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
app.use(cors());
app.use(express.json({
  verify: (_req, _res, buf) => {
    (_req as any).rawBody = buf;
  },
}));
app.use(express.urlencoded({ extended: true }));

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

export default app;
