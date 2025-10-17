/**
 * SQLite database schema initialization
 */

import { db } from "./connection.js";
import { logger } from "../utils/logger.js";

export function initializeSchema(): void {
  logger.info("Initializing database schema...");

  // Create traces table
  db.run(`
    CREATE TABLE IF NOT EXISTS traces (
      id TEXT PRIMARY KEY,
      project_name TEXT NOT NULL,
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      status TEXT NOT NULL DEFAULT 'running',
      total_cost REAL DEFAULT 0,
      total_nodes INTEGER DEFAULT 0,
      metadata TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      updated_at INTEGER DEFAULT (strftime('%s', 'now') * 1000)
    )
  `);

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_traces_project ON traces(project_name)"
  );
  db.run("CREATE INDEX IF NOT EXISTS idx_traces_status ON traces(status)");
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_traces_created ON traces(created_at DESC)"
  );

  // Create nodes table
  db.run(`
    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      run_id TEXT NOT NULL UNIQUE,
      parent_run_id TEXT,
      type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      start_time INTEGER NOT NULL,
      end_time INTEGER,
      data TEXT NOT NULL,
      cost REAL,
      tokens TEXT,
      latency INTEGER,
      error TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (trace_id) REFERENCES traces(id) ON DELETE CASCADE
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_nodes_trace ON nodes(trace_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_nodes_run_id ON nodes(run_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_nodes_parent ON nodes(parent_run_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_nodes_type ON nodes(type)");
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_nodes_start_time ON nodes(start_time)"
  );

  // Create edges table
  db.run(`
    CREATE TABLE IF NOT EXISTS edges (
      id TEXT PRIMARY KEY,
      trace_id TEXT NOT NULL,
      from_node TEXT NOT NULL,
      to_node TEXT NOT NULL,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (trace_id) REFERENCES traces(id) ON DELETE CASCADE,
      FOREIGN KEY (from_node) REFERENCES nodes(run_id) ON DELETE CASCADE,
      FOREIGN KEY (to_node) REFERENCES nodes(run_id) ON DELETE CASCADE
    )
  `);

  db.run("CREATE INDEX IF NOT EXISTS idx_edges_trace ON edges(trace_id)");
  db.run("CREATE INDEX IF NOT EXISTS idx_edges_from ON edges(from_node)");
  db.run("CREATE INDEX IF NOT EXISTS idx_edges_to ON edges(to_node)");

  // Create anomalies table
  db.run(`
    CREATE TABLE IF NOT EXISTS anomalies (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      trace_id TEXT NOT NULL,
      type TEXT NOT NULL,
      severity TEXT NOT NULL,
      message TEXT NOT NULL,
      nodes TEXT NOT NULL,
      suggestion TEXT,
      metadata TEXT,
      created_at INTEGER DEFAULT (strftime('%s', 'now') * 1000),
      FOREIGN KEY (trace_id) REFERENCES traces(id) ON DELETE CASCADE
    )
  `);

  db.run(
    "CREATE INDEX IF NOT EXISTS idx_anomalies_trace ON anomalies(trace_id)"
  );
  db.run("CREATE INDEX IF NOT EXISTS idx_anomalies_type ON anomalies(type)");
  db.run(
    "CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity)"
  );

  // Create trigger to update updated_at
  db.run(`
    CREATE TRIGGER IF NOT EXISTS update_traces_updated_at
    AFTER UPDATE ON traces
    FOR EACH ROW
    BEGIN
      UPDATE traces SET updated_at = (strftime('%s', 'now') * 1000)
      WHERE id = NEW.id;
    END
  `);

  logger.info("Database schema initialized successfully");
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeSchema();
  process.exit(0);
}
