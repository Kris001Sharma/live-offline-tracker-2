import { StorageEngine } from '../../storage';
import { 
  TrustedDeviceRecord, 
  TrustedDeviceRegistrationData, 
  TrustedDeviceStatus, 
  SyncStatus,
  TrustedDeviceRepositoryError
} from './trusted-device.repository.types';

/**
 * Trusted Device Repository
 * 
 * Architectural Responsibilities:
 * - Repository owns SQL queries, schema interactions, and persistence operations.
 * - Repository owns database lookup queries and integrity rules (e.g. approved device lookups, duplicate checks).
 * - Registration Engine owns workflow orchestration and business decisions.
 * - Translates and encapsulates raw database exceptions into standardized persistence errors (PERSISTENCE_ERROR).
 */

function mapRowToRecord(row: any): TrustedDeviceRecord {
  return {
    id: row.id,
    workerId: row.worker_id,
    deviceId: row.device_id,
    manufacturer: row.manufacturer,
    model: row.model,
    platform: row.platform,
    appVersion: row.app_version,
    registeredAt: row.registered_at,
    approvedAt: row.approved_at || undefined,
    approvedBy: row.approved_by || undefined,
    status: row.status as TrustedDeviceStatus,
    syncStatus: row.sync_status as SyncStatus,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

export const TrustedDeviceRepository = {
  /**
   * Persists a new device registration record into SQLite.
   * Repository owns SQL insertion and persistence integrity.
   */
  async register(data: TrustedDeviceRegistrationData): Promise<void> {
    try {
      const now = new Date().toISOString();
      const status: TrustedDeviceStatus = 'PENDING_APPROVAL';
      const syncStatus: SyncStatus = 'PENDING';
      
      await StorageEngine.execute(`
        INSERT INTO trusted_devices (
          id, worker_id, device_id, manufacturer, model, platform, app_version,
          registered_at, status, sync_status, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `, [
        data.id,
        data.workerId,
        data.deviceId,
        data.manufacturer,
        data.model,
        data.platform,
        data.appVersion,
        data.registeredAt,
        status,
        syncStatus,
        now,
        now
      ]);
    } catch (error) {
      throw new TrustedDeviceRepositoryError('PERSISTENCE_ERROR', error);
    }
  },

  /**
   * Look up all registration records associated with a specific worker.
   */
  async findByWorker(workerId: string): Promise<TrustedDeviceRecord[]> {
    try {
      const result = await StorageEngine.execute(`
        SELECT * FROM trusted_devices WHERE worker_id = ? ORDER BY created_at DESC
      `, [workerId]);
      return result.rows.map(mapRowToRecord);
    } catch (error) {
      throw new TrustedDeviceRepositoryError('PERSISTENCE_ERROR', error);
    }
  },

  /**
   * Look up all registration records associated with a specific device identifier.
   */
  async findByDevice(deviceId: string): Promise<TrustedDeviceRecord[]> {
    try {
      const result = await StorageEngine.execute(`
        SELECT * FROM trusted_devices WHERE device_id = ? ORDER BY created_at DESC
      `, [deviceId]);
      return result.rows.map(mapRowToRecord);
    } catch (error) {
      throw new TrustedDeviceRepositoryError('PERSISTENCE_ERROR', error);
    }
  },

  /**
   * Look up a specific device registration for a given worker and device.
   * Repository owns database lookup query.
   */
  async findByWorkerAndDevice(workerId: string, deviceId: string): Promise<TrustedDeviceRecord | null> {
    try {
      const result = await StorageEngine.execute(`
        SELECT * FROM trusted_devices WHERE worker_id = ? AND device_id = ? ORDER BY created_at DESC LIMIT 1
      `, [workerId, deviceId]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToRecord(result.rows[0]);
    } catch (error) {
      throw new TrustedDeviceRepositoryError('PERSISTENCE_ERROR', error);
    }
  },

  /**
   * Find any existing approved device record for a worker.
   * Repository owns SQL filtering for approved devices.
   */
  async findApprovedByWorker(workerId: string): Promise<TrustedDeviceRecord | null> {
    try {
      const result = await StorageEngine.execute(`
        SELECT * FROM trusted_devices WHERE worker_id = ? AND status = 'APPROVED' LIMIT 1
      `, [workerId]);
      if (result.rows.length === 0) {
        return null;
      }
      return mapRowToRecord(result.rows[0]);
    } catch (error) {
      throw new TrustedDeviceRepositoryError('PERSISTENCE_ERROR', error);
    }
  },

  /**
   * Check whether a worker already has an approved trusted device.
   */
  async hasApprovedDevice(workerId: string): Promise<boolean> {
    const approved = await this.findApprovedByWorker(workerId);
    return approved !== null;
  },

  /**
   * Find all pending registration requests across all devices and workers.
   */
  async findPending(): Promise<TrustedDeviceRecord[]> {
    try {
      const result = await StorageEngine.execute(`
        SELECT * FROM trusted_devices WHERE status = 'PENDING_APPROVAL' ORDER BY created_at ASC
      `);
      return result.rows.map(mapRowToRecord);
    } catch (error) {
      throw new TrustedDeviceRepositoryError('PERSISTENCE_ERROR', error);
    }
  },

  /**
   * Find pending registration requests for a specific worker.
   */
  async findPendingByWorker(workerId: string): Promise<TrustedDeviceRecord[]> {
    try {
      const result = await StorageEngine.execute(`
        SELECT * FROM trusted_devices WHERE worker_id = ? AND status = 'PENDING_APPROVAL' ORDER BY created_at ASC
      `, [workerId]);
      return result.rows.map(mapRowToRecord);
    } catch (error) {
      throw new TrustedDeviceRepositoryError('PERSISTENCE_ERROR', error);
    }
  },

  /**
   * Approve a pending device registration.
   */
  async approve(id: string, approvedBy: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await StorageEngine.execute(`
        UPDATE trusted_devices
        SET status = 'APPROVED', approved_at = ?, approved_by = ?, sync_status = 'PENDING', updated_at = ?
        WHERE id = ?
      `, [now, approvedBy, now, id]);
    } catch (error) {
      throw new TrustedDeviceRepositoryError('PERSISTENCE_ERROR', error);
    }
  },

  /**
   * Reject a pending device registration.
   */
  async reject(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await StorageEngine.execute(`
        UPDATE trusted_devices
        SET status = 'REJECTED', sync_status = 'PENDING', updated_at = ?
        WHERE id = ?
      `, [now, id]);
    } catch (error) {
      throw new TrustedDeviceRepositoryError('PERSISTENCE_ERROR', error);
    }
  },

  /**
   * Update sync status of a device registration to SYNCED.
   */
  async markSynced(id: string): Promise<void> {
    try {
      const now = new Date().toISOString();
      await StorageEngine.execute(`
        UPDATE trusted_devices
        SET sync_status = 'SYNCED', updated_at = ?
        WHERE id = ?
      `, [now, id]);
    } catch (error) {
      throw new TrustedDeviceRepositoryError('PERSISTENCE_ERROR', error);
    }
  }
};
