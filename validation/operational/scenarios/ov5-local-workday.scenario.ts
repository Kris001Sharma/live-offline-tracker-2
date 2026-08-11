import { OperationalScenario } from '../framework';
import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertExists,
  assertFrozen,
  assertRepositoryCount,
  assertDatabaseState,
  assertAccepted,
  assertAttendanceState,
  assertLocationCount,
  assertActiveSession,
  assertNoPendingSync,
  assertRepositoryIntegrity
} from '../assertions';
import { StorageEngine } from '../../../modules/storage';
import { BunSQLiteAdapter } from '../../repository/bun-sqlite.adapter';
import { ConfigurationEngine } from '../../../modules/configuration';
import { AuthenticationEngine } from '../../../modules/authentication';
import { UserContextEngine, WorkerRole } from '../../../modules/user-context';
import { WorkerAdminEngine } from '../../../modules/worker-administration';
import { WorkerProfileEngine } from '../../../modules/worker-profile';
import { AttendanceEngine, AttendanceState } from '../../../modules/attendance';
import { LocationEvaluationEngine, EvaluationReason } from '../../../modules/location-evaluation';
import { AttendanceRepository, LocationRepository, ShiftRepository } from '../../../modules/repositories';
import { LocationProvider } from '../../../modules/location';

export class OperationalLocalWorkdayScenario implements OperationalScenario {
  public id = 'OV-SCENARIO-05';
  public title = 'Complete Local Workday Operational Validation';
  public description = 'Validates a complete offline staff workday end-to-end: setup, shift verification, GPS validation, clock-in, 15 simulated workday location samples, clock-out, final integrity checks, and cleanup.';

  private testEmail = 'admin@sapana.local';
  private testPassword = 'Validation@123';
  private workerId = 'SYSTEM';
  private shiftId = 'SHIFT-LOCAL-WORKDAY-01';

  private geofence = {
    center: {
      latitude: 13.7563,
      longitude: 100.5018
    },
    radiusMeters: 100.0
  };

  private evalOptions = {
    maxAccuracyMeters: 50,
    geofence: this.geofence,
    minTimeSeconds: 5
  };

  public async setup(): Promise<void> {
    // Phase 1 Setup: Initialize environment & engines
    process.env.VITE_ATTENDANCE_GEOFENCE_LAT = '13.7563';
    process.env.VITE_ATTENDANCE_GEOFENCE_LNG = '100.5018';
    process.env.VITE_ATTENDANCE_GEOFENCE_RADIUS = '100';

    const adapter = new BunSQLiteAdapter(':memory:');
    await StorageEngine.initialize(adapter);
    assertTrue(await StorageEngine.health(), 'Phase 1: StorageEngine initialized and healthy');

    ConfigurationEngine.load();
    AuthenticationEngine.initialize();
    UserContextEngine.initialize();
    WorkerProfileEngine.initialize();
    WorkerAdminEngine.initialize();
    AttendanceEngine.initialize();

    // Authenticate worker
    const loginRes = await AuthenticationEngine.login(this.testEmail, this.testPassword);
    assertTrue(loginRes.success, 'Phase 1: AuthenticationEngine login with seeded account succeeded');

    const authUser = AuthenticationEngine.currentUser();
    assertExists(authUser, 'Phase 1: Authenticated user object exists');
    this.workerId = 'SYSTEM';

    // Establish UserContext & Profile
    UserContextEngine.setCurrentWorker({
      id: this.workerId,
      email: authUser.email,
      role: 'WORKER' as WorkerRole,
      displayName: 'Local Workday Worker',
      active: true
    });

    await WorkerAdminEngine.createWorker({
      workerId: this.workerId,
      email: authUser.email,
      displayName: 'Local Workday Worker',
      employeeCode: 'EMP-LOCAL-001',
      role: 'WORKER' as WorkerRole,
      organization: 'Sapana',
      active: true
    });

    const profileRes = await WorkerProfileEngine.load();
    assertTrue(profileRes.success, 'Phase 1: WorkerProfileEngine loaded worker profile');

    // Create active shift in ShiftRepository
    const now = new Date().toISOString();
    await ShiftRepository.createShift({
      id: this.shiftId,
      worker_id: this.workerId,
      status: 'ACTIVE',
      started_at: now,
      ended_at: null
    });

    // Configure LocationProvider mock
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

    // Initial assertions
    assertAttendanceState(AttendanceEngine.status().state, AttendanceState.NOT_CHECKED_IN, 'Phase 1: Attendance state is NOT_CHECKED_IN');
    await assertActiveSession(() => AttendanceRepository.findActiveSession(this.workerId), false, 'Phase 1: No active attendance session exists during setup');
    await assertLocationCount(() => LocationRepository.findPending().then(l => l.length), 0, 'Phase 1: No pending location records during setup');
    await assertNoPendingSync(() => AttendanceRepository.findPending(), 'Phase 1: No pending attendance sync records during setup');
  }

