/**
 * Axon backend server (composition root).
 * - OTLP /v1/traces  — trace ingestion
 * - REST /api/*       — querying traces
 * - SSE  /api/events  — live dashboard updates
 * - serves the built dashboard on the same origin
 */

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import { createServer } from "http";
import cors from "cors";
import dotenv from "dotenv";

import { initializeSchema } from "./database/schema.js";
import { createOtlpTraceHandler } from "./otel/otlp-receiver.js";
import type { IngestResult } from "./otel/span-transformer.js";
import { tracesRouter } from "./api/traces.js";
import { sseHandler, sseTraceCreated, sseTraceUpdated } from "./sse.js";
import { mountDashboard } from "./static.js";

dotenv.config();
initializeSchema();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
const httpServer = createServer(app);

// After the OTLP receiver stores spans, signal SSE clients: new traces trigger
// a list refresh, updated traces trigger a refetch of the open trace.
function emitIngest(result: IngestResult): void {
  for (const traceId of result.created) sseTraceCreated(traceId);
  for (const traceId of result.updated) sseTraceUpdated(traceId);
}

app.use(cors());

// OTLP receiver — registered BEFORE express.json() so its scoped raw body parser
// wins and protobuf payloads are never parsed as JSON.
app.post(
  "/v1/traces",
  express.raw({ type: "*/*", limit: "10mb" }),
  createOtlpTraceHandler({ onIngest: emitIngest }),
);

app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), timestamp: Date.now() });
});

app.get("/api/events", sseHandler);
app.use("/api", tracesRouter);

// Static dashboard + SPA fallback (must be after API/OTLP routes).
const dashboardDir = mountDashboard(app, __dirname);

const PORT = parseInt(process.env.PORT || "4000", 10);
const HOST = process.env.HOST || "127.0.0.1";

httpServer.listen(PORT, HOST, () => {
  const base = `http://${HOST}:${PORT}`;
  console.log(`
╔══════════════════════════════════════════════════╗
║   Axon — LLM Observability                       ║
╠══════════════════════════════════════════════════╣
║   Dashboard:  ${base.padEnd(34)}║
║   OTLP ingest: ${(base + "/v1/traces").padEnd(33)}║
║   REST API:   ${(base + "/api/traces").padEnd(34)}║
║   Health:     ${(base + "/health").padEnd(34)}║
╚══════════════════════════════════════════════════╝
  `);
  if (!dashboardDir) {
    console.warn("  ⚠  Dashboard not built — run: npm run build --workspace=dashboard");
  }
  console.log("✅ Axon ready\n");
});

export { app, httpServer };
