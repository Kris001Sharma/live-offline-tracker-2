import { StorageAdapter } from '../../../modules/storage';
import { Migration } from '../migrations.types';

export const migration002: Migration = {
  version: 2,
  name: '002_trusted_device_one_active_per_worker',
  up: async (adapter: StorageAdapter): Promise<void> => {
    // Database-level enforcement of "one active trusted device per worker".
    // Historical records (PENDING_APPROVAL / REJECTED / REVOKED) are preserved;
    // at most one record may be APPROVED at any time.
    await adapter.execute(`
      CREATE UNIQUE INDEX idx_trusted_devices_one_active_per_worker
      ON trusted_devices (worker_id)
      WHERE status = 'APPROVED'
    `);
  }
};
