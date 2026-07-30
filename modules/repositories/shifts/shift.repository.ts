import { StorageEngine } from '../../storage';
import { ShiftEntity } from '../repository.types';

export const ShiftRepository = {
  async createShift(shift: ShiftEntity): Promise<void> {
    await StorageEngine.execute(
      `INSERT INTO shifts (id, worker_id, status, started_at, ended_at) VALUES (?, ?, ?, ?, ?)`,
      [shift.id, shift.worker_id, shift.status, shift.started_at, shift.ended_at]
    );
  },

  async getActiveShift(): Promise<ShiftEntity | null> {
    const result = await StorageEngine.execute<ShiftEntity>(
      `SELECT id, worker_id, status, started_at, ended_at FROM shifts WHERE ended_at IS NULL ORDER BY started_at DESC LIMIT 1`
    );
    return result.rows[0] ?? null;
  },

  async closeShift(id: string, endedAt: string): Promise<void> {
    await StorageEngine.execute(
      `UPDATE shifts SET ended_at = ?, status = 'CLOSED' WHERE id = ?`,
      [endedAt, id]
    );
  },

  async getShiftHistory(limit = 50, offset = 0): Promise<ShiftEntity[]> {
    const result = await StorageEngine.execute<ShiftEntity>(
      `SELECT id, worker_id, status, started_at, ended_at FROM shifts ORDER BY started_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return result.rows;
  }
};
