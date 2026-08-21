import { AuthenticationEngine, AuthenticatedUser, AuthenticationState } from '../authentication';
import { UserContextEngine, CurrentWorker, WorkerRole } from '../user-context';
import { WorkerRepository } from '../repositories';
import { AuthSessionStatus, AuthSessionResult } from './auth-session.types';
import { TrustedDeviceSyncEngine } from '../trusted-device-sync/trusted-device-sync.service';
import { SyncEngine } from '../sync/sync.service';

let initialized = false;
let lastLoginAt: string | undefined;
let lastRestoreAt: string | undefined;
let lastLogoutAt: string | undefined;

function mapToWorker(authUser: AuthenticatedUser): CurrentWorker {
  // Temporary mapping until Worker repository is introduced.
  // Using placeholder values for displayName, role, active.
  return {
    id: authUser.id,
    email: authUser.email || '',
    displayName: authUser.email || 'Unknown User',
    role: 'WORKER' as WorkerRole,
    active: true
  };
}

async function rollbackSession(): Promise<void> {
  try {
    const authStatus = AuthenticationEngine.status();
    if (authStatus.state !== AuthenticationState.UNAUTHENTICATED) {
      await AuthenticationEngine.logout();
    }
  } catch (error) {
    // Ignore rollback errors
  } finally {
    UserContextEngine.clear();
  }
}

async function materializeWorker(worker: CurrentWorker): Promise<void> {
  try {
    const existing = await WorkerRepository.findById(worker.id);
    if (!existing) {
      await WorkerRepository.create({
        workerId: worker.id,
        email: worker.email,
        displayName: worker.displayName,
        role: worker.role,
        active: worker.active
      });
    }
  } catch (error) {
    // Non-blocking: login/restore must not fail because local worker persistence failed.
  }
}

function deepFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  Object.keys(obj as any).forEach(prop => {
    const val = (obj as any)[prop];
    if (typeof val === 'object' && val !== null && !Object.isFrozen(val)) {
      deepFreeze(val);
    }
  });
  return Object.freeze(obj);
}

export const AuthSession = {
  initialize(): void {
    if (!initialized) {
      AuthenticationEngine.initialize();
      UserContextEngine.initialize();
      initialized = true;
    }
  },

  async login(email: string, password: string): Promise<AuthSessionResult> {
    const authResult = await AuthenticationEngine.login(email, password);

    if (!authResult.success) {
      return Object.freeze({
        success: false,
        error: authResult.error,
        errorCode: authResult.errorCode
      });
    }

    try {
      const authUser = AuthenticationEngine.currentUser();
      if (!authUser) {
        throw new Error('Authentication succeeded but no user was returned');
      }

      const worker = mapToWorker(authUser);

      // Atomic Session Construction
      if (!worker.id || !worker.email || !worker.role || !worker.displayName) {
        throw new Error('Invalid worker mapping. Missing required fields.');
      }

      UserContextEngine.setCurrentWorker(worker);

      // Validate both are populated
      if (!UserContextEngine.isAuthenticated() || AuthenticationEngine.status().state !== AuthenticationState.AUTHENTICATED) {
         throw new Error('Failed to establish complete session');
      }

      await materializeWorker(worker);

      // Initialize and configure trusted device sync with Supabase
      TrustedDeviceSyncEngine.initialize();
      SyncEngine.initialize(TrustedDeviceSyncEngine);

      // Trigger trusted device synchronization (non-blocking to login response)
      // This ensures the trusted device is synced to supervisor after login
      TrustedDeviceSyncEngine.syncTrustedDevice().catch(error => {
        // Log synchronization errors but don't block login
        console.error('[TrustDeviceSync] Synchronization failed:', error);
      });

      lastLoginAt = new Date().toISOString();
      return Object.freeze({ success: true });
    } catch (error: any) {
      await rollbackSession();

      return Object.freeze({
        success: false,
        error: error.message || String(error),
        errorCode: undefined
      });
    }
  },

  async logout(): Promise<AuthSessionResult> {
    const userContextStatus = UserContextEngine.status();
    const authStatus = AuthenticationEngine.status();

    // Defensive logout
    if (!userContextStatus.authenticated && authStatus.state === AuthenticationState.UNAUTHENTICATED) {
      return Object.freeze({ success: true });
    }

    try {
      const authResult = await AuthenticationEngine.logout();
      return Object.freeze({
        success: authResult.success,
        error: authResult.error,
        errorCode: authResult.errorCode
      });
    } finally {
      UserContextEngine.clear();
      lastLogoutAt = new Date().toISOString();
    }
  },

  async restore(): Promise<AuthSessionResult> {
    const authResult = await AuthenticationEngine.restoreSession();

    if (!authResult.success) {
      await rollbackSession();
      return Object.freeze({
        success: false,
        error: authResult.error,
        errorCode: authResult.errorCode
      });
    }

    try {
      const authUser = AuthenticationEngine.currentUser();
      if (!authUser) {
         throw new Error('Session restored but no user was returned');
      }

      const worker = mapToWorker(authUser);

      if (!worker.id || !worker.email || !worker.role || !worker.displayName) {
        throw new Error('Invalid worker mapping during restore');
      }

      UserContextEngine.setCurrentWorker(worker);

      // Restore Validation
      if (!UserContextEngine.isAuthenticated() || AuthenticationEngine.status().state !== AuthenticationState.AUTHENTICATED) {
         throw new Error('Partial session state after restore');
      }

      await materializeWorker(worker);

      // Initialize and configure trusted device sync with Supabase
      TrustedDeviceSyncEngine.initialize();
      SyncEngine.initialize(TrustedDeviceSyncEngine);

      // Trigger trusted device synchronization (non-blocking to login response)
      // This ensures the trusted device is synced to supervisor after session restore
      TrustedDeviceSyncEngine.syncTrustedDevice().catch(error => {
        // Log synchronization errors but don't block login/restore
        console.error('[TrustDeviceSync] Synchronization failed:', error);
      });

      lastRestoreAt = new Date().toISOString();
      return Object.freeze({ success: true });
    } catch (error: any) {
      await rollbackSession();

      return Object.freeze({
        success: false,
        error: error.message || String(error),
        errorCode: undefined
      });
    }
  },

  status(): AuthSessionStatus {
    const userContextStatus = UserContextEngine.status();

    // Frozen Session Status
    return deepFreeze({
      initialized,
      authenticated: userContextStatus.authenticated,
      workerId: userContextStatus.currentWorkerId,
      role: userContextStatus.role,
      lastLoginAt,
      lastRestoreAt,
      lastLogoutAt
    });
  }
};