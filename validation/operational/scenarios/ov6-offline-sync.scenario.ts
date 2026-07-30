import { OperationalScenario } from '../framework';
import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertExists,
  assertAccepted,
  assertLocationCount,
  assertPendingSync,
  assertSyncCompleted,
  assertRemoteRepositoryCount,
  assertNoDuplicateUploads,
  assertFailureCounterReset
} from '../assertions';
import { StorageEngine } from '../../../modules/storage';
import { BunSQLiteAdapter } from '../../repository/bun-sqlite.adapter';
import { ConfigurationEngine } from '../../../modules/configuration';
import { AuthenticationEngine, AuthenticationState } from '../../../modules/authentication';
import { UserContextEngine, WorkerRole } from '../../../modules/user-context';
import { WorkerProfileEngine } from '../../../modules/worker-profile';
import { WorkerAdminEngine } from '../../../modules/worker-administration';
import { AttendanceEngine } from '../../../modules/attendance';
import { WorkerSyncEngine, WorkerSyncErrorCode, WorkerSyncError, WorkerSyncProvider } from '../../../modules/worker-sync';
import { LocationEvaluationEngine, EvaluationReason } from '../../../modules/location-evaluation';
import {
  WorkerRepository,
  ShiftRepository,
  AttendanceRepository,
  LocationRepository
} from '../../../modules/repositories';
import { LocationProvider } from '../../../modules/location';
import { ConnectivityFixture } from '../fixtures';
import { createClient } from '@supabase/supabase-js';

export class OperationalOfflineSyncScenario implements OperationalScenario {
  public id = 'OV-SCENARIO-06';
  public title = 'Offline Synchronization & Recovery Operational Validation';
  public description = 'Validates complete offline workday execution and subsequent idempotent recovery synchronization to Supabase upon network restoration.';

  private testWorkerId = 'SYSTEM';
  private testEmail = 'system@sapana.local';
  private shiftId = `SHIFT-OV6-${Date.now()}`;
  private attendanceId: string | null = null;
  private locationIds: string[] = [];
  private supabaseClient: any = null;

  private baselineWorkersCount = 0;
  private baselineAttendanceCount = 0;
  private baselineEventsCount = 0;
  private origAuthStatus: any = null;

  private evalOptions = {
    maxAccuracyMeters: 50,
    geofence: {
      center: { latitude: 13.7563, longitude: 100.5018 },
      radiusMeters: 500
    }
  };

