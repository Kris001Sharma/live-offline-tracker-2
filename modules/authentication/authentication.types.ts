export enum AuthenticationState {
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  AUTHENTICATING = 'AUTHENTICATING',
  AUTHENTICATED = 'AUTHENTICATED',
  REFRESHING = 'REFRESHING',
  LOGGING_OUT = 'LOGGING_OUT'
}

export enum AuthenticationErrorCode {
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  NETWORK_ERROR = 'NETWORK_ERROR',
  SESSION_EXPIRED = 'SESSION_EXPIRED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  OFFLINE_NO_SESSION = 'OFFLINE_NO_SESSION',
  INCONSISTENT_SESSION = 'INCONSISTENT_SESSION',
  NO_SESSION = 'NO_SESSION'
}

export interface AuthenticationStatus {
  readonly state: AuthenticationState;
  readonly userId?: string;
  readonly lastError?: string;
  readonly lastLoginAt?: string;
  readonly lastLogoutAt?: string;
  readonly lastRestoreAttemptAt?: string;
  readonly lastAuthenticationFailureAt?: string;
  readonly consecutiveFailures: number;
}

export interface AuthenticationResult {
  readonly success: boolean;
  readonly state: AuthenticationState;
  readonly error?: string;
  readonly errorCode?: AuthenticationErrorCode;
}

export interface AuthenticatedUser {
  readonly id: string;
  readonly email?: string;
}
