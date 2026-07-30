export enum ConnectivityState {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  MONITORING = 'MONITORING',
  STOPPING = 'STOPPING'
}

export enum ConnectivityErrorCode {
  INVALID_LIFECYCLE_TRANSITION = 'INVALID_LIFECYCLE_TRANSITION',
  NETWORK_PLUGIN_ERROR = 'NETWORK_PLUGIN_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface ConnectivityStatus {
  readonly state: ConnectivityState;
  readonly isOnline: boolean;
  readonly lastConnectivityChangeAt?: string;
  readonly lastStartedAt?: string;
  readonly lastStoppedAt?: string;
  readonly consecutiveFailures: number;
}

export interface ConnectivityResult {
  readonly success: boolean;
  readonly state: ConnectivityState;
  readonly error?: string;
  readonly errorCode?: ConnectivityErrorCode;
}