  private liveSyncProvider: WorkerSyncProvider = {
    fetchUpdatedWorkers: async (since?: string) => {
      if (!ConnectivityFixture.isOnline()) {
        throw new WorkerSyncError(WorkerSyncErrorCode.NETWORK_ERROR, 'Network offline: connection refused');
      }
      let query = this.supabaseClient.from('workers').select('*');
      if (since) {
        query = query.gte('updated_at', since);
      }
      const { data, error } = await query;
      if (error) {
        throw new Error(`Supabase query workers failed: ${error.message}`);
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
    },

    uploadAttendance: async (records) => {
      if (!ConnectivityFixture.isOnline()) {
        throw new WorkerSyncError(WorkerSyncErrorCode.NETWORK_ERROR, 'Network offline: connection refused');
      }
      if (records.length === 0) return;

      const payload = records.map((a) => ({
        id: a.id,
        worker_id: a.worker_id,
        check_in_at: a.check_in_at,
        check_out_at: a.check_out_at ?? null,
        latitude: a.latitude,
        longitude: a.longitude,
        accuracy: a.accuracy,
        sync_status: 'SYNCED',
        created_at: a.created_at || new Date().toISOString(),
        updated_at: a.updated_at || new Date().toISOString()
      }));

      const { error } = await this.supabaseClient.from('attendance').upsert(payload);
      if (error) {
        throw new Error(`Supabase upload attendance failed: ${error.message}`);
      }
    },

    uploadLocations: async (records) => {
      if (!ConnectivityFixture.isOnline()) {
        throw new WorkerSyncError(WorkerSyncErrorCode.NETWORK_ERROR, 'Network offline: connection refused');
      }
      if (records.length === 0) return;

      const payload = records.map((loc) => ({
        id: loc.id,
        event_type: 'LOCATION_UPDATE',
        event_data: JSON.stringify({
          latitude: loc.latitude,
          longitude: loc.longitude,
          accuracy: loc.accuracy,
          altitude: loc.altitude,
          speed: loc.speed,
          heading: loc.heading
        }),
        occurred_at: loc.recorded_at,
        worker_id: loc.worker_id,
        shift_id: loc.shift_id
      }));

      const { error } = await this.supabaseClient.from('events').upsert(payload);
      if (error) {
        throw new Error(`Supabase upload locations failed: ${error.message}`);
      }
    }
  };

  public async setup(): Promise<void> {
    // 1. Initialize storage and configurations
    const adapter = new BunSQLiteAdapter(':memory:');
    await StorageEngine.initialize(adapter);
    assertTrue(await StorageEngine.health(), 'Phase 1: StorageEngine initialized and healthy');

    ConfigurationEngine.load();
    const config = ConfigurationEngine.config.environment.supabase;
    this.supabaseClient = createClient(config.url, config.anonKey);
    assertExists(this.supabaseClient, 'Phase 1: Direct Supabase test client created');

    // 2. Initialize engines
    AuthenticationEngine.initialize();
    this.origAuthStatus = AuthenticationEngine.status;
    AuthenticationEngine.status = () => ({
      state: AuthenticationState.AUTHENTICATED,
      userId: this.testWorkerId,
      consecutiveFailures: 0
    });

    UserContextEngine.initialize();
    WorkerProfileEngine.initialize();
    WorkerAdminEngine.initialize();
    AttendanceEngine.initialize();
    WorkerSyncEngine.initialize(this.liveSyncProvider);

    // Mock LocationProvider
    LocationProvider.getCurrentLocation = async () => ({
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 5.0,
      timestamp: new Date().toISOString(),
      altitude: null,
      heading: null,
      speed: null,
      coords: {
        latitude: 13.7563,
        longitude: 100.5018,
        accuracy: 5.0
      }
    } as any);

    // 3. User Authentication & Context Setup
    UserContextEngine.setCurrentWorker({
      id: this.testWorkerId,
      email: this.testEmail,
      role: 'ADMIN' as WorkerRole,
      displayName: 'Sapana Admin Worker',
      active: true
    });

    assertTrue(UserContextEngine.status().authenticated, 'Phase 1: UserContext authenticated');
    assertEqual(UserContextEngine.workerId(), this.testWorkerId, 'Phase 1: Worker ID matches expected worker-admin');

    // Seed local worker repository
    await WorkerRepository.create({
      workerId: this.testWorkerId,
      email: this.testEmail,
      displayName: 'Sapana Admin Worker',
      employeeCode: 'EMP-ADMIN',
      role: 'ADMIN' as WorkerRole,
      organization: 'Sapana',
      active: true
    });

    // Upsert worker record in remote Supabase workers table for foreign key constraint
    const { error: workerErr } = await this.supabaseClient.from('workers').upsert({
      worker_id: this.testWorkerId,
      email: this.testEmail,
      display_name: 'Sapana Admin Worker',
      role: 'ADMIN',
      active: 1,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });
    if (workerErr) {
      console.error('Supabase worker upsert error:', workerErr);
    }
    assertTrue(!workerErr, 'Phase 1: Worker record upserted to remote Supabase workers table');

    // Ensure shift exists in local shift repo and remote Supabase shifts table for foreign key constraint
    await ShiftRepository.createShift({
      id: this.shiftId,
      worker_id: this.testWorkerId,
      status: 'ACTIVE',
      started_at: new Date().toISOString(),
      ended_at: null
    });

    const { error: shiftErr } = await this.supabaseClient.from('shifts').upsert({
      id: this.shiftId,
      worker_id: this.testWorkerId,
      status: 'ACTIVE',
      started_at: new Date().toISOString()
    });
    assertTrue(!shiftErr, 'Phase 1: Shift record upserted to remote Supabase shifts table');

    // Verify initial clean state
    await assertPendingSync(async () => AttendanceRepository.findPending(), 0, 'Phase 1: Initial pending attendance queue is empty');
    await assertPendingSync(async () => LocationRepository.findPending(), 0, 'Phase 1: Initial pending location queue is empty');
  }

  public async execute(): Promise<void> {
    // Phase 2 — Online Baseline
    ConnectivityFixture.setOnline(true);
    assertTrue(ConnectivityFixture.isOnline(), 'Phase 2: Connectivity set to ONLINE');

    const { data: remoteWorkers } = await this.supabaseClient.from('workers').select('*');
    this.baselineWorkersCount = remoteWorkers ? remoteWorkers.length : 0;

    const { data: remoteAttendance } = await this.supabaseClient.from('attendance').select('*').eq('worker_id', this.testWorkerId);
    this.baselineAttendanceCount = remoteAttendance ? remoteAttendance.length : 0;

    const { data: remoteEvents } = await this.supabaseClient.from('events').select('*').eq('worker_id', this.testWorkerId);
    this.baselineEventsCount = remoteEvents ? remoteEvents.length : 0;

    // Phase 3 — Simulate Network Loss
    ConnectivityFixture.setOnline(false);
    assertFalse(ConnectivityFixture.isOnline(), 'Phase 3: Connectivity set to OFFLINE');

    const offlineAttempt = await WorkerSyncEngine.sync();
    assertFalse(offlineAttempt.success, 'Phase 3: WorkerSyncEngine.sync() returns failure when offline');
    assertEqual(offlineAttempt.errorCode, WorkerSyncErrorCode.NETWORK_ERROR, 'Phase 3: WorkerSyncEngine returned NETWORK_ERROR code');

    // Phase 4 — Offline Workday Execution
    const checkInRes = await AttendanceEngine.checkIn();
    assertTrue(checkInRes.success, 'Phase 4: Check-in executed successfully in offline mode');

    const activeSession = await AttendanceRepository.findActiveSession(this.testWorkerId);
    assertExists(activeSession, 'Phase 4: Active attendance session created locally');
    this.attendanceId = activeSession.id;

    // Generate 20 GPS readings locally
    for (let i = 1; i <= 20; i++) {
      const lat = 13.7563 + i * 0.0001;
      const lng = 100.5018 + i * 0.0001;
      const recordedAt = new Date(Date.now() + i * 1000).toISOString();

      const evalRes = LocationEvaluationEngine.evaluate({
        currentLocation: { latitude: lat, longitude: lng, accuracy: 10, timestamp: recordedAt } as any,
        options: this.evalOptions
      });
      assertAccepted(evalRes, `Phase 4: GPS observation ${i}/20 accepted by LocationEvaluationEngine`);

      const locId = `loc-ov6-${i}-${Date.now()}`;
      await LocationRepository.append({
        id: locId,
        shift_id: this.shiftId,
        worker_id: this.testWorkerId,
        latitude: lat,
        longitude: lng,
        accuracy: 10,
        altitude: 15,
        speed: 1.5,
        heading: 90,
        recorded_at: recordedAt
      });
      this.locationIds.push(locId);
    }

    const checkOutRes = await AttendanceEngine.checkOut();
    assertTrue(checkOutRes.success, 'Phase 4: Check-out executed successfully in offline mode');

    // Phase 5 — Offline Queue Verification
    await assertLocationCount(async () => (await LocationRepository.findBetween(this.testWorkerId, '2000-01-01', '2100-01-01')).length, 20, 'Phase 5: Exactly 20 location records saved in local SQLite');
    await assertPendingSync(async () => AttendanceRepository.findPending(), 1, 'Phase 5: Exactly 1 pending attendance record queued locally');
    await assertPendingSync(async () => LocationRepository.findPending(), 20, 'Phase 5: Exactly 20 pending location records queued locally');

    // Verify Supabase remote state was NOT touched during offline workday
    const { data: remoteAttOffline } = await this.supabaseClient.from('attendance').select('*').eq('worker_id', this.testWorkerId);
    assertEqual((remoteAttOffline || []).length, this.baselineAttendanceCount, 'Phase 5: Remote Supabase attendance count untouched while offline');

    const { data: remoteEventsOffline } = await this.supabaseClient.from('events').select('*').eq('worker_id', this.testWorkerId);
    assertEqual((remoteEventsOffline || []).length, this.baselineEventsCount, 'Phase 5: Remote Supabase events count untouched while offline');

    // Phase 6 — Connectivity Restoration
    ConnectivityFixture.setOnline(true);
    assertTrue(ConnectivityFixture.isOnline(), 'Phase 6: Connectivity set to ONLINE');

    // Phase 7 — Execute Synchronization
    const syncRes = await WorkerSyncEngine.sync();
    assertTrue(syncRes.success, 'Phase 7: WorkerSyncEngine.sync() succeeded after connectivity restoration');
    assertEqual(syncRes.attendanceUploadedCount, 1, 'Phase 7: Exactly 1 attendance record uploaded');
    assertEqual(syncRes.locationUploadedCount, 20, 'Phase 7: Exactly 20 location records uploaded');

    // Phase 8 — Remote Verification
    await assertPendingSync(async () => AttendanceRepository.findPending(), 0, 'Phase 8: Local attendance pending queue cleared after sync');
    await assertPendingSync(async () => LocationRepository.findPending(), 0, 'Phase 8: Local location pending queue cleared after sync');

    assertSyncCompleted(() => WorkerSyncEngine.status(), 'Phase 8: Sync status reports successful completion');
    assertFailureCounterReset(() => WorkerSyncEngine.status().consecutiveFailures, 'Phase 8: Failure counter reset to 0');

    await assertRemoteRepositoryCount(async () => {
      const { data } = await this.supabaseClient.from('attendance').select('*').eq('worker_id', this.testWorkerId);
      return (data || []).length;
    }, this.baselineAttendanceCount + 1, 'Phase 8: Remote attendance table count increased by 1');

    await assertRemoteRepositoryCount(async () => {
      const { data } = await this.supabaseClient.from('events').select('*').eq('worker_id', this.testWorkerId).eq('shift_id', this.shiftId);
      return (data || []).length;
    }, 20, 'Phase 8: Remote events table count contains 20 GPS updates for shift');

    // Phase 9 — Idempotency Verification
    const syncRes2 = await WorkerSyncEngine.sync();
    assertTrue(syncRes2.success, 'Phase 9: Second synchronization run executed successfully');
    assertEqual(syncRes2.synchronizedCount, 0, 'Phase 9: Second sync resulted in zero new uploads');
    assertEqual(syncRes2.attendanceUploadedCount, 0, 'Phase 9: Zero attendance uploads on repeated sync');
    assertEqual(syncRes2.locationUploadedCount, 0, 'Phase 9: Zero location uploads on repeated sync');

    await assertNoDuplicateUploads(
      async () => {
        const { data } = await this.supabaseClient.from('events').select('*').eq('shift_id', this.shiftId);
        return data || [];
      },
      (item: any) => item.id,
      'Phase 9: No duplicate event records present in Supabase'
    );
  }

  public async verify(): Promise<void> {
    // Phase 10 — Integrity Verification
    const localAttendance = await AttendanceRepository.findLatest(this.testWorkerId);
    assertExists(localAttendance, 'Phase 10: Local attendance record retrieved');

    const { data: remoteAttList } = await this.supabaseClient.from('attendance').select('*').eq('id', localAttendance.id);
    assertExists(remoteAttList && remoteAttList[0], 'Phase 10: Remote Supabase attendance record matches local ID');

    const remoteAtt = remoteAttList[0];
    assertEqual(remoteAtt.worker_id, localAttendance.worker_id, 'Phase 10: Worker ID matches between local and remote');
    assertEqual(new Date(remoteAtt.check_in_at).toISOString(), new Date(localAttendance.check_in_at).toISOString(), 'Phase 10: Check-in timestamp matches between local and remote');
    assertEqual(new Date(remoteAtt.check_out_at).toISOString(), new Date(localAttendance.check_out_at!).toISOString(), 'Phase 10: Check-out timestamp matches between local and remote');
    assertEqual(remoteAtt.latitude, localAttendance.latitude, 'Phase 10: Check-in latitude matches between local and remote');
    assertEqual(remoteAtt.longitude, localAttendance.longitude, 'Phase 10: Check-in longitude matches between local and remote');

    const localLocations = await LocationRepository.findBetween(this.testWorkerId, '2000-01-01', '2100-01-01');
    assertEqual(localLocations.length, 20, 'Phase 10: Exactly 20 local locations verified');

    const { data: remoteEvents } = await this.supabaseClient.from('events').select('*').eq('shift_id', this.shiftId);
    assertEqual((remoteEvents || []).length, 20, 'Phase 10: Exactly 20 remote event locations verified');

    for (const evt of remoteEvents || []) {
      assertEqual(evt.worker_id, this.testWorkerId, 'Phase 10: Event worker_id foreign key verified');
      assertEqual(evt.shift_id, this.shiftId, 'Phase 10: Event shift_id foreign key verified');
    }
  }

  public async cleanup(): Promise<void> {
    // Phase 11 — Cleanup
    try {
      if (this.attendanceId) {
        await this.supabaseClient.from('attendance').delete().eq('id', this.attendanceId);
      }
      if (this.shiftId) {
        await this.supabaseClient.from('events').delete().eq('shift_id', this.shiftId);
        await this.supabaseClient.from('shifts').delete().eq('id', this.shiftId);
      }
    } catch (err) {
      console.error('Error during remote cleanup:', err);
    }

    if (this.origAuthStatus) {
      AuthenticationEngine.status = this.origAuthStatus;
    }
    UserContextEngine.clear();
    WorkerSyncEngine.clear();
    WorkerProfileEngine.clear();
    WorkerAdminEngine.clear();
    await StorageEngine.close();
    assertTrue(!(await StorageEngine.health()), 'Phase 11: StorageEngine cleanly closed');
  }
}
