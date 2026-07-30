import { EventType } from './enums';

export interface Coordinates {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  heading: number | null;
  speed: number | null;
}

export interface TrackingSample {
  coordinates: Coordinates;
  timestamp: string;
  isMocked: boolean;
}

export interface DomainEvent<T = unknown> {
  id: string;
  type: EventType;
  payload: T;
  occurredAt: string;
  workerId: string;
  shiftId: string | null;
}