  public async execute(): Promise<void> {
    // Phase 2: Shift Verification
    const activeShift = await ShiftRepository.getActiveShift();
    assertExists(activeShift, 'Phase 2: Active shift retrieved from ShiftRepository');
    assertEqual(activeShift.worker_id, this.workerId, 'Phase 2: Active shift belongs to current worker');
    assertEqual(activeShift.status, 'ACTIVE', 'Phase 2: Shift status is ACTIVE');
    assertEqual(activeShift.ended_at, null, 'Phase 2: Shift ended_at is null');

    // Phase 3: GPS Validation
    const initialLocation = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 5.0,
      timestamp: new Date().toISOString()
    };

    const initialGpsEval = LocationEvaluationEngine.evaluate({
      currentLocation: initialLocation as any,
      options: this.evalOptions
    });
    assertAccepted(initialGpsEval, 'Phase 3: Initial GPS fix within geofence accepted');
    assertTrue(initialGpsEval.reasons.includes(EvaluationReason.ACCEPTED), 'Phase 3: GPS evaluation reason includes ACCEPTED');

    // Phase 4: Clock In
    const checkInRes = await AttendanceEngine.checkIn();
    assertTrue(checkInRes.success, 'Phase 4: Attendance check-in executed successfully');
    assertAttendanceState(AttendanceEngine.status().state, AttendanceState.CHECKED_IN, 'Phase 4: Attendance state transitioned to CHECKED_IN');
    assertExists(checkInRes.timestamp, 'Phase 4: Check-in timestamp recorded');

    const activeSession = await AttendanceRepository.findActiveSession(this.workerId);
    assertExists(activeSession, 'Phase 4: Exactly one active attendance session recorded in repository');
    assertEqual(activeSession.worker_id, this.workerId, 'Phase 4: Session worker_id matches target worker');

    // Phase 5: Simulated Workday (15 Location Observations)
    const totalSamples = 15;
    const startTimeMs = new Date(checkInRes.timestamp!).getTime();

    let prevLoc = { ...initialLocation };
    let prevTimeStr = checkInRes.timestamp!;

    for (let i = 1; i <= totalSamples; i++) {
      // Simulate movement within geofence spaced by 10 seconds
      const sampleTime = new Date(startTimeMs + i * 10000).toISOString();
      const sampleLoc = {
        latitude: 13.7563 + i * 0.00001, // ~1.1 meter step
        longitude: 100.5018 + i * 0.00001,
        accuracy: 4.5,
        timestamp: sampleTime
      };

      const evalRes = LocationEvaluationEngine.evaluate({
        currentLocation: sampleLoc as any,
        previousLocation: prevLoc as any,
        previousTimestamp: prevTimeStr,
        options: this.evalOptions
      });

      assertAccepted(evalRes, `Phase 5: Sample ${i}/${totalSamples} GPS observation accepted`);

      // Persist into LocationRepository
      await LocationRepository.append({
        id: `LOC-WORKDAY-${i}`,
        shift_id: this.shiftId,
        worker_id: this.workerId,
        latitude: sampleLoc.latitude,
        longitude: sampleLoc.longitude,
        accuracy: sampleLoc.accuracy,
        speed: 1.2,
        recorded_at: sampleTime
      });

      // Verify increment after each insert
      await assertLocationCount(
        async () => {
          const records = await LocationRepository.findBetween(this.workerId, '2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z');
          return records.length;
        },
        i,
        `Phase 5: LocationRepository count verified at ${i}`
      );

      // Verify active attendance session count remains exactly 1
      await assertRepositoryCount(
        async () => {
          const active = await AttendanceRepository.findActiveSession(this.workerId);
          return active ? 1 : 0;
        },
        1,
        `Phase 5: Active attendance session count unaffected after sample ${i}`
      );

      prevLoc = sampleLoc;
      prevTimeStr = sampleTime;
    }

