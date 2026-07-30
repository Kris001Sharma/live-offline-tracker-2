import { WorkerRepository } from '../repositories';
import { WorkerRole, UserContextEngine, CurrentWorker } from '../user-context';
import { 
  WorkerProfile, 
  WorkerProfileStatus, 
  WorkerProfileLifecycle, 
  WorkerProfileResult,
  WorkerProfileErrorCode,
  WorkerProfileError
} from './worker-profile.types';

/**
 * ARCHITECTURE NOTE: Worker Profile Engine Ownership
 * 
 * This engine owns application-specific worker metadata (employee code, role, etc.).
 * It is the single source of truth for runtime profile orchestration.
 * 
 * It is separate from Authentication because Authentication only proves WHO the user is.
 * It is separate from User Context because User Context only tracks runtime identity.
 * Worker Profile holds the extended domain information about the worker.
 * 
 * Worker Repository exclusively owns persistence, SQL, and storage retrieval.
 * Worker Profile Engine must NEVER execute SQL or interface directly with SQLite.
 * 
 * Refresh operations must be atomic to ensure the application never experiences
 * a partial or missing profile state during a background update.
 */
let initialized = false;
let lifecycle = WorkerProfileLifecycle.EMPTY;
let currentProfile: WorkerProfile | null = null;
let lastLoadedAt: string | undefined;

