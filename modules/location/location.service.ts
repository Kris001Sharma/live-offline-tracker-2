import { Geolocation, Position, PermissionStatus as CapacitorPermissionStatus, PositionOptions } from '@capacitor/geolocation';
import { 
  Location, 
  LocationError, 
  LocationErrorCode, 
  LocationPermissionStatus 
} from './location.types';
import { DEFAULT_GEOLOCATION_TIMEOUT_MS, DEFAULT_GEOLOCATION_MAXIMUM_AGE_MS } from './location.constants';

function mapPermissionStatus(status: CapacitorPermissionStatus): LocationPermissionStatus {
  switch (status.location) {
    case 'granted':
      return LocationPermissionStatus.GRANTED;
    case 'denied':
      return LocationPermissionStatus.DENIED;
    case 'prompt':
      return LocationPermissionStatus.PROMPT;
    case 'prompt-with-rationale':
      return LocationPermissionStatus.PROMPT_WITH_RATIONALE;
    default:
      return LocationPermissionStatus.UNAVAILABLE;
  }
}

function mapLocationError(error: any): LocationError {
  const message = error?.message?.toLowerCase() || '';
  
  if (message.includes('permission') || message.includes('denied')) {
    return {
      code: LocationErrorCode.PERMISSION_DENIED,
      message: 'Location permission denied.',
      originalError: error,
    };
  }
  if (message.includes('timeout')) {
    return {
      code: LocationErrorCode.TIMEOUT,
      message: 'Location request timed out.',
      originalError: error,
    };
  }
  if (message.includes('disabled') || message.includes('unavailable')) {
    return {
      code: LocationErrorCode.SERVICES_DISABLED,
      message: 'Location services are disabled.',
      originalError: error,
    };
  }
  
  return {
    code: LocationErrorCode.UNKNOWN_ERROR,
    message: error?.message || 'An unknown location error occurred.',
    originalError: error,
  };
}

function mapPositionToLocation(position: Position): Location {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    timestamp: new Date(position.timestamp).toISOString(),
    altitude: position.coords.altitude ?? null,
    heading: position.coords.heading ?? null,
    speed: position.coords.speed ?? null,
  };
}

export const LocationProvider = {
  async checkPermission(): Promise<LocationPermissionStatus> {
    try {
      const status = await Geolocation.checkPermissions();
      return mapPermissionStatus(status);
    } catch (error) {
      return LocationPermissionStatus.UNAVAILABLE;
    }
  },

  async requestPermission(): Promise<LocationPermissionStatus> {
    try {
      const status = await Geolocation.requestPermissions();
      return mapPermissionStatus(status);
    } catch (error) {
      return LocationPermissionStatus.UNAVAILABLE;
    }
  },

  async getCurrentLocation(options?: PositionOptions): Promise<Location> {
    try {
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: options?.enableHighAccuracy ?? true,
        timeout: options?.timeout ?? DEFAULT_GEOLOCATION_TIMEOUT_MS,
        maximumAge: options?.maximumAge ?? DEFAULT_GEOLOCATION_MAXIMUM_AGE_MS,
      });
      return mapPositionToLocation(position);
    } catch (error) {
      throw mapLocationError(error);
    }
  },
};
