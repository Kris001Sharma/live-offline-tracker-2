import { CapacitorSQLite, SQLiteConnection, SQLiteDBConnection } from '@capacitor-community/sqlite';
import { Capacitor } from '@capacitor/core';
import { StorageAdapter, QueryResult } from './storage.types';
import { DATABASE_NAME, DATABASE_VERSION, READ_ONLY } from './storage.constants';

export class CapacitorSQLiteAdapter implements StorageAdapter {
  private sqlite: SQLiteConnection;
  private db: SQLiteDBConnection | null = null;
  private initialized = false;

  constructor() {
    this.sqlite = new SQLiteConnection(CapacitorSQLite);
  }

  async initialize(): Promise<void> {
    if (this.initialized && this.db) {
      return;
    }

    try {
      if (Capacitor.getPlatform() === 'web') {
        // Initialize web store if we are running in the browser
        await this.sqlite.initWebStore();
      }

      const ret = await this.sqlite.checkConnectionsConsistency();
      const isConn = (await this.sqlite.isConnection(DATABASE_NAME, READ_ONLY)).result;

      if (ret.result && isConn) {
        this.db = await this.sqlite.retrieveConnection(DATABASE_NAME, READ_ONLY);
      } else {
        this.db = await this.sqlite.createConnection(
          DATABASE_NAME,
          READ_ONLY,
          'no-encryption',
          DATABASE_VERSION,
          false
        );
      }

      await this.db.open();
      this.initialized = true;
    } catch (error) {
      this.initialized = false;
      this.db = null;
      throw new Error(`Storage Adapter: Failed to initialize database. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async execute<T = unknown>(query: string, params: any[] = []): Promise<QueryResult<T>> {
    this.ensureInitialized();
    
    try {
      const upperQuery = query.trim().toUpperCase();
      const isSelect = upperQuery.startsWith('SELECT') || upperQuery.startsWith('PRAGMA');
      
      if (isSelect) {
        const res = await this.db!.query(query, params);
        return {
          rows: (res.values || []) as T[],
        };
      } else {
        const res = await this.db!.run(query, params);
        return {
          rows: [],
          rowsAffected: res.changes?.changes || 0,
          insertId: res.changes?.lastId,
        };
      }
    } catch (error) {
      throw new Error(`Storage Adapter: Query execution failed. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async transaction<T>(action: (adapter: StorageAdapter) => Promise<T>): Promise<T> {
    this.ensureInitialized();
    
    try {
      await this.db!.execute('BEGIN TRANSACTION');
      const result = await action(this);
      await this.db!.execute('COMMIT');
      return result;
    } catch (error) {
      try {
        await this.db!.execute('ROLLBACK');
      } catch (rollbackError) {
        console.error('Storage Adapter: Failed to rollback transaction.', rollbackError);
      }
      throw new Error(`Storage Adapter: Transaction failed. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async close(): Promise<void> {
    if (!this.initialized || !this.db) {
      return;
    }

    try {
      await this.sqlite.closeConnection(DATABASE_NAME, READ_ONLY);
      this.initialized = false;
      this.db = null;
    } catch (error) {
      throw new Error(`Storage Adapter: Failed to close database. ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async checkHealth(): Promise<boolean> {
    if (!this.initialized || !this.db) {
      return false;
    }
    
    try {
      const isDBOpen = await this.db.isDBOpen();
      return !!isDBOpen.result;
    } catch {
      return false;
    }
  }

  private ensureInitialized(): void {
    if (!this.initialized || !this.db) {
      throw new Error('Storage Adapter: Database is not initialized.');
    }
  }
}
