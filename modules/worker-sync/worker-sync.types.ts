import { AttendanceEntity } from '../repositories/attendance/attendance.repository.types';
import { LocationEntity } from '../repositories/location/location.types';

export enum WorkerSyncLifecycle {
  IDLE = 'IDLE',
  SYNCING = 'SYNCING'
}

export enum WorkerSyncErrorCode {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  ALREADY_SYNCING = 'ALREADY_SYNCING',
  PROVIDER_NOT_CONFIGURED = 'PROVIDER_NOT_CONFIGURED',
  SYNC_FAILED = 'SYNC_FAILED',
  NETWORK_ERROR = 'NETWORK_ERROR'
}

export class WorkerSyncError extends Error {
  constructor(
    public readonly code: WorkerSyncErrorCode,
    message: string,
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'WorkerSyncError';
  }
}

export interface WorkerSyncStatus {
  readonly initialized: boolean;
  readonly lifecycle: WorkerSyncLifecycle;
  readonly lastSyncAt?: string;
  readonly lastSuccessfulSyncAt?: string;
  readonly lastFailedSyncAt?: string;
  readonly lastSyncDuration?: number;
  readonly consecutiveFailures: number;
  readonly pendingAttendanceCount?: number;
  readonly pendingLocationCount?: number;
}

export interface WorkerSyncResult {
  readonly success: boolean;
  readonly synchronizedCount?: number;
  readonly attendanceUploadedCount?: number;
  readonly locationUploadedCount?: number;
  readonly error?: string;
  readonly errorCode?: WorkerSyncErrorCode;
}

export interface RemoteWorkerRecord {
  readonly workerId: string;
  readonly employeeCode?: string;
  readonly email: string;
  readonly displayName: string;
  readonly role: string;
  readonly organization?: string;
  readonly active: boolean;
  readonly updatedAt?: string;
}

export interface WorkerSyncProvider {
  fetchUpdatedWorkers(since?: string): Promise<RemoteWorkerRecord[]>;
  uploadAttendance?(records: AttendanceEntity[]): Promise<void>;
  uploadLocations?(records: LocationEntity[]): Promise<void>;
}
