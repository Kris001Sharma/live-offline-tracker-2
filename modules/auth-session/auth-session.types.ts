import { WorkerRole } from '../user-context';
import { AuthenticationErrorCode } from '../authentication';

export interface AuthSessionStatus {
  readonly initialized: boolean;
  readonly authenticated: boolean;
  readonly workerId?: string;
  readonly role?: WorkerRole;
  readonly lastLoginAt?: string;
  readonly lastRestoreAt?: string;
  readonly lastLogoutAt?: string;
}

export interface AuthSessionResult {
  readonly success: boolean;
  readonly error?: string;
  readonly errorCode?: AuthenticationErrorCode;
}
