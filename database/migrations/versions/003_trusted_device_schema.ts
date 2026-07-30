import { StorageAdapter } from '../../../modules/storage';
import { Migration } from '../migrations.types';

export const migration_003_trusted_device_schema: Migration = {
  version: 3,
  name: 'trusted_device_schema',
  up: async (db: StorageAdapter) => {
    await db.execute(`
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
      )
    `);
    
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_worker_id ON trusted_devices(worker_id)
    `);
    
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_trusted_devices_device_id ON trusted_devices(device_id)
    `);
  }
};
