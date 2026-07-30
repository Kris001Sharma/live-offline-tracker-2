import { StorageAdapter } from '../../../modules/storage';
import { Migration } from '../migrations.types';

export const migration001: Migration = {
  version: 1,
  name: '001_initial_schema',
  up: async (adapter: StorageAdapter): Promise<void> => {
    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS workers (
        id TEXT PRIMARY KEY,
        external_id TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS shifts (
        id TEXT PRIMARY KEY,
        worker_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE RESTRICT
      )
    `);

    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        event_data TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        worker_id TEXT NOT NULL,
        shift_id TEXT,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE RESTRICT,
        FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE RESTRICT
      )
    `);

    await adapter.execute(`
      CREATE TABLE IF NOT EXISTS sync_queue (
        id TEXT PRIMARY KEY,
        event_id TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL,
        retry_count INTEGER NOT NULL DEFAULT 0,
        last_error TEXT,
        last_attempt_at TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )
    `);

    await adapter.execute(`CREATE INDEX IF NOT EXISTS idx_events_occurred_at ON events(occurred_at)`);
    await adapter.execute(`CREATE INDEX IF NOT EXISTS idx_events_shift_id ON events(shift_id)`);
    await adapter.execute(`CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)`);
  }
};
