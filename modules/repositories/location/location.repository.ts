import { StorageEngine } from '../../storage';
import { SyncStatus } from '../../domain';
import { LocationEntity, AppendLocationRequest } from './location.types';

export const LocationRepository = {
  async append(location: AppendLocationRequest): Promise<void> {
    const syncStatus = SyncStatus.PENDING;
    const createdAt = new Date().toISOString();
    
    await StorageEngine.execute(
      `INSERT INTO locations (id, shift_id, worker_id, latitude, longitude, accuracy, altitude, speed, heading, recorded_at, sync_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        location.id,
        location.shift_id,
        location.worker_id,
        location.latitude,
        location.longitude,
        location.accuracy,
        location.altitude ?? null,
        location.speed ?? null,
        location.heading ?? null,
        location.recorded_at,
        syncStatus,
        createdAt
      ]
    );
  },

  async findLatest(workerId: string): Promise<LocationEntity | null> {
    const result = await StorageEngine.execute<LocationEntity>(
      `SELECT id, shift_id, worker_id, latitude, longitude, accuracy, altitude, speed, heading, recorded_at, sync_status, created_at FROM locations WHERE worker_id = ? ORDER BY recorded_at DESC LIMIT 1`,
      [workerId]
    );
    return result.rows[0] ?? null;
  },

  async findBetween(workerId: string, from: string, to: string): Promise<LocationEntity[]> {
    const result = await StorageEngine.execute<LocationEntity>(
      `SELECT id, shift_id, worker_id, latitude, longitude, accuracy, altitude, speed, heading, recorded_at, sync_status, created_at FROM locations WHERE worker_id = ? AND recorded_at >= ? AND recorded_at <= ? ORDER BY recorded_at ASC`,
      [workerId, from, to]
    );
    return result.rows;
  },

  async findPending(): Promise<LocationEntity[]> {
    const result = await StorageEngine.execute<LocationEntity>(
      `SELECT id, shift_id, worker_id, latitude, longitude, accuracy, altitude, speed, heading, recorded_at, sync_status, created_at FROM locations WHERE sync_status = 'PENDING' ORDER BY recorded_at ASC`
    );
    return result.rows;
  },

  async markSynced(locationIds: string[]): Promise<void> {
    if (locationIds.length === 0) return;
    
    const placeholders = locationIds.map(() => '?').join(',');
    const syncStatus = SyncStatus.COMPLETED;
    
    await StorageEngine.execute(
      `UPDATE locations SET sync_status = ? WHERE id IN (${placeholders})`,
      [syncStatus, ...locationIds]
    );
  }
};
