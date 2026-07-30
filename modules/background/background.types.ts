export enum ExecutionState {
  STOPPED = 'STOPPED',
  STARTING = 'STARTING',
  ACTIVE = 'ACTIVE',
  BACKGROUND = 'BACKGROUND',
  STOPPING = 'STOPPING',
  ERROR = 'ERROR'
}

export interface ExecutionStatus {
  readonly state: ExecutionState;
  readonly lastError?: string;
}
