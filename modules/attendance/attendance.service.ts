import { AttendanceState, AttendanceStatus, AttendanceResult, AttendanceErrorCode } from './attendance.types';
import { LocationProvider, LocationErrorCode } from '../location';
import { LocationEvaluationEngine, LocationEvaluationRequest } from '../location-evaluation';
import { ConfigurationEngine } from '../configuration';
import { AttendanceRepository } from '../repositories';
import { EventEngine } from '../event';
import { EventType } from '../domain';

let currentState: AttendanceState = AttendanceState.NOT_CHECKED_IN;
let checkedInAt: string | undefined;
let checkedOutAt: string | undefined;
let lastError: string | undefined;
let activeAttendanceId: string | undefined;

/**
 * Restores the engine to its previous state if an operation fails or is rejected.
 * Attendance never owns GPS validation or location logic; it acts only as an orchestrator.
 * State and timestamps are only committed after a fully successful location validation and persistence.
 */
function rollback(state: AttendanceState, inAt: string | undefined, outAt: string | undefined, attendanceId: string | undefined): void {
  currentState = state;
  checkedInAt = inAt;
  checkedOutAt = outAt;
  activeAttendanceId = attendanceId;
}

async function logEventSafe(type: EventType, payload: unknown): Promise<void> {
  try {
    await EventEngine.createEvent({
      type,
      workerId: 'SYSTEM',
      payload
    });
  } catch (error) {
    // Suppress event generation failure to prevent corrupting attendance transactions
    console.warn(`[AttendanceEngine] Failed to log event ${type}:`, error);
  }
}

