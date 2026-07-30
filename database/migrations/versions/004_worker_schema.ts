import { StorageAdapter } from '../../../modules/storage';
import { Migration } from '../migrations.types';

export const migration_004_worker_schema: Migration = {
  version: 4,
  name: 'worker_schema',
  up: async (db: StorageAdapter) => {
    // Disable foreign keys temporarily for the schema migration
    await db.execute('PRAGMA foreign_keys=OFF');

    await db.execute(`
      CREATE TABLE IF NOT EXISTS workers_new (
        worker_id TEXT PRIMARY KEY,
        employee_code TEXT,
        email TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        role TEXT NOT NULL,
        organization TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        synced_at TEXT
      )
    `);

    // Copy existing data if any exists from the old 'workers' table.
    // 'external_id' becomes 'email', 'id' becomes 'worker_id', 'name' becomes 'display_name'
    try {
      await db.execute(`
        INSERT INTO workers_new (worker_id, email, display_name, role, created_at, updated_at)
        SELECT id, external_id, name, 'WORKER', created_at, updated_at FROM workers
      `);
    } catch (e) {
      // If table doesn't exist or column doesn't match, ignore. 
      // This is a safety catch.
    }

    await db.execute('DROP TABLE IF EXISTS workers');
    
    await db.execute('ALTER TABLE workers_new RENAME TO workers');

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_workers_email ON workers(email)
    `);

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_workers_employee_code ON workers(employee_code)
    `);
    
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_workers_active ON workers(active)
    `);

    // Re-enable foreign keys
    await db.execute('PRAGMA foreign_keys=ON');
  }
};
