export enum TrustedDeviceRegistrationStatus {
  NOT_REGISTERED = 'NOT_REGISTERED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

/**
 * Device verification check outcome, computed by the registration engine for
 * the current worker + current device. This is the domain result the device
 * verification UI consumes.
 */
export enum DeviceVerificationState {
  /** Worker has no active trusted device; the current device may be registered. */
  NOT_REGISTERED = 'NOT_REGISTERED',
  /** The current device is the worker's active trusted device. */
  TRUSTED = 'TRUSTED',
  /** The worker already has a different active trusted device; registration is blocked. */
  DIFFERENT_DEVICE = 'DIFFERENT_DEVICE',
  /** The check could not be evaluated (missing worker/device or persistence failure). */
  ERROR = 'ERROR'
}

export interface RegistrationStatus {
  /** This worker+device registration record status (NOT_REGISTERED when no record or no active device). */
  readonly status: TrustedDeviceRegistrationStatus;
  /** Device verification check outcome for the current worker + current device. */
  readonly verification: DeviceVerificationState;
  readonly message?: string;
}

export enum TrustedDeviceRegistrationResultCode {
  SUCCESS = 'SUCCESS',
  DEVICE_NOT_REGISTERED = 'DEVICE_NOT_REGISTERED',
  APPROVED = 'APPROVED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  DEVICE_MISMATCH = 'DEVICE_MISMATCH',
  PERSISTENCE_ERROR = 'PERSISTENCE_ERROR',
  PRECONDITION_FAILED = 'PRECONDITION_FAILED'
}

export interface TrustedDeviceRegistrationResult {
  readonly success: boolean;
  readonly code: TrustedDeviceRegistrationResultCode;
  readonly error?: string;
}
