/**
 * REST API router for querying traces.
 * Thin HTTP layer over the trace-view service.
 */

import { Router } from "express";
import {
  listTraces,
  getTraceDetail,
  getTraceEvents,
  getStats,
  getProjects,
} from "../services/trace-view.js";

export const tracesRouter = Router();

/** GET /api/traces - list all traces (optionally filtered by ?project=) */
tracesRouter.get("/traces", (req, res) => {
  try {
    res.json(listTraces(req.query.project as string | undefined));
  } catch (error) {
    console.error("Error listing traces:", error);
    res.status(500).json({ error: "Failed to list traces", message: (error as Error).message });
  }
});

/** GET /api/traces/:traceId - full trace with enhanced nodes/edges/stats */
tracesRouter.get("/traces/:traceId", (req, res) => {
  try {
    const detail = getTraceDetail(req.params.traceId);
    if (!detail) return res.status(404).json({ error: "Trace not found" });
    res.json(detail);
  } catch (error) {
    console.error("Error getting trace:", error);
    res.status(500).json({ error: "Failed to get trace" });
  }
});

/** GET /api/traces/:traceId/events - flat event list for a trace */
tracesRouter.get("/traces/:traceId/events", (req, res) => {
  try {
    const events = getTraceEvents(req.params.traceId);
    if (!events) return res.status(404).json({ error: "Trace not found" });
    res.json({ events });
  } catch (error) {
    console.error("Error getting events:", error);
    res.status(500).json({ error: "Failed to get events" });
  }
});

/** GET /api/stats - overall statistics */
tracesRouter.get("/stats", (_req, res) => {
  try {
    res.json(getStats());
  } catch (error) {
    console.error("Error getting stats:", error);
    res.status(500).json({ error: "Failed to get stats" });
  }
});

/** GET /api/projects - per-project rollup */
tracesRouter.get("/projects", (_req, res) => {
  try {
    res.json({ projects: getProjects() });
  } catch (error) {
    console.error("Error getting projects:", error);
    res.status(500).json({ error: "Failed to get projects" });
  }
});
