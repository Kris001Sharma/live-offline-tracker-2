import { OperationalScenario } from '../framework';
import {
  assertEqual,
  assertTrue,
  assertFalse,
  assertExists,
  assertFrozen,
  assertLifecycle
} from '../assertions';
import { StorageEngine } from '../../../modules/storage';
import { BunSQLiteAdapter } from '../../repository/bun-sqlite.adapter';
import { ConfigurationEngine } from '../../../modules/configuration';
import { 
  AuthenticationEngine, 
  AuthenticationState, 
  AuthenticationErrorCode 
} from '../../../modules/authentication';

export class OperationalAuthenticationScenario implements OperationalScenario {
  public id = 'OV-SCENARIO-02';
  public title = 'Authentication & Session Operational Validation Workflow';
  public description = 'Validates the complete authentication lifecycle against live Supabase backend: unauthenticated state, invalid password translation, seeded account login, session restoration, contract immutability, and logout.';

  private testEmail = 'admin@sapana.local';
  private testPassword = 'Validation@123';

  public async setup(): Promise<void> {
    const adapter = new BunSQLiteAdapter(':memory:');
    await StorageEngine.initialize(adapter);
    assertTrue(await StorageEngine.health(), 'StorageEngine initialized and healthy');

    ConfigurationEngine.load();
    AuthenticationEngine.initialize();

    // Ensure clean initial state via defensive logout
    await AuthenticationEngine.logout();
    assertEqual(
      AuthenticationEngine.status().state, 
      AuthenticationState.UNAUTHENTICATED, 
      'AuthenticationEngine initial state is UNAUTHENTICATED'
    );
  }

  public async execute(): Promise<void> {
    // Stage 1: Initialize AuthenticationEngine & Verify UNAUTHENTICATED
    AuthenticationEngine.initialize();
    assertEqual(
      AuthenticationEngine.status().state, 
      AuthenticationState.UNAUTHENTICATED, 
      'Stage 1: AuthenticationEngine initialized in UNAUTHENTICATED state'
    );

    // Stage 2: Attempt login using intentionally invalid password
    const invalidRes = await AuthenticationEngine.login(this.testEmail, 'invalid-password-999');
    assertFalse(invalidRes.success, 'Stage 2: Invalid password login failed as expected');
    assertEqual(
      invalidRes.errorCode, 
      AuthenticationErrorCode.INVALID_CREDENTIALS, 
      'Stage 2: Error code correctly translated to INVALID_CREDENTIALS'
    );
    assertEqual(
      AuthenticationEngine.status().state, 
      AuthenticationState.UNAUTHENTICATED, 
      'Stage 2: Lifecycle returned to UNAUTHENTICATED after invalid login attempt'
    );
    assertEqual(
      AuthenticationEngine.currentUser(), 
      null, 
      'Stage 2: No active session user exists after failed login'
    );

    // Stage 3: Login using seeded validation account
    const loginRes = await AuthenticationEngine.login(this.testEmail, this.testPassword);
    assertTrue(loginRes.success, 'Stage 3: Login with seeded validation account succeeded');
    assertEqual(
      AuthenticationEngine.status().state, 
      AuthenticationState.AUTHENTICATED, 
      'Stage 3: Authentication state became AUTHENTICATED'
    );

    const currentUser = AuthenticationEngine.currentUser();
    assertExists(currentUser, 'Stage 3: Authenticated user object exists');
    assertEqual(currentUser?.email, this.testEmail, 'Stage 3: Authenticated user email matches seeded account');
    assertExists(currentUser?.id, 'Stage 3: Authenticated user ID exists');

    // Stage 4: Call restoreSession() & state machine validation
    let stateGuardCaught = false;
    try {
      await AuthenticationEngine.restoreSession();
    } catch (err: any) {
      stateGuardCaught = true;
      assertTrue(
        err.message.includes('Cannot restore session from state AUTHENTICATED'),
        'Stage 4: Calling restoreSession from AUTHENTICATED state enforced state machine protection'
      );
    }
    assertTrue(stateGuardCaught, 'Stage 4: State guard correctly prevented duplicate session restoration when already AUTHENTICATED');

    // Verify existing session identity remains unchanged and active
    const activeUser = AuthenticationEngine.currentUser();
    assertExists(activeUser, 'Stage 4: Active session user remains intact');
    assertEqual(activeUser?.email, this.testEmail, 'Stage 4: Session identity unchanged');

    // Stage 5: Call status() & verify contract immutability
    const status = AuthenticationEngine.status();
    assertFrozen(status, 'Stage 5: Status object is deeply frozen and immutable');

    let mutationThrew = false;
    try {
      (status as any).state = 'MUTATED_STATE';
    } catch {
      mutationThrew = true;
    }
    assertTrue(mutationThrew, 'Stage 5: Direct mutation of status object threw an exception');

    // Stage 6: Logout
    const logoutRes = await AuthenticationEngine.logout();
    assertTrue(logoutRes.success, 'Stage 6: Logout succeeded cleanly');
    assertEqual(
      AuthenticationEngine.status().state, 
      AuthenticationState.UNAUTHENTICATED, 
      'Stage 6: Authentication state became UNAUTHENTICATED'
    );
    assertEqual(AuthenticationEngine.currentUser(), null, 'Stage 6: Current user cleared upon logout');

    // Stage 7: Call restoreSession() again
    const restoreAfterLogout = await AuthenticationEngine.restoreSession();
    assertFalse(restoreAfterLogout.success, 'Stage 7: restoreSession returned success=false after session removal');
    assertTrue(
      restoreAfterLogout.errorCode === AuthenticationErrorCode.NO_SESSION || 
      restoreAfterLogout.errorCode === AuthenticationErrorCode.OFFLINE_NO_SESSION,
      'Stage 7: Error code is NO_SESSION or OFFLINE_NO_SESSION'
    );
    assertEqual(
      AuthenticationEngine.status().state, 
      AuthenticationState.UNAUTHENTICATED, 
      'Stage 7: Remained in UNAUTHENTICATED state without runtime exceptions'
    );
  }

  public async verify(): Promise<void> {
    const status = AuthenticationEngine.status();
    assertExists(status.lastLoginAt, 'Verify: lastLoginAt timestamp recorded');
    assertExists(status.lastLogoutAt, 'Verify: lastLogoutAt timestamp recorded');
    assertExists(status.lastRestoreAttemptAt, 'Verify: lastRestoreAttemptAt timestamp recorded');
    assertExists(status.lastAuthenticationFailureAt, 'Verify: lastAuthenticationFailureAt timestamp recorded');
    assertTrue(status.consecutiveFailures >= 0, 'Verify: consecutiveFailures metric tracked');
  }

  public async cleanup(): Promise<void> {
    await AuthenticationEngine.logout();
    await StorageEngine.close();
    assertTrue(!(await StorageEngine.health()), 'StorageEngine cleanly closed during cleanup');
  }
}
