import { StorageAdapter } from '../../../modules/storage';
import { Migration } from '../migrations.types';

export const migration002: Migration = {
  version: 2,
  name: '002_attendance_schema',
  up: async (adapter: StorageAdapter): Promise<void> => {
    await adapter.execute(`
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
        updated_at TEXT NOT NULL,
        FOREIGN KEY (worker_id) REFERENCES workers(id) ON DELETE RESTRICT
      )
    `);
    
    await adapter.execute(`CREATE INDEX IF NOT EXISTS idx_attendance_worker_id ON attendance(worker_id)`);
    await adapter.execute(`CREATE INDEX IF NOT EXISTS idx_attendance_sync_status ON attendance(sync_status)`);
  }
};