export const AttendanceEngine = {
  initialize(): void {
    currentState = AttendanceState.NOT_CHECKED_IN;
    checkedInAt = undefined;
    checkedOutAt = undefined;
    lastError = undefined;
    activeAttendanceId = undefined;
  },

  async checkIn(): Promise<AttendanceResult> {
    if (currentState !== AttendanceState.NOT_CHECKED_IN && currentState !== AttendanceState.CHECKED_OUT) {
      throw new Error(`Attendance Engine: Cannot check in from state ${currentState}`);
    }

    const previousState = currentState;
    const previousInAt = checkedInAt;
    const previousOutAt = checkedOutAt;
    const previousAttendanceId = activeAttendanceId;

    currentState = AttendanceState.CHECKING_IN;
    lastError = undefined;

    try {
      const config = ConfigurationEngine.config;
      const geofence = config.runtime.attendance?.geofence;

      if (!geofence || typeof geofence.center.latitude !== 'number' || typeof geofence.center.longitude !== 'number' || geofence.radiusMeters <= 0 || isNaN(geofence.center.latitude) || isNaN(geofence.center.longitude) || isNaN(geofence.radiusMeters)) {
        rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
        await logEventSafe(EventType.ATTENDANCE_ERROR, {
          action: 'checkIn',
          error: 'Invalid attendance configuration'
        });
        return Object.freeze({
          success: false,
          state: currentState,
          error: 'Invalid attendance configuration',
          errorCode: AttendanceErrorCode.UNKNOWN_ERROR
        });
      }
      
      let location;
      try {
        location = await LocationProvider.getCurrentLocation();
      } catch (error: any) {
        rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
        const code = error?.code === LocationErrorCode.PERMISSION_DENIED ? AttendanceErrorCode.PERMISSION_DENIED : AttendanceErrorCode.LOCATION_UNAVAILABLE;
        const msg = error?.message || 'Failed to acquire location';
        await logEventSafe(EventType.ATTENDANCE_ERROR, {
          action: 'checkIn',
          error: msg,
          code
        });
        return Object.freeze({
          success: false,
          state: currentState,
          error: msg,
          errorCode: code
        });
      }

      const request: LocationEvaluationRequest = {
        currentLocation: location,
        options: {
          maxAccuracyMeters: config.runtime.gps.accuracyThresholdMeters,
          geofence
        }
      };

      const evaluation = LocationEvaluationEngine.evaluate(request);

      if (!evaluation.accepted) {
        rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
        await logEventSafe(EventType.ATTENDANCE_LOCATION_REJECTED, {
          action: 'checkIn',
          reasons: evaluation.reasons
        });
        return Object.freeze({
          success: false,
          state: currentState,
          error: `Location validation failed: ${evaluation.reasons.join(', ')}`,
          errorCode: AttendanceErrorCode.LOCATION_EVALUATION_FAILED
        });
      }

      const now = new Date().toISOString();
      const newAttendanceId = crypto.randomUUID();

      try {
        await AttendanceRepository.append({
          id: newAttendanceId,
          worker_id: 'SYSTEM', // Hardcoded as per current conventions
          check_in_at: now,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          accuracy: location.coords.accuracy
        });
      } catch (error) {
        rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
        await logEventSafe(EventType.ATTENDANCE_PERSISTENCE_FAILED, {
          action: 'checkIn',
          error: error instanceof Error ? error.message : String(error)
        });
        return Object.freeze({
          success: false,
          state: currentState,
          error: error instanceof Error ? error.message : String(error),
          errorCode: AttendanceErrorCode.PERSISTENCE_ERROR
        });
      }

      // Commit only after successful validation and persistence
      currentState = AttendanceState.CHECKED_IN;
      checkedInAt = now;
      checkedOutAt = undefined;
      activeAttendanceId = newAttendanceId;

      await logEventSafe(EventType.ATTENDANCE_CHECKED_IN, {
        attendanceId: newAttendanceId,
        timestamp: now
      });

      return Object.freeze({
        success: true,
        state: currentState,
        timestamp: checkedInAt
      });
    } catch (error) {
      rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
      await logEventSafe(EventType.ATTENDANCE_ERROR, {
        action: 'checkIn',
        error: error instanceof Error ? error.message : String(error)
      });
      return Object.freeze({
        success: false,
        state: currentState,
        error: error instanceof Error ? error.message : String(error),
        errorCode: AttendanceErrorCode.UNKNOWN_ERROR
      });
    }
  },

  async checkOut(): Promise<AttendanceResult> {
    if (currentState !== AttendanceState.CHECKED_IN) {
      throw new Error(`Attendance Engine: Cannot check out from state ${currentState}`);
    }

    const previousState = currentState;
    const previousInAt = checkedInAt;
    const previousOutAt = checkedOutAt;
    const previousAttendanceId = activeAttendanceId;

    currentState = AttendanceState.CHECKING_OUT;
    lastError = undefined;

    try {
      const config = ConfigurationEngine.config;
      const geofence = config.runtime.attendance?.geofence;

      if (!geofence || typeof geofence.center.latitude !== 'number' || typeof geofence.center.longitude !== 'number' || geofence.radiusMeters <= 0 || isNaN(geofence.center.latitude) || isNaN(geofence.center.longitude) || isNaN(geofence.radiusMeters)) {
        rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
        await logEventSafe(EventType.ATTENDANCE_ERROR, {
          action: 'checkOut',
          error: 'Invalid attendance configuration'
        });
        return Object.freeze({
          success: false,
          state: currentState,
          error: 'Invalid attendance configuration',
          errorCode: AttendanceErrorCode.UNKNOWN_ERROR
        });
      }
      
      let location;
      try {
        location = await LocationProvider.getCurrentLocation();
      } catch (error: any) {
        rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
        const code = error?.code === LocationErrorCode.PERMISSION_DENIED ? AttendanceErrorCode.PERMISSION_DENIED : AttendanceErrorCode.LOCATION_UNAVAILABLE;
        const msg = error?.message || 'Failed to acquire location';
        await logEventSafe(EventType.ATTENDANCE_ERROR, {
          action: 'checkOut',
          error: msg,
          code
        });
        return Object.freeze({
          success: false,
          state: currentState,
          error: msg,
          errorCode: code
        });
      }

      const request: LocationEvaluationRequest = {
        currentLocation: location,
        options: {
          maxAccuracyMeters: config.runtime.gps.accuracyThresholdMeters,
          geofence
        }
      };

      const evaluation = LocationEvaluationEngine.evaluate(request);

      if (!evaluation.accepted) {
        rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
        await logEventSafe(EventType.ATTENDANCE_LOCATION_REJECTED, {
          action: 'checkOut',
          reasons: evaluation.reasons
        });
        return Object.freeze({
          success: false,
          state: currentState,
          error: `Location validation failed: ${evaluation.reasons.join(', ')}`,
          errorCode: AttendanceErrorCode.LOCATION_EVALUATION_FAILED
        });
      }

      const now = new Date().toISOString();
      
      let currentId = activeAttendanceId;
      if (!currentId) {
        // Fallback in case memory state was lost but state machine was manually restored
        const activeSession = await AttendanceRepository.findActiveSession('SYSTEM');
        if (activeSession) {
          currentId = activeSession.id;
        } else {
          rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
          await logEventSafe(EventType.ATTENDANCE_PERSISTENCE_FAILED, {
            action: 'checkOut',
            error: 'No active attendance record found to checkout'
          });
          return Object.freeze({
            success: false,
            state: currentState,
            error: 'No active attendance record found to checkout',
            errorCode: AttendanceErrorCode.PERSISTENCE_ERROR
          });
        }
      }

      try {
        await AttendanceRepository.updateCheckOut(currentId, now);
      } catch (error) {
        rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
        await logEventSafe(EventType.ATTENDANCE_PERSISTENCE_FAILED, {
          action: 'checkOut',
          error: error instanceof Error ? error.message : String(error)
        });
        return Object.freeze({
          success: false,
          state: currentState,
          error: error instanceof Error ? error.message : String(error),
          errorCode: AttendanceErrorCode.PERSISTENCE_ERROR
        });
      }

      // Commit only after successful validation and persistence
      currentState = AttendanceState.CHECKED_OUT;
      checkedOutAt = now;
      activeAttendanceId = undefined;

      await logEventSafe(EventType.ATTENDANCE_CHECKED_OUT, {
        attendanceId: currentId,
        timestamp: now
      });

      return Object.freeze({
        success: true,
        state: currentState,
        timestamp: checkedOutAt
      });
    } catch (error) {
      rollback(previousState, previousInAt, previousOutAt, previousAttendanceId);
      await logEventSafe(EventType.ATTENDANCE_ERROR, {
        action: 'checkOut',
        error: error instanceof Error ? error.message : String(error)
      });
      return Object.freeze({
        success: false,
        state: currentState,
        error: error instanceof Error ? error.message : String(error),
        errorCode: AttendanceErrorCode.UNKNOWN_ERROR
      });
    }
  },

  status(): AttendanceStatus {
    return Object.freeze({
      state: currentState,
      checkedInAt,
      checkedOutAt,
      lastError
    });
  }
};
