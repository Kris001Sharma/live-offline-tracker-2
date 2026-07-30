import { TrackingState, TrackingStatus, ProcessLocationResult } from './tracking.types';
import { EventEngine } from '../event';
import { EventType, TrackingSample } from '../domain';
import { LocationEvaluationEngine, LocationEvaluationRequest } from '../location-evaluation';
import { Location } from '../location';
import { LocationRepository } from '../repositories';
import { ConfigurationEngine } from '../configuration';

let currentState: TrackingState = TrackingState.STOPPED;
let lastError: string | undefined;
let startedAt: string | undefined;
let isProcessingLocation = false;

// Health metrics
let lastProcessedAt: string | undefined;
let lastPersistedAt: string | undefined;

export const TrackingEngine = {
  initialize(): void {
    currentState = TrackingState.STOPPED;
    lastError = undefined;
    startedAt = undefined;
    isProcessingLocation = false;
    
    lastProcessedAt = undefined;
    lastPersistedAt = undefined;
  },

  async start(): Promise<void> {
    if (currentState !== TrackingState.STOPPED) {
      throw new Error(`Tracking Engine: Cannot start from state ${currentState}`);
    }

    currentState = TrackingState.STARTING;

    try {
      await EventEngine.createEvent({
        type: EventType.TRACKING_STARTED,
        workerId: 'SYSTEM',
        payload: {}
      });

      currentState = TrackingState.RUNNING;
      startedAt = new Date().toISOString();
      lastError = undefined;
    } catch (error) {
      currentState = TrackingState.ERROR;
      lastError = error instanceof Error ? error.message : String(error);
      
      try {
        await EventEngine.createEvent({
          type: EventType.TRACKING_ERROR,
          workerId: 'SYSTEM',
          payload: { error: lastError }
        });
      } catch (innerError) {
        // Suppress inner errors
      }
      
      throw error;
    }
  },

  async stop(): Promise<void> {
    if (currentState !== TrackingState.RUNNING && currentState !== TrackingState.PAUSED) {
      throw new Error(`Tracking Engine: Cannot stop from state ${currentState}`);
    }

    currentState = TrackingState.STOPPING;

    try {
      await EventEngine.createEvent({
        type: EventType.TRACKING_STOPPED,
        workerId: 'SYSTEM',
        payload: {}
      });

      currentState = TrackingState.STOPPED;
      startedAt = undefined;
    } catch (error) {
      currentState = TrackingState.ERROR;
      lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  },

  async pause(): Promise<void> {
    if (currentState !== TrackingState.RUNNING) {
      throw new Error(`Tracking Engine: Cannot pause from state ${currentState}`);
    }

    currentState = TrackingState.PAUSED;

    try {
      await EventEngine.createEvent({
        type: EventType.TRACKING_PAUSED,
        workerId: 'SYSTEM',
        payload: {}
      });
    } catch (error) {
      currentState = TrackingState.ERROR;
      lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  },

  async resume(): Promise<void> {
    if (currentState !== TrackingState.PAUSED) {
      throw new Error(`Tracking Engine: Cannot resume from state ${currentState}`);
    }

    currentState = TrackingState.RUNNING;

    try {
      await EventEngine.createEvent({
        type: EventType.TRACKING_RESUMED,
        workerId: 'SYSTEM',
        payload: {}
      });
    } catch (error) {
      currentState = TrackingState.ERROR;
      lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  },

  status(): TrackingStatus {
    return {
      state: currentState,
      lastError,
      startedAt,
      lastProcessedAt,
      lastPersistedAt
    };
  },

  async processLocation(location: Location): Promise<ProcessLocationResult> {
    if (currentState !== TrackingState.RUNNING) {
      throw new Error(`Tracking Engine: Cannot process location in state ${currentState}`);
    }
    
    if (isProcessingLocation) {
      return {
        location,
        success: false,
        failure: { type: 'CONCURRENCY_ERROR', message: 'Concurrent execution of processLocation is forbidden.' }
      };
    }
    isProcessingLocation = true;
    lastProcessedAt = new Date().toISOString();

    try {
      let lastLocation;
      try {
        lastLocation = await LocationRepository.findLatest('SYSTEM');
      } catch (error) {
        return {
          location,
          success: false,
          failure: { type: 'PERSISTENCE_ERROR', message: error instanceof Error ? error.message : String(error) }
        };
      }
      
      let previousLocation: Location | undefined;
      let previousTimestamp: string | undefined;

      if (lastLocation) {
        previousLocation = {
          latitude: lastLocation.latitude,
          longitude: lastLocation.longitude,
          accuracy: lastLocation.accuracy,
          timestamp: lastLocation.recorded_at,
          altitude: lastLocation.altitude,
          heading: lastLocation.heading,
          speed: lastLocation.speed
        };
        previousTimestamp = lastLocation.recorded_at;
      }

      const config = ConfigurationEngine.config;

      const request: LocationEvaluationRequest = {
        currentLocation: location,
        previousLocation,
        previousTimestamp,
        options: {
          maxAccuracyMeters: config.runtime.gps.accuracyThresholdMeters
        }
      };

      const evaluation = LocationEvaluationEngine.evaluate(request);

      if (evaluation.accepted) {
        const payload: TrackingSample = {
          coordinates: {
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            altitude: location.altitude ?? null,
            heading: location.heading ?? null,
            speed: location.speed ?? null
          },
          timestamp: location.timestamp,
          isMocked: false
        };
        
        const locationId = crypto.randomUUID();
        
        try {
          await LocationRepository.append({
            id: locationId,
            shift_id: 'SYSTEM',
            worker_id: 'SYSTEM',
            latitude: location.latitude,
            longitude: location.longitude,
            accuracy: location.accuracy,
            altitude: location.altitude ?? null,
            heading: location.heading ?? null,
            speed: location.speed ?? null,
            recorded_at: location.timestamp
          });
          lastPersistedAt = new Date().toISOString();
        } catch (error) {
          return {
            location,
            evaluation,
            success: false,
            failure: { type: 'PERSISTENCE_ERROR', message: error instanceof Error ? error.message : String(error) }
          };
        }
        
        try {
          await EventEngine.createEvent({
            type: EventType.GPS_RECORDED,
            workerId: 'SYSTEM',
            payload
          });
        } catch (error) {
          return {
            location,
            evaluation,
            success: false,
            failure: { type: 'EVENT_ERROR', message: error instanceof Error ? error.message : String(error) }
          };
        }
      } else {
        try {
          await EventEngine.createEvent({
            type: EventType.LOCATION_REJECTED,
            workerId: 'SYSTEM',
            payload: {
              location,
              reasons: evaluation.reasons,
              measurements: evaluation.measurements
            }
          });
        } catch (error) {
          return {
            location,
            evaluation,
            success: false,
            failure: { type: 'EVENT_ERROR', message: error instanceof Error ? error.message : String(error) }
          };
        }
      }

      return {
        location,
        evaluation,
        success: true
      };
    } finally {
      isProcessingLocation = false;
    }
  }
};
