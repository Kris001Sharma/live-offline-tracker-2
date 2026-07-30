import { ConfigurationEngine } from '../configuration';
import { TrackingEngine, TrackingState } from '../tracking';
import { TrackingSession, SessionState } from '../tracking-session';
import { TrackingHealthStatus, TrackingHealthState } from './tracking-health.types';
import { HEALTHY_TICK_MULTIPLIER, MAX_CONSECUTIVE_FAILURES } from './tracking-health.constants';

export const TrackingHealth = {
  status(): TrackingHealthStatus {
    const trackingStatus = TrackingEngine.status();
    const sessionStatus = TrackingSession.status();
    const config = ConfigurationEngine.config;
    
    const isTrackingEngineRunning = trackingStatus.state === TrackingState.RUNNING;
    const isSchedulerRunning = sessionStatus.state === SessionState.RUNNING;
    
    const currentPollIntervalMs = config.runtime.tracking.intervalMs;
    const healthThresholdMs = currentPollIntervalMs * HEALTHY_TICK_MULTIPLIER;
    const maximumFailureCount = MAX_CONSECUTIVE_FAILURES;
    
    const consecutiveFailureCount = sessionStatus.failureCount;
    const lastSchedulerTickAt = sessionStatus.lastTickAt;
    
    let isPipelineHealthy = false;
    let healthState = TrackingHealthState.UNHEALTHY;
    
    // Check if systems are uninitialized or starting up
    const isEngineUninitialized = trackingStatus.state === TrackingState.STOPPED && trackingStatus.startedAt === undefined && trackingStatus.lastProcessedAt === undefined;
    const isSessionUninitialized = sessionStatus.state === SessionState.STOPPED && sessionStatus.lastTickAt === undefined;
    const isStarting = trackingStatus.state === TrackingState.STARTING || sessionStatus.state === SessionState.STARTING;
    const isMissingMetrics = isTrackingEngineRunning && isSchedulerRunning && !lastSchedulerTickAt;
    
    if (isEngineUninitialized || isSessionUninitialized || isStarting || isMissingMetrics) {
        healthState = TrackingHealthState.UNKNOWN;
    } else if (!isTrackingEngineRunning && !isSchedulerRunning) {
        healthState = TrackingHealthState.STOPPED;
    } else if (isTrackingEngineRunning && isSchedulerRunning) {
       const now = Date.now();
       const lastTickTime = lastSchedulerTickAt ? new Date(lastSchedulerTickAt).getTime() : 0;
       
       let elapsedMs = now - lastTickTime;
       // Clock drift protection: if manual clock changes cause negative elapsed time, treat as 0
       if (elapsedMs < 0) {
           elapsedMs = 0;
       }
       
       const isTickRecent = elapsedMs <= healthThresholdMs;
       const isFailureCountAcceptable = consecutiveFailureCount < maximumFailureCount;
       
       if (isTickRecent && isFailureCountAcceptable) {
           isPipelineHealthy = true;
           healthState = TrackingHealthState.HEALTHY;
       } else if (isTickRecent || isFailureCountAcceptable) {
           healthState = TrackingHealthState.DEGRADED;
       }
    }
    
    const isRecoveryActive = consecutiveFailureCount > 0 && isSchedulerRunning;
    
    return {
      state: healthState,
      trackingState: trackingStatus.state,
      schedulerState: sessionStatus.state,
      
      isTrackingEngineRunning,
      isSchedulerRunning,
      isPipelineHealthy,
      isRecoveryActive,
      
      currentPollIntervalMs,
      healthThresholdMs,
      maximumFailureCount,
      consecutiveFailureCount,
      
      lastSchedulerTickAt,
      lastSuccessfulLocationAt: sessionStatus.lastLocationAt,
      lastSuccessfulProcessingAt: trackingStatus.lastProcessedAt,
      lastSuccessfulPersistenceAt: trackingStatus.lastPersistedAt
    };
  }
};
