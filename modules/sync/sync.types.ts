export enum SyncState {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  STOPPING = 'STOPPING'
}

export enum SyncErrorCode {
  INVALID_LIFECYCLE_TRANSITION = 'INVALID_LIFECYCLE_TRANSITION',
  OFFLINE = 'OFFLINE',
  PIPELINE_STAGE_FAILED = 'PIPELINE_STAGE_FAILED',
  MAX_RETRIES_EXCEEDED = 'MAX_RETRIES_EXCEEDED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export enum ConflictPolicy {
  LOCAL_WINS = 'LOCAL_WINS',
  REMOTE_WINS = 'REMOTE_WINS',
  MANUAL_REVIEW = 'MANUAL_REVIEW',
  SKIP = 'SKIP'
}

export interface SyncConflictResult {
  readonly hasConflict: boolean;
  readonly policy: ConflictPolicy;
  readonly reason: string;
  readonly localVersion?: string;
  readonly remoteVersion?: string;
}

export interface SyncStatus {
  readonly state: SyncState;
  readonly isRunning: boolean;
  readonly lastStartedAt?: string;
  readonly lastStoppedAt?: string;
  readonly lastSyncAttemptAt?: string;
  readonly consecutiveFailures: number;
  readonly lastSuccessfulSyncAt?: string;
  readonly lastFailedSyncAt?: string;
  readonly lastSyncDuration?: number;
  readonly lastSyncedModule?: string;
  readonly itemsUploaded: number;
  readonly itemsRemaining: number;
  readonly retryCount: number;
  readonly lastRetryAt?: string;
  readonly nextRetryDelay?: number;
  readonly lastRetryReason?: string;
}

export interface SyncResult {
  readonly success: boolean;
  readonly state: SyncState;
  readonly error?: string;
  readonly errorCode?: SyncErrorCode;
}
