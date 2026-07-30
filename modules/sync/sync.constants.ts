import { SyncState, SyncStatus } from './sync.types';

export const SYNC_ENGINE_VERSION = '1.0.0';

export const DEFAULT_SYNC_STATUS: SyncStatus = Object.freeze({
  state: SyncState.STOPPED,
  isRunning: false,
  consecutiveFailures: 0,
  itemsUploaded: 0,
  itemsRemaining: 0,
  retryCount: 0
});

export const MAX_RETRIES = 5;
export const BASE_RETRY_DELAY = 5;
export const MAX_RETRY_DELAY = 60;
