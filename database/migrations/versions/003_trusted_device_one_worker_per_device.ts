import { StorageAdapter } from '../../../modules/storage';
import { Migration } from '../migrations.types';

export const migration003: Migration = {
  version: 3,
  name: '003_trusted_device_one_worker_per_device',
  up: async (adapter: StorageAdapter): Promise<void> => {
    // Database-level enforcement of "one worker per APPROVED trusted device".
    // Historical records (PENDING_APPROVAL / REJECTED / REVOKED) are preserved;
    // at most one worker may be associated with an APPROVED device at any time.
    await adapter.execute(`
      CREATE UNIQUE INDEX idx_trusted_devices_one_worker_per_device
      ON trusted_devices (device_id)
      WHERE status = 'APPROVED'
    `);
  }
};