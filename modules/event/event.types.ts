import { EventType } from '../domain';

export interface CreateEventRequest<T = unknown> {
  type: EventType;
  workerId: string;
  shiftId?: string;
  payload: T;
}
