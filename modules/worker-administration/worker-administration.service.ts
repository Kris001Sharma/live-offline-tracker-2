import { WorkerRepository, WorkerRepositoryErrorCode, WorkerRepositoryError } from '../repositories';
import { WorkerSyncEngine } from '../worker-sync';
import {
  WorkerAdminLifecycle,
  WorkerAdminStatus,
  WorkerAdminResult,
  WorkerAdminErrorCode,
  WorkerAdminError,
  WorkerAdminOperationType,
  WorkerCreationPayload,
  WorkerUpdatePayload,
  WorkerAdminRecord
} from './worker-administration.types';

let initialized = false;
let lifecycle = WorkerAdminLifecycle.IDLE;
let lastOperationAt: string | undefined;
let lastSuccessfulOperationAt: string | undefined;
let lastFailedOperationAt: string | undefined;
let lastOperationType: WorkerAdminOperationType | undefined;
let consecutiveFailures = 0;

let pendingSync = false;
let lastSyncNotificationAt: string | undefined;


const DEFAULT_STATUS = Object.freeze({
  initialized: false,
  lifecycle: WorkerAdminLifecycle.IDLE,
  consecutiveFailures: 0,
  pendingSync: false,
  lastSyncNotificationAt: undefined
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
  lifecycle = WorkerAdminLifecycle.IDLE;
  lastOperationAt = undefined;
  lastSuccessfulOperationAt = undefined;
  lastFailedOperationAt = undefined;
  lastOperationType = undefined;
  consecutiveFailures = 0;
  pendingSync = false;
  lastSyncNotificationAt = undefined;
}

function transitionTo(newLifecycle: WorkerAdminLifecycle): void {
  const valid = (
    (lifecycle === WorkerAdminLifecycle.IDLE && newLifecycle === WorkerAdminLifecycle.PROCESSING) ||
    (lifecycle === WorkerAdminLifecycle.PROCESSING && newLifecycle === WorkerAdminLifecycle.IDLE)
  );

  if (!valid) {
    throw new WorkerAdminError(
      WorkerAdminErrorCode.ALREADY_PROCESSING,
      `Worker Admin Engine: Invalid lifecycle transition from ${lifecycle} to ${newLifecycle}`
    );
  }

  lifecycle = newLifecycle;
}

function recordOperationStart(type: WorkerAdminOperationType): void {
  transitionTo(WorkerAdminLifecycle.PROCESSING);
  lastOperationAt = new Date().toISOString();
  lastOperationType = type;
}

function recordOperationSuccess(): void {
  lastSuccessfulOperationAt = new Date().toISOString();
  consecutiveFailures = 0;
  transitionTo(WorkerAdminLifecycle.IDLE);
}

function recordOperationFailure(): void {
  lastFailedOperationAt = new Date().toISOString();
  consecutiveFailures++;
  transitionTo(WorkerAdminLifecycle.IDLE);
}

function mapRepositoryError(error: any): WorkerAdminErrorCode {
  if (error instanceof WorkerRepositoryError) {
    switch (error.code) {
      case WorkerRepositoryErrorCode.WORKER_NOT_FOUND:
        return WorkerAdminErrorCode.WORKER_NOT_FOUND;
      case WorkerRepositoryErrorCode.WORKER_ALREADY_EXISTS:
        return WorkerAdminErrorCode.WORKER_ALREADY_EXISTS;
      case WorkerRepositoryErrorCode.STORAGE_ERROR:
        return WorkerAdminErrorCode.STORAGE_ERROR;
      default:
        return WorkerAdminErrorCode.UNKNOWN_ERROR;
    }
  }
  return WorkerAdminErrorCode.UNKNOWN_ERROR;
}



function validateState(): WorkerAdminResult<any> | null {
  if (!initialized) {
    return deepCloneAndFreeze({
      success: false,
      error: 'Engine not initialized',
      errorCode: WorkerAdminErrorCode.UNINITIALIZED
    });
  }
  if (lifecycle !== WorkerAdminLifecycle.IDLE) {
    return deepCloneAndFreeze({
      success: false,
      error: 'Engine is already processing an operation',
      errorCode: WorkerAdminErrorCode.ALREADY_PROCESSING
    });
  }
  return null;
}

function validateWorkerId(workerId: string): WorkerAdminResult<any> | null {
  if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
    return deepCloneAndFreeze({
      success: false,
      error: 'Validation failed: workerId is required and must be a valid string',
      errorCode: WorkerAdminErrorCode.VALIDATION_ERROR
    });
  }
  return null;
}

function validateEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validateCreatePayload(payload: WorkerCreationPayload): WorkerAdminResult<any> | null {
  const idError = validateWorkerId(payload.workerId);
  if (idError) return idError;

  if (!payload.email || !validateEmail(payload.email)) {
    return deepCloneAndFreeze({
      success: false,
      error: 'Validation failed: email is required and must be a valid email format',
      errorCode: WorkerAdminErrorCode.VALIDATION_ERROR
    });
  }

  if (!payload.displayName || typeof payload.displayName !== 'string' || payload.displayName.trim() === '') {
    return deepCloneAndFreeze({
      success: false,
      error: 'Validation failed: displayName is required and must not be empty',
      errorCode: WorkerAdminErrorCode.VALIDATION_ERROR
    });
  }

  if (!payload.role || typeof payload.role !== 'string' || payload.role.trim() === '') {
    return deepCloneAndFreeze({
      success: false,
      error: 'Validation failed: role is required and must not be empty',
      errorCode: WorkerAdminErrorCode.VALIDATION_ERROR
    });
  }

  return null;
}

function validateUpdatePayload(workerId: string, payload: WorkerUpdatePayload): WorkerAdminResult<any> | null {
  const idError = validateWorkerId(workerId);
  if (idError) return idError;

  if (payload.email !== undefined && !validateEmail(payload.email)) {
    return deepCloneAndFreeze({
      success: false,
      error: 'Validation failed: email must be a valid email format if provided',
      errorCode: WorkerAdminErrorCode.VALIDATION_ERROR
    });
  }

  if (payload.displayName !== undefined && (typeof payload.displayName !== 'string' || payload.displayName.trim() === '')) {
    return deepCloneAndFreeze({
      success: false,
      error: 'Validation failed: displayName cannot be empty if provided',
      errorCode: WorkerAdminErrorCode.VALIDATION_ERROR
    });
  }

  if (payload.role !== undefined && (typeof payload.role !== 'string' || payload.role.trim() === '')) {
    return deepCloneAndFreeze({
      success: false,
      error: 'Validation failed: role cannot be empty if provided',
      errorCode: WorkerAdminErrorCode.VALIDATION_ERROR
    });
  }

  return null;
}

function notifySync(): void {
  pendingSync = true;
  lastSyncNotificationAt = new Date().toISOString();
  
  // Asynchronous fire-and-forget
  Promise.resolve().then(async () => {
    try {
      await WorkerSyncEngine.sync();
      // We don't change pendingSync on success or failure, because this is just metadata in Admin engine.
    } catch (e) {
      // Intentionally swallow errors to keep notification non-blocking
    }
  });
}

