import { DomainEvent, SyncStatus } from '../domain';
import { EventRepository, EventEntity } from '../repositories';
import { CreateEventRequest } from './event.types';

export const EventService = {
  async createEvent<T = unknown>(request: CreateEventRequest<T>): Promise<DomainEvent<T>> {
    const eventId = crypto.randomUUID();
    const timestamp = new Date().toISOString();
    const shiftId = request.shiftId || null;
    
    const domainEvent: DomainEvent<T> = {
      id: eventId,
      type: request.type,
      payload: request.payload,
      occurredAt: timestamp,
      workerId: request.workerId,
      shiftId: shiftId
    };

    const eventEntity: EventEntity = {
      id: eventId,
      event_type: request.type,
      event_data: JSON.stringify(request.payload),
      occurred_at: timestamp,
      worker_id: request.workerId,
      shift_id: shiftId,
      sync_status: SyncStatus.PENDING,
      sync_retry_count: 0,
      sync_last_error: null,
      sync_last_attempt_at: null
    };

    await EventRepository.appendEvent(eventEntity);

    return domainEvent;
  }
};
