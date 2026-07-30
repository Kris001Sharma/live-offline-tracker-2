import { OperationalScenario } from '../framework';
import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertExists,
  assertFrozen,
  assertRepositoryCount,
  assertDatabaseState
} from '../assertions';
import { StorageEngine } from '../../../modules/storage';
import { BunSQLiteAdapter } from '../../repository/bun-sqlite.adapter';
import { ConfigurationEngine } from '../../../modules/configuration';
import { AuthenticationEngine } from '../../../modules/authentication';
import { UserContextEngine, WorkerRole } from '../../../modules/user-context';
import { WorkerAdminEngine } from '../../../modules/worker-administration';
import { WorkerProfileEngine } from '../../../modules/worker-profile';
import { AttendanceEngine, AttendanceState } from '../../../modules/attendance';
import { AttendanceRepository } from '../../../modules/repositories';
import { LocationProvider } from '../../../modules/location';

export class OperationalAttendanceScenario implements OperationalScenario {
  public id = 'OV-SCENARIO-03';
  public title = 'Attendance Operational Validation Workflow';
  public description = 'Validates the complete attendance business lifecycle: initial uncommitted state, clock-in, duplicate clock-in rejection, active attendance retrieval, clock-out, and duplicate clock-out rejection.';

  private testEmail = 'admin@sapana.local';
  private testPassword = 'Password123!';
  private workerId = 'SYSTEM';

  public async setup(): Promise<void> {
    // 1. Ensure required geofence environment configuration
    process.env.VITE_ATTENDANCE_GEOFENCE_LAT = '13.7563';
    process.env.VITE_ATTENDANCE_GEOFENCE_LNG = '100.5018';
    process.env.VITE_ATTENDANCE_GEOFENCE_RADIUS = '100';

    // 2. Initialize in-memory SQLite storage
    const adapter = new BunSQLiteAdapter(':memory:');
    await StorageEngine.initialize(adapter);
    assertTrue(await StorageEngine.health(), 'StorageEngine initialized and healthy');

    // 3. Load configuration and initialize required engines
    ConfigurationEngine.load();
    AuthenticationEngine.initialize();
    UserContextEngine.initialize();
    WorkerProfileEngine.initialize();
    AttendanceEngine.initialize();

    // 4. Authenticate using seeded validation account
    const loginRes = await AuthenticationEngine.login(this.testEmail, this.testPassword);
    assertTrue(loginRes.success, 'AuthenticationEngine login with seeded account succeeded');

    const authUser = AuthenticationEngine.currentUser();
    assertExists(authUser, 'Authenticated user object exists');

    // 5. Establish UserContext identity and worker profile
    UserContextEngine.setCurrentWorker({
      id: authUser.id,
      email: authUser.email,
      role: 'WORKER' as WorkerRole,
      displayName: 'Admin Worker',
      active: true
    });

    WorkerAdminEngine.initialize();
    await WorkerAdminEngine.createWorker({
      workerId: authUser.id,
      email: authUser.email,
      displayName: 'Admin Worker',
      employeeCode: 'EMP-001',
      role: 'WORKER' as WorkerRole,
      organization: 'Sapana',
      active: true
    });

    const profileRes = await WorkerProfileEngine.load();
    assertTrue(profileRes.success, 'WorkerProfileEngine loaded worker profile');

    // 6. Configure mock GPS LocationProvider
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

    // 7. Verify no active attendance exists in initial state
    assertEqual(
      AttendanceEngine.status().state,
      AttendanceState.NOT_CHECKED_IN,
      'AttendanceEngine initialized in NOT_CHECKED_IN state'
    );

    const activeSession = await AttendanceRepository.findActiveSession(this.workerId);
    assertEqual(activeSession, null, 'No active attendance session exists in repository during setup');
  }

