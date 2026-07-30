export enum WorkerRole {
  WORKER = 'WORKER',
  ADMINISTRATOR = 'ADMINISTRATOR',
  SUPER_ADMIN = 'SUPER_ADMIN'
}

export interface WorkerRecord {
  readonly workerId: string;
  readonly employeeCode?: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: WorkerRole | string;
  readonly organization?: string;
  readonly active: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly syncedAt?: string;
}

export interface WorkerCreatePayload {
  readonly workerId: string;
  readonly employeeCode?: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: WorkerRole | string;
  readonly organization?: string;
  readonly active?: boolean;
}

export interface WorkerUpdatePayload {
  readonly employeeCode?: string;
  readonly displayName?: string;
  readonly role?: WorkerRole | string;
  readonly organization?: string;
  readonly active?: boolean;
}

export enum WorkerRepositoryErrorCode {
  WORKER_NOT_FOUND = 'WORKER_NOT_FOUND',
  WORKER_ALREADY_EXISTS = 'WORKER_ALREADY_EXISTS',
  STORAGE_ERROR = 'STORAGE_ERROR'
}

export class WorkerRepositoryError extends Error {
  constructor(
    public readonly code: WorkerRepositoryErrorCode,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'WorkerRepositoryError';
  }
}
