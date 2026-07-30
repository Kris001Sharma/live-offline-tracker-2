import { WorkerRepository, AttendanceRepository, LocationRepository } from '../repositories';
import { AuthenticationEngine, AuthenticationState } from '../authentication';
import {
  WorkerSyncLifecycle,
  WorkerSyncStatus,
  WorkerSyncResult,
  WorkerSyncErrorCode,
  WorkerSyncError,
  WorkerSyncProvider
} from './worker-sync.types';

let initialized = false;
let lifecycle = WorkerSyncLifecycle.IDLE;
let provider: WorkerSyncProvider | null = null;

let lastSyncAt: string | undefined;
let lastSuccessfulSyncAt: string | undefined;
let lastFailedSyncAt: string | undefined;
let lastSyncDuration: number | undefined;
let consecutiveFailures = 0;

const DEFAULT_STATUS = Object.freeze({
  initialized: false,
  lifecycle: WorkerSyncLifecycle.IDLE,
  consecutiveFailures: 0
});

function deepCloneAndFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  const cloned: any = Array.isArray(obj) ? [] : {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = deepCloneAndFreeze((obj as any)[key]);
    }
  }
  return Object.freeze(cloned);
}

function clearInternal(): void {
  initialized = false;
  lifecycle = WorkerSyncLifecycle.IDLE;
  provider = null;
  lastSyncAt = undefined;
  lastSuccessfulSyncAt = undefined;
  lastFailedSyncAt = undefined;
  lastSyncDuration = undefined;
  consecutiveFailures = 0;
}

function transitionTo(newLifecycle: WorkerSyncLifecycle): void {
  const valid = (
    (lifecycle === WorkerSyncLifecycle.IDLE && newLifecycle === WorkerSyncLifecycle.SYNCING) ||
    (lifecycle === WorkerSyncLifecycle.SYNCING && newLifecycle === WorkerSyncLifecycle.IDLE)
  );

  if (!valid) {
    throw new WorkerSyncError(
      WorkerSyncErrorCode.ALREADY_SYNCING,
      `Worker Sync Engine: Invalid lifecycle transition from ${lifecycle} to ${newLifecycle}`
    );
  }

  lifecycle = newLifecycle;
}

export const WorkerSyncEngine = {
  initialize(syncProvider?: WorkerSyncProvider): void {
    clearInternal();
    if (syncProvider) {
      provider = syncProvider;
    }
    initialized = true;
  },

  async sync(): Promise<WorkerSyncResult> {
    if (!initialized) {
      throw new WorkerSyncError(
        WorkerSyncErrorCode.SYNC_FAILED,
        'Worker Sync Engine is not initialized'
      );
    }

    if (lifecycle !== WorkerSyncLifecycle.IDLE) {
      return deepCloneAndFreeze({
        success: false,
        error: 'Already syncing',
        errorCode: WorkerSyncErrorCode.ALREADY_SYNCING
      });
    }

    if (!provider) {
      return deepCloneAndFreeze({
        success: false,
        error: 'Sync provider not configured',
        errorCode: WorkerSyncErrorCode.PROVIDER_NOT_CONFIGURED
      });
    }

    const authStatus = AuthenticationEngine.status();
    if (authStatus.state !== AuthenticationState.AUTHENTICATED) {
      return deepCloneAndFreeze({
        success: false,
        error: 'Unauthenticated',
        errorCode: WorkerSyncErrorCode.UNAUTHENTICATED
      });
    }

    transitionTo(WorkerSyncLifecycle.SYNCING);
    const startTime = Date.now();
    lastSyncAt = new Date().toISOString();

    try {
      const remoteWorkers = await provider.fetchUpdatedWorkers(lastSuccessfulSyncAt);

      let synchronizedCount = 0;

      for (const rw of remoteWorkers) {
        if (!rw.workerId || !rw.email || !rw.displayName || !rw.role || rw.active === undefined) {
          continue; 
        }

        const existing = await WorkerRepository.findById(rw.workerId);
        
        if (existing) {
          await WorkerRepository.update(rw.workerId, {
            employeeCode: rw.employeeCode,
            displayName: rw.displayName,
            role: rw.role,
            organization: rw.organization,
            active: rw.active
          });
        } else {
          await WorkerRepository.create({
            workerId: rw.workerId,
            employeeCode: rw.employeeCode,
            email: rw.email,
            displayName: rw.displayName,
            role: rw.role,
            organization: rw.organization,
            active: rw.active
          });
        }
        synchronizedCount++;
      }

      let attendanceUploadedCount = 0;
      let locationUploadedCount = 0;

      const pendingAttendance = await AttendanceRepository.findPending();
      if (pendingAttendance.length > 0 && provider.uploadAttendance) {
        await provider.uploadAttendance(pendingAttendance);
        await AttendanceRepository.markSynced(pendingAttendance.map((a) => a.id));
        attendanceUploadedCount = pendingAttendance.length;
        synchronizedCount += attendanceUploadedCount;
      }

      const pendingLocations = await LocationRepository.findPending();
      if (pendingLocations.length > 0 && provider.uploadLocations) {
        await provider.uploadLocations(pendingLocations);
        await LocationRepository.markSynced(pendingLocations.map((l) => l.id));
        locationUploadedCount = pendingLocations.length;
        synchronizedCount += locationUploadedCount;
      }

      lastSuccessfulSyncAt = new Date().toISOString();
      lastSyncDuration = Date.now() - startTime;
      consecutiveFailures = 0;

      transitionTo(WorkerSyncLifecycle.IDLE);

      return deepCloneAndFreeze({
        success: true,
        synchronizedCount,
        attendanceUploadedCount,
        locationUploadedCount
      });
    } catch (error: any) {
      lastFailedSyncAt = new Date().toISOString();
      lastSyncDuration = Date.now() - startTime;
      consecutiveFailures++;

      transitionTo(WorkerSyncLifecycle.IDLE);

      return deepCloneAndFreeze({
        success: false,
        error: error.message || String(error),
        errorCode: error instanceof WorkerSyncError ? error.code : WorkerSyncErrorCode.SYNC_FAILED
      });
    }
  },

  status(): WorkerSyncStatus {
    if (!initialized) {
      return DEFAULT_STATUS;
    }

    try {
      return deepCloneAndFreeze({
        initialized,
        lifecycle,
        lastSyncAt,
        lastSuccessfulSyncAt,
        lastFailedSyncAt,
        lastSyncDuration,
        consecutiveFailures
      });
    } catch {
      return DEFAULT_STATUS;
    }
  },

  clear(): void {
    clearInternal();
  }
};
