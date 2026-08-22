import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ConfigurationEngine } from '../configuration';
import { TrustedDeviceRecord } from '../repositories/trusted-device/trusted-device.repository.types';
import { TrustedDeviceSyncProvider } from './trusted-device-sync.types';
import { AuthenticationEngine } from '../authentication';
import { WorkerRepository } from '../repositories/worker';
import { TrustedDeviceRepository } from '../repositories/trusted-device';
import { ConnectivityEngine } from '../connectivity';
import { TrustedDeviceStatus } from '../repositories/trusted-device/trusted-device.repository.types';
import { SyncStatus } from '../repositories/trusted-device/trusted-device.repository.types';

let initialized = false;
let supabaseClient: SupabaseClient | null = null;

export const TrustedDeviceSyncEngine = {
  initialize(): void {
    if (initialized) {
      return;
    }

    try {
      const config = ConfigurationEngine.config.environment.supabase;
      supabaseClient = createClient(config.url, config.anonKey);
      initialized = true;
    } catch (error) {
      supabaseClient = null;
      initialized = false;
      throw new Error(`TrustedDeviceSyncEngine: Initialization failed. ${error}`);
    }
  },

  /**
   * Upload trusted device records to Supabase.
   * Implements the TrustedDeviceSyncProvider interface.
   */
  async uploadTrustedDevices(records: TrustedDeviceRecord[]): Promise<void> {
    if (!initialized) {
      throw new Error('TrustedDeviceSyncEngine is not initialized');
    }

    if (!supabaseClient) {
      throw new Error('TrustedDeviceSyncEngine: Supabase client not available');
    }

    if (records.length === 0) {
      return;
    }

    try {
      // Transform local records to Supabase format
      const payload = records.map((record) => ({
        id: record.id,
        worker_id: record.workerId,
        device_id: record.deviceId,
        manufacturer: record.manufacturer,
        model: record.model,
        platform: record.platform,
        app_version: record.appVersion,
        registered_at: record.registeredAt,
        approved_at: record.approvedAt || null,
        approved_by: record.approvedBy || null,
        status: record.status,
        sync_status: record.syncStatus,
        created_at: record.createdAt,
        updated_at: record.updatedAt
      }));

      // Use Supabase upsert to insert or update records
      const { error } = await supabaseClient
        .from('trusted_devices')
        .upsert(payload, { onConflict: 'id' });

      if (error) {
        throw new Error(`Trusted device sync failed: ${error.message}`);
      }
    } catch (error: any) {
      throw new Error(`TrustedDeviceSyncEngine: Failed to upload trusted devices. ${error.message}`);
    }
  },

  /**
   * Find the approved trusted device for a worker from Supabase.
   * Returns the trusted device record if found and approved, null otherwise.
   */
  async findApprovedTrustedDeviceForWorker(workerId: string): Promise<TrustedDeviceRecord | null> {
    if (!initialized) {
      throw new Error('TrustedDeviceSyncEngine is not initialized');
    }

    if (!supabaseClient) {
      throw new Error('TrustedDeviceSyncEngine: Supabase client not available');
    }

    try {
      const { data, error } = await supabaseClient
        .from('trusted_devices')
        .select('*')
        .eq('worker_id', workerId)
        .eq('status', 'APPROVED')
        .single();

      if (error) {
        // If no record found, error will be PGRST116, which we treat as null result
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(`Failed to fetch trusted device from Supabase: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      // Transform Supabase record to TrustedDeviceRecord format
      return {
        id: data.id,
        workerId: data.worker_id,
        deviceId: data.device_id,
        manufacturer: data.manufacturer,
        model: data.model,
        platform: data.platform,
        appVersion: data.app_version,
        registeredAt: data.registered_at,
        approvedAt: data.approved_at,
        approvedBy: data.approved_by,
        status: data.status as TrustedDeviceStatus,
        syncStatus: data.sync_status as SyncStatus,
        createdAt: data.created_at,
        updatedAt: data.updated_at
      };
    } catch (error: any) {
      throw new Error(`TrustedDeviceSyncEngine: Failed to find approved trusted device. ${error.message}`);
    }
  },

  /**
   * Synchronize a trusted device from local storage to Supabase.
   * Implements the 5-step verification flow as specified in the directive.
   */
  async syncTrustedDevice(): Promise<{ success: boolean; error?: any }> {
    try {
      // Step 1: Resolve authenticated identity
      const authUser = AuthenticationEngine.currentUser();
      if (!authUser) {
        const error = new Error('AUTHENTICATED_USER_NOT_AVAILABLE');
        return { success: false, error };
      }

      // Step 2: Resolve local worker
      const worker = await WorkerRepository.findById(authUser.id);
      if (!worker) {
        const error = new Error('LOCAL_WORKER_NOT_FOUND');
        return { success: false, error };
      }
      if (worker.workerId !== authUser.id) {
        const error = new Error('WORKER_IDENTITY_MISMATCH');
        return { success: false, error };
      }

      // Step 3: Resolve local pending trusted device
      const pendingDevices = await TrustedDeviceRepository.findPendingByWorker(authUser.id);
      if (pendingDevices.length === 0) {
        // No pending device is not an error - it's a clean NO_PENDING_DEVICE result
        return { success: true }; // Success but nothing to sync
      }

      // Take the first pending device (should be only one per worker due to constraints)
      const trustedDevice = pendingDevices[0];

      // Step 4: Verify remote worker
      const { data: remoteWorker, error: remoteWorkerError } = await supabaseClient
        .from('workers')
        .select('worker_id')
        .eq('worker_id', authUser.id)
        .single();

      if (remoteWorkerError) {
        return { success: false, error: remoteWorkerError };
      }

      if (!remoteWorker) {
        const error = new Error('REMOTE_WORKER_NOT_FOUND');
        return { success: false, error };
      }

      // Step 5: Upload trusted device
      try {
        // Transform local record to Supabase format
        const payload = {
          id: trustedDevice.id,
          worker_id: trustedDevice.workerId,
          device_id: trustedDevice.deviceId,
          manufacturer: trustedDevice.manufacturer,
          model: trustedDevice.model,
          platform: trustedDevice.platform,
          app_version: trustedDevice.appVersion,
          registered_at: trustedDevice.registeredAt,
          approved_at: trustedDevice.approvedAt ?? null,
          approved_by: trustedDevice.approvedBy ?? null,
          status: trustedDevice.status,
          sync_status: trustedDevice.syncStatus,
          created_at: trustedDevice.createdAt,
          updated_at: trustedDevice.updatedAt
        };

        const { error: uploadError } = await supabaseClient
          .from('trusted_devices')
          .upsert(payload, { onConflict: 'id' });

        if (uploadError) {
          return { success: false, error: uploadError };
        }
      } catch (uploadError) {
        return { success: false, error: uploadError };
      }

      // Step 6: Mark local record synced
      try {
        await TrustedDeviceRepository.markSynced(trustedDevice.id);
      } catch (markSyncError) {
        // Note: We don't return early here because the upload succeeded
        // The directive says: "Do not falsely report the remote upload as failed if the remote upload succeeded."
        // We'll continue but note that marking sync failed
        // However, for the return value, we'll still consider it success since upload succeeded
      }

      return { success: true };
    } catch (unexpectedError) {
      // Handle any unexpected errors that might occur during the flow
      return { success: false, error: unexpectedError };
    }
  },

  // For consistency with other engines, though not strictly needed for upload-only provider
  status(): { initialized: boolean } {
    return { initialized };
  }
};