import { ConnectivityEngine } from '../connectivity';
import { 
  TrustedDeviceRepository, 
  AttendanceRepository, 
  EventRepository 
} from '../repositories';
import { 
  SyncState, 
  SyncStatus, 
  SyncResult, 
  SyncErrorCode,
  ConflictPolicy,
  SyncConflictResult
} from './sync.types';
import { 
  DEFAULT_SYNC_STATUS, 
  MAX_RETRIES, 
  BASE_RETRY_DELAY, 
  MAX_RETRY_DELAY 
} from './sync.constants';

/**
 * Offline Synchronization Engine
 * 
 * Architectural Responsibilities:
 * - Sync Engine owns synchronization orchestration only.
 * - Upload implementations remain delegated.
 * - Retry belongs exclusively to Sync Engine.
 * - Retry metrics remain runtime-only.
 * - Retry logic never persists to SQLite.
 * - Conflict handling belongs exclusively to Slice 8E.
 * - Scheduling belongs to a future phase.
 * - SQL remains repository owned.
 * - HTTP uploads remain delegated to upload providers.
 */

function deepCloneAndFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    const arrCopy = obj.map(item => deepCloneAndFreeze(item));
    return Object.freeze(arrCopy) as unknown as T;
  }
  const copy: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepCloneAndFreeze((obj as Record<string, any>)[key]);
    }
  }
  return Object.freeze(copy) as unknown as T;
}

function freezeResult(result: SyncResult): SyncResult {
  return deepCloneAndFreeze(result);
}

let currentState: SyncState = SyncState.STOPPED;
let isRunning: boolean = false;
let lastStartedAt: string | undefined;
let lastStoppedAt: string | undefined;
let lastSyncAttemptAt: string | undefined;
let consecutiveFailures: number = 0;
let lastSuccessfulSyncAt: string | undefined;
let lastFailedSyncAt: string | undefined;
let lastSyncDuration: number | undefined;
let lastSyncedModule: string | undefined;
let itemsUploaded: number = 0;
let itemsRemaining: number = 0;

let retryCount: number = 0;
let lastRetryAt: string | undefined;
let nextRetryDelay: number | undefined;
let lastRetryReason: string | undefined;

// Rollback state
let previousState: SyncState = SyncState.STOPPED;
let previousIsRunning: boolean = false;
let previousLastStartedAt: string | undefined;
let previousLastStoppedAt: string | undefined;
let previousLastSyncAttemptAt: string | undefined;
let previousConsecutiveFailures: number = 0;
let previousLastSuccessfulSyncAt: string | undefined;
let previousLastFailedSyncAt: string | undefined;
let previousLastSyncDuration: number | undefined;
let previousLastSyncedModule: string | undefined;
let previousItemsUploaded: number = 0;
let previousItemsRemaining: number = 0;
let previousRetryCount: number = 0;
let previousLastRetryAt: string | undefined;
let previousNextRetryDelay: number | undefined;
let previousLastRetryReason: string | undefined;

function saveStateForRollback(): void {
  previousState = currentState;
  previousIsRunning = isRunning;
  previousLastStartedAt = lastStartedAt;
  previousLastStoppedAt = lastStoppedAt;
  previousLastSyncAttemptAt = lastSyncAttemptAt;
  previousConsecutiveFailures = consecutiveFailures;
  previousLastSuccessfulSyncAt = lastSuccessfulSyncAt;
  previousLastFailedSyncAt = lastFailedSyncAt;
  previousLastSyncDuration = lastSyncDuration;
  previousLastSyncedModule = lastSyncedModule;
  previousItemsUploaded = itemsUploaded;
  previousItemsRemaining = itemsRemaining;
  previousRetryCount = retryCount;
  previousLastRetryAt = lastRetryAt;
  previousNextRetryDelay = nextRetryDelay;
  previousLastRetryReason = lastRetryReason;
}

function rollbackSync(): void {
  currentState = previousState;
  isRunning = previousIsRunning;
  lastStartedAt = previousLastStartedAt;
  lastStoppedAt = previousLastStoppedAt;
  lastSyncAttemptAt = previousLastSyncAttemptAt;
  consecutiveFailures = previousConsecutiveFailures;
  lastSuccessfulSyncAt = previousLastSuccessfulSyncAt;
  lastFailedSyncAt = previousLastFailedSyncAt;
  lastSyncDuration = previousLastSyncDuration;
  lastSyncedModule = previousLastSyncedModule;
  itemsUploaded = previousItemsUploaded;
  itemsRemaining = previousItemsRemaining;
  retryCount = previousRetryCount;
  lastRetryAt = previousLastRetryAt;
  nextRetryDelay = previousNextRetryDelay;
  lastRetryReason = previousLastRetryReason;
}

function commitState(): void {
  saveStateForRollback();
}

/**
 * Single reset path for the engine.
 * Ensures state is cleared safely and deterministically.
 */
