import { Database } from "bun:sqlite";
import { StorageAdapter, QueryResult } from '../../modules/storage/storage.types';

export class BunSQLiteAdapter implements StorageAdapter {
  private db: Database | null = null;
  private _initialized = false;

  constructor(private filename: string = ":memory:") {}

  async initialize(): Promise<void> {
    if (this._initialized && this.db) {
      return;
    }
    this.db = new Database(this.filename);
    this.db.run("PRAGMA foreign_keys = ON;");
    
    // Create tables based on schema
    this.db.run(`
      CREATE TABLE IF NOT EXISTS workers (
          worker_id TEXT PRIMARY KEY,
          email TEXT UNIQUE NOT NULL,
          display_name TEXT NOT NULL,
          employee_code TEXT,
          role TEXT NOT NULL,
          organization TEXT,
          active INTEGER NOT NULL,
          synced_at TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS trusted_devices (
          id TEXT PRIMARY KEY,
          worker_id TEXT NOT NULL,
          device_id TEXT NOT NULL,
          manufacturer TEXT NOT NULL,
          model TEXT NOT NULL,
          platform TEXT NOT NULL,
          app_version TEXT NOT NULL,
          registered_at TEXT NOT NULL,
          approved_at TEXT,
          approved_by TEXT,
          status TEXT NOT NULL,
          sync_status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS shifts (
          id TEXT PRIMARY KEY,
          worker_id TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          ended_at TEXT
      );
      CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          event_type TEXT NOT NULL,
          event_data TEXT NOT NULL,
          occurred_at TEXT NOT NULL,
          worker_id TEXT NOT NULL,
          shift_id TEXT,
          sync_status TEXT NOT NULL,
          sync_retry_count INTEGER NOT NULL,
          sync_last_error TEXT,
          sync_last_attempt_at TEXT
      );
      CREATE TABLE IF NOT EXISTS attendance (
          id TEXT PRIMARY KEY,
          worker_id TEXT NOT NULL,
          check_in_at TEXT NOT NULL,
          check_out_at TEXT,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL NOT NULL,
          sync_status TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS locations (
          id TEXT PRIMARY KEY,
          shift_id TEXT,
          worker_id TEXT NOT NULL,
          latitude REAL NOT NULL,
          longitude REAL NOT NULL,
          accuracy REAL NOT NULL,
          altitude REAL,
          speed REAL,
          heading REAL,
          recorded_at TEXT NOT NULL,
          sync_status TEXT NOT NULL,
          created_at TEXT NOT NULL
      );
    `);

    this._initialized = true;
  }

  async execute<T = unknown>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    if (!this._initialized || !this.db) {
      throw new Error('Adapter not initialized');
    }
    
    // Bun SQLite uses ?1, ?2 for params, but supports ? fine.
    // However, it doesn't return rowsAffected and insertId from query.all()
    // It returns those for run().
    
    const upperQuery = query.trim().toUpperCase();
    const isSelect = upperQuery.startsWith('SELECT') || upperQuery.startsWith('PRAGMA');
    
    if (isSelect) {
      try {
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as T[];
        return { rows };
      } catch (err: any) {
        throw new Error(`Execute SELECT failed: ${err.message}`);
      }
    } else {
      try {
        const stmt = this.db.prepare(query);
        const res = stmt.run(...params);
        return {
          rows: [],
          rowsAffected: res.changes,
          insertId: res.lastInsertRowid.toString()
        };
      } catch(err: any) {
        throw new Error(`Execute RUN failed: ${err.message}`);
      }
    }
  }

  async transaction<T>(action: (adapter: StorageAdapter) => Promise<T>): Promise<T> {
    if (!this._initialized || !this.db) {
      throw new Error('Adapter not initialized');
    }
    this.db.run('BEGIN TRANSACTION');
    try {
      const result = await action(this);
      this.db.run('COMMIT');
      return result;
    } catch (e: any) {
      this.db.run('ROLLBACK');
      throw new Error(`Transaction failed: ${e.message}`);
    }
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this._initialized = false;
  }

  async checkHealth(): Promise<boolean> {
    return this._initialized && this.db !== null;
  }
}
