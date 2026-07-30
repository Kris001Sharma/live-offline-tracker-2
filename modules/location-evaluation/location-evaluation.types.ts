import { Location } from '../location';

export interface Point {
  readonly latitude: number;
  readonly longitude: number;
}

export interface Geofence {
  readonly center: Point;
  readonly radiusMeters: number;
}

export interface EvaluationOptions {
  readonly maxAccuracyMeters?: number;
  readonly minDistanceMeters?: number;
  readonly minTimeSeconds?: number;
  readonly geofence?: Geofence;
}

export interface LocationEvaluationRequest {
  readonly currentLocation: Location;
  readonly previousLocation?: Location;
  readonly previousTimestamp?: string;
  readonly options: EvaluationOptions;
}

export enum EvaluationReason {
  ACCURACY_REJECTED = 'ACCURACY_REJECTED',
  DISTANCE_REJECTED = 'DISTANCE_REJECTED',
  TIME_REJECTED = 'TIME_REJECTED',
  GEOFENCE_REJECTED = 'GEOFENCE_REJECTED',
  INVALID_COORDINATES = 'INVALID_COORDINATES',
  INVALID_TIMESTAMP = 'INVALID_TIMESTAMP',
  SPEED_REJECTED = 'SPEED_REJECTED',
  ACCEPTED = 'ACCEPTED'
}

export interface EvaluationMetadata {
  readonly accuracyMeters?: number;
  readonly distanceMeters?: number;
  readonly timeElapsedSeconds?: number;
  readonly distanceToGeofenceCenterMeters?: number;
}

export interface LocationEvaluationResult {
  readonly accepted: boolean;
  readonly reasons: readonly EvaluationReason[];
  readonly measurements: EvaluationMetadata;
}
