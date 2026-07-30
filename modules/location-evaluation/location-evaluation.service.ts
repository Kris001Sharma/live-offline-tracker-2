import { EARTH_RADIUS_METERS, MAX_SPEED_MPS } from './location-evaluation.constants';
import { 
  LocationEvaluationRequest, 
  LocationEvaluationResult, 
  EvaluationReason,
  EvaluationMetadata,
  Point
} from './location-evaluation.types';

export const LocationEvaluationEngine = {
  evaluate(request: LocationEvaluationRequest): LocationEvaluationResult {
    const reasons: EvaluationReason[] = [];
    let measurements: EvaluationMetadata = {};
    let accepted = true;

    if (!request || !request.currentLocation || !request.options) {
      return Object.freeze({
        accepted: false,
        reasons: Object.freeze([EvaluationReason.INVALID_COORDINATES]),
        measurements: Object.freeze({})
      });
    }

    const { currentLocation, previousLocation, previousTimestamp, options } = request;

    // 1. Required & Defensive Coordinate Validation
    const lat = currentLocation?.latitude;
    const lng = currentLocation?.longitude;

    const isLatValid = typeof lat === 'number' && Number.isFinite(lat) && lat >= -90 && lat <= 90;
    const isLngValid = typeof lng === 'number' && Number.isFinite(lng) && lng >= -180 && lng <= 180;

    if (!isLatValid || !isLngValid) {
      accepted = false;
      reasons.push(EvaluationReason.INVALID_COORDINATES);
    }

    // 2. Defensive Timestamp Validation
    const currentMs = currentLocation?.timestamp ? new Date(currentLocation.timestamp).getTime() : NaN;
    if (isNaN(currentMs)) {
      accepted = false;
      reasons.push(EvaluationReason.INVALID_TIMESTAMP);
    } else if (previousTimestamp !== undefined) {
      const prevMs = new Date(previousTimestamp).getTime();
      if (!isNaN(prevMs) && currentMs < prevMs) {
        accepted = false;
        reasons.push(EvaluationReason.INVALID_TIMESTAMP);
      }
    }

    // If basic input/coordinate/timestamp checks failed, stop further geometric checks
    if (!accepted) {
      return Object.freeze({
        accepted: false,
        reasons: Object.freeze(reasons),
        measurements: Object.freeze(measurements)
      });
    }

    // 3. Speed / Rapid GPS Jump Check
    const maxSpeed = MAX_SPEED_MPS; // Internal immutable max speed 150 m/s (~540 km/h)
    if (previousLocation !== undefined && previousTimestamp !== undefined) {
      const prevMs = new Date(previousTimestamp).getTime();
      if (!isNaN(prevMs) && currentMs > prevMs) {
        const timeElapsedSeconds = (currentMs - prevMs) / 1000;
        const distanceMeters = this.calculateDistance(currentLocation, previousLocation);
        const speedMps = timeElapsedSeconds > 0 ? distanceMeters / timeElapsedSeconds : Infinity;

        measurements = { ...measurements, distanceMeters, timeElapsedSeconds };

        if (speedMps > maxSpeed) {
          accepted = false;
          reasons.push(EvaluationReason.SPEED_REJECTED);
        }
      }
    }

    // 4. Accuracy Check
    if (options.maxAccuracyMeters !== undefined) {
      measurements = { ...measurements, accuracyMeters: currentLocation.accuracy };
      if (currentLocation.accuracy > options.maxAccuracyMeters) {
        accepted = false;
        reasons.push(EvaluationReason.ACCURACY_REJECTED);
      }
    }

    // 5. Time Check
    if (options.minTimeSeconds !== undefined && previousTimestamp !== undefined) {
      const prevMs = new Date(previousTimestamp).getTime();
      if (!isNaN(prevMs)) {
        const timeElapsedSeconds = (currentMs - prevMs) / 1000;
        measurements = { ...measurements, timeElapsedSeconds };

        if (timeElapsedSeconds < options.minTimeSeconds) {
          accepted = false;
          reasons.push(EvaluationReason.TIME_REJECTED);
        }
      }
    }

    // 6. Distance Check
    if (options.minDistanceMeters !== undefined && previousLocation !== undefined) {
      const distanceMeters = this.calculateDistance(currentLocation, previousLocation);
      measurements = { ...measurements, distanceMeters };

      if (distanceMeters < options.minDistanceMeters) {
        accepted = false;
        reasons.push(EvaluationReason.DISTANCE_REJECTED);
      }
    }

    // 7. Geofence Check
    if (options.geofence !== undefined) {
      const distanceToGeofenceCenterMeters = this.calculateDistance(
        currentLocation,
        options.geofence.center
      );
      
      measurements = { ...measurements, distanceToGeofenceCenterMeters };

      if (distanceToGeofenceCenterMeters > options.geofence.radiusMeters) {
        accepted = false;
        reasons.push(EvaluationReason.GEOFENCE_REJECTED);
      }
    }

    if (accepted) {
      reasons.push(EvaluationReason.ACCEPTED);
    }

    return Object.freeze({
      accepted,
      reasons: Object.freeze(reasons),
      measurements: Object.freeze(measurements)
    });
  },

  calculateDistance(point1: Point, point2: Point): number {
    const toRadians = (degrees: number) => degrees * (Math.PI / 180);

    const lat1 = toRadians(point1.latitude);
    const lat2 = toRadians(point2.latitude);
    const deltaLat = toRadians(point2.latitude - point1.latitude);
    const deltaLon = toRadians(point2.longitude - point1.longitude);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return EARTH_RADIUS_METERS * c;
  }
};
