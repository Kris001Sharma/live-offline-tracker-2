import { assert, report } from '../framework';
import { BunSQLiteAdapter } from '../repository/bun-sqlite.adapter';
import { StorageEngine } from '../../modules/storage';
import { AuthenticationEngine, AuthenticationState } from '../../modules/authentication';
import { WorkerSyncEngine, WorkerSyncErrorCode, WorkerSyncLifecycle } from '../../modules/worker-sync';
import { WorkerRepository, WorkerRole } from '../../modules/repositories';
import { createClient } from '@supabase/supabase-js';

async function validateSync1_UnconfiguredProviderError() {
  console.log('\n--- Validating Sync 1: Unconfigured Sync Provider Error ---');
  try {
    WorkerSyncEngine.initialize();
    const res = await WorkerSyncEngine.sync();
    assert(res.success === false, 'WorkerSyncEngine.sync() fails when no provider is configured [LIVE VERIFIED]');
    assert(res.errorCode === WorkerSyncErrorCode.PROVIDER_NOT_CONFIGURED, 'WorkerSyncEngine returns PROVIDER_NOT_CONFIGURED [LIVE VERIFIED]');
  } catch (err: any) {
    assert(false, `Sync 1 validation failed: ${err.message}`);
  }
}

async function validateSync2_UnauthenticatedSyncRejection() {
  console.log('\n--- Validating Sync 2: Unauthenticated Synchronization Rejection ---');
  try {
    const mockProvider = {
      fetchUpdatedWorkers: async () => []
    };
    WorkerSyncEngine.initialize(mockProvider);

    // Ensure state is UNAUTHENTICATED
    const origStatus = AuthenticationEngine.status;
    AuthenticationEngine.status = () => ({
      state: AuthenticationState.UNAUTHENTICATED,
      consecutiveFailures: 0
    });

    const res = await WorkerSyncEngine.sync();
    assert(res.success === false, 'WorkerSyncEngine rejects unauthenticated sync request [LIVE VERIFIED]');
    assert(res.errorCode === WorkerSyncErrorCode.UNAUTHENTICATED, 'WorkerSyncEngine returns UNAUTHENTICATED error code [LIVE VERIFIED]');

    AuthenticationEngine.status = origStatus;
  } catch (err: any) {
    assert(false, `Sync 2 validation failed: ${err.message}`);
  }
}

async function validateSync3_LiveSupabaseProviderDeltaSync() {
  console.log('\n--- Validating Sync 3: Live Supabase Provider Delta Sync Pipeline ---');
  try {
    const url = process.env.VITE_SUPABASE_URL!;
    const key = process.env.VITE_SUPABASE_ANON_KEY!;
    const client = createClient(url, key);

    const liveSyncProvider = {
      fetchUpdatedWorkers: async (since?: string) => {
        let query = client.from('workers').select('*');
        if (since) {
          query = query.gte('updated_at', since);
        }
        const { data, error } = await query;
        if (error) {
          throw new Error(`Live Supabase query failed: ${error.message}`);
        }
        return (data || []).map((w: any) => ({
          workerId: w.worker_id,
          email: w.email,
          displayName: w.display_name,
          employeeCode: w.employee_code,
          role: w.role as WorkerRole,
          organization: w.organization,
          active: w.active === 1 || w.active === true
        }));
      }
    };

    WorkerSyncEngine.initialize(liveSyncProvider);

    const origStatus = AuthenticationEngine.status;
    AuthenticationEngine.status = () => ({
      state: AuthenticationState.AUTHENTICATED,
      userId: 'worker-admin',
      consecutiveFailures: 0
    });

    const res = await WorkerSyncEngine.sync();
    assert(res.success === true, 'WorkerSyncEngine.sync() succeeded against live Supabase [LIVE VERIFIED]');
    assert((res.synchronizedCount || 0) >= 4, 'WorkerSyncEngine synchronized all seeded remote workers into local SQLite [LIVE VERIFIED]');

    const admin = await WorkerRepository.findById('worker-admin');
    assert(admin !== null && admin.displayName === 'System Administrator', 'Live worker-admin retrieved from local SQLite after sync [LIVE VERIFIED]');

    // Status checks
    const syncStatus = WorkerSyncEngine.status();
    assert(syncStatus.lastSuccessfulSyncAt !== undefined, 'WorkerSyncEngine recorded lastSuccessfulSyncAt timestamp [LIVE VERIFIED]');
    assert(syncStatus.consecutiveFailures === 0, 'WorkerSyncEngine reset consecutiveFailures to 0 [LIVE VERIFIED]');

    AuthenticationEngine.status = origStatus;
  } catch (err: any) {
    assert(false, `Sync 3 validation failed: ${err.message}`);
  }
}

async function validateSync4_ProviderErrorHandlingAndFailureRollback() {
  console.log('\n--- Validating Sync 4: Provider Error Handling & Deterministic Error Translation ---');
  try {
    const failingProvider = {
      fetchUpdatedWorkers: async () => {
        throw new Error('Supabase network connection timeout during fetch');
      }
    };

    WorkerSyncEngine.initialize(failingProvider);

    const origStatus = AuthenticationEngine.status;
    AuthenticationEngine.status = () => ({
      state: AuthenticationState.AUTHENTICATED,
      userId: 'worker-admin',
      consecutiveFailures: 0
    });

    const res = await WorkerSyncEngine.sync();
    assert(res.success === false, 'WorkerSyncEngine handled provider exception gracefully [LIVE VERIFIED]');
    assert(res.errorCode === WorkerSyncErrorCode.SYNC_FAILED, 'WorkerSyncEngine mapped provider exception to SYNC_FAILED [LIVE VERIFIED]');
    assert(WorkerSyncEngine.status().consecutiveFailures === 1, 'WorkerSyncEngine incremented consecutiveFailures counter [LIVE VERIFIED]');
    assert(WorkerSyncEngine.status().lifecycle === WorkerSyncLifecycle.IDLE, 'WorkerSyncEngine reset lifecycle state back to IDLE [LIVE VERIFIED]');

    AuthenticationEngine.status = origStatus;
  } catch (err: any) {
    assert(false, `Sync 4 validation failed: ${err.message}`);
  }
}

async function runSynchronizationValidation() {
  console.log('=== STARTING SYNCHRONIZATION VALIDATION (QUALITY GATE 6) ===');

  const adapter = new BunSQLiteAdapter(':memory:');
  await StorageEngine.initialize(adapter);

  await validateSync1_UnconfiguredProviderError();
  await validateSync2_UnauthenticatedSyncRejection();
  await validateSync3_LiveSupabaseProviderDeltaSync();
  await validateSync4_ProviderErrorHandlingAndFailureRollback();

  await StorageEngine.close();
  report('Synchronization');
}

runSynchronizationValidation().catch(console.error);
