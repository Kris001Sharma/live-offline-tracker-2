export enum WorkerAdminLifecycle {
  IDLE = 'IDLE',
  PROCESSING = 'PROCESSING'
}

export enum WorkerAdminOperationType {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DEACTIVATE = 'DEACTIVATE',
  GET = 'GET',
  LIST = 'LIST'
}

export enum WorkerAdminErrorCode {
  UNINITIALIZED = 'UNINITIALIZED',
  ALREADY_PROCESSING = 'ALREADY_PROCESSING',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  WORKER_NOT_FOUND = 'WORKER_NOT_FOUND',
  WORKER_ALREADY_EXISTS = 'WORKER_ALREADY_EXISTS',
  STORAGE_ERROR = 'STORAGE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export class WorkerAdminError extends Error {
  constructor(
    public readonly code: WorkerAdminErrorCode,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'WorkerAdminError';
  }
}

export interface WorkerAdminStatus {
  readonly initialized: boolean;
  readonly lifecycle: WorkerAdminLifecycle;
  readonly lastOperationAt?: string;
  readonly lastSuccessfulOperationAt?: string;
  readonly lastFailedOperationAt?: string;
  readonly lastOperationType?: WorkerAdminOperationType;
  readonly consecutiveFailures: number;
  readonly pendingSync: boolean;
  readonly lastSyncNotificationAt?: string;
}

export interface WorkerAdminResult<T = void> {
  readonly success: boolean;
  readonly data?: T;
  readonly error?: string;
  readonly errorCode?: WorkerAdminErrorCode;
}

export interface WorkerCreationPayload {
  readonly workerId: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: string;
  readonly employeeCode?: string;
  readonly organization?: string;
  readonly active?: boolean;
}

export interface WorkerUpdatePayload {
  readonly email?: string;
  readonly displayName?: string;
  readonly role?: string;
  readonly employeeCode?: string;
  readonly organization?: string;
  readonly active?: boolean;
}

export interface WorkerAdminRecord {
  readonly workerId: string;
  readonly employeeCode?: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: string;
  readonly organization?: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly syncedAt?: string;
}