export const WorkerAdminEngine = {
  initialize(): void {
    clearInternal();
    initialized = true;
  },

  async createWorker(payload: WorkerCreationPayload): Promise<WorkerAdminResult<WorkerAdminRecord>> {
    const stateError = validateState();
    if (stateError) return stateError;

    const validationError = validateCreatePayload(payload);
    if (validationError) return validationError;

    recordOperationStart(WorkerAdminOperationType.CREATE);

    try {
      const record = await WorkerRepository.create({
        workerId: payload.workerId,
        email: payload.email,
        displayName: payload.displayName,
        role: payload.role,
        employeeCode: payload.employeeCode,
        organization: payload.organization,
        active: payload.active !== undefined ? payload.active : true
      });

      recordOperationSuccess();
      notifySync();

      return deepCloneAndFreeze({
        success: true,
        data: record as WorkerAdminRecord
      });
    } catch (error: any) {
      recordOperationFailure();
      return deepCloneAndFreeze({
        success: false,
        error: error.message || String(error),
        errorCode: mapRepositoryError(error)
      });
    }
  },

  async updateWorker(workerId: string, payload: WorkerUpdatePayload): Promise<WorkerAdminResult<WorkerAdminRecord>> {
    const stateError = validateState();
    if (stateError) return stateError;

    const validationError = validateUpdatePayload(workerId, payload);
    if (validationError) return validationError;

    recordOperationStart(WorkerAdminOperationType.UPDATE);

    try {
      const existing = await WorkerRepository.findById(workerId);
      if (!existing) {
        throw new WorkerRepositoryError(WorkerRepositoryErrorCode.WORKER_NOT_FOUND, 'Worker not found');
      }

      // Map payload to repository update payload implicitly
      const record = await WorkerRepository.update(workerId, {
        email: payload.email, // If repository update payload supports email
        displayName: payload.displayName,
        role: payload.role,
        employeeCode: payload.employeeCode,
        organization: payload.organization,
        active: payload.active
      } as any);
      
      recordOperationSuccess();
      notifySync();

      return deepCloneAndFreeze({
        success: true,
        data: record as WorkerAdminRecord
      });
    } catch (error: any) {
      recordOperationFailure();
      return deepCloneAndFreeze({
        success: false,
        error: error.message || String(error),
        errorCode: mapRepositoryError(error)
      });
    }
  },

  async deactivateWorker(workerId: string): Promise<WorkerAdminResult<WorkerAdminRecord>> {
    return this.updateWorker(workerId, { active: false });
  },

  async getWorker(workerId: string): Promise<WorkerAdminResult<WorkerAdminRecord>> {
    const stateError = validateState();
    if (stateError) return stateError;

    const idError = validateWorkerId(workerId);
    if (idError) return idError;

    recordOperationStart(WorkerAdminOperationType.GET);

    try {
      const record = await WorkerRepository.findById(workerId);
      
      if (!record) {
        throw new WorkerRepositoryError(WorkerRepositoryErrorCode.WORKER_NOT_FOUND, 'Worker not found');
      }

      recordOperationSuccess();

      return deepCloneAndFreeze({
        success: true,
        data: record as WorkerAdminRecord
      });
    } catch (error: any) {
      recordOperationFailure();
      return deepCloneAndFreeze({
        success: false,
        error: error.message || String(error),
        errorCode: mapRepositoryError(error)
      });
    }
  },

  async listWorkers(): Promise<WorkerAdminResult<WorkerAdminRecord[]>> {
    const stateError = validateState();
    if (stateError) return stateError;

    recordOperationStart(WorkerAdminOperationType.LIST);

    try {
      const records = await WorkerRepository.list();
      
      recordOperationSuccess();

      return deepCloneAndFreeze({
        success: true,
        data: records as WorkerAdminRecord[]
      });
    } catch (error: any) {
      recordOperationFailure();
      return deepCloneAndFreeze({
        success: false,
        error: error.message || String(error),
        errorCode: mapRepositoryError(error)
      });
    }
  },

  status(): WorkerAdminStatus {
    if (!initialized) {
      return DEFAULT_STATUS;
    }
    
    try {
      return deepCloneAndFreeze({
        initialized,
        lifecycle,
        lastOperationAt,
        lastSuccessfulOperationAt,
        lastFailedOperationAt,
        lastOperationType,
        consecutiveFailures,
        pendingSync,
        lastSyncNotificationAt
      });
    } catch {
      return DEFAULT_STATUS;
    }
  },

  clear(): void {
    clearInternal();
  }
};
