# Validation Workspace

This directory is the permanent home for every validation harness, regression test, execution utility, and future Quality Gate implementation.

## Architecture & Directory Structure
- `framework.ts`: Core validation framework providing standardized assertions, coverage categorization, and JSON reporting.
- `run.ts`: Central execution runner supporting modular validation execution.
- `repository/`: Validation harnesses for offline-first local repositories (testing SQLite persistence, object mapping, and constraints).
- `engine/`: Validation harnesses for business feature engines (testing state machines, orchestration, and domain logic).
- `integration/`: Validation harnesses for cross-layer component interaction and orchestration flows (Quality Gate 5).
- `cloud/`: Live cloud integration validation against Supabase (Quality Gate 6).
- `synchronization/`: Validation harnesses for offline/online synchronization engines (Quality Gate 6).
- `operational/`: Operational validation framework executing end-to-end multi-step business scenarios (Slice OV-1: Sanity Execution, Slice OV-2: Authentication & Session Lifecycle, Slice OV-3: Attendance Operational Validation, Slice OV-4/OV-4A: GPS Operational Validation & Hardening, Slice OV-5: Complete Local Workday Operational Validation, Slice OV-6: Offline Synchronization & Recovery Operational Validation).
- `production/`: Validation of production readiness (planned).

## Rules
- Validation infrastructure must remain completely isolated from production code (never inside `modules/` or `src/`).
- Validation harnesses must never execute automatically during application startup.
- They must never become part of production builds.
- Future Quality Gates must extend this validation framework rather than creating isolated validation scripts.

## Coverage Matrix Summary

| Validation Module | Target Components Validated | Public APIs Exercised | Status |
| :--- | :--- | :--- | :--- |
| `repository` | `WorkerRepository`, `AttendanceRepository`, `ShiftRepository`, `EventRepository`, `TrustedDeviceRepository` | `create`, `findById`, `append`, `findActiveSession`, `getActiveShift`, `closeShift`, `register`, `approve`, `reject` etc. | ✅ VERIFIED |
| `engine` | `ConfigurationEngine`, `StorageEngine`, `AuthenticationEngine`, `UserContextEngine`, `WorkerAdminEngine`, `WorkerProfileEngine`, `WorkerSyncEngine` | `load`, `initialize`, `health`, `login`, `logout`, `status`, `currentWorker`, `createWorker`, `sync` | ✅ VERIFIED |
| `integration` | Cross-module orchestration flows (`Configuration`→`Auth`, `Auth`→`UserContext`, `UserContext`→`WorkerProfile`, `WorkerAdmin`→`WorkerRepository`, `WorkerAdmin`→`WorkerSync`, `WorkerSync`→`WorkerRepository`, `Storage`→`Repository`) | `load`, `initialize`, `login`, `setCurrentWorker`, `load`, `createWorker`, `updateWorker`, `deactivateWorker`, `sync`, `append`, `createShift`, `appendEvent`, `register` | ✅ VERIFIED |
| `cloud` | Live Supabase configuration, single-instance Auth client, AuthApiError translation, live table queries, seeded data verification, schema check, identity propagation, profile query, admin orchestration, live sync, SDK isolation audit, contract immutability | `load`, `initialize`, `login`, `restoreSession`, `logout`, `setCurrentWorker`, `createWorker`, `sync`, `status` | ✅ VERIFIED |
| `synchronization` | `WorkerSyncEngine`, live Supabase Sync Provider, delta sync pipeline, error recovery, unauthenticated sync rejection, failure rollback | `initialize`, `sync`, `status` | ✅ VERIFIED |
| `operational` | Operational Scenario Runner, Fixtures (Auth, Worker, Attendance, GPS, Shift, Device, Sync, Net, Time), Assertions, End-to-End Operational Workflow Scenarios (OV-1: Sanity, OV-2: Auth, OV-3: Attendance, OV-4/OV-4A: GPS Validation, OV-5: Complete Local Workday, OV-6: Offline Sync & Recovery) | `setup`, `execute`, `verify`, `cleanup`, `runAll`, `AttendanceEngine.checkIn/checkOut`, `LocationEvaluationEngine.evaluate`, `LocationRepository.append`, `ShiftRepository.getActiveShift`, `WorkerSyncEngine.sync` | ✅ VERIFIED |
| `production` | Build assets, Environment, Constraints | N/A (Planned) | ⏳ PENDING |

## Execution Flow & Module Registration
To execute validations, use the central runner:
```bash
# Run all validations
bun validation/run.ts all

# Run specific modules
bun validation/run.ts repository
bun validation/run.ts engine
bun validation/run.ts integration
```

To add future validation modules:
1. Create a new directory (e.g., `integration/`).
2. Create the validation script (e.g., `integration.validation.ts`) importing `assert` and `report` from `../framework`.
3. Call `report('Integration')` at the end of the script.
4. Add the suite name to `SUITES` in `validation/run.ts`.
5. Update the Coverage Matrix above.

## Execution Statistics Summary
The validation framework now reports structured statistics across:
- **Public APIs Validated**: Ensures contract compliance.
- **Lifecycle Checks**: Validates idempotency and state machine transitions.
- **Failure Path Checks**: Validates robust error capturing and custom domain Exceptions.
- **Immutability Checks**: Asserts `Object.freeze` adherence.
- **Architecture Checks**: Asserts module boundary isolation (e.g. no SQL inside engines).
