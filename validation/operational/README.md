# Operational Validation Framework (Subsystem)

## Overview
The **Operational Validation Framework** extends the permanent Validation Framework by providing a high-level, business-scenario testing environment. While the existing unit/integration validation suites verify individual engines and repository boundaries in isolation, the Operational Validation Framework executes **end-to-end multi-step business workflows** against the actual backend engines.

## Key Principles & Architectural Constraints
1. **Zero Production Modification**: Operational validation code resides strictly under `validation/operational/` and is never imported or bundled into production code.
2. **Public API Usage Only**: Scenarios interact exclusively through public module engines (`AuthenticationEngine`, `UserContextEngine`, `WorkerAdminEngine`, `WorkerSyncEngine`, `StorageEngine`, `ConfigurationEngine`) and public Repositories (`WorkerRepository`, `AttendanceRepository`, `ShiftRepository`, `EventRepository`, `TrustedDeviceRepository`).
3. **Engine State Privacy**: Scenarios never inspect private engine fields, execute raw SQL statements, or bypass engine boundaries.
4. **Cloud Isolation Integrity**: Cloud interaction continues strictly through `AuthenticationEngine` or configured sync providers—never by instantiating `SupabaseClient` directly in validation scenarios.

---

## Directory Structure
```
validation/
  operational/
    framework.ts            # Scenario contract interface, phase types, and assertion harness
    runner.ts               # Sequential scenario execution runner, metrics, and JSON reporting
    operational.validation.ts # Entrypoint executable for operational validation suite
    assertions/             # Reusable assertion helpers
      index.ts
    fixtures/               # Scaffolding fixtures for scenario setup & teardown
      auth.fixture.ts
      worker.fixture.ts
      attendance.fixture.ts
      gps.fixture.ts
      shift.fixture.ts
      trusted-device.fixture.ts
      sync.fixture.ts
      connectivity.fixture.ts
      time.fixture.ts
      index.ts
    scenarios/              # Complete operational scenario implementations
      ov1-sanity.scenario.ts
      index.ts
    README.md               # Operational validation framework documentation
```

---

## Scenario Lifecycle Contract
Every operational scenario implements the `OperationalScenario` interface defined in `framework.ts`:

```typescript
export interface OperationalScenario {
  id: string;
  title: string;
  description: string;
  setup(): Promise<void>;
  execute(): Promise<void>;
  verify(): Promise<void>;
  cleanup(): Promise<void>;
}
```

### Lifecycle Phases
1. **`setup()`**: Initializes local storage, engines, configuration, and registers required fixtures/mocks.
2. **`execute()`**: Performs the sequence of business actions (e.g., identity login, worker creation, shift opening, check-in, delta sync).
3. **`verify()`**: Asserts state persistence across Repositories, contract immutability (`Object.isFrozen`), engine status, and data integrity.
4. **`cleanup()`**: Tears down test state, closes database connections, and clears user context to prevent test side effects.

---

## Runner Architecture
The `OperationalScenarioRunner` sequentially processes registered scenarios:
- **Phase Isolation**: Each phase (`setup`, `execute`, `verify`, `cleanup`) is timed and executed in sequence.
- **Failure Resilience**: If a scenario phase fails, emergency cleanup is attempted and execution safely continues to the next scenario without crashing the runner process.
- **Metrics Collection**: Tracks scenario counts (passed/failed/skipped), phase durations, and assertion pass/fail tallies.
- **Structured Output**: Prints formatted CLI logs and emits `___JSON_REPORT___` output for central aggregation by `validation/run.ts`.

---

## Assertion Architecture
The assertion helpers in `validation/operational/assertions/index.ts` automatically register assertion results with `OperationalHarness`:
- `assertEqual(actual, expected, message)`: Value & structural equality check.
- `assertTrue(condition, message)`: Truthiness check.
- `assertFalse(condition, message)`: Falsiness check.
- `assertExists(value, message)`: Non-null and non-undefined check.
- `assertFrozen(obj, message)`: Contract immutability (`Object.isFrozen`) check.
- `assertLifecycle(current, expected, message)`: Engine lifecycle status check.
- `assertRepositoryCount(countFetcher, expectedCount, message)`: Repository row count check.
- `assertDatabaseState(checkFn, message)`: Local SQLite database state condition check.
- `assertSupabaseState(checkFn, message)`: Cloud Supabase data condition check.

---

## Fixture Architecture
Fixtures act as reusable scaffolding adapters for scenarios:
- **`AuthFixture`**: Handles setup and teardown of authenticated sessions via `AuthenticationEngine`.
- **`WorkerFixture`**: Creates and queries worker entities using `WorkerAdminEngine` and `WorkerRepository`.
- **`AttendanceFixture`**: Records check-in sessions and queries active sessions using `AttendanceRepository`.
- **`GPSFixture`**: Generates valid mock GPS coordinates and accuracy metadata.
- **`ShiftFixture`**: Manages active shift opening and querying using `ShiftRepository`.
- **`TrustedDeviceFixture`**: Registers and approves device records using `TrustedDeviceRepository`.
- **`SyncFixture`**: Triggers and queries delta synchronization via `WorkerSyncEngine`.
- **`ConnectivityFixture`**: Simulates online and offline network states for offline-first scenarios.
- **`TimeFixture`**: Provides deterministic ISO timestamp generation and time offsets.

---

## Execution
To run operational validation independently:
```bash
bun validation/run.ts operational
```

To run as part of the complete permanent validation suite:
```bash
bun validation/run.ts all
```
