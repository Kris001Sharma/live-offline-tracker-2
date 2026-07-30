import { StorageEngine } from '../../storage';
import { SyncStatus } from '../../domain';
import { AttendanceEntity, AppendAttendanceRequest, AttendanceRepositoryError } from './attendance.repository.types';

export const AttendanceRepository = {
  async append(attendance: AppendAttendanceRequest): Promise<void> {
    const activeSession = await this.findActiveSession(attendance.worker_id);
    if (activeSession) {
      throw new AttendanceRepositoryError('Cannot create multiple active attendance sessions for the same worker.');
    }

    const syncStatus = SyncStatus.PENDING;
    const createdAt = new Date().toISOString();
    
    await StorageEngine.execute(
      `INSERT INTO attendance (id, worker_id, check_in_at, check_out_at, latitude, longitude, accuracy, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        attendance.id,
        attendance.worker_id,
        attendance.check_in_at,
        attendance.check_out_at ?? null,
        attendance.latitude,
        attendance.longitude,
        attendance.accuracy,
        syncStatus,
        createdAt,
        createdAt
      ]
    );
  },

  async updateCheckOut(id: string, checkOutAt: string): Promise<void> {
    const updatedAt = new Date().toISOString();
    
    await StorageEngine.execute(
      `UPDATE attendance SET check_out_at = ?, updated_at = ?, sync_status = 'PENDING' WHERE id = ?`,
      [checkOutAt, updatedAt, id]
    );
  },

  async findLatest(workerId: string): Promise<AttendanceEntity | null> {
    const result = await StorageEngine.execute<AttendanceEntity>(
      `SELECT id, worker_id, check_in_at, check_out_at, latitude, longitude, accuracy, sync_status, created_at, updated_at FROM attendance WHERE worker_id = ? ORDER BY check_in_at DESC LIMIT 1`,
      [workerId]
    );
    return result.rows[0] ?? null;
  },

  async findActiveSession(workerId: string): Promise<AttendanceEntity | null> {
    const result = await StorageEngine.execute<AttendanceEntity>(
      `SELECT id, worker_id, check_in_at, check_out_at, latitude, longitude, accuracy, sync_status, created_at, updated_at FROM attendance WHERE worker_id = ? AND check_in_at IS NOT NULL AND check_out_at IS NULL ORDER BY check_in_at DESC LIMIT 1`,
      [workerId]
    );
    return result.rows[0] ?? null;
  },

  async findBetween(workerId: string, from: string, to: string): Promise<AttendanceEntity[]> {
    const result = await StorageEngine.execute<AttendanceEntity>(
      `SELECT id, worker_id, check_in_at, check_out_at, latitude, longitude, accuracy, sync_status, created_at, updated_at FROM attendance WHERE worker_id = ? AND check_in_at >= ? AND check_in_at <= ? ORDER BY check_in_at ASC`,
      [workerId, from, to]
    );
    return result.rows;
  },

  async findPending(): Promise<AttendanceEntity[]> {
    const result = await StorageEngine.execute<AttendanceEntity>(
      `SELECT id, worker_id, check_in_at, check_out_at, latitude, longitude, accuracy, sync_status, created_at, updated_at FROM attendance WHERE sync_status = 'PENDING' ORDER BY check_in_at ASC`
    );
    return result.rows;
  },

  async markSynced(attendanceIds: string[]): Promise<void> {
    if (attendanceIds.length === 0) return;
    
    const placeholders = attendanceIds.map(() => '?').join(',');
    const syncStatus = SyncStatus.COMPLETED;
    const updatedAt = new Date().toISOString();
    
    await StorageEngine.execute(
      `UPDATE attendance SET sync_status = ?, updated_at = ? WHERE id IN (${placeholders})`,
      [syncStatus, updatedAt, ...attendanceIds]
    );
  }
};