  public async execute(): Promise<void> {
    // Stage 1: Verify worker has no active attendance
    assertEqual(
      AttendanceEngine.status().state,
      AttendanceState.NOT_CHECKED_IN,
      'Stage 1: Verified attendance engine state is NOT_CHECKED_IN'
    );
    const noActiveSession = await AttendanceRepository.findActiveSession(this.workerId);
    assertEqual(noActiveSession, null, 'Stage 1: Verified no active attendance session exists in repository');

    // Stage 2: Clock IN
    const checkInRes = await AttendanceEngine.checkIn();
    assertTrue(checkInRes.success, 'Stage 2: Clock IN succeeded via AttendanceEngine public API');
    assertEqual(
      AttendanceEngine.status().state,
      AttendanceState.CHECKED_IN,
      'Stage 2: Attendance state transitioned to CHECKED_IN'
    );
    assertExists(checkInRes.timestamp, 'Stage 2: Clock-in timestamp recorded in result');

    const activeSession = await AttendanceRepository.findActiveSession(this.workerId);
    assertExists(activeSession, 'Stage 2: Active attendance session created in repository');
    assertEqual(activeSession.worker_id, this.workerId, 'Stage 2: Repository session worker_id matches target worker');
    assertEqual(activeSession.check_in_at, checkInRes.timestamp, 'Stage 2: Repository check_in_at matches engine timestamp');

    // Stage 3: Attempt duplicate Clock IN
    let duplicateCheckInThrew = false;
    try {
      await AttendanceEngine.checkIn();
    } catch (err: any) {
      duplicateCheckInThrew = true;
      assertTrue(
        err.message.includes('Cannot check in from state CHECKED_IN'),
        'Stage 3: Duplicate clock-in exception contained expected lifecycle error message'
      );
    }
    assertTrue(duplicateCheckInThrew, 'Stage 3: Attempted duplicate clock-in threw structured lifecycle exception');
    assertEqual(
      AttendanceEngine.status().state,
      AttendanceState.CHECKED_IN,
      'Stage 3: Attendance state remained CHECKED_IN after duplicate clock-in rejection'
    );

    await assertRepositoryCount(
      async () => {
        const pending = await AttendanceRepository.findPending();
        return pending.length;
      },
      1,
      'Stage 3: Repository contains exactly 1 attendance record without duplicate corruption'
    );

    // Stage 4: Retrieve active attendance
    const retrievedSession = await AttendanceRepository.findActiveSession(this.workerId);
    assertExists(retrievedSession, 'Stage 4: Successfully retrieved active attendance session');
    assertEqual(retrievedSession.worker_id, this.workerId, 'Stage 4: Retrieved worker ID matches target');
    assertEqual(retrievedSession.check_in_at, AttendanceEngine.status().checkedInAt, 'Stage 4: Retrieved check-in time matches engine state');
    assertEqual(retrievedSession.check_out_at, null, 'Stage 4: Active session check_out_at is null');

    // Stage 5: Clock OUT
    const checkOutRes = await AttendanceEngine.checkOut();
    assertTrue(checkOutRes.success, 'Stage 5: Clock OUT succeeded via AttendanceEngine public API');
    assertEqual(
      AttendanceEngine.status().state,
      AttendanceState.CHECKED_OUT,
      'Stage 5: Attendance state transitioned to CHECKED_OUT'
    );
    assertExists(checkOutRes.timestamp, 'Stage 5: Clock-out timestamp recorded in result');

    const activePostCheckout = await AttendanceRepository.findActiveSession(this.workerId);
    assertEqual(activePostCheckout, null, 'Stage 5: Verified zero active attendance sessions remain in repository');

    // Stage 6: Attempt duplicate Clock OUT
    let duplicateCheckOutThrew = false;
    try {
      await AttendanceEngine.checkOut();
    } catch (err: any) {
      duplicateCheckOutThrew = true;
      assertTrue(
        err.message.includes('Cannot check out from state CHECKED_OUT'),
        'Stage 6: Duplicate clock-out exception contained expected lifecycle error message'
      );
    }
    assertTrue(duplicateCheckOutThrew, 'Stage 6: Attempted duplicate clock-out threw structured lifecycle exception');
    assertEqual(
      AttendanceEngine.status().state,
      AttendanceState.CHECKED_OUT,
      'Stage 6: Attendance state remained CHECKED_OUT after duplicate clock-out rejection'
    );

    const closedRecord = await AttendanceRepository.findLatest(this.workerId);
    assertExists(closedRecord, 'Stage 6: Closed attendance record preserved in repository');
    assertExists(closedRecord.check_out_at, 'Stage 6: Closed record check_out_at is non-null and intact');
  }

  public async verify(): Promise<void> {
    const status = AttendanceEngine.status();
    assertFrozen(status, 'Verify: AttendanceStatus object is deeply frozen and immutable');
    assertExists(status.checkedInAt, 'Verify: checkedInAt timestamp recorded in final status');
    assertExists(status.checkedOutAt, 'Verify: checkedOutAt timestamp recorded in final status');

    const inTime = new Date(status.checkedInAt!).getTime();
    const outTime = new Date(status.checkedOutAt!).getTime();
    assertTrue(inTime <= outTime, 'Verify: Timestamp ordering guaranteed (checkInAt <= checkOutAt)');

    await assertRepositoryCount(
      async () => {
        const records = await AttendanceRepository.findBetween(this.workerId, '2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z');
        return records.length;
      },
      1,
      'Verify: Total repository attendance record count equals 1'
    );

    await assertDatabaseState(
      async () => {
        const active = await AttendanceRepository.findActiveSession(this.workerId);
        return active === null;
      },
      'Verify: Database state has 0 active attendance sessions'
    );
  }

  public async cleanup(): Promise<void> {
    await AuthenticationEngine.logout();
    UserContextEngine.clear();
    AttendanceEngine.initialize();
    WorkerProfileEngine.initialize();
    await StorageEngine.close();
    assertTrue(!(await StorageEngine.health()), 'Cleanup: StorageEngine cleanly closed');
  }
}