function clearInternal(): void {
  currentState = SyncState.STOPPED;
  isRunning = false;
  lastStartedAt = undefined;
  lastStoppedAt = undefined;
  lastSyncAttemptAt = undefined;
  consecutiveFailures = 0;
  lastSuccessfulSyncAt = undefined;
  lastFailedSyncAt = undefined;
  lastSyncDuration = undefined;
  lastSyncedModule = undefined;
  itemsUploaded = 0;
  itemsRemaining = 0;
  retryCount = 0;
  lastRetryAt = undefined;
  nextRetryDelay = undefined;
  lastRetryReason = undefined;
}


/**
 * Deterministic Conflict Evaluator
 * Evaluates local and remote versions of the same logical entity and returns a deterministic decision.
 * Does NOT execute synchronization.
 */
function evaluateConflict(
  localTimestamp: string | null | undefined,
  remoteTimestamp: string | null | undefined
): SyncConflictResult {
  if (!localTimestamp && !remoteTimestamp) {
    return deepCloneAndFreeze({
      hasConflict: false,
      policy: ConflictPolicy.SKIP,
      reason: 'Both local and remote versions are missing.'
    });
  }

  if (localTimestamp && !remoteTimestamp) {
    return deepCloneAndFreeze({
      hasConflict: false,
      policy: ConflictPolicy.LOCAL_WINS,
      reason: 'Remote version is missing.',
      localVersion: localTimestamp
    });
  }

  if (!localTimestamp && remoteTimestamp) {
    return deepCloneAndFreeze({
      hasConflict: false,
      policy: ConflictPolicy.REMOTE_WINS,
      reason: 'Local version is missing.',
      remoteVersion: remoteTimestamp
    });
  }

  if (localTimestamp === remoteTimestamp) {
    return deepCloneAndFreeze({
      hasConflict: false,
      policy: ConflictPolicy.SKIP,
      reason: 'Local and remote versions are identical.',
      localVersion: localTimestamp as string,
      remoteVersion: remoteTimestamp as string
    });
  }

  const localDate = new Date(localTimestamp as string);
  const remoteDate = new Date(remoteTimestamp as string);

  if (localDate.getTime() > remoteDate.getTime()) {
    return deepCloneAndFreeze({
      hasConflict: true,
      policy: ConflictPolicy.LOCAL_WINS,
      reason: 'Local version is newer than remote version.',
      localVersion: localTimestamp as string,
      remoteVersion: remoteTimestamp as string
    });
  } else if (localDate.getTime() < remoteDate.getTime()) {
    return deepCloneAndFreeze({
      hasConflict: true,
      policy: ConflictPolicy.REMOTE_WINS,
      reason: 'Remote version is newer than local version.',
      localVersion: localTimestamp as string,
      remoteVersion: remoteTimestamp as string
    });
  }

  // Fallback to manual review in unexpected scenarios
  return deepCloneAndFreeze({
    hasConflict: true,
    policy: ConflictPolicy.MANUAL_REVIEW,
    reason: 'Unable to deterministically resolve conflict.',
    localVersion: localTimestamp as string,
    remoteVersion: remoteTimestamp as string
  });
}

type SyncStage = {
  name: string;
  execute: () => Promise<{ uploaded: number; remaining: number }>;
};

const UPLOAD_PIPELINE: readonly SyncStage[] = deepCloneAndFreeze([
  {
    name: 'Trusted Device Registration',
    execute: async () => {
      const pending = await TrustedDeviceRepository.findPending();
      return { uploaded: 0, remaining: pending.length };
    }
  },
  {
    name: 'Attendance',
    execute: async () => {
      const pending = await AttendanceRepository.findPending();
      return { uploaded: 0, remaining: pending.length };
    }
  },
  {
    name: 'Tracking Events',
    execute: async () => {
      const pending = await EventRepository.getUnsyncedEvents();
      return { uploaded: 0, remaining: pending.length };
    }
  }
]);

async function executePipeline(): Promise<{ success: boolean, totalUploaded: number; totalRemaining: number, error?: any }> {
  let totalUploaded = 0;
  let totalRemaining = 0;

  for (const stage of UPLOAD_PIPELINE) {
    if (!stage || typeof stage.name !== 'string' || typeof stage.execute !== 'function') {
      return { success: false, totalUploaded, totalRemaining, error: new Error('Invalid stage definition') };
    }

    lastSyncedModule = stage.name;
    try {
      const result = await stage.execute();
      totalUploaded += result.uploaded;
      totalRemaining += result.remaining;
    } catch (error: any) {
      return { success: false, totalUploaded, totalRemaining, error: new Error(`Sync Pipeline failed at stage: ${stage.name}. ${error.message || String(error)}`) };
    }
  }

  return { success: true, totalUploaded, totalRemaining };
}

