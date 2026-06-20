/**
 * Dashboard static-file serving + SPA fallback.
 *
 * The backend serves the built dashboard so the UI, REST API, OTLP ingest and
 * SSE all live on one origin/port.
 */

import path from "path";
import { existsSync } from "fs";
import type { Express } from "express";
import express from "express";

/**
 * Resolve the dashboard dist directory. Preference order:
 *   1. AXON_DASHBOARD_DIR env override
 *   2. <repo>/dashboard/dist        (dev / monorepo layout)
 *   3. <server.js parent>/dashboard (CLI bundled)
 */
export function resolveDashboardDir(serverDir: string): string | null {
  if (process.env.AXON_DASHBOARD_DIR) return process.env.AXON_DASHBOARD_DIR;
  const monorepo = path.join(serverDir, "../../dashboard/dist");
  if (existsSync(monorepo)) return monorepo;
  const bundled = path.join(serverDir, "../dashboard");
  if (existsSync(bundled)) return bundled;
  return null;
}

/**
 * Mount static serving + SPA fallback on `app`. Returns the resolved directory
 * (or null if the dashboard build was not found, in which case nothing is mounted
 * and Axon runs as a pure OTLP collector).
 */
export function mountDashboard(app: Express, serverDir: string): string | null {
  const dashboardDir = resolveDashboardDir(serverDir);

  if (!dashboardDir) {
    console.warn(
      "[axon] Dashboard dist not found. Serving as a pure OTLP collector. " +
        "Run `npm run build --workspace=dashboard` or set AXON_DASHBOARD_DIR.",
    );
    return null;
  }

  app.use(express.static(dashboardDir));

  // SPA fallback for non-API, non-OTLP, non-health paths so deep links work.
  app.get(/^\/(?!api\/|v1\/|health).*/, (_req, res) => {
    res.sendFile(path.join(dashboardDir, "index.html"));
  });

  return dashboardDir;
}
