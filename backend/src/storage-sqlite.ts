/**
 * SQLite storage for traces (persistent, file-based)
 */

import Database from "better-sqlite3";
import {
  Trace,
  TraceEvent,
  TraceStats,
  TraceListItem,
  TraceWithEvents
} from "./types";
import path from "path";
import fs from "fs";

class SQLiteStorage {
  private db: Database.Database;
  private dbPath: string;

  constructor(dbPath: string = "./data/traces.db") {
    this.dbPath = dbPath;

    // Ensure data directory exists
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    // Open database
    this.db = new Database(dbPath);

    // Enable WAL mode for better concurrency
    this.db.pragma("journal_mode = WAL");

    // NOTE: Schema initialization moved to database/schema.ts
    // Do NOT initialize schema here to avoid conflicts
    // this.initSchema();

    console.log(`📁 SQLite database: ${dbPath}`);
  }

  /**
   * Create database schema
   */
  private initSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS traces (
        trace_id TEXT PRIMARY KEY,
        project_name TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        metadata TEXT,
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
      );

      CREATE INDEX IF NOT EXISTS idx_traces_project 
        ON traces(project_name);
      
      CREATE INDEX IF NOT EXISTS idx_traces_start_time 
        ON traces(start_time DESC);

      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_id TEXT UNIQUE NOT NULL,
        trace_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        parent_run_id TEXT,
        timestamp INTEGER NOT NULL,
        type TEXT NOT NULL,
        
        -- LLM fields
        model TEXT,
        prompts TEXT,
        response TEXT,
        tokens_prompt INTEGER,
        tokens_completion INTEGER,
        tokens_total INTEGER,
        cost REAL,
        latency INTEGER,
        reasoning TEXT,
        agent_actions TEXT,
        
        -- Tool fields
        tool_name TEXT,
        tool_input TEXT,
        tool_output TEXT,
        
        -- Chain fields
        chain_name TEXT,
        chain_inputs TEXT,
        chain_outputs TEXT,
        
        -- Error fields
        error TEXT,
        stack TEXT,
        
        -- Metadata
        metadata TEXT,
        
        created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
        
