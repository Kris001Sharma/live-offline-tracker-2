import { AuthenticationEngine, AuthenticatedUser, AuthenticationState } from '../authentication';
import { UserContextEngine, CurrentWorker, WorkerRole } from '../user-context';
import { AuthSessionStatus, AuthSessionResult } from './auth-session.types';

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

      lastLoginAt = new Date().toISOString();
      return Object.freeze({ success: true });
    } catch (error: any) {
      await rollbackSession();
      
      return Object.freeze({
        success: false,
        error: error.message || String(error)
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

      lastRestoreAt = new Date().toISOString();
      return Object.freeze({ success: true });
    } catch (error: any) {
      await rollbackSession();
      return Object.freeze({
        success: false,
        error: error.message || String(error)
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
