import { StorageEngine } from '../../storage';
import { EventEntity } from '../repository.types';

export const EventRepository = {
  async appendEvent(event: EventEntity): Promise<void> {
    await StorageEngine.execute(
      `INSERT INTO events (id, event_type, event_data, occurred_at, worker_id, shift_id, sync_status, sync_retry_count, sync_last_error, sync_last_attempt_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [event.id, event.event_type, event.event_data, event.occurred_at, event.worker_id, event.shift_id, event.sync_status, event.sync_retry_count, event.sync_last_error, event.sync_last_attempt_at]
    );
  },

  async getEvents(limit = 100, offset = 0): Promise<EventEntity[]> {
    const result = await StorageEngine.execute<EventEntity>(
      `SELECT id, event_type, event_data, occurred_at, worker_id, shift_id, sync_status, sync_retry_count, sync_last_error, sync_last_attempt_at FROM events ORDER BY occurred_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
    return result.rows;
  },

  async getUnsyncedEvents(): Promise<EventEntity[]> {
    const result = await StorageEngine.execute<EventEntity>(
      `SELECT id, event_type, event_data, occurred_at, worker_id, shift_id, sync_status, sync_retry_count, sync_last_error, sync_last_attempt_at FROM events WHERE sync_status IN ('PENDING', 'FAILED') ORDER BY occurred_at ASC`
    );
    return result.rows;
  },

  async getEventsByShift(shiftId: string): Promise<EventEntity[]> {
    const result = await StorageEngine.execute<EventEntity>(
      `SELECT id, event_type, event_data, occurred_at, worker_id, shift_id, sync_status, sync_retry_count, sync_last_error, sync_last_attempt_at FROM events WHERE shift_id = ? ORDER BY occurred_at ASC`,
      [shiftId]
    );
    return result.rows;
  },

  async getLatestEventByType(eventType: string): Promise<EventEntity | null> {
    const result = await StorageEngine.execute<EventEntity>(
      `SELECT id, event_type, event_data, occurred_at, worker_id, shift_id, sync_status, sync_retry_count, sync_last_error, sync_last_attempt_at FROM events WHERE event_type = ? ORDER BY occurred_at DESC LIMIT 1`,
      [eventType]
    );
    return result.rows[0] ?? null;
  }
};
