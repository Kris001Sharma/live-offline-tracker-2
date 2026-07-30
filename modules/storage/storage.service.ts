import { StorageAdapter, QueryResult } from './storage.types';

let currentAdapter: StorageAdapter | null = null;
let initialized = false;

export const StorageEngine = {
  async initialize(adapter: StorageAdapter): Promise<void> {
    if (initialized) {
      return;
    }

    if (!adapter) {
      throw new Error('Storage Engine: Adapter is required for initialization.');
    }

    try {
      await adapter.initialize();
      currentAdapter = adapter;
      initialized = true;
    } catch (error) {
      currentAdapter = null;
      initialized = false;
      throw new Error(`Storage Engine: Initialization failed. ${error instanceof Error ? error.message : String(error)}`);
    }
  },

  async health(): Promise<boolean> {
    if (!currentAdapter || !initialized) return false;
    try {
      return await currentAdapter.checkHealth();
    } catch {
      return false;
    }
  },

  async execute<T = unknown>(query: string, params?: any[]): Promise<QueryResult<T>> {
    if (!currentAdapter || !initialized) {
      throw new Error('Storage Engine: Cannot execute query, database not initialized.');
    }
    return currentAdapter.execute<T>(query, params);
  },

  async transaction<T>(action: (txAdapter: StorageAdapter) => Promise<T>): Promise<T> {
    if (!currentAdapter || !initialized) {
      throw new Error('Storage Engine: Cannot start transaction, database not initialized.');
    }
    return currentAdapter.transaction(action);
  },

  async close(): Promise<void> {
    if (currentAdapter) {
      await currentAdapter.close();
      currentAdapter = null;
    }
    initialized = false;
  }
};
