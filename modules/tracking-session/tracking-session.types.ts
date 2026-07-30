export enum SessionState {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  RUNNING = 'RUNNING',
  PAUSED = 'PAUSED',
  STOPPING = 'STOPPING',
  ERROR = 'ERROR'
}

export interface SessionStatus {
  readonly state: SessionState;
  readonly lastError?: string;
  readonly lastTickAt?: string;
  readonly lastLocationAt?: string;
  readonly failureCount: number;
}
