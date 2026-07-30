import { createClient, SupabaseClient, AuthError } from '@supabase/supabase-js';
import { ConfigurationEngine } from '../configuration';
import { 
  AuthenticationState, 
  AuthenticationStatus, 
  AuthenticationResult, 
  AuthenticationErrorCode, 
  AuthenticatedUser 
} from './authentication.types';

/**
 * Authentication Engine
 * 
 * Architectural Responsibilities:
 * - Authentication owns session lifecycle (login, logout, restoration).
 * - User Context owns runtime identity.
 * - Worker Profile owns application profile metadata.
 * - Trusted Device owns physical device identity.
 * - Auth Session coordinates these engines.
 */

let currentState: AuthenticationState = AuthenticationState.UNAUTHENTICATED;
let currentUserId: string | undefined;
let lastError: string | undefined;
let supabaseClient: SupabaseClient | null = null;
let currentAuthenticatedUser: AuthenticatedUser | null = null;
let initialized = false;

// Metrics
let lastLoginAt: string | undefined;
let lastLogoutAt: string | undefined;
let lastRestoreAttemptAt: string | undefined;
let lastAuthenticationFailureAt: string | undefined;
let consecutiveFailures: number = 0;

// Rollback state
let previousState: AuthenticationState = AuthenticationState.UNAUTHENTICATED;
let previousUserId: string | undefined;
let previousAuthenticatedUser: AuthenticatedUser | null = null;

function deepCloneAndFreeze<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }
  if (obj instanceof Date) {
    return obj;
  }
  if (Array.isArray(obj)) {
    const arrCopy = obj.map(item => deepCloneAndFreeze(item));
    return Object.freeze(arrCopy) as unknown as T;
  }
  const copy: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      copy[key] = deepCloneAndFreeze((obj as Record<string, any>)[key]);
    }
  }
  return Object.freeze(copy) as unknown as T;
}

function freezeResult(result: AuthenticationResult): AuthenticationResult {
  return deepCloneAndFreeze(result);
}

function saveStateForRollback(): void {
  previousState = currentState;
  previousUserId = currentUserId;
  previousAuthenticatedUser = currentAuthenticatedUser;
}

/**
 * Single rollback path helper.
 * Restores the previous valid authentication state.
 */
function rollbackAuthentication(): void {
  currentState = previousState;
  currentUserId = previousUserId;
  currentAuthenticatedUser = previousAuthenticatedUser;
}

function commitState(): void {
  saveStateForRollback();
}

function handleAuthFailure(errorMsg: string, code: AuthenticationErrorCode): AuthenticationResult {
  rollbackAuthentication();
  lastError = errorMsg;
  lastAuthenticationFailureAt = new Date().toISOString();
  consecutiveFailures += 1;
  return freezeResult({
    success: false,
    state: currentState,
    error: lastError,
    errorCode: code
  });
}

function parseSupabaseError(error: AuthError | null | any): AuthenticationErrorCode {
  if (!error) return AuthenticationErrorCode.UNKNOWN_ERROR;
  const msg = error?.message?.toLowerCase() || '';
  if (error?.status === 400 || msg.includes('credential')) {
    return AuthenticationErrorCode.INVALID_CREDENTIALS;
  } else if (error?.status === 0 || msg.includes('network') || msg.includes('fetch') || msg.includes('failed to fetch')) {
    return AuthenticationErrorCode.NETWORK_ERROR;
  } else if (msg.includes('expire') || msg.includes('refresh') || msg.includes('session')) {
    return AuthenticationErrorCode.SESSION_EXPIRED;
  }
  return AuthenticationErrorCode.UNKNOWN_ERROR;
}

/**
 * Validates session internal consistency before exposing success.
 */
function isSessionConsistent(user: any, session: any): boolean {
  if (!user || !user.id || !user.email) return false;
  if (!session || !session.access_token || !session.refresh_token) return false;
  
  if (session.expires_at) {
    const expiresAt = session.expires_at * 1000;
    if (Date.now() > expiresAt) {
      return false; // Expired session is inconsistent for active auth
    }
  }
  return true;
}

