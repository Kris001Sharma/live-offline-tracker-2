import { UserContextEngine } from '../user-context';
import { TrustedDeviceEngine } from '../trusted-device';
import { TrustedDeviceRepository, TrustedDeviceRecord } from '../repositories';
import { 
  TrustedDeviceRegistrationStatus, 
  DeviceVerificationState,
  RegistrationStatus, 
  TrustedDeviceRegistrationResult,
  TrustedDeviceRegistrationResultCode
} from './trusted-device-registration.types';

/**
 * Deep clones and deep freezes an object recursively to ensure immutability.
 */
function deepCloneAndFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (obj instanceof Date) {
    return obj;
  }

  if (Array.isArray(obj)) {
    const arrCopy = obj.map(item => deepCloneAndFreeze(item));
    return Object.freeze(arrCopy) as unknown as T;
  }

  const copy: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepCloneAndFreeze((obj as Record<string, any>)[key]);
    }
  }

  return Object.freeze(copy) as unknown as T;
}

/**
 * Defensive validation for worker identity.
 */
function isValidWorker(worker: any): boolean {
  return Boolean(
    worker &&
    typeof worker.id === 'string' && worker.id.trim().length > 0 &&
    typeof worker.email === 'string' && worker.email.trim().length > 0 &&
    typeof worker.displayName === 'string' && worker.displayName.trim().length > 0 &&
    typeof worker.role === 'string' && worker.role.trim().length > 0
  );
}

/**
 * Defensive validation for device identity.
 */
function isValidDevice(device: any): boolean {
  return Boolean(
    device &&
    typeof device.deviceId === 'string' && device.deviceId.trim().length > 0 &&
    typeof device.manufacturer === 'string' && device.manufacturer.trim().length > 0 &&
    typeof device.model === 'string' && device.model.trim().length > 0 &&
    typeof device.platform === 'string' && device.platform.trim().length > 0 &&
    typeof device.appVersion === 'string' && device.appVersion.trim().length > 0
  );
}

/**
 * Transient registration state variable used during orchestration.
 */
let transientRegistrationState: Record<string, any> | null = null;

/**
 * Private helper to perform registration state rollback.
 * Executed on every registration failure path (precondition failure, duplicate conflict, repository exception, unexpected exception).
 * Guarantees that temporary runtime registration state is restored and atomicity is preserved.
 */
function rollbackRegistration(): void {
  transientRegistrationState = null;
}

