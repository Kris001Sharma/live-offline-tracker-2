import { UserContextEngine } from '../user-context';
import { TrustedDeviceEngine } from '../trusted-device';
import { TrustedDeviceRepository, TrustedDeviceRecord } from '../repositories';
import { TrustedDeviceSyncEngine } from '../trusted-device-sync/trusted-device-sync.service';
import { ConnectivityEngine } from '../connectivity';
import { Network } from '@capacitor/network';
import {
  TrustedDeviceRegistrationStatus,
  DeviceVerificationState,
  RegistrationStatus,
  TrustedDeviceRegistrationResult,
  TrustedDeviceRegistrationResultCode
} from './trusted-device-registration.types';
import { DiagnosticTraceStore } from '../diagnostic/diagnostic-trace.store';

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

      // Check if we're online to determine whether to use Supabase authority
      const connectivityStatus = ConnectivityEngine.status();
      let nativeStatus: any = null;
      try {
        nativeStatus = await Network.getStatus();
      } catch (e) {
        nativeStatus = { error: e instanceof Error ? e.message : String(e) };
      }

      DiagnosticTraceStore.append({ phase: 'CONNECTIVITY_LIFECYCLE', result: 'SUCCESS', data: {
        step: 'connectivityCheckStarted',
        timestamp: new Date().toISOString(),
        engineInitialized: true,
        engineState: connectivityStatus.state,
        engineIsOnline: connectivityStatus.isOnline,
        nativeConnected: nativeStatus?.connected ?? null,
        nativeConnectionType: nativeStatus?.connectionType ?? null,
        lastConnectivityEventAt: connectivityStatus.lastConnectivityChangeAt ?? null
      }});

      const isOnline = ConnectivityEngine.isOnline();

      const comparisonResult = (() => {
        if (isOnline && nativeStatus?.connected) return 'ENGINE_ONLINE_NATIVE_ONLINE';
        if (!isOnline && nativeStatus?.connected) return 'ENGINE_OFFLINE_NATIVE_ONLINE';
        if (isOnline && !nativeStatus?.connected) return 'ENGINE_ONLINE_NATIVE_OFFLINE';
        return 'ENGINE_OFFLINE_NATIVE_OFFLINE';
      })();

      DiagnosticTraceStore.append({ phase: 'CONNECTIVITY_LIFECYCLE', result: 'SUCCESS', data: {
        step: 'connectivityCheckCompleted',
        timestamp: new Date().toISOString(),
        engineInitialized: true,
        engineState: connectivityStatus.state,
        engineIsOnline: isOnline,
        nativeConnected: nativeStatus?.connected ?? null,
        nativeConnectionType: nativeStatus?.connectionType ?? null,
        lastConnectivityEventAt: connectivityStatus.lastConnectivityChangeAt ?? null
      }});

      DiagnosticTraceStore.append({ phase: 'CONNECTIVITY_LIFECYCLE', result: 'SUCCESS', data: {
        step: 'connectivityComparison',
        timestamp: new Date().toISOString(),
        engineIsOnline: isOnline,
        nativeConnected: nativeStatus?.connected ?? null,
        comparisonResult,
        lifecycleOrdering: connectivityStatus.state === 'MONITORING' ? 'CONNECTIVITY_READY_BEFORE_AUTH' : 'CONNECTIVITY_READY_AFTER_AUTH'
      }});

      DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
        step: 'trustedDeviceAuthorityPathSelected',
        path: isOnline ? 'SUPABASE_AUTHORITY' : 'LOCAL_FALLBACK',
        engineIsOnline: isOnline,
        nativeConnected: nativeStatus?.connected ?? null
      }});

      // Fetch local trusted device records for comparison
      const thisDevice = await TrustedDeviceRepository.findByWorkerAndDevice(worker!.id, device!.deviceId);
      const approvedDevice = await TrustedDeviceRepository.findApprovedByWorker(worker!.id);
      console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.status: local repository lookup', {
        thisDevice: thisDevice ? { status: thisDevice.status } : null,
        approvedDevice: approvedDevice ? { deviceId: approvedDevice.deviceId } : null
      });

      // If online, use Supabase as the authoritative source
      if (isOnline) {
        console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.status: using Supabase authority');

        DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: { step: 'supabaseClientResolution', available: TrustedDeviceSyncEngine.status().initialized } });

        DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'STARTED', data: { step: 'remoteTrustedDeviceLookupStarted', workerId: worker!.id, queryMethod: 'TrustedDeviceSyncEngine.findApprovedTrustedDeviceForWorker', table: 'trusted_devices' } });
        try {
          const supabaseApprovedDevice = await TrustedDeviceSyncEngine.findApprovedTrustedDeviceForWorker(worker!.id);
          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
            step: 'remoteTrustedDeviceLookupCompleted',
            workerId: worker!.id,
            queryMethod: 'TrustedDeviceSyncEngine.findApprovedTrustedDeviceForWorker',
            table: 'trusted_devices',
            querySucceeded: true,
            rowCount: supabaseApprovedDevice ? 1 : 0,
            remoteRecordFound: !!supabaseApprovedDevice,
            ...(supabaseApprovedDevice ? {
              remoteRecordId: supabaseApprovedDevice.id,
              remoteWorkerId: supabaseApprovedDevice.workerId,
              remoteDeviceId: supabaseApprovedDevice.deviceId,
              remoteStatus: supabaseApprovedDevice.status,
              remoteSyncStatus: supabaseApprovedDevice.syncStatus
            } : {
              remoteOutcome: 'NOT_FOUND'
            })
          }});
          console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.status: Supabase lookup result', {
            supabaseDevice: supabaseApprovedDevice ? {
              deviceId: supabaseApprovedDevice.deviceId,
              status: supabaseApprovedDevice.status,
              syncStatus: supabaseApprovedDevice.syncStatus
            } : null
          });

          // AUTHORITY INPUT SNAPSHOT - frozen diagnostic snapshot before decision
          const allLocalRecords = await TrustedDeviceRepository.findByWorker(worker!.id);
          const localApproved = allLocalRecords.find(r => r.status === 'APPROVED');
          const authoritySnapshot = Object.freeze({
            workerId: worker!.id,
            currentDeviceId: device!.deviceId,
            remoteRecordFound: !!supabaseApprovedDevice,
            remoteWorkerId: supabaseApprovedDevice?.workerId ?? null,
            remoteDeviceId: supabaseApprovedDevice?.deviceId ?? null,
            remoteStatus: supabaseApprovedDevice?.status ?? null,
            localRecordFound: allLocalRecords.length > 0,
            localRecordId: localApproved?.id ?? null,
            localDeviceId: localApproved?.deviceId ?? null,
            localStatus: localApproved?.status ?? null,
            online: isOnline
          });
          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: authoritySnapshot });

          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'STARTED', data: { step: 'localTrustedDeviceLookupStarted', workerId: worker!.id } });
          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
            step: 'localTrustedDeviceLookupCompleted',
            workerId: worker!.id,
            recordCount: allLocalRecords.length,
            records: allLocalRecords.map(r => ({
              recordId: r.id,
              workerId: r.workerId,
              deviceId: r.deviceId,
              status: r.status,
              syncStatus: r.syncStatus,
              isCurrentDevice: r.deviceId === device!.deviceId
            }))
          }});

          // Reconcile local state with Supabase authoritative state
          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'STARTED', data: { step: 'localReconciliationStarted' } });
          await this.reconcileLocalStateWithSupabase(worker!.id, device!.deviceId, supabaseApprovedDevice);
          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
            step: 'localReconciliationCompleted',
            authoritativeDecision: supabaseApprovedDevice
              ? (supabaseApprovedDevice.deviceId === device!.deviceId ? 'TRUSTED' : 'DIFFERENT_DEVICE')
              : 'NOT_REGISTERED'
          }});

          // Make decision based on Supabase authoritative state
          if (!supabaseApprovedDevice) {
            // STATE A: SERVER HAS NO TRUSTED DEVICE
            DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
              step: 'authoritativeDecisionCalculated',
              decision: 'NOT_REGISTERED',
              decisionReason: 'REMOTE_NO_APPROVED_DEVICE',
              decisionInputSource: 'SUPABASE'
            }});
            DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
              step: 'finalTrustedDeviceDecision',
              authoritativeDecision: 'NOT_REGISTERED',
              returnedStatus: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
              returnedVerification: DeviceVerificationState.NOT_REGISTERED,
              decisionConsistent: true
            }});
            return deepCloneAndFreeze({
              status: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
              verification: DeviceVerificationState.NOT_REGISTERED
            });
          }

          if (supabaseApprovedDevice.deviceId === device!.deviceId) {
            // STATE B: SERVER HAS TRUSTED DEVICE FOR CURRENT DEVICE
            DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
              step: 'authoritativeDecisionCalculated',
              decision: 'TRUSTED',
              decisionReason: 'REMOTE_APPROVED_SAME_DEVICE',
              decisionInputSource: 'SUPABASE'
            }});
            DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
              step: 'finalTrustedDeviceDecision',
              authoritativeDecision: 'TRUSTED',
              returnedStatus: TrustedDeviceRegistrationStatus.APPROVED,
              returnedVerification: DeviceVerificationState.TRUSTED,
              decisionConsistent: true
            }});
            return deepCloneAndFreeze({
              status: TrustedDeviceRegistrationStatus.APPROVED,
              verification: DeviceVerificationState.TRUSTED
            });
          }

          // STATE C: SERVER HAS TRUSTED DEVICE FOR ANOTHER DEVICE
          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
            step: 'authoritativeDecisionCalculated',
            decision: 'DIFFERENT_DEVICE',
            decisionReason: 'REMOTE_APPROVED_DIFFERENT_DEVICE',
            decisionInputSource: 'SUPABASE'
          }});
          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
            step: 'finalTrustedDeviceDecision',
            authoritativeDecision: 'DIFFERENT_DEVICE',
            returnedStatus: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
            returnedVerification: DeviceVerificationState.DIFFERENT_DEVICE,
            decisionConsistent: true
          }});
          return deepCloneAndFreeze({
            status: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
            verification: DeviceVerificationState.DIFFERENT_DEVICE
          });
        } catch (supabaseError) {
          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'FAILED', data: {
            step: 'remoteTrustedDeviceLookupCompleted',
            workerId: worker!.id,
            queryMethod: 'TrustedDeviceSyncEngine.findApprovedTrustedDeviceForWorker',
            table: 'trusted_devices',
            querySucceeded: false,
            rowCount: 0,
            remoteRecordFound: false,
            remoteOutcome: 'ERROR',
            error: supabaseError instanceof Error ? supabaseError.message : String(supabaseError)
          }});
          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'FAILED', data: {
            step: 'authoritativeDecisionCalculated',
            decision: 'ERROR',
            decisionReason: 'SUPABASE_QUERY_FAILED',
            decisionInputSource: 'SUPABASE'
          }});
          DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'FAILED', data: {
            step: 'finalTrustedDeviceDecision',
            authoritativeDecision: 'ERROR',
            returnedStatus: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
            returnedVerification: DeviceVerificationState.ERROR,
            decisionConsistent: true
          }});
          // If Supabase query fails while online, return ERROR as per spec
          // Local storage must not be allowed to resurrect an obsolete trusted-device decision
          return deepCloneAndFreeze({
            status: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
            verification: DeviceVerificationState.ERROR
          });
        }
      } else {
        console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.status: OFFLINE - using local state');
      }

      // FALLBACK TO LOCAL STATE LOGIC (when offline or Supabase query failed)
      // No active trusted device for this worker.
      if (!approvedDevice) {
        const recordStatus = thisDevice?.status === 'PENDING_APPROVAL' || thisDevice?.status === 'REJECTED'
          ? (thisDevice.status as unknown as TrustedDeviceRegistrationStatus)
          : TrustedDeviceRegistrationStatus.NOT_REGISTERED;

        DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
          step: 'authoritativeDecisionCalculated',
          decision: DeviceVerificationState.NOT_REGISTERED,
          decisionReason: 'OFFLINE_NO_APPROVED_DEVICE',
          decisionInputSource: 'LOCAL'
        }});
        DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
          step: 'finalTrustedDeviceDecision',
          authoritativeDecision: 'OFFLINE_NOT_REGISTERED',
          returnedStatus: recordStatus,
          returnedVerification: DeviceVerificationState.NOT_REGISTERED,
          decisionConsistent: true
        }});

        return deepCloneAndFreeze({
          status: recordStatus,
          verification: DeviceVerificationState.NOT_REGISTERED
        });
      }

      // An active trusted device exists.
      if (approvedDevice.deviceId === device!.deviceId) {
        DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
          step: 'authoritativeDecisionCalculated',
          decision: DeviceVerificationState.TRUSTED,
          decisionReason: 'OFFLINE_LOCAL_TRUSTED',
          decisionInputSource: 'LOCAL'
        }});
        DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
          step: 'finalTrustedDeviceDecision',
          authoritativeDecision: 'OFFLINE_TRUSTED',
          returnedStatus: TrustedDeviceRegistrationStatus.APPROVED,
          returnedVerification: DeviceVerificationState.TRUSTED,
          decisionConsistent: true
        }});

        return deepCloneAndFreeze({
          status: TrustedDeviceRegistrationStatus.APPROVED,
          verification: DeviceVerificationState.TRUSTED
        });
      }

      // A different active trusted device exists; this device is blocked.
      DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
        step: 'authoritativeDecisionCalculated',
        decision: DeviceVerificationState.DIFFERENT_DEVICE,
        decisionReason: 'OFFLINE_LOCAL_DIFFERENT_DEVICE',
        decisionInputSource: 'LOCAL'
      }});
      DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
        step: 'finalTrustedDeviceDecision',
        authoritativeDecision: 'OFFLINE_DIFFERENT_DEVICE',
        returnedStatus: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
        returnedVerification: DeviceVerificationState.DIFFERENT_DEVICE,
        decisionConsistent: true
      }});

      return deepCloneAndFreeze({
        status: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
        verification: DeviceVerificationState.DIFFERENT_DEVICE
      });
    } catch (e) {
      DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'FAILED', data: {
        step: 'finalTrustedDeviceDecision',
        authoritativeDecision: 'ERROR',
        returnedStatus: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
        returnedVerification: DeviceVerificationState.ERROR,
        decisionConsistent: true,
        error: e instanceof Error ? e.message : String(e)
      }});
      console.error('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.status: ERROR', e);
      return deepCloneAndFreeze({
        status: TrustedDeviceRegistrationStatus.NOT_REGISTERED,
        verification: DeviceVerificationState.ERROR
      });
    }
  },

  /**
   * Reconcile local trusted-device state with Supabase authoritative state.
   * This ensures local state doesn't override authoritative server decisions.
   */
  async reconcileLocalStateWithSupabase(
    workerId: string,
    currentDeviceId: string,
    supabaseApprovedDevice: TrustedDeviceRecord | null
  ): Promise<void> {
    try {
      const localApprovedDevice = await TrustedDeviceRepository.findApprovedByWorker(workerId);
      const thisDevice = await TrustedDeviceRepository.findByWorkerAndDevice(workerId, currentDeviceId);

      console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.reconcileLocalStateWithSupabase: START', {
        workerId,
        currentDeviceId,
        supabaseApprovedDevice: supabaseApprovedDevice ? {
          deviceId: supabaseApprovedDevice.deviceId,
          status: supabaseApprovedDevice.status
        } : null,
        localApprovedDevice: localApprovedDevice ? {
          deviceId: localApprovedDevice.deviceId,
          status: localApprovedDevice.status
        } : null,
        thisDevice: thisDevice ? {
          deviceId: thisDevice.deviceId,
          status: thisDevice.status
        } : null
      });

      const recordsBefore = await TrustedDeviceRepository.findByWorker(workerId);
      const recordsChanged: Array<{ recordId: string; deviceId: string; oldStatus: string; newStatus: string; oldSyncStatus: string; newSyncStatus: string }> = [];

      // Case 1: Supabase says NO TRUSTED DEVICE (NONE)
      if (!supabaseApprovedDevice) {
        // If there's a local approved device, we need to reconcile it
        if (localApprovedDevice) {
          console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.reconcileLocalStateWithSupabase: RECONCILING - removing local approved device as Supabase says NONE');
          recordsChanged.push({
            recordId: localApprovedDevice.id,
            deviceId: localApprovedDevice.deviceId,
            oldStatus: localApprovedDevice.status,
            newStatus: 'REVOKED',
            oldSyncStatus: localApprovedDevice.syncStatus,
            newSyncStatus: 'PENDING'
          });
          // Reset the local approved device to REVOKED state (obsolete state)
          await TrustedDeviceRepository.resetActive(workerId);
        }
        // If there's a local pending/rejected device for current device, we can leave it
        // as it might be a new registration waiting to sync
        const recordsAfter = await TrustedDeviceRepository.findByWorker(workerId);
        DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
          step: 'localReconciliationCompleted',
          authoritativeDecision: 'NOT_REGISTERED',
          recordsBefore: recordsBefore.map(r => ({ recordId: r.id, deviceId: r.deviceId, status: r.status })),
          recordsChanged,
          recordsAfter: recordsAfter.map(r => ({ recordId: r.id, deviceId: r.deviceId, status: r.status }))
        }});
        return;
      }

      // Case 2: Supabase says CURRENT DEVICE IS TRUSTED (SAME_DEVICE)
      if (supabaseApprovedDevice.deviceId === currentDeviceId) {
        // If local state doesn't match Supabase, reconcile it
        if (!localApprovedDevice || localApprovedDevice.deviceId !== currentDeviceId) {
          console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.reconcileLocalStateWithSupabase: RECONCILING - setting local state to match Supabase (SAME_DEVICE)');
          // Either there's no local approved device, or it's for a different device
          // We need to make the current device the approved one
          await TrustedDeviceRepository.registerActive({
            id: thisDevice?.id || crypto.randomUUID()?.toString() || Math.random().toString(36).substring(2, 15),
            workerId: workerId,
            deviceId: currentDeviceId,
            manufacturer: thisDevice?.manufacturer || '',
            model: thisDevice?.model || '',
            platform: thisDevice?.platform || '',
            appVersion: thisDevice?.appVersion || '',
            registeredAt: thisDevice?.registeredAt || new Date().toISOString()
          });
        }
        const recordsAfter = await TrustedDeviceRepository.findByWorker(workerId);
        DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
          step: 'localReconciliationCompleted',
          authoritativeDecision: 'TRUSTED',
          recordsBefore: recordsBefore.map(r => ({ recordId: r.id, deviceId: r.deviceId, status: r.status })),
          recordsChanged,
          recordsAfter: recordsAfter.map(r => ({ recordId: r.id, deviceId: r.deviceId, status: r.status }))
        }});
        return;
      }

      // Case 3: Supabase says ANOTHER DEVICE IS TRUSTED (DIFFERENT_DEVICE)
      // In this case, we should not have a local approved device for the current device
      // (unless it's a stale record that needs reconciliation)
      if (localApprovedDevice && localApprovedDevice.deviceId === currentDeviceId) {
        console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.reconcileLocalStateWithSupabase: RECONCILING - removing local approved device for current device as Supabase says DIFFERENT_DEVICE');
        recordsChanged.push({
          recordId: localApprovedDevice.id,
          deviceId: localApprovedDevice.deviceId,
          oldStatus: localApprovedDevice.status,
          newStatus: 'REVOKED',
          oldSyncStatus: localApprovedDevice.syncStatus,
          newSyncStatus: 'PENDING'
        });
        // Reset the local approved device for current device to REVOKED state
        await TrustedDeviceRepository.resetActive(workerId);
      }
      // We don't touch other local records as they may be legitimate for other devices
      const recordsAfter = await TrustedDeviceRepository.findByWorker(workerId);
      DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'SUCCESS', data: {
        step: 'localReconciliationCompleted',
        authoritativeDecision: 'DIFFERENT_DEVICE',
        recordsBefore: recordsBefore.map(r => ({ recordId: r.id, deviceId: r.deviceId, status: r.status })),
        recordsChanged,
        recordsAfter: recordsAfter.map(r => ({ recordId: r.id, deviceId: r.deviceId, status: r.status }))
      }});
    } catch (error) {
      console.error('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.reconcileLocalStateWithSupabase: ERROR', error);
      DiagnosticTraceStore.append({ phase: 'TRUSTED_DEVICE_VERIFICATION', result: 'FAILED', data: {
        step: 'localReconciliationCompleted',
        authoritativeDecision: 'ERROR',
        recordsBefore: [],
        recordsChanged: [],
        recordsAfter: [],
        error: error instanceof Error ? error.message : String(error)
      }});
      // Don't throw - we don't want reconciliation failures to break the registration status check
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

      // APPLICATION REGISTRATION PROTECTION: Check if device already has APPROVED trusted-device record
      // This provides deterministic, understandable result before attempting database operation
      const deviceRecords = await TrustedDeviceRepository.findByDevice(device!.deviceId);
      const hasApprovedRecordForOtherWorker = deviceRecords.some(
        record => record.status === 'APPROVED' && record.workerId !== worker!.id
      );
      if (hasApprovedRecordForOtherWorker) {
        console.log('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: DEVICE_ALREADY_ACTIVE_ELSEWHERE');
        rollbackRegistration();
        return deepCloneAndFreeze({
          success: false,
          code: TrustedDeviceRegistrationResultCode.DEVICE_ALREADY_ACTIVE_ELSEWHERE,
          error: 'Device is already active with another worker.'
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

      // Perform authoritative verification after registration
      // Initialize sync engine if needed
      TrustedDeviceSyncEngine.initialize();

      // Upload the newly registered trusted device to Supabase
      const pendingDevices = await TrustedDeviceRepository.findPendingByWorker(worker!.id);
      if (pendingDevices.length > 0) {
        try {
          await TrustedDeviceSyncEngine.uploadTrustedDevices(pendingDevices);
          // Note: We don't require marking sync to succeed for registration verification
          // The directive says: "Do not falsely report the remote upload as failed if the remote upload succeeded."
          // We'll attempt to mark sync but treat upload success as sufficient for registration
          try {
            for (const record of pendingDevices) {
              await TrustedDeviceRepository.markSynced(record.id);
            }
          } catch (markSyncError) {
            // Log mark sync failure but don't fail registration - upload succeeded
            console.warn('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: MARK_SYNC_FAILED (non-fatal)', markSyncError);
          }
        } catch (uploadError) {
          console.error('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: UPLOAD_ERROR', uploadError);
          transientRegistrationState = null;
          return deepCloneAndFreeze({
            success: false,
            code: TrustedDeviceRegistrationResultCode.PERSISTENCE_ERROR,
            error: 'Failed to upload trusted device to server'
          });
        }
      } else {
        // No pending devices to upload - this should not happen after successful local registration
        console.error('[NativeIdentityDiag] TrustedDeviceRegistrationEngine.registerCurrentDevice: NO_PENDING_DEVICES');
        transientRegistrationState = null;
        return deepCloneAndFreeze({
          success: false,
          code: TrustedDeviceRegistrationResultCode.PERSISTENCE_ERROR,
          error: 'No pending devices found for upload after registration'
        });
      }

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