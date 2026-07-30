export enum AttendanceState {
  NOT_CHECKED_IN = 'NOT_CHECKED_IN',
  CHECKING_IN = 'CHECKING_IN',
  CHECKED_IN = 'CHECKED_IN',
  CHECKING_OUT = 'CHECKING_OUT',
  CHECKED_OUT = 'CHECKED_OUT',
  ERROR = 'ERROR'
}

export enum AttendanceErrorCode {
  LIFECYCLE_ERROR = 'LIFECYCLE_ERROR',
  LOCATION_UNAVAILABLE = 'LOCATION_UNAVAILABLE',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  LOCATION_EVALUATION_FAILED = 'LOCATION_EVALUATION_FAILED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  PERSISTENCE_ERROR = 'PERSISTENCE_ERROR'
}

export interface AttendanceStatus {
  readonly state: AttendanceState;
  readonly checkedInAt?: string;
  readonly checkedOutAt?: string;
  readonly lastError?: string;
}

export interface AttendanceResult {
  readonly success: boolean;
  readonly state: AttendanceState;
  readonly timestamp?: string;
  readonly error?: string;
  readonly errorCode?: AttendanceErrorCode;
}
