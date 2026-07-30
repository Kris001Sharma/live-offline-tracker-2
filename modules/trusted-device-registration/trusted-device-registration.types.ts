export enum TrustedDeviceRegistrationStatus {
  NOT_REGISTERED = 'NOT_REGISTERED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface RegistrationStatus {
  readonly status: TrustedDeviceRegistrationStatus;
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
