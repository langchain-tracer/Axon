import { DatabaseSync, StatementSync } from "node:sqlite";
import { logger } from "../utils/logger.js";
import path from "path";
import { mkdirSync } from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

type RunResult = { changes: number | bigint; lastInsertRowid: number | bigint };

class SQLiteDatabase {
  private db: DatabaseSync;

  constructor() {
    const dbPath =
      process.env.DATABASE_PATH || path.join(__dirname, "../../data/traces.db");

    mkdirSync(path.dirname(dbPath), { recursive: true });

    logger.info("Connecting to SQLite database:", dbPath);

    this.db = new DatabaseSync(dbPath);

    this.db.exec("PRAGMA journal_mode = WAL");
    this.db.exec("PRAGMA foreign_keys = ON");

    logger.info("SQLite database connected");
  }

  query<T = any>(sql: string, params?: any[]): T[] {
    try {
      const stmt: StatementSync = this.db.prepare(sql);
      const result = params ? stmt.all(...params) : stmt.all();
      return result as T[];
    } catch (error) {
      logger.error("SQLite query error:", { sql, params, error });
      throw error;
    }
  }

  get<T = any>(sql: string, params?: any[]): T | undefined {
    try {
      const stmt: StatementSync = this.db.prepare(sql);
      const result = params ? stmt.get(...params) : stmt.get();
      return result as T | undefined;
    } catch (error) {
      logger.error("SQLite get error:", { sql, params, error });
      throw error;
    }
  }

  run(sql: string, params?: any[], opts?: { silent?: boolean }): RunResult {
    try {
      const stmt: StatementSync = this.db.prepare(sql);
      return params ? stmt.run(...params) : stmt.run();
    } catch (error) {
      if (!opts?.silent) logger.error("SQLite run error:", { sql, params, error });
      throw error;
    }
  }

  transaction<T>(callback: () => T): T {
    this.db.exec("BEGIN");
    try {
      const result = callback();
      this.db.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
  }

  getDb(): DatabaseSync {
    return this.db;
  }

  close(): void {
    this.db.close();
    logger.info("SQLite database closed");
  }

  healthCheck(): boolean {
    try {
      this.db.prepare("SELECT 1").get();
      return true;
    } catch (error) {
      logger.error("Database health check failed:", error);
      return false;
    }
  }
}

export const db = new SQLiteDatabase();