        FOREIGN KEY (trace_id) REFERENCES traces(trace_id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_events_trace_id 
        ON events(trace_id);
      
      CREATE INDEX IF NOT EXISTS idx_events_run_id 
        ON events(run_id);
      
      CREATE INDEX IF NOT EXISTS idx_events_type 
        ON events(type);
      
      CREATE INDEX IF NOT EXISTS idx_events_timestamp 
        ON events(timestamp);
    `);

    console.log("✅ Database schema initialized");
  }

  /**
   * Store events for a trace
   */
  addEvents(events: TraceEvent[]): void {
    console.log(events, "EVENT from db");

    const insertTrace = this.db.prepare(`
      INSERT OR IGNORE INTO traces (trace_id, project_name, start_time, metadata)
      VALUES (?, ?, ?, ?)
    `);

    const updateTraceEndTime = this.db.prepare(`
      UPDATE traces 
      SET end_time = ? 
      WHERE trace_id = ? AND (end_time IS NULL OR end_time < ?)
    `);

    const insertEvent = this.db.prepare(`
      INSERT INTO events (
        event_id, trace_id, run_id, parent_run_id, timestamp, type,
        model, prompts, response, tokens_prompt, tokens_completion, tokens_total,
        cost, latency, reasoning, agent_actions, tool_name, tool_input, tool_output,
        chain_name, chain_inputs, chain_outputs, error, stack, metadata
      ) VALUES (
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?
      )
    `);

    // Use transaction for better performance
    const insertMany = this.db.transaction((events: TraceEvent[]) => {
      for (const event of events) {
        // Insert or update trace
        insertTrace.run(
          event.traceId,
          event.metadata?.projectName || "default",
          event.timestamp,
          JSON.stringify(event.metadata || {})
        );

        // Update end time
        updateTraceEndTime.run(event.timestamp, event.traceId, event.timestamp);

        // Insert event
        insertEvent.run(
          event.eventId,
          event.traceId,
          event.runId,
          event.parentRunId || null,
          event.timestamp,
          event.type,

          // LLM fields
          event.model || null,
          event.prompts ? JSON.stringify(event.prompts) : null,
          event.response || null,
          event.tokens?.prompt || null,
          event.tokens?.completion || null,
          event.tokens?.total || null,
          event.cost || null,
          event.latency || null,
          event.reasoning || null,
          event.agentActions ? JSON.stringify(event.agentActions) : null,

          // Tool fields
          event.toolName || null,
          event.input ? JSON.stringify(event.input) : null,
          event.output || null,

          // Chain fields
          event.chainName || null,
          event.inputs ? JSON.stringify(event.inputs) : null,
          event.outputs ? JSON.stringify(event.outputs) : null,

          // Error fields
          event.error || null,
          event.stack || null,

          // Metadata
          JSON.stringify(event.metadata || {})
        );
      }
    });

    insertMany(events);
    console.log(`📦 Stored ${events.length} events in SQLite`);
  }

  /**
   * Get a specific trace with full details
   */
  getTrace(traceId: string): TraceWithEvents | undefined {
    const traceRow = this.db
      .prepare(`SELECT * FROM traces WHERE trace_id = ?`)
      .get(traceId) as any;

    if (!traceRow) return undefined;

    const eventRows = this.db
      .prepare(`SELECT * FROM events WHERE trace_id = ? ORDER BY timestamp ASC`)
      .all(traceId) as any[];

    const events = eventRows.map((row) => this.rowToEvent(row));

    // Calculate stats
    const totalCost = events.reduce((sum, e) => sum + (e.cost || 0), 0);
    const totalNodes = events.filter((e) => e.type.endsWith("_start")).length;

    const status: "running" | "complete" | "error" = events.some(
      (e) => e.type === "error"
    )
      ? "error"
      : events.every((e) => e.type.endsWith("_end") || e.type === "error")
      ? "complete"
      : "running";

    return {
      id: traceRow.trace_id, // ✅ Changed from 'Id' to 'id'
      projectName: traceRow.project_name,
      startTime: traceRow.start_time,
      endTime: traceRow.end_time,
      status,
      totalCost,
      totalNodes,
      metadata: JSON.parse(traceRow.metadata || "{}"),
      createdAt: new Date(traceRow.created_at),
      events // Include events for full trace
    };
  }

  /**
   * Get all traces (minimal info)
   */
  getAllTraces(limit: number = 100): TraceListItem[] {
    const traceRows = this.db
      .prepare(
        `
      SELECT 
        t.trace_id,
        t.project_name,
        t.start_time,
        t.end_time,
        t.created_at,
        SUM(COALESCE(e.cost, 0)) as total_cost,
        COUNT(CASE WHEN e.type LIKE '%_start' THEN 1 END) as total_nodes,
        CASE 
          WHEN SUM(CASE WHEN e.type = 'error' THEN 1 ELSE 0 END) > 0 THEN 'error'
          WHEN t.end_time IS NOT NULL THEN 'complete'
          ELSE 'running'
        END as status
      FROM traces t
      LEFT JOIN events e ON e.trace_id = t.trace_id
      GROUP BY t.trace_id
      ORDER BY t.start_time DESC 
      LIMIT ?
    `
      )
      .all(limit) as any[];

    return traceRows.map((row) => ({
      id: row.trace_id,
      projectName: row.project_name,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status as "running" | "complete" | "error",
      totalCost: row.total_cost || 0,
      totalNodes: row.total_nodes || 0
    }));
  }

  /**
   * Get traces by project (minimal info)
   */
  getTracesByProject(
    projectName: string,
    limit: number = 100
  ): TraceListItem[] {
    const traceRows = this.db
      .prepare(
        `
      SELECT 
        t.trace_id,
        t.project_name,
        t.start_time,
        t.end_time,
        t.created_at,
        SUM(COALESCE(e.cost, 0)) as total_cost,
        COUNT(CASE WHEN e.type LIKE '%_start' THEN 1 END) as total_nodes,
        CASE 
          WHEN SUM(CASE WHEN e.type = 'error' THEN 1 ELSE 0 END) > 0 THEN 'error'
          WHEN t.end_time IS NOT NULL THEN 'complete'
          ELSE 'running'
        END as status
      FROM traces t
      LEFT JOIN events e ON e.trace_id = t.trace_id
      WHERE t.project_name = ?
      GROUP BY t.trace_id
      ORDER BY t.start_time DESC 
      LIMIT ?
    `
      )
      .all(projectName, limit) as any[];

    return traceRows.map((row) => ({
      id: row.trace_id,
      projectName: row.project_name,
      startTime: row.start_time,
      endTime: row.end_time,
      status: row.status as "running" | "complete" | "error",
      totalCost: row.total_cost || 0,
      totalNodes: row.total_nodes || 0
    }));
  }

  /**
   * Calculate trace statistics
   */
  getTraceStats(traceId: string): TraceStats | null {
    const stats = this.db
      .prepare(
        `
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN type = 'llm_end' THEN 1 ELSE 0 END) as llm_calls,
        SUM(CASE WHEN type = 'tool_end' THEN 1 ELSE 0 END) as tool_calls,
        SUM(CASE WHEN type = 'error' THEN 1 ELSE 0 END) as errors,
        SUM(COALESCE(cost, 0)) as total_cost,
        SUM(COALESCE(latency, 0)) as total_latency
      FROM events
      WHERE trace_id = ?
    `
      )
      .get(traceId) as any;

    if (!stats) return null;

    return {
      totalEvents: stats.total_events,
      llmCalls: stats.llm_calls,
      toolCalls: stats.tool_calls,
      totalCost: stats.total_cost,
      totalLatency: stats.total_latency,
      errors: stats.errors
    };
  }

  /**
   * Delete old traces (cleanup)
   */
  cleanup(maxAgeMs: number = 24 * 60 * 60 * 1000): number {
    const cutoffTime = Date.now() - maxAgeMs;

    const result = this.db
      .prepare(`DELETE FROM traces WHERE start_time < ?`)
      .run(cutoffTime);

    if (result.changes > 0) {
      console.log(`🧹 Cleaned up ${result.changes} old traces`);
      // Vacuum to reclaim space
      this.db.exec("VACUUM");
    }

    return result.changes;
  }

  /**
   * Get storage stats
   */
  getStorageStats() {
    const stats = this.db
      .prepare(
        `
      SELECT 
        (SELECT COUNT(*) FROM traces) as total_traces,
        (SELECT COUNT(*) FROM events) as total_events,
        (SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()) as db_size_bytes
    `
      )
      .get() as any;

    return {
      totalTraces: stats.total_traces,
      totalEvents: stats.total_events,
      databaseSize: stats.db_size_bytes,
      databaseSizeMB: (stats.db_size_bytes / 1024 / 1024).toFixed(2),
      databasePath: this.dbPath
    };
  }

  /**
   * Convert database row to TraceEvent
   */
  private rowToEvent(row: any): TraceEvent {
    const event: TraceEvent = {
      eventId: row.event_id,
      traceId: row.trace_id,
      runId: row.run_id,
      parentRunId: row.parent_run_id,
      timestamp: row.timestamp,
      type: row.type,
      status: row.status || "complete",
      metadata: JSON.parse(row.metadata || "{}")
    };

    // Add type-specific fields
    if (row.model) event.model = row.model;
    if (row.prompts) event.prompts = JSON.parse(row.prompts);
    if (row.response) event.response = row.response;
    if (row.tokens_prompt) {
      event.tokens = {
        prompt: row.tokens_prompt,
        completion: row.tokens_completion,
        total: row.tokens_total
      };
    }
    if (row.cost) event.cost = row.cost;
    if (row.latency) event.latency = row.latency;
    if (row.tool_name) event.toolName = row.tool_name;
    if (row.tool_input) event.input = JSON.parse(row.tool_input);
    if (row.tool_output) event.output = row.tool_output;
    if (row.chain_name) event.chainName = row.chain_name;
    if (row.chain_inputs) event.inputs = JSON.parse(row.chain_inputs);
    if (row.chain_outputs) event.outputs = JSON.parse(row.chain_outputs);
    if (row.error) event.error = row.error;
    if (row.stack) event.stack = row.stack;

    return event;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    console.log("📁 Database closed");
  }
}

// Singleton instance
export const storage = new SQLiteStorage(
  process.env.DB_PATH || "./data/traces.db"
);

// Cleanup on process exit
process.on("SIGINT", () => {
  storage.close();
  process.exit(0);
});

process.on("SIGTERM", () => {
  storage.close();
  process.exit(0);
});
