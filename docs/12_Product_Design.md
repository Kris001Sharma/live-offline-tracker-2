# Product Design

## Purpose

The Worker Application enables field workers to manage daily operations seamlessly in offline and connected environments. Key functional capabilities include:

- Authenticating securely on assigned devices.
- Recording time-stamped, location-verified attendance.
- Tracking live background location automatically during active work sessions.
- Synchronizing offline records transparently when connectivity is available.
- Providing an extensible base for future field operation capabilities.

---

## User Roles

- **Worker**: Field employee who performs daily attendance check-ins, check-outs, tasks, and location tracking on physical mobile devices.
- **Administrator**: Field operations supervisor who manages worker assignments, geofences, device registrations, and reviews operational records via the admin web dashboard.
- **Super Administrator**: System executive who configures system-wide parameters, global organization policies, and access controls.

---

## Worker Journey

```
Open Application
      ↓
Login
      ↓
Device Verification
      ↓
Dashboard
      ↓
Check In
      ↓
Automatic Location Tracking
      ↓
Check Out
      ↓
Synchronization
```

1. **Open Application**: The worker launches the mobile application on their mobile device.
2. **Login**: Session is automatically restored from cached credentials or authenticated via primary credentials/biometrics.
3. **Device Verification**: The app confirms the physical device matches the worker's registered trusted device.
4. **Dashboard**: Displays active operational status, shift details, and sync status.
5. **Check In**: Worker initiates attendance check-in.
6. **Automatic Location Tracking**: Background location tracking starts automatically upon successful check-in.
7. **Check Out**: Worker completes shift check-out. Background tracking stops automatically.
8. **Synchronization**: Queued records sync asynchronously with the backend.

---

## Worker Dashboard

The dashboard serves as the central operational hub, presenting key functional areas without unnecessary UI complexity:

- **Attendance**: Status controls for Check In and Check Out.
- **Tracking Status**: Real-time indicator of active background tracking engine state.
- **Sync Status**: Indicator showing queue state for pending offline sync items.
- **Current Shift**: Summary of active check-in timestamp and duration.
- **Profile**: Basic identity details and assigned worker ID.
- **Settings**: Device preferences and diagnostics.
- **Future Modules**: Extensible container for upcoming field features.

---

## Attendance Experience

### Check In
When a worker selects Check In:
1. The application verifies the device identity.
2. Obtains current GPS coordinates.
3. Validates position against the configured site geofence and accuracy threshold.
4. Prompts for a live attendance selfie photo.
5. Persists the attendance record locally and transitions status to checked-in.

### Check Out
When a worker selects Check Out:
1. Performs identical device and location validation.
2. Updates the active attendance record with the check-out timestamp.
3. Stops active background location tracking.

---

## Tracking Experience

- **Automatic Lifecycle**: Location tracking begins automatically upon successful attendance check-in and terminates upon check-out.
- **Zero Manual Input**: Workers do not manually log individual GPS coordinates or manage tracking intervals.
- **Background Execution**: Tracking operates continuously in the background while the worker performs field activities.

---

## Offline Behaviour

- The application is strictly Offline-First.
- Attendance check-in and check-out function fully without internet connectivity.
- Location tracking records continue to be captured and stored locally in offline storage.
- Operational flows remain uninterrupted regardless of network status.

---

## Sync Experience

The application presents simple, high-level indicators reflecting synchronization status:

- **Pending**: Local records exist that have not yet synced.
- **Syncing**: Background sync transaction currently in progress.
- **Synced**: All local records match remote server state.
- **Failed**: A sync attempt encountered an error; automatic retry scheduled.

Worker manual intervention is not required under normal operating conditions.

---

## Device Management

- Each worker is bound to one single trusted physical device.
- Changing or registering a new device requires administrator approval.
- Unauthorized or unapproved devices cannot record attendance or location tracking data.

---

## Selfie Verification

- Attendance check-in requires capturing a live selfie photograph.
- Selecting photos from device photo galleries or external files is strictly prohibited.
- Selfies serve as operational evidence for auditing.
- Facial recognition or automated biometric matching is not performed locally; human verification is performed by administrators when necessary.

---

## Future Features

The product model reserves extension capabilities for future domain modules:

- **Tasks**: Assignment and status management for field tasks.
- **Client Visits**: Registration and reporting for client site visits.
- **Forms**: Customizable mobile forms for site assessments.
- **Asset Inspection**: Auditing and condition logging for physical equipment.
- **Leave Management**: Submission and approval tracking for worker leave.
- **Notifications**: System and operational alerts.
- **Reports**: Individual worker activity logs and summaries.

---

## Product Principles

- **Simple**: Clean, focused workflows with clear outcomes.
- **Offline First**: All primary transactions complete locally first.
- **Reliable**: Resilient against network drops, app restarts, and hardware variance.
- **Minimal Interaction**: Automated background tracking minimizes manual data entry.
- **Low Technical Complexity**: Direct operational paths with predictable state transitions.
- **Operationally Resilient**: Fault tolerance ensuring data preservation.

---

## Acceptance Criteria

- Worker journey and operational lifecycle are frozen.
- Product behavior across online, offline, and background states is frozen.
- Extensibility structure for future operational modules is defined.
- No UI layout, color palette, or framework design choices are included.
