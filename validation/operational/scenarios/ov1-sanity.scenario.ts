import { OperationalScenario } from '../framework';
import {
  assertEqual,
  assertTrue,
  assertExists,
  assertFrozen,
  assertLifecycle
} from '../assertions';
import { StorageEngine } from '../../../modules/storage';
import { BunSQLiteAdapter } from '../../repository/bun-sqlite.adapter';
import { ConfigurationEngine } from '../../../modules/configuration';
import { AuthenticationEngine, AuthenticationState } from '../../../modules/authentication';
import { UserContextEngine, WorkerRole } from '../../../modules/user-context';
import { WorkerAdminEngine } from '../../../modules/worker-administration';
import { WorkerRepository, ShiftRepository, AttendanceRepository } from '../../../modules/repositories';
import { ShiftFixture, AttendanceFixture } from '../fixtures';

export class OperationalSanityScenario implements OperationalScenario {
  public id = 'OV-SCENARIO-01';
  public title = 'End-to-End Operational Workflow Sanity Execution';
  public description = 'Executes a complete business scenario from storage initialization, user context identity, worker admin creation, shift lifecycle, and attendance check-in.';

  private testWorkerId = `op-worker-${Date.now()}`;
  private createdShiftId: string | null = null;
  private createdAttendanceId: string | null = null;

  public async setup(): Promise<void> {
    const adapter = new BunSQLiteAdapter(':memory:');
    await StorageEngine.initialize(adapter);
    assertTrue(await StorageEngine.health(), 'StorageEngine initialized and healthy');

    ConfigurationEngine.load();
    AuthenticationEngine.initialize();
    assertEqual(AuthenticationEngine.status().state, AuthenticationState.UNAUTHENTICATED, 'AuthenticationEngine initial state is UNAUTHENTICATED');

    UserContextEngine.initialize();
  }

  public async execute(): Promise<void> {
    // 1. Establish UserContext identity
    UserContextEngine.setCurrentWorker({
      id: this.testWorkerId,
      email: 'op.sanity@sapana.local',
      role: 'WORKER' as WorkerRole,
      displayName: 'Operational Sanity Worker',
      active: true
    });

    assertTrue(UserContextEngine.status().authenticated, 'UserContextEngine set to authenticated');
    assertEqual(UserContextEngine.workerId(), this.testWorkerId, 'UserContextEngine workerId matches created test worker');

    // 2. Admin Engine creates worker record
    WorkerAdminEngine.initialize();
    const adminRes = await WorkerAdminEngine.createWorker({
      workerId: this.testWorkerId,
      email: 'op.sanity@sapana.local',
      displayName: 'Operational Sanity Worker',
      employeeCode: 'EMP-SANITY',
      role: 'WORKER' as WorkerRole,
      organization: 'Sapana',
      active: true
    });

    assertTrue(adminRes.success, 'WorkerAdminEngine successfully created worker record');

    // 3. Shift lifecycle via ShiftFixture
    this.createdShiftId = await ShiftFixture.createActiveShift(this.testWorkerId);
    assertExists(this.createdShiftId, 'ShiftFixture created active shift ID');

    // 4. Attendance check-in via AttendanceFixture
    const attRecord = await AttendanceFixture.createCheckInRecord(this.testWorkerId, 13.7563, 100.5018);
    this.createdAttendanceId = attRecord.id;
    assertExists(this.createdAttendanceId, 'AttendanceFixture recorded check-in attendance ID');
  }

  public async verify(): Promise<void> {
    // 1. Verify worker persisted in repository
    const workerRepoObj = await WorkerRepository.findById(this.testWorkerId);
    assertExists(workerRepoObj, 'Worker record found in WorkerRepository');
    assertEqual(workerRepoObj.displayName, 'Operational Sanity Worker', 'Worker display name matches');

    // 2. Verify active shift in repository
    const activeShift = await ShiftRepository.getActiveShift();
    assertExists(activeShift, 'Active shift found in ShiftRepository');
    assertEqual(activeShift.worker_id, this.testWorkerId, 'Active shift worker_id matches UserContext');

    // 3. Verify attendance record in repository
    const activeSession = await AttendanceRepository.findActiveSession(this.testWorkerId);
    assertExists(activeSession, 'Active attendance session found in AttendanceRepository');
    assertEqual(activeSession.latitude, 13.7563, 'Check-in latitude matches');

    // 4. Contract immutability verification
    const currentUser = UserContextEngine.currentWorker();
    assertFrozen(currentUser, 'UserContextEngine currentWorker object is deeply frozen');
  }

  public async cleanup(): Promise<void> {
    UserContextEngine.clear();
    await StorageEngine.close();
    assertTrue(!(await StorageEngine.health()), 'StorageEngine cleanly closed');
  }
}