export const TrustedDeviceRegistrationEngine = {
  initialize(): void {
    rollbackRegistration();
  },

  async status(): Promise<RegistrationStatus> {
    console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.status: START');
    try {
      const worker = UserContextEngine.currentWorker();
      const device = TrustedDeviceEngine.device();
      console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.status: inputs', {
        worker: worker ? { id: worker.id, email: worker.email } : null,
        device: device ? { deviceId: device.deviceId, platform: device.platform } : null
      });

      if (!isValidWorker(worker) || !isValidDevice(device)) {
        console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.status: PRECONDITION NOT MET (invalid worker or device)');
        return deepCloneAndFreeze({
          status: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
          verification: DeviceVerificationState.ERROR
        });
      }

      const thisDevice = await TrustedDeviceRepository.findByWorkerAndDevice(worker!.id, device!.deviceId);
      const approvedDevice = await TrustedDeviceRepository.findApprovedByWorker(worker!.id);
      console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.status: repository lookup', {
        thisDevice: thisDevice ? { status: thisDevice.status } : null,
        approvedDevice: approvedDevice ? { deviceId: approvedDevice.deviceId } : null
      });

      // No active trusted device for this worker.
      if (!approvedDevice) {
        const recordStatus = thisDevice?.status === 'PENDING_APPROVAL' || thisDevice?.status === 'REJECTED'
          ? (thisDevice.status as unknown as TrustedDeviceRegistrationStatus)
          : TrustedDeviceRegistrationStatus.NOT_REGISTERED;

        return deepCloneAndFreeze({
          status: recordStatus,
          verification: DeviceVerificationState.NOT_REGISTERED
        });
      }

      // An active trusted device exists.
      if (approvedDevice.deviceId === device!.deviceId) {
        return deepCloneAndFreeze({
          status: TrustedDeviceRegistrationStatus.APPROVED,
          verification: DeviceVerificationState.TRUSTED
        });
      }

      // A different active trusted device exists; this device is blocked.
      return deepCloneAndFreeze({
        status: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
        verification: DeviceVerificationState.DIFFERENT_DEVICE
      });
    } catch (e) {
      console.error('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.status: ERROR', e);
      return deepCloneAndFreeze({
        status: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
        verification: DeviceVerificationState.ERROR
      });
    }
  },

  async registerCurrentDevice(): Promise<TrustedDeviceRegistrationResult> {
    console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: START');
    try {
      transientRegistrationState = { stage: 'EVALUATING', timestamp: new Date().toISOString() };

      // Defensive Runtime Validation: Worker check
      const worker = UserContextEngine.currentWorker();
      console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: worker', worker ? { id: worker.id, email: worker.email } : null);
      if (!isValidWorker(worker)) {
        console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: PRECONDITION_FAILED (invalid worker)');
        rollbackRegistration();
        return deepCloneAndFreeze({
          success: false,
          code: TrustedDeviceRegistrationResultCode.PRECONDITION_FAILED,
          error: 'No active worker or missing mandatory worker identifiers in User Context'
        });
      }

      // Defensive Runtime Validation: Device check
      const device = TrustedDeviceEngine.device();
      console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: device', device);
      if (!isValidDevice(device)) {
        console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: PRECONDITION_FAILED (invalid device)');
        rollbackRegistration();
        return deepCloneAndFreeze({
          success: false,
          code: TrustedDeviceRegistrationResultCode.PRECONDITION_FAILED,
          error: 'No active device identity or missing mandatory device identifiers in Trusted Device Engine'
        });
      }

      // Repository Ownership: Lookup existing registration for worker and device
      const thisDeviceRegistration = await TrustedDeviceRepository.findByWorkerAndDevice(worker!.id, device!.deviceId);
      console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: thisDeviceRegistration', thisDeviceRegistration);

      if (thisDeviceRegistration) {
        if (thisDeviceRegistration.status === 'APPROVED') {
          console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: ALREADY APPROVED');
          rollbackRegistration();
          return deepCloneAndFreeze({
            success: true,
            code: TrustedDeviceRegistrationResultCode.APPROVED
          });
        }
        if (thisDeviceRegistration.status === 'REJECTED') {
          console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: REJECTED');
          rollbackRegistration();
          return deepCloneAndFreeze({
            success: false,
            code: TrustedDeviceRegistrationResultCode.PRECONDITION_FAILED,
            error: 'Device is rejected.'
          });
        }
      }

      // Repository Ownership: Check if worker already has an active trusted device (different device)
      const approvedDevice = await TrustedDeviceRepository.findApprovedByWorker(worker!.id);
      console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: approvedDevice', approvedDevice);
      if (approvedDevice) {
        console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: DEVICE_MISMATCH');
        rollbackRegistration();
        return deepCloneAndFreeze({
          success: false,
          code: TrustedDeviceRegistrationResultCode.DEVICE_MISMATCH,
          error: 'Worker already has an active trusted device.'
        });
      }

      // No active trusted device: the current device becomes the worker's active trusted device.
      const uuid = typeof crypto !== 'undefined' && crypto.randomUUID 
        ? crypto.randomUUID() 
        : Math.random().toString(36).substring(2, 15);
      console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: registering', { workerId: worker!.id, deviceId: device!.deviceId, uuid });

      await TrustedDeviceRepository.registerActive({
        id: uuid,
        workerId: worker!.id,
        deviceId: device!.deviceId,
        manufacturer: device!.manufacturer,
        model: device!.model,
        platform: device!.platform,
        appVersion: device!.appVersion,
        registeredAt: new Date().toISOString()
      });

      transientRegistrationState = null;
      console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: SUCCESS');

      return deepCloneAndFreeze({
        success: true,
        code: TrustedDeviceRegistrationResultCode.SUCCESS
      });

    } catch (error: any) {
      console.error('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: PERSISTENCE_ERROR', error);
      rollbackRegistration();
      return deepCloneAndFreeze({
        success: false,
        code: TrustedDeviceRegistrationResultCode.PERSISTENCE_ERROR,
        error: 'PERSISTENCE_ERROR'
      });
    }
  },

  async registration(): Promise<TrustedDeviceRecord | null> {
    try {
      const worker = UserContextEngine.currentWorker();
      const device = TrustedDeviceEngine.device();
      
      if (!isValidWorker(worker) || !isValidDevice(device)) {
        return null;
      }

      const record = await TrustedDeviceRepository.findByWorkerAndDevice(worker!.id, device!.deviceId);
      return record ? deepCloneAndFreeze(record) : null;
    } catch {
      return null;
    }
  },

  /**
   * Administrator reset: revokes the worker's active trusted device.
   *
   * After the reset the worker has no active trusted device and may register
   * a new device on the next login. Historical records are preserved with the
   * REVOKED status for audit/history. Idempotent when no active device exists.
   */
  async resetActiveDevice(workerId: string): Promise<TrustedDeviceRegistrationResult> {
    if (!workerId || typeof workerId !== 'string' || workerId.trim() === '') {
      return deepCloneAndFreeze({
        success: false,
        code: TrustedDeviceRegistrationResultCode.PRECONDITION_FAILED,
        error: 'workerId is required.'
      });
    }

    try {
      await TrustedDeviceRepository.resetActive(workerId.trim());
      return deepCloneAndFreeze({
        success: true,
        code: TrustedDeviceRegistrationResultCode.SUCCESS
      });
    } catch (error: any) {
      return deepCloneAndFreeze({
        success: false,
        code: TrustedDeviceRegistrationResultCode.PERSISTENCE_ERROR,
        error: 'PERSISTENCE_ERROR'
      });
    }
  },

  clear(): void {
    rollbackRegistration();
  }
};
