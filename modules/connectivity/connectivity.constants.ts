import { ConnectivityState, ConnectivityStatus } from './connectivity.types';

export const CONNECTIVITY_ENGINE_VERSION = '1.0.0';

export const DEFAULT_CONNECTIVITY_STATUS: ConnectivityStatus = Object.freeze({
  state: ConnectivityState.STOPPED,
  isOnline: false,
  consecutiveFailures: 0
});
