import { Network } from '@capacitor/network';
import { PluginListenerHandle } from '@capacitor/core';
import { 
  ConnectivityState, 
  ConnectivityStatus, 
  ConnectivityResult, 
  ConnectivityErrorCode 
} from './connectivity.types';
import { DEFAULT_CONNECTIVITY_STATUS } from './connectivity.constants';

/**
 * Connectivity Engine
 * 
 * Architectural Responsibilities:
 * - Connectivity Engine owns network state only.
 * - Sync decisions belong exclusively to Sync Engine.
 * - Upload orchestration belongs to later slices.
 * - Repository interaction is prohibited.
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

function freezeResult(result: ConnectivityResult): ConnectivityResult {
  return deepCloneAndFreeze(result);
}

let currentState: ConnectivityState = ConnectivityState.STOPPED;
let isOnline: boolean = false;
let lastConnectivityChangeAt: string | undefined;
let lastStartedAt: string | undefined;
let lastStoppedAt: string | undefined;
let consecutiveFailures: number = 0;

let networkListener: PluginListenerHandle | null = null;

// Rollback state
let previousState: ConnectivityState = ConnectivityState.STOPPED;
let previousIsOnline: boolean = false;
let previousLastConnectivityChangeAt: string | undefined;
let previousLastStartedAt: string | undefined;
let previousLastStoppedAt: string | undefined;
let previousConsecutiveFailures: number = 0;

function saveStateForRollback(): void {
  previousState = currentState;
  previousIsOnline = isOnline;
  previousLastConnectivityChangeAt = lastConnectivityChangeAt;
  previousLastStartedAt = lastStartedAt;
  previousLastStoppedAt = lastStoppedAt;
  previousConsecutiveFailures = consecutiveFailures;
}

function rollbackConnectivity(): void {
  currentState = previousState;
  isOnline = previousIsOnline;
  lastConnectivityChangeAt = previousLastConnectivityChangeAt;
  lastStartedAt = previousLastStartedAt;
  lastStoppedAt = previousLastStoppedAt;
  consecutiveFailures = previousConsecutiveFailures;
}

function commitState(): void {
  saveStateForRollback();
}

/**
 * Single reset path.
 */
function clearInternal(): void {
  currentState = ConnectivityState.STOPPED;
  isOnline = false;
  lastConnectivityChangeAt = undefined;
  lastStartedAt = undefined;
  lastStoppedAt = undefined;
  consecutiveFailures = 0;

  if (networkListener) {
    networkListener.remove().catch(() => {});
    networkListener = null;
  }
}

export const ConnectivityEngine = {
  initialize(): void {
    clearInternal();
    saveStateForRollback();
  },

  async startMonitoring(): Promise<ConnectivityResult> {
    if (currentState !== ConnectivityState.STOPPED) {
      return freezeResult({
        success: false,
        state: currentState,
        error: `Connectivity Engine: Cannot start monitoring from state ${currentState}`,
        errorCode: ConnectivityErrorCode.INVALID_LIFECYCLE_TRANSITION
      });
    }

    saveStateForRollback();
    currentState = ConnectivityState.STARTING;

    try {
      if (networkListener) {
        await networkListener.remove();
        networkListener = null;
      }

      const status = await Network.getStatus();
      isOnline = status.connected;
      lastConnectivityChangeAt = new Date().toISOString();

      networkListener = await Network.addListener('networkStatusChange', (newStatus) => {
        if (isOnline !== newStatus.connected) {
          isOnline = newStatus.connected;
          lastConnectivityChangeAt = new Date().toISOString();
        }
      });

      currentState = ConnectivityState.MONITORING;
      lastStartedAt = new Date().toISOString();
      consecutiveFailures = 0;
      commitState();

      return freezeResult({
        success: true,
        state: currentState
      });
    } catch (error: any) {
      rollbackConnectivity();
      return freezeResult({
        success: false,
        state: currentState,
        error: error.message || String(error),
        errorCode: ConnectivityErrorCode.NETWORK_PLUGIN_ERROR
      });
    }
  },

  async stopMonitoring(): Promise<ConnectivityResult> {
    if (currentState !== ConnectivityState.MONITORING) {
      return freezeResult({
        success: false,
        state: currentState,
        error: `Connectivity Engine: Cannot stop monitoring from state ${currentState}`,
        errorCode: ConnectivityErrorCode.INVALID_LIFECYCLE_TRANSITION
      });
    }

    saveStateForRollback();
    currentState = ConnectivityState.STOPPING;

    try {
      if (networkListener) {
        await networkListener.remove();
        networkListener = null;
      }

      currentState = ConnectivityState.STOPPED;
      lastStoppedAt = new Date().toISOString();
      commitState();

      return freezeResult({
        success: true,
        state: currentState
      });
    } catch (error: any) {
      rollbackConnectivity();
      return freezeResult({
        success: false,
        state: currentState,
        error: error.message || String(error),
        errorCode: ConnectivityErrorCode.NETWORK_PLUGIN_ERROR
      });
    }
  },

  isOnline(): boolean {
    try {
      return !!isOnline;
    } catch (e) {
      return false;
    }
  },

  status(): ConnectivityStatus {
    try {
      return deepCloneAndFreeze({
        state: currentState,
        isOnline,
        lastConnectivityChangeAt,
        lastStartedAt,
        lastStoppedAt,
        consecutiveFailures
      });
    } catch (e) {
      return deepCloneAndFreeze({ ...DEFAULT_CONNECTIVITY_STATUS });
    }
  }
};
