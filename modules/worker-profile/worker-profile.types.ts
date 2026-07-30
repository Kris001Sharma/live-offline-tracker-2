import { WorkerRole } from '../user-context';

export enum WorkerProfileLifecycle {
  EMPTY = 'EMPTY',
  LOADING = 'LOADING',
  READY = 'READY',
  REFRESHING = 'REFRESHING',
  CLEARED = 'CLEARED'
}

export interface WorkerProfile {
  readonly workerId: string;
  readonly employeeCode: string;
  readonly displayName: string;
  readonly email: string;
  readonly role: WorkerRole;
  readonly organization?: string;
  readonly active: boolean;
}

export interface WorkerProfileStatus {
  readonly initialized: boolean;
  readonly lifecycle: WorkerProfileLifecycle;
  readonly lastLoadedAt?: string;
}

export enum WorkerProfileErrorCode {
  NETWORK_ERROR = 'NETWORK_ERROR',
  PROFILE_NOT_FOUND = 'PROFILE_NOT_FOUND',
  LIFECYCLE_ERROR = 'LIFECYCLE_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  UNAUTHENTICATED = 'UNAUTHENTICATED'
}

export class WorkerProfileError extends Error {
  constructor(
    public readonly code: WorkerProfileErrorCode,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'WorkerProfileError';
  }
}

export interface WorkerProfileResult {
  readonly success: boolean;
  readonly error?: string;
  readonly errorCode?: WorkerProfileErrorCode;
}
