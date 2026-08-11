import { OperationalScenario } from '../framework';
import {
  assertTrue,
  assertFalse,
  assertEqual,
  assertExists,
  assertFrozen,
  assertAccepted,
  assertRejected,
  assertRepositoryCount,
  assertDatabaseState
} from '../assertions';
import { StorageEngine } from '../../../modules/storage';
import { BunSQLiteAdapter } from '../../repository/bun-sqlite.adapter';
import { ConfigurationEngine } from '../../../modules/configuration';
import { AuthenticationEngine } from '../../../modules/authentication';
import { UserContextEngine, WorkerRole } from '../../../modules/user-context';
import { LocationEvaluationEngine, EvaluationReason, LocationEvaluationResult } from '../../../modules/location-evaluation';
import { AttendanceRepository, LocationRepository } from '../../../modules/repositories';

export interface LocationEvaluationDomainResult {
  readonly accepted: boolean;
  readonly reasons: readonly string[];
  readonly measurements: Record<string, any>;
}

export class OperationalGPSScenario implements OperationalScenario {
  public id = 'OV-SCENARIO-04';
  public title = 'GPS Operational Validation';
  public description = 'Validates realistic location conditions independently through LocationEvaluationEngine.evaluate public API: valid GPS location, outside geofence rejection, poor accuracy rejection, missing coordinates rejection, stale timestamp rejection, impossible coordinates rejection, and rapid GPS jump rejection.';

  private testEmail = 'admin@sapana.local';
  private testPassword = 'Validation@123';
  private geofence = {
    center: { latitude: 13.7563, longitude: 100.5018 },
    radiusMeters: 100
  };
  private evalOptions = {
    maxAccuracyMeters: 50,
    geofence: this.geofence,
    minTimeSeconds: 5
  };

  private evaluationResults: LocationEvaluationResult[] = [];

  public async setup(): Promise<void> {
    // 1. Initialize in-memory SQLite storage
    const adapter = new BunSQLiteAdapter(':memory:');
    await StorageEngine.initialize(adapter);
    assertTrue(await StorageEngine.health(), 'StorageEngine initialized and healthy');

    // 2. Load configuration and initialize required engines
    ConfigurationEngine.load();
    AuthenticationEngine.initialize();
    UserContextEngine.initialize();

    // 3. Authenticate using seeded validation account
    const loginRes = await AuthenticationEngine.login(this.testEmail, this.testPassword);
    assertTrue(loginRes.success, 'AuthenticationEngine login with seeded account succeeded');

    const authUser = AuthenticationEngine.currentUser();
    assertExists(authUser, 'Authenticated user object exists');

    // 4. Establish UserContext identity
    UserContextEngine.setCurrentWorker({
      id: authUser.id,
      email: authUser.email,
      role: 'WORKER' as WorkerRole,
      displayName: 'Admin Worker',
      active: true
    });

    // 5. Ensure AttendanceRepository and LocationRepository are empty
    await assertRepositoryCount(
      async () => {
        const records = await AttendanceRepository.findPending();
        return records.length;
      },
      0,
      'Setup: AttendanceRepository is empty'
    );

    await assertRepositoryCount(
      async () => {
        const locations = await LocationRepository.findPending();
        return locations.length;
      },
      0,
      'Setup: LocationRepository is empty'
    );
  }

  public async execute(): Promise<void> {
    // Scenario A: Valid location
    const validLocation = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 5.0,
      timestamp: new Date().toISOString()
    };
    const resA = LocationEvaluationEngine.evaluate({
      currentLocation: validLocation as any,
      options: this.evalOptions
    });
    assertAccepted(resA, 'Scenario A: Valid location accepted');
    assertTrue(resA.reasons.includes(EvaluationReason.ACCEPTED), 'Scenario A: Reason includes ACCEPTED');
    this.evaluationResults.push(resA);

    // Scenario B: Outside geofence
    const outsideGeofenceLocation = {
      latitude: 14.0000,
      longitude: 101.0000,
      accuracy: 5.0,
      timestamp: new Date().toISOString()
    };
    const resB = LocationEvaluationEngine.evaluate({
      currentLocation: outsideGeofenceLocation as any,
      options: this.evalOptions
    });
    assertRejected(resB, 'Scenario B: Location outside geofence rejected');
    assertTrue(resB.reasons.includes(EvaluationReason.GEOFENCE_REJECTED), 'Scenario B: Reason includes GEOFENCE_REJECTED');
    this.evaluationResults.push(resB);

