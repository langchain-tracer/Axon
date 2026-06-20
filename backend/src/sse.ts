/**
 * Server-Sent Events hub for live dashboard updates.
 *
 * v1 is deliberately minimal: one endpoint (GET /api/events) and two global
 * events broadcast to every client — `trace_created` and `trace_updated`.
 * No rooms, subscriptions, or per-client filtering. The dashboard refreshes the
 * trace list on `trace_created` and refetches the open trace on `trace_updated`.
 */

import type { Request, Response } from "express";

const clients = new Set<Response>();
const heartbeats = new Map<Response, ReturnType<typeof setInterval>>();

/** Broadcast a named SSE event with a JSON payload to all connected clients. */
function broadcast(event: string, data: unknown): void {
  const frame = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(frame);
}

/** A new trace was seen for the first time. */
export function sseTraceCreated(traceId: string): void {
  broadcast("trace_created", { traceId, timestamp: Date.now() });
}

/** An existing trace received new spans. */
export function sseTraceUpdated(traceId: string): void {
  broadcast("trace_updated", { traceId, timestamp: Date.now() });
}

/** Express handler for GET /api/events. */
export function sseHandler(req: Request, res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // disable proxy buffering
  res.flushHeaders();

  res.write("retry: 3000\n\n");
  res.write("event: connected\ndata: {}\n\n");

  clients.add(res);
  heartbeats.set(res, setInterval(() => res.write(": ping\n\n"), 20000));

  req.on("close", () => {
    const hb = heartbeats.get(res);
    if (hb) clearInterval(hb);
    heartbeats.delete(res);
    clients.delete(res);
  });
}
