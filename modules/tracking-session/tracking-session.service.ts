import { SessionState, SessionStatus } from './tracking-session.types';
import { ConfigurationEngine } from '../configuration';
import { LocationProvider } from '../location';
import { TrackingEngine } from '../tracking';
import { EventEngine } from '../event';
import { EventType } from '../domain';

/**
 * TrackingSession decides **when** a location is collected.
 * TrackingEngine decides **what happens** to that location.
 */
let currentState: SessionState = SessionState.STOPPED;
let lastError: string | undefined;
let timerId: ReturnType<typeof setTimeout> | undefined;
let isExecutingCycle = false;

// Health metrics
let lastTickAt: string | undefined;
let lastLocationAt: string | undefined;
let failureCount: number = 0;

async function executeCycle(): Promise<void> {
  // Defensive guard: Execution is only allowed when RUNNING.
  if (currentState !== SessionState.RUNNING) {
    return;
  }
  // Defensive guard: Prevent overlapping cycles.
  if (isExecutingCycle) {
    return;
  }
  isExecutingCycle = true;
  lastTickAt = new Date().toISOString();
  
  try {
    let location;
    try {
      location = await LocationProvider.getCurrentLocation();
      lastLocationAt = new Date().toISOString();
    } catch (error) {
      failureCount++;
      // The scheduler intentionally survives GPS read failures.
      // Transient hardware or OS location failures must not terminate long-running offline tracking.
      try {
        await EventEngine.createEvent({
          type: EventType.TRACKING_ERROR,
          workerId: 'SYSTEM',
          payload: { error: error instanceof Error ? error.message : String(error), source: 'LocationProvider' }
        });
      } catch (e) {
        // Event failures must never stop tracking or cause recursive error loops.
      }
      return;
    }

    const result = await TrackingEngine.processLocation(location);

    if (!result.success && result.failure) {
      failureCount++;
      if (result.failure.type === 'PERSISTENCE_ERROR') {
        // The scheduler intentionally survives persistence failures.
        // Intermittent storage availability must not permanently halt tracking.
        try {
          await EventEngine.createEvent({
            type: EventType.TRACKING_ERROR,
            workerId: 'SYSTEM',
            payload: { error: result.failure.message, source: 'LocationRepository' }
          });
        } catch (e) {
          // Event failures must never stop tracking.
        }
      }
      // For EVENT_ERROR, we just continue without logging another error event to avoid loop.
      // Event failures must never stop tracking.
    } else {
      failureCount = 0;
    }
  } catch (error) {
    failureCount++;
    // Global catch-all to ensure executeCycle never throws and breaks the scheduling loop.
    try {
      await EventEngine.createEvent({
        type: EventType.TRACKING_ERROR,
        workerId: 'SYSTEM',
        payload: { error: error instanceof Error ? error.message : String(error), source: 'TrackingSession' }
      });
    } catch (e) {
      // Ignore errors when failing to log errors.
    }
  } finally {
    isExecutingCycle = false;
  }
}

function scheduleNextCycle(): void {
  // Defensive guard: Do not schedule if not RUNNING.
  if (currentState !== SessionState.RUNNING) {
    return;
  }
  
  // Defensive guard: Ensure no duplicate schedulers.
  if (timerId !== undefined) {
    clearTimeout(timerId);
    timerId = undefined;
  }
  
  const config = ConfigurationEngine.config;
  const intervalMs = config.runtime.tracking.intervalMs;
  
  timerId = setTimeout(async () => {
    // Wrap executeCycle in a try-catch to absolutely guarantee scheduleNextCycle() is called,
    // ensuring the scheduler always survives even if an unforeseen exception escapes.
    try {
      await executeCycle();
    } catch (e) {
      // Ignored: executeCycle handles its own errors, this is a fallback to guarantee loop survival.
    } finally {
      scheduleNextCycle();
    }
  }, intervalMs);
}

function stopTimer(): void {
  if (timerId !== undefined) {
    clearTimeout(timerId);
    timerId = undefined;
  }
}

export const TrackingSession = {
  initialize(): void {
    stopTimer();
    currentState = SessionState.STOPPED;
    lastError = undefined;
    isExecutingCycle = false;
    
    lastTickAt = undefined;
    lastLocationAt = undefined;
    failureCount = 0;
  },

  async start(): Promise<void> {
    if (currentState !== SessionState.STOPPED) {
      throw new Error(`Tracking Session: Cannot start from state ${currentState}`);
    }

    currentState = SessionState.STARTING;

    try {
      currentState = SessionState.RUNNING;
      scheduleNextCycle();
      lastError = undefined;
    } catch (error) {
      currentState = SessionState.ERROR;
      lastError = error instanceof Error ? error.message : String(error);
      stopTimer();
      throw error;
    }
  },

  async stop(): Promise<void> {
    if (currentState !== SessionState.RUNNING && currentState !== SessionState.PAUSED) {
      throw new Error(`Tracking Session: Cannot stop from state ${currentState}`);
    }

    currentState = SessionState.STOPPING;
    stopTimer();
    currentState = SessionState.STOPPED;
  },

  async pause(): Promise<void> {
    if (currentState !== SessionState.RUNNING) {
      throw new Error(`Tracking Session: Cannot pause from state ${currentState}`);
    }

    currentState = SessionState.PAUSED;
    stopTimer();
  },

  async resume(): Promise<void> {
    if (currentState !== SessionState.PAUSED) {
      throw new Error(`Tracking Session: Cannot resume from state ${currentState}`);
    }

    currentState = SessionState.RUNNING;
    
    try {
      scheduleNextCycle();
    } catch (error) {
      currentState = SessionState.ERROR;
      lastError = error instanceof Error ? error.message : String(error);
      stopTimer();
      throw error;
    }
  },

  status(): SessionStatus {
    return {
      state: currentState,
      lastError,
      lastTickAt,
      lastLocationAt,
      failureCount
    };
  }
};