    // Scenario C: Poor GPS accuracy
    const poorAccuracyLocation = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 150.0,
      timestamp: new Date().toISOString()
    };
    const resC = LocationEvaluationEngine.evaluate({
      currentLocation: poorAccuracyLocation as any,
      options: this.evalOptions
    });
    assertRejected(resC, 'Scenario C: Location with poor accuracy rejected');
    assertTrue(resC.reasons.includes(EvaluationReason.ACCURACY_REJECTED), 'Scenario C: Reason includes ACCURACY_REJECTED');
    this.evaluationResults.push(resC);

    // Scenario D: Missing coordinates
    const missingCoordsLocation = {
      latitude: NaN,
      longitude: 100.5018,
      accuracy: 5.0,
      timestamp: new Date().toISOString()
    };
    const resD = LocationEvaluationEngine.evaluate({
      currentLocation: missingCoordsLocation as any,
      options: this.evalOptions
    });
    assertRejected(resD, 'Scenario D: Location with missing/NaN coordinates rejected');
    assertTrue(resD.reasons.includes(EvaluationReason.INVALID_COORDINATES), 'Scenario D: Reason includes INVALID_COORDINATES');
    this.evaluationResults.push(resD);

    // Scenario E: Stale timestamp
    const staleLocation = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 5.0,
      timestamp: '2026-07-27T08:00:00.000Z'
    };
    const previousTimestamp = '2026-07-27T10:00:00.000Z';
    const resE = LocationEvaluationEngine.evaluate({
      currentLocation: staleLocation as any,
      previousTimestamp,
      options: this.evalOptions
    });
    assertRejected(resE, 'Scenario E: Location with stale timestamp rejected');
    assertTrue(resE.reasons.includes(EvaluationReason.INVALID_TIMESTAMP), 'Scenario E: Reason includes INVALID_TIMESTAMP');
    this.evaluationResults.push(resE);

    // Scenario F: Impossible coordinates (Latitude > 90)
    const impossibleCoordsLocation = {
      latitude: 120.0,
      longitude: 100.5018,
      accuracy: 5.0,
      timestamp: new Date().toISOString()
    };
    const resF = LocationEvaluationEngine.evaluate({
      currentLocation: impossibleCoordsLocation as any,
      options: this.evalOptions
    });
    assertRejected(resF, 'Scenario F: Location with impossible coordinates (Lat = 120 > 90) rejected');
    assertTrue(resF.reasons.includes(EvaluationReason.INVALID_COORDINATES), 'Scenario F: Reason includes INVALID_COORDINATES');
    this.evaluationResults.push(resF);

    // Scenario G: Rapid GPS jump
    const prevLoc = {
      latitude: 13.7563,
      longitude: 100.5018,
      accuracy: 5.0,
      timestamp: '2026-07-27T10:00:00.000Z'
    };
    const jumpLoc = {
      latitude: 18.7883,
      longitude: 98.9853,
      accuracy: 5.0,
      timestamp: '2026-07-27T10:00:02.000Z' // 580km jump in 2 seconds
    };
    const resG = LocationEvaluationEngine.evaluate({
      currentLocation: jumpLoc as any,
      previousLocation: prevLoc as any,
      previousTimestamp: prevLoc.timestamp,
      options: this.evalOptions
    });
    assertRejected(resG, 'Scenario G: Rapid GPS jump across impossible distance rejected');
    assertTrue(resG.reasons.includes(EvaluationReason.SPEED_REJECTED), 'Scenario G: Reason includes SPEED_REJECTED');
    this.evaluationResults.push(resG);
  }

  public async verify(): Promise<void> {
    // 1. Verify returned contracts remain deeply frozen
    for (const res of this.evaluationResults) {
      assertFrozen(res, 'Verify: GPS evaluation contract result is deeply frozen');
    }

    // 2. Verify AttendanceRepository remains untouched
    await assertRepositoryCount(
      async () => {
        const records = await AttendanceRepository.findPending();
        return records.length;
      },
      0,
      'Verify: AttendanceRepository record count remains 0 (untouched)'
    );

    // 3. Verify LocationRepository remains untouched
    await assertRepositoryCount(
      async () => {
        const locations = await LocationRepository.findPending();
        return locations.length;
      },
      0,
      'Verify: LocationRepository record count remains 0 (untouched)'
    );

    // 4. Verify Database State
    await assertDatabaseState(
      async () => {
        const activeSession = await AttendanceRepository.findActiveSession('SYSTEM');
        return activeSession === null;
      },
      'Verify: Database state has zero active attendance sessions'
    );
  }

  public async cleanup(): Promise<void> {
    await AuthenticationEngine.logout();
    UserContextEngine.clear();
    await StorageEngine.close();
    assertTrue(!(await StorageEngine.health()), 'Cleanup: StorageEngine cleanly closed');
  }
}
