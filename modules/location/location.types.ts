export interface Location {
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
  readonly timestamp: string;
  readonly altitude?: number | null;
  readonly heading?: number | null;
  readonly speed?: number | null;
}

export enum LocationPermissionStatus {
  GRANTED = 'GRANTED',
  DENIED = 'DENIED',
  PROMPT = 'PROMPT',
  PROMPT_WITH_RATIONALE = 'PROMPT_WITH_RATIONALE',
  UNAVAILABLE = 'UNAVAILABLE'
}

export enum LocationErrorCode {
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  POSITION_UNAVAILABLE = 'POSITION_UNAVAILABLE',
  TIMEOUT = 'TIMEOUT',
  SERVICES_DISABLED = 'SERVICES_DISABLED',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

export interface LocationError {
  readonly code: LocationErrorCode;
  readonly message: string;
  readonly originalError?: unknown;
}