export const SyncEngine = {
  evaluateConflict,
  initialize(): void {
    clearInternal();
    saveStateForRollback();
  },

  async start(): Promise<SyncResult> {
    if (currentState !== SyncState.STOPPED) {
      return freezeResult({
        success: false,
        state: currentState,
        error: `Sync Engine: Cannot start from state ${currentState}`,
        errorCode: SyncErrorCode.INVALID_LIFECYCLE_TRANSITION
      });
    }

    if (retryCount > MAX_RETRIES) {
      return freezeResult({
        success: false,
        state: currentState,
        error: 'Sync Engine: Maximum retries exceeded',
        errorCode: SyncErrorCode.MAX_RETRIES_EXCEEDED
      });
    }

    // Offline short-circuit
    if (!ConnectivityEngine.isOnline()) {
      return freezeResult({
        success: false,
        state: currentState,
        error: 'Sync Engine: Cannot start while offline',
        errorCode: SyncErrorCode.OFFLINE
      });
    }

    saveStateForRollback();
    currentState = SyncState.STARTING;
    lastSyncAttemptAt = new Date().toISOString();
    
    try {
      currentState = SyncState.RUNNING;
      isRunning = true;
      lastStartedAt = new Date().toISOString();
      commitState();

      const pipelineResult = await executePipeline();

      if (!pipelineResult.success) {
        // A pipeline stage failed, or an invalid stage was encountered.
        // We rollback to atomic snapshot, then log the failure.
        rollbackSync();
        
        // Record failure
        currentState = SyncState.STOPPED;
        isRunning = false;
        lastFailedSyncAt = new Date().toISOString();
        consecutiveFailures += 1;
        retryCount += 1;
        lastRetryAt = new Date().toISOString();
        lastRetryReason = pipelineResult.error?.message || 'Unknown pipeline failure';

        if (retryCount > MAX_RETRIES) {
          nextRetryDelay = undefined;
          commitState();
          return freezeResult({
            success: false,
            state: currentState,
            error: 'Maximum retries exceeded',
            errorCode: SyncErrorCode.MAX_RETRIES_EXCEEDED
          });
        }

        // Deterministic exponential backoff calculation
        nextRetryDelay = Math.min(BASE_RETRY_DELAY * Math.pow(2, retryCount - 1), MAX_RETRY_DELAY);
        commitState();

        return freezeResult({
          success: false,
          state: currentState,
          error: pipelineResult.error?.message || 'Unknown pipeline failure',
          errorCode: SyncErrorCode.PIPELINE_STAGE_FAILED
        });
      }

      // Success Behaviour
      currentState = SyncState.STOPPED;
      isRunning = false;
      lastSuccessfulSyncAt = new Date().toISOString();
      lastSyncDuration = new Date().getTime() - new Date(lastStartedAt).getTime();
      itemsUploaded = pipelineResult.totalUploaded;
      itemsRemaining = pipelineResult.totalRemaining;
      consecutiveFailures = 0;
      retryCount = 0;
      lastRetryAt = undefined;
      nextRetryDelay = undefined;
      lastRetryReason = undefined;
      commitState();

      return freezeResult({
        success: true,
        state: currentState
      });
    } catch (error: any) {
      // Unexpected exceptions
      rollbackSync();
      return freezeResult({
        success: false,
        state: currentState,
        error: error.message || String(error),
        errorCode: SyncErrorCode.UNKNOWN_ERROR
      });
    }
  },

  async stop(): Promise<SyncResult> {
    if (currentState !== SyncState.RUNNING) {
      return freezeResult({
        success: false,
        state: currentState,
        error: `Sync Engine: Cannot stop from state ${currentState}`,
        errorCode: SyncErrorCode.INVALID_LIFECYCLE_TRANSITION
      });
    }

    saveStateForRollback();
    currentState = SyncState.STOPPING;

    try {
      // Future slices will inject actual stop logic here

      currentState = SyncState.STOPPED;
      isRunning = false;
      lastStoppedAt = new Date().toISOString();
      commitState();

      return freezeResult({
        success: true,
        state: currentState
      });
    } catch (error: any) {
      rollbackSync();
      return freezeResult({
        success: false,
        state: currentState,
        error: error.message || String(error),
        errorCode: SyncErrorCode.UNKNOWN_ERROR
      });
    }
  },

  status(): SyncStatus {
    try {
      return deepCloneAndFreeze({
        state: currentState,
        isRunning,
        lastStartedAt,
        lastStoppedAt,
        lastSyncAttemptAt,
        consecutiveFailures,
        lastSuccessfulSyncAt,
        lastFailedSyncAt,
        lastSyncDuration,
        lastSyncedModule,
        itemsUploaded,
        itemsRemaining,
        retryCount,
        lastRetryAt,
        nextRetryDelay,
        lastRetryReason
      });
    } catch (e) {
      return deepCloneAndFreeze({ ...DEFAULT_SYNC_STATUS });
    }
  }
};
