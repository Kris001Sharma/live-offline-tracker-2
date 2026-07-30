export interface QueryResult<T = unknown> {
  rows: T[];
  rowsAffected?: number;
  insertId?: string | number;
}

export interface StorageAdapter {
  initialize(): Promise<void>;
  execute<T = unknown>(query: string, params?: any[]): Promise<QueryResult<T>>;
  transaction<T>(action: (adapter: StorageAdapter) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  checkHealth(): Promise<boolean>;
}

export interface Migration {
  version: number;
  name: string;
  up: (adapter: StorageAdapter) => Promise<void>;
}