export const AuthenticationEngine = {
  initialize(): void {
    if (initialized) {
      return; // Repeated initialize must never duplicate clients or listeners
    }
    currentState = AuthenticationState.UNAUTHENTICATED;
    currentUserId = undefined;
    currentAuthenticatedUser = null;
    lastError = undefined;
    
    lastLoginAt = undefined;
    lastLogoutAt = undefined;
    lastRestoreAttemptAt = undefined;
    lastAuthenticationFailureAt = undefined;
    consecutiveFailures = 0;
    
    saveStateForRollback();

    const config = ConfigurationEngine.config.environment.supabase;
    supabaseClient = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: false
      }
    });
    initialized = true;
  },

  async login(email: string, password: string): Promise<AuthenticationResult> {
    if (currentState !== AuthenticationState.UNAUTHENTICATED) {
      throw new Error(`Authentication Engine: Cannot login from state ${currentState}`);
    }
    if (!supabaseClient) {
      throw new Error('Authentication Engine is not initialized');
    }
    
    saveStateForRollback();
    currentState = AuthenticationState.AUTHENTICATING;
    lastError = undefined;
    
    try {
      const { data, error } = await supabaseClient.auth.signInWithPassword({
        email,
        password
      });

      if (error) {
        return handleAuthFailure(error.message, parseSupabaseError(error));
      }

      if (!data.user || !data.session) {
        return handleAuthFailure('Authentication failed: No session returned', AuthenticationErrorCode.UNKNOWN_ERROR);
      }

      if (!isSessionConsistent(data.user, data.session)) {
        return handleAuthFailure('Authentication failed: Inconsistent session', AuthenticationErrorCode.INCONSISTENT_SESSION);
      }

      currentState = AuthenticationState.AUTHENTICATED;
      currentUserId = data.user.id;
      currentAuthenticatedUser = Object.freeze({
        id: data.user.id,
        email: data.user.email
      });
      lastLoginAt = new Date().toISOString();
      consecutiveFailures = 0;
      commitState();

      return freezeResult({
        success: true,
        state: currentState
      });
    } catch (err: any) {
      return handleAuthFailure(err.message || String(err), AuthenticationErrorCode.UNKNOWN_ERROR);
    }
  },

  async logout(): Promise<AuthenticationResult> {
    if (!supabaseClient) {
      throw new Error('Authentication Engine is not initialized');
    }
    
    if (currentState === AuthenticationState.UNAUTHENTICATED) {
      // Defensive Logout: Idempotent and successful if already logged out
      return freezeResult({
        success: true,
        state: currentState
      });
    }

    saveStateForRollback();
    currentState = AuthenticationState.LOGGING_OUT;
    lastError = undefined;

    try {
      const { error } = await supabaseClient.auth.signOut();
      if (error) {
        console.warn('Authentication Engine: Supabase sign out failed', error);
      }
    } catch (err: any) {
      console.warn('Authentication Engine: Unexpected error during sign out', err);
    } finally {
      currentState = AuthenticationState.UNAUTHENTICATED;
      currentUserId = undefined;
      currentAuthenticatedUser = null;
      lastLogoutAt = new Date().toISOString();
      commitState();
    }
    
    return freezeResult({
      success: true,
      state: currentState
    });
  },

  async restoreSession(): Promise<AuthenticationResult> {
    if (currentState !== AuthenticationState.UNAUTHENTICATED) {
      throw new Error(`Authentication Engine: Cannot restore session from state ${currentState}`);
    }
    if (!supabaseClient) {
      throw new Error('Authentication Engine is not initialized');
    }
    
    saveStateForRollback();
    currentState = AuthenticationState.REFRESHING;
    lastError = undefined;
    lastRestoreAttemptAt = new Date().toISOString();

    const isOffline = typeof navigator !== 'undefined' && 'onLine' in navigator ? !navigator.onLine : false;

    try {
      const { data, error } = await supabaseClient.auth.getSession();
      
      if (error) {
        return handleAuthFailure(error.message, parseSupabaseError(error));
      }

      if (!data.session) {
        return handleAuthFailure('No active session found', isOffline ? AuthenticationErrorCode.OFFLINE_NO_SESSION : AuthenticationErrorCode.NO_SESSION);
      }

      const sessionObj = data.session;
      const isExpired = sessionObj.expires_at ? (Date.now() > sessionObj.expires_at * 1000) : false;

      if (isExpired) {
        // Attempt to refresh explicitly if expired.
        // If offline, refresh will fail.
        if (isOffline) {
           return handleAuthFailure('Session expired and offline', AuthenticationErrorCode.SESSION_EXPIRED);
        }
        const refreshResult = await supabaseClient.auth.refreshSession();
        if (refreshResult.error) {
           return handleAuthFailure(refreshResult.error.message, parseSupabaseError(refreshResult.error));
        }
        if (!refreshResult.data.session) {
           return handleAuthFailure('Session refresh failed', AuthenticationErrorCode.SESSION_EXPIRED);
        }
        // Use refreshed data
        data.session = refreshResult.data.session;
      }

      if (!isSessionConsistent(data.session.user, data.session)) {
        return handleAuthFailure('Restored session is inconsistent', AuthenticationErrorCode.INCONSISTENT_SESSION);
      }

      currentState = AuthenticationState.AUTHENTICATED;
      currentUserId = data.session.user.id;
      currentAuthenticatedUser = Object.freeze({
        id: data.session.user.id,
        email: data.session.user.email
      });
      consecutiveFailures = 0;
      commitState();

      return freezeResult({
        success: true,
        state: currentState
      });
    } catch (err: any) {
      const code = isOffline ? AuthenticationErrorCode.NETWORK_ERROR : AuthenticationErrorCode.UNKNOWN_ERROR;
      return handleAuthFailure(err.message || String(err), code);
    }
  },

  status(): AuthenticationStatus {
    return deepCloneAndFreeze({
      state: currentState,
      userId: currentUserId,
      lastError,
      lastLoginAt,
      lastLogoutAt,
      lastRestoreAttemptAt,
      lastAuthenticationFailureAt,
      consecutiveFailures
    });
  },

  currentUser(): AuthenticatedUser | null {
    if (currentState !== AuthenticationState.AUTHENTICATED || !currentAuthenticatedUser) {
      return null;
    }
    return deepCloneAndFreeze(currentAuthenticatedUser);
  }
};
