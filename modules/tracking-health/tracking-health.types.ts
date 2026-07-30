import { TrackingState } from '../tracking';
import { SessionState } from '../tracking-session';

export enum TrackingHealthState {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  STOPPED = 'STOPPED',
  UNKNOWN = 'UNKNOWN'
}

export interface TrackingHealthStatus {
  readonly state: TrackingHealthState;
  readonly trackingState: TrackingState;
  readonly schedulerState: SessionState;
  
  readonly isTrackingEngineRunning: boolean;
  readonly isSchedulerRunning: boolean;
  readonly isPipelineHealthy: boolean;
  readonly isRecoveryActive: boolean;
  
  readonly currentPollIntervalMs: number;
  readonly healthThresholdMs: number;
  readonly maximumFailureCount: number;
  readonly consecutiveFailureCount: number;
  
  readonly lastSchedulerTickAt?: string;
  readonly lastSuccessfulLocationAt?: string;
  readonly lastSuccessfulProcessingAt?: string;
  readonly lastSuccessfulPersistenceAt?: string;
}
