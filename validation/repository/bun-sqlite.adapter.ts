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