    // Phase 6: Clock Out
    const checkOutRes = await AttendanceEngine.checkOut();
    assertTrue(checkOutRes.success, 'Phase 6: Attendance check-out executed successfully');
    assertAttendanceState(AttendanceEngine.status().state, AttendanceState.CHECKED_OUT, 'Phase 6: Attendance state transitioned to CHECKED_OUT');
    assertExists(checkOutRes.timestamp, 'Phase 6: Check-out timestamp recorded');

    await assertActiveSession(() => AttendanceRepository.findActiveSession(this.workerId), false, 'Phase 6: Zero active attendance sessions remain in repository');

    const completedAttendance = await AttendanceRepository.findLatest(this.workerId);
    assertExists(completedAttendance, 'Phase 6: Completed attendance record present in repository');
    assertExists(completedAttendance.check_out_at, 'Phase 6: Check-out timestamp non-null in repository');

    // Verify location records linked to active shift and worker
    const workdayLocations = await LocationRepository.findBetween(this.workerId, '2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z');
    assertEqual(workdayLocations.length, totalSamples, 'Phase 6: All 15 location records retrieved from repository');
    assertTrue(workdayLocations.every(l => l.shift_id === this.shiftId), 'Phase 6: All location records linked to correct shift_id');
    assertTrue(workdayLocations.every(l => l.worker_id === this.workerId), 'Phase 6: All location records linked to correct worker_id');
  }

  public async verify(): Promise<void> {
    // Phase 7: Final Verification
    const profile = WorkerProfileEngine.profile();
    assertExists(profile, 'Phase 7: WorkerProfile remains intact and accessible in READY state');
    assertEqual(profile.workerId, this.workerId, 'Phase 7: WorkerProfile workerId matches expected target worker');

    const currentWorker = UserContextEngine.currentWorker();
    assertExists(currentWorker, 'Phase 7: UserContext worker exists');
    assertEqual(currentWorker.id, this.workerId, 'Phase 7: UserContext identity unchanged');

    await assertRepositoryIntegrity(
      async () => {
        const records = await AttendanceRepository.findBetween(this.workerId, '2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z');
        return records.length === 1 && records[0].check_in_at !== null && records[0].check_out_at !== null;
      },
      'Phase 7: AttendanceRepository integrity verified (exactly 1 closed record)'
    );

    await assertRepositoryIntegrity(
      async () => {
        const locations = await LocationRepository.findBetween(this.workerId, '2000-01-01T00:00:00Z', '2100-01-01T00:00:00Z');
        return locations.length === 15;
      },
      'Phase 7: LocationRepository integrity verified (exactly 15 persisted GPS samples)'
    );

    assertTrue(await StorageEngine.health(), 'Phase 7: StorageEngine healthy');

    const authUser = AuthenticationEngine.currentUser();
    assertExists(authUser, 'Phase 7: Authentication session remains active and valid');

    await assertNoPendingSync(
      () => AttendanceRepository.findPending(),
      'Phase 7: Pending offline attendance records present without sync errors'
    );
  }

  public async cleanup(): Promise<void> {
    // Phase 8: Cleanup
    await AuthenticationEngine.logout();
    UserContextEngine.clear();
    AttendanceEngine.initialize();
    WorkerProfileEngine.initialize();
    await StorageEngine.close();
    assertTrue(!(await StorageEngine.health()), 'Phase 8: StorageEngine cleanly closed during cleanup');
  }
}
