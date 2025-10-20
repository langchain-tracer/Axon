/**
 * Database models and queries for SQLite
 */

import { db } from "./connection.js";
import { Trace, Node, Edge, Anomaly } from "../types/index.js";

export class TraceModel {
  /**
   * Create a new trace
   */
  static create(data: {
    id: string;
    projectName: string;
    startTime: number;
    metadata?: Record<string, any>;
  }): Trace {
    db.run(
      `INSERT INTO traces (id, project_name, start_time, status, metadata)
       VALUES (?, ?, ?, ?, ?)`,
      [
        data.id,
        data.projectName,
        data.startTime,
        "running",
        JSON.stringify(data.metadata || {})
      ]
    );

    return this.findById(data.id)!;
  }

  /**
   * Update trace
   */
  static update(
    traceId: string,
    data: {
      endTime?: number;
      status?: string;
      totalCost?: number;
      totalNodes?: number;
    }
  ): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.endTime !== undefined) {
      fields.push("end_time = ?");
      values.push(data.endTime);
    }
    if (data.status) {
      fields.push("status = ?");
      values.push(data.status);
    }
    if (data.totalCost !== undefined) {
      fields.push("total_cost = ?");
      values.push(data.totalCost);
    }
    if (data.totalNodes !== undefined) {
      fields.push("total_nodes = ?");
      values.push(data.totalNodes);
    }

    if (fields.length === 0) return;

    values.push(traceId);

    db.run(`UPDATE traces SET ${fields.join(", ")} WHERE trace_id = ?`, values);
  }

  /**
   * Get trace by ID
   */
  static findById(traceId: string): Trace | null {
    const row = db.get<any>("SELECT * FROM traces WHERE trace_id = ?", [traceId]);

    if (!row) return null;

    return {
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at)
    };
  }

  /**
   * List traces
   */
  static list(options: {
    projectName?: string;
    limit?: number;
    offset?: number;
  }): Trace[] {
    let query = "SELECT * FROM traces";
    const params: any[] = [];

    if (options.projectName) {
      query += " WHERE project_name = ?";
      params.push(options.projectName);
    }

    query += " ORDER BY created_at DESC";

    if (options.limit) {
      query += " LIMIT ?";
      params.push(options.limit);
    }

    if (options.offset) {
      query += " OFFSET ?";
      params.push(options.offset);
    }

    const rows = db.query<any>(query, params);

    return rows.map((row) => ({
      ...row,
      metadata: row.metadata ? JSON.parse(row.metadata) : {},
      createdAt: new Date(row.created_at)
    }));
  }
}

export class NodeModel {
  /**
   * Create a node
   */
  static create(node: Node): Node {
    db.run(
      `INSERT INTO nodes (
        id, trace_id, run_id, parent_run_id, type, status,
        start_time, end_time, data, cost, tokens, latency, error
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        node.id,
        node.traceId,
        node.runId,
        node.parentRunId || null,
        node.type,
        node.status,
        node.startTime,
        node.endTime || null,
        JSON.stringify(node.data),
        node.cost || null,
        node.tokens ? JSON.stringify(node.tokens) : null,
        node.latency || null,
        node.error || null
      ]
    );

    return this.findByRunId(node.runId)!;
  }

  /**
   * Update node
   */
  static update(runId: string, data: Partial<Node>): void {
    const fields: string[] = [];
    const values: any[] = [];

    if (data.status) {
      fields.push("status = ?");
      values.push(data.status);
    }
    if (data.endTime !== undefined) {
      fields.push("end_time = ?");
      values.push(data.endTime);
    }
    if (data.cost !== undefined) {
      fields.push("cost = ?");
      values.push(data.cost);
    }
    if (data.tokens) {
      fields.push("tokens = ?");
      values.push(JSON.stringify(data.tokens));
    }
    if (data.latency !== undefined) {
      fields.push("latency = ?");
      values.push(data.latency);
    }
    if (data.error) {
      fields.push("error = ?");
      values.push(data.error);
    }

    if (fields.length === 0) return;

    values.push(runId);

    db.run(`UPDATE nodes SET ${fields.join(", ")} WHERE run_id = ?`, values);
  }

  /**
   * Get nodes for a trace
   */
  static findByTraceId(traceId: string): Node[] {
    const rows = db.query<any>(
      "SELECT * FROM nodes WHERE trace_id = ? ORDER BY start_time ASC",
      [traceId]
    );

    return rows.map((row) => ({
      ...row,
      data: JSON.parse(row.data),
      tokens: row.tokens ? JSON.parse(row.tokens) : undefined,
      createdAt: new Date(row.created_at)
    }));
  }

  /**
   * Get node by run ID
   */
  static findByRunId(runId: string): Node | null {
    const row = db.get<any>("SELECT * FROM nodes WHERE run_id = ?", [runId]);

    if (!row) return null;

    return {
      ...row,
      data: JSON.parse(row.data),
      tokens: row.tokens ? JSON.parse(row.tokens) : undefined,
      createdAt: new Date(row.created_at)
    };
  }
}

export class EdgeModel {
  /**
   * Create an edge
   */
  static create(edge: {
    id: string;
    traceId: string;
    fromNode: string;
    toNode: string;
  }): Edge {
    db.run(
      `INSERT INTO edges (id, trace_id, from_node, to_node)
       VALUES (?, ?, ?, ?)`,
      [edge.id, edge.traceId, edge.fromNode, edge.toNode]
    );

    const row = db.get<any>("SELECT * FROM edges WHERE id = ?", [edge.id]);

    return {
      ...row!,
      createdAt: new Date(row!.created_at)
    };
  }

  /**
   * Get edges for a trace
   */
  static findByTraceId(traceId: string): Edge[] {
    const rows = db.query<any>("SELECT * FROM edges WHERE trace_id = ?", [
      traceId
    ]);

    return rows.map((row) => ({
      ...row,
      createdAt: new Date(row.created_at)
    }));
  }
}

export class AnomalyModel {
  /**
   * Create an anomaly
   */
  static create(anomaly: Omit<Anomaly, "id" | "createdAt">): Anomaly {
    const result = db.run(
      `INSERT INTO anomalies (
        trace_id, type, severity, message, nodes, suggestion, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        anomaly.traceId,
        anomaly.type,
        anomaly.severity,
        anomaly.message,
        JSON.stringify(anomaly.nodes),
        anomaly.suggestion || null,
        anomaly.metadata ? JSON.stringify(anomaly.metadata) : null
      ]
    );

    const row = db.get<any>("SELECT * FROM anomalies WHERE id = ?", [
      result.lastInsertRowid
    ]);

    return {
      ...row!,
      id: String(row!.id),
      nodes: JSON.parse(row!.nodes),
      metadata: row!.metadata ? JSON.parse(row!.metadata) : undefined,
      createdAt: new Date(row!.created_at)
    };
  }

  /**
   * Get anomalies for a trace
   */
  static findByTraceId(traceId: string): Anomaly[] {
    const rows = db.query<any>(
      "SELECT * FROM anomalies WHERE trace_id = ? ORDER BY created_at DESC",
      [traceId]
    );

    return rows.map((row) => ({
      ...row,
      id: String(row.id),
      nodes: JSON.parse(row.nodes),
      metadata: row.metadata ? JSON.parse(row.metadata) : undefined,
      createdAt: new Date(row.created_at)
    }));
  }
}