const DEFAULT_STATUS = Object.freeze({
  initialized: false,
  lifecycle: WorkerProfileLifecycle.EMPTY,
  lastLoadedAt: undefined
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
  if (lifecycle !== WorkerProfileLifecycle.CLEARED && lifecycle !== WorkerProfileLifecycle.EMPTY) {
    lifecycle = WorkerProfileLifecycle.CLEARED;
  }
  currentProfile = null;
  lastLoadedAt = undefined;
}

function transitionTo(newLifecycle: WorkerProfileLifecycle): void {
  // Enforce valid transitions
  const valid = (
    (lifecycle === WorkerProfileLifecycle.EMPTY && (newLifecycle === WorkerProfileLifecycle.LOADING || newLifecycle === WorkerProfileLifecycle.CLEARED)) ||
    (lifecycle === WorkerProfileLifecycle.CLEARED && (newLifecycle === WorkerProfileLifecycle.LOADING || newLifecycle === WorkerProfileLifecycle.EMPTY)) ||
    (lifecycle === WorkerProfileLifecycle.LOADING && (newLifecycle === WorkerProfileLifecycle.READY || newLifecycle === WorkerProfileLifecycle.CLEARED)) ||
    (lifecycle === WorkerProfileLifecycle.READY && (newLifecycle === WorkerProfileLifecycle.REFRESHING || newLifecycle === WorkerProfileLifecycle.CLEARED)) ||
    (lifecycle === WorkerProfileLifecycle.REFRESHING && (newLifecycle === WorkerProfileLifecycle.READY || newLifecycle === WorkerProfileLifecycle.CLEARED))
  );

  if (!valid) {
    throw new WorkerProfileError(
      WorkerProfileErrorCode.LIFECYCLE_ERROR,
      `Worker Profile Engine: Invalid lifecycle transition from ${lifecycle} to ${newLifecycle}`
    );
  }

  lifecycle = newLifecycle;
}

function validateProfile(profile: Partial<WorkerProfile>): profile is WorkerProfile {
  if (
    !profile.workerId ||
    !profile.employeeCode ||
    !profile.displayName ||
    !profile.email ||
    !profile.role ||
    !profile.organization ||
    profile.active === undefined
  ) {
    return false;
  }
  return true;
}

function buildWorkerProfile(record: any, currentWorker: CurrentWorker): WorkerProfile {
  const rawProfile: WorkerProfile = {
    workerId: record.workerId,
    employeeCode: record.employeeCode || `EMP-${record.workerId.substring(0,6)}`,
    displayName: record.displayName || currentWorker.displayName || 'Unknown',
    email: record.email || currentWorker.email || '',
    role: (record.role || 'WORKER') as WorkerRole,
    organization: record.organization || 'Sapana',
    active: record.active !== undefined ? Boolean(record.active) : true
  };

  if (!validateProfile(rawProfile)) {
    throw new WorkerProfileError(
      WorkerProfileErrorCode.VALIDATION_ERROR,
      'Invalid profile data loaded from repository.'
    );
  }

  return rawProfile;
}

export const WorkerProfileEngine = {
  initialize(): void {
    clearInternal();
    initialized = true;
  },

  async load(): Promise<WorkerProfileResult> {
    if (!initialized) {
      throw new WorkerProfileError(
        WorkerProfileErrorCode.LIFECYCLE_ERROR,
        'Worker Profile Engine is not initialized'
      );
    }

    if (lifecycle !== WorkerProfileLifecycle.EMPTY && lifecycle !== WorkerProfileLifecycle.CLEARED) {
      throw new WorkerProfileError(
        WorkerProfileErrorCode.LIFECYCLE_ERROR,
        `Worker Profile Engine: Cannot load from state ${lifecycle}`
      );
    }

    transitionTo(WorkerProfileLifecycle.LOADING);

    try {
      const currentWorker = UserContextEngine.currentWorker();
      
      if (!currentWorker) {
        throw new WorkerProfileError(
          WorkerProfileErrorCode.UNAUTHENTICATED,
          'No authenticated user context found'
        );
      }

      const record = await WorkerRepository.findById(currentWorker.id);

      if (!record) {
        return deepCloneAndFreeze({
          success: false,
          error: 'Profile not found',
          errorCode: WorkerProfileErrorCode.PROFILE_NOT_FOUND
        });
      }

      const rawProfile = buildWorkerProfile(record, currentWorker);

      currentProfile = deepCloneAndFreeze(rawProfile);
      lastLoadedAt = new Date().toISOString();
      
      transitionTo(WorkerProfileLifecycle.READY);

      return deepCloneAndFreeze({ success: true });
    } catch (error: any) {
      clearInternal(); // Reverts to CLEARED
      return deepCloneAndFreeze({
        success: false,
        error: error.message || String(error),
        errorCode: error instanceof WorkerProfileError ? error.code : WorkerProfileErrorCode.UNKNOWN_ERROR
      });
    }
  },

  async refresh(): Promise<WorkerProfileResult> {
    if (!initialized) {
      throw new WorkerProfileError(
        WorkerProfileErrorCode.LIFECYCLE_ERROR,
        'Worker Profile Engine is not initialized'
      );
    }

    if (lifecycle !== WorkerProfileLifecycle.READY) {
      throw new WorkerProfileError(
        WorkerProfileErrorCode.LIFECYCLE_ERROR,
        `Worker Profile Engine: Cannot refresh from state ${lifecycle}`
      );
    }

    transitionTo(WorkerProfileLifecycle.REFRESHING);

    try {
      const currentWorker = UserContextEngine.currentWorker();
      
      if (!currentWorker) {
        throw new WorkerProfileError(
          WorkerProfileErrorCode.UNAUTHENTICATED,
          'No authenticated user context found'
        );
      }

      const record = await WorkerRepository.findById(currentWorker.id);

      if (!record) {
        // Revert to READY, do not clear
        transitionTo(WorkerProfileLifecycle.READY);
        return deepCloneAndFreeze({
          success: false,
          error: 'Profile not found',
          errorCode: WorkerProfileErrorCode.PROFILE_NOT_FOUND
        });
      }

      const rawProfile = buildWorkerProfile(record, currentWorker);

      // Replace current profile only after successful construction and validation
      currentProfile = deepCloneAndFreeze(rawProfile);
      lastLoadedAt = new Date().toISOString();
      
      transitionTo(WorkerProfileLifecycle.READY);

      return deepCloneAndFreeze({ success: true });
    } catch (error: any) {
      // Revert to READY, do not clear
      transitionTo(WorkerProfileLifecycle.READY);
      return deepCloneAndFreeze({
        success: false,
        error: error.message || String(error),
        errorCode: error instanceof WorkerProfileError ? error.code : WorkerProfileErrorCode.UNKNOWN_ERROR
      });
    }
  },

  clear(): void {
    clearInternal();
  },

  status(): WorkerProfileStatus {
    if (!initialized) {
      return DEFAULT_STATUS;
    }
    
    try {
      return deepCloneAndFreeze({
        initialized,
        lifecycle,
        lastLoadedAt
      });
    } catch {
      return DEFAULT_STATUS;
    }
  },

  profile(): WorkerProfile | null {
    if (lifecycle !== WorkerProfileLifecycle.READY && lifecycle !== WorkerProfileLifecycle.REFRESHING) {
      return null;
    }

    if (!currentProfile) {
      return null;
    }

    // Defensive final runtime validation
    if (!validateProfile(currentProfile)) {
      return null;
    }

    return currentProfile;
  }
};
