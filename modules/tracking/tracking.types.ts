import { Location } from '../location';
import { LocationEvaluationResult } from '../location-evaluation';

export enum TrackingState {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPING = 'STOPPING',
  ERROR = 'ERROR'
}

export interface TrackingStatus {
  readonly state: TrackingState;
  readonly lastError?: string;
  readonly startedAt?: string;
  readonly lastProcessedAt?: string;
  readonly lastPersistedAt?: string;
}

export type ProcessLocationFailureType = 'PERSISTENCE_ERROR' | 'EVENT_ERROR' | 'CONCURRENCY_ERROR';

export interface ProcessLocationFailure {
  readonly type: ProcessLocationFailureType;
  readonly message: string;
}

export interface ProcessLocationResult {
  readonly location: Location;
  readonly evaluation?: LocationEvaluationResult;
  readonly success: boolean;
  readonly failure?: ProcessLocationFailure;
}
