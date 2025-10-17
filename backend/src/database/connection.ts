/**
 * SQLite connection and query utilities
 */

import Database from "better-sqlite3";
import { logger } from "../utils/logger.js";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class SQLiteDatabase {
  private db: Database.Database;

  constructor() {
    const dbPath =
      process.env.DATABASE_PATH || path.join(__dirname, "../../data/traces.db");

    logger.info("Connecting to SQLite database:", dbPath);

    this.db = new Database(dbPath, {
      verbose:
        process.env.NODE_ENV === "development"
          ? (msg) => logger.debug("SQL:", msg)
          : undefined
    });

    // Enable WAL mode for better concurrency
    this.db.pragma("journal_mode = WAL");

    // Foreign keys
    this.db.pragma("foreign_keys = ON");

    logger.info("SQLite database connected");
  }

  /**
   * Execute a query and return all rows
   */
  query<T = any>(sql: string, params?: any[]): T[] {
    try {
      const stmt = this.db.prepare(sql);
      const result = params ? stmt.all(...params) : stmt.all();
      return result as T[];
    } catch (error) {
      logger.error("SQLite query error:", { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute a query and return first row
   */
  get<T = any>(sql: string, params?: any[]): T | undefined {
    try {
      const stmt = this.db.prepare(sql);
      const result = params ? stmt.get(...params) : stmt.get();
      return result as T | undefined;
    } catch (error) {
      logger.error("SQLite get error:", { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute INSERT/UPDATE/DELETE
   */
  run(sql: string, params?: any[]): Database.RunResult {
    try {
      const stmt = this.db.prepare(sql);
      return params ? stmt.run(...params) : stmt.run();
    } catch (error) {
      logger.error("SQLite run error:", { sql, params, error });
      throw error;
    }
  }

  /**
   * Execute multiple statements in a transaction
   */
  transaction<T>(callback: () => T): T {
    const trans = this.db.transaction(callback);
    return trans();
  }

  /**
   * Get the underlying database instance
   */
  getDb(): Database.Database {
    return this.db;
  }

  /**
   * Close database connection
   */
  close(): void {
    this.db.close();
    logger.info("SQLite database closed");
  }

  /**
   * Health check
   */
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
