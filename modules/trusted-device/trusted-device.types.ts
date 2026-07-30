export enum TrustedDeviceState {
  EMPTY = 'EMPTY',
  LOADING = 'LOADING',
  READY = 'READY',
  CLEARED = 'CLEARED'
}

export interface TrustedDeviceIdentity {
  readonly deviceId: string;
  readonly manufacturer: string;
  readonly model: string;
  readonly platform: string;
  readonly operatingSystem: string;
  readonly operatingSystemVersion: string;
  readonly appVersion: string;
}

export interface TrustedDeviceStatus {
  readonly initialized: boolean;
  readonly state: TrustedDeviceState;
  readonly lastLoadedAt?: string;
}

export enum TrustedDeviceErrorCode {
  INITIALIZATION_ERROR = 'INITIALIZATION_ERROR',
  DEVICE_ERROR = 'DEVICE_ERROR',
  LIFECYCLE_ERROR = 'LIFECYCLE_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR'
}

export interface TrustedDeviceResult {
  readonly success: boolean;
  readonly error?: string;
  readonly errorCode?: TrustedDeviceErrorCode;
}
