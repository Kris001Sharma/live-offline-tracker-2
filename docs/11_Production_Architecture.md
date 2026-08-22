# Production Architecture

## Purpose

This document defines the production architecture of the Worker Platform. It documents the production technology choices, security boundaries, authentication model, deployment architecture, and operational principles.

---

## Architecture Overview

The Worker Platform follows an Offline-First architecture where mobile devices operate independently of network connectivity, using local storage for primary data transactions and synchronizing with the central backend asynchronously.

```
Worker Mobile App
      ↓
Offline SQLite
      ↓
Sync Engine
      ↓
Supabase Backend
      ↓
Admin Dashboard
```

- **Worker Mobile App**: Runs on the physical mobile device and handles user interactions and local workflows.
- **Offline SQLite**: Serves as the primary local source of truth on the mobile device.
- **Sync Engine**: Handles bidirectional, asynchronous synchronization between SQLite and Supabase.
- **Supabase Backend**: Functions as the central source of truth after synchronization, hosting relational data and authentication services.
- **Admin Dashboard**: Web interface for management, configuration, monitoring, and reporting.

---

## Production Technology Stack

- **Mobile Client**: Capacitor, React, TypeScript
- **Offline Database**: Local SQLite
- **Backend Service**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **Object Storage**: Cloudinary
- **Administration**: Web Dashboard (React / TypeScript)

---

## Authentication Strategy

- Workers authenticate once using Supabase Auth.
- The authenticated session token and refresh token are cached securely on the device in local secure storage.
- The application never requests credentials repeatedly during standard usage.
- Session renewal occurs automatically in the background whenever network connectivity is available.
- The application relies strictly on secure device storage mechanisms to protect tokens.

---

## Device Registration Strategy

- Each worker is assigned exactly one trusted physical device.
- Upon initial registration/provisioning, a unique device identifier is securely stored on the device and registered on the backend.
- Every attendance and tracking operation validates against the registered device identifier.
- Transferring or changing a worker's assigned device requires explicit administrator approval.
- Multiple simultaneous devices for a single worker are not supported.

---

## Worker Login Experience

### First Login
- Credentials required: Email and Password.
- Upon successful authentication, the device binding and cached session are established.

### Subsequent App Launches
- The app automatically restores the cached session token.

### Re-Authentication / Unlocking
- Native biometric authentication (Fingerprint / Face ID) is preferred when supported by the device.
- Fallback: Device PIN / Screen Lock.
- Fallback to password occurs only when biometric/PIN options fail or session tokens expire invalidly.
- Goal: Minimal friction for daily worker workflows.

---

## Admin Authentication

- Administrators authenticate using Supabase Auth.
- Authorization is strictly enforced using Role-Based Access Control (RBAC).
- Field workers cannot access administrative features or API endpoints.
- No secondary or independent authentication system exists; Supabase Auth manages all identities.

---

## User Roles

- **Worker**: Field worker performing check-in, check-out, tracking, tasks, and submission of field data on mobile devices.
- **Administrator**: Operational manager supervising teams, managing geofences, reviewing attendance/tracking records, and approving device registration changes via the dashboard.
- **Super Administrator**: System owner managing system-wide configuration, administrative access control, and global parameters.

---

## Image Storage Strategy

- Binary image files (e.g., attendance selfies, inspection images, evidence photos) are uploaded directly to Cloudinary.
- Supabase stores only image metadata (URL, public ID, timestamp, entity reference).
- Mobile devices cache binary images temporarily in local offline storage until synchronization occurs.
- SQLite never stores binary image data (BLOBs); only local file paths or remote metadata URLs are stored locally.

---

## Offline Synchronization

- SQLite is always the primary local source of truth on the mobile device.
- Synchronization between SQLite and Supabase is strictly asynchronous and decoupled from local transaction execution.
- Operational actions (check-in, check-out, location logging) never block or fail due to network state or connectivity issues.

---

## Security Principles

- **Least Privilege**: Users and services operate with minimal necessary access rights.
- **Offline-First Security**: Local data is encrypted at rest; tokens are stored in secure platform storage.
- **Client Key Isolation**: The Supabase `Service Role Key` is strictly forbidden inside mobile or web clients; client access uses `Anon Key` with Row Level Security (RLS).
- **Authentication Engine Supabase Client Ownership**: `AuthenticationEngine` is the sole module permitted to instantiate and own the `SupabaseClient`. Repository modules, Feature Engines, Synchronization Engines, and UI components are strictly prohibited from directly importing `@supabase/supabase-js` or constructing Supabase clients. All future cloud interactions must occur exclusively through `AuthenticationEngine` (or a dedicated Cloud API layer introduced by a future architecture phase).
- **Transport Security**: HTTPS and TLS 1.3 for all network communication.
- **Device Binding**: Only verified, registered devices can emit location and attendance events.
- **Role-Based Authorization**: Strict authorization checks on backend endpoints and UI interfaces.

---

## Scalability

The architecture is designed to support the expansion of future domain modules without changing the core platform, engines, or storage interfaces:
- Attendance
- Tracking
- Client Visits
- Tasks
- Forms
- Inspections
- Assets
- Geofencing

---

## Out of Scope

This document intentionally excludes:
- Database table schemas and migration SQL
- Internal Engine method implementations
- Repository SQL query definitions
- API endpoint payload contracts
- UI design tokens and visual layouts

---

## Acceptance Criteria

- Production stack is frozen.
- Authentication model is frozen.
- Device registration strategy is frozen.
- Image storage strategy is frozen.
- Deployment architecture is frozen.
- Future module implementations will adhere to these established boundaries without requiring foundational architectural re-engineering.

---

## Architecture Baseline (Post-Phase 8 Validation)

### Verified Subsystems
The following completed engines have been audited and verified for production:
- Configuration Engine
- Storage Engine (SQLite)
- Migration Engine
- Location Provider (GPS)
- Location Evaluation Engine
- Tracking Engine (Orchestration)
- Tracking Session (Scheduler)
- Tracking Health (Diagnostics)
- Attendance Engine (Lifecycle)
- Attendance Repository
- Event Engine
- Authentication Engine (Lifecycle)
- User Context Engine (Runtime Identity)
- Worker Profile Engine (Business Profile)
- Auth Session Engine (Orchestration)
- Trusted Device Engine (Device Identity)
- Trusted Device Registration Engine (Workflow)

- Sync Engine (Orchestration, Pipeline, Retry, Conflict)
- Connectivity Engine (Network Monitoring)
All listed engines are officially frozen.

### Current Dependency Graph
The baseline enforces a strict unidirectional dependency graph with no upward dependencies or circular imports:
`Sync Engine` -> `Connectivity Engine` -> `Authentication` -> `User Context` -> `Worker Profile` -> `Auth Session` -> `Attendance` -> `Tracking` -> `Repositories` -> `Storage` -> `SQLite`.

### Engine & Repository Ownership
- **Engines** own orchestration and business rules (e.g. tracking rules, attendance states, profile handling).
- **Repositories** strictly own SQL execution, persistence mapping, and lookup queries. No business logic resides in repositories.

### Offline-First Readiness
Every completed subsystem (Tracking, Attendance, Events, Repositories, Authentication, Trusted Device, Synchronization) has been verified to function autonomously without cloud connectivity. Data transactions securely persist to local SQLite. The Synchronization subsystem correctly short-circuits when offline and guarantees no loss of local operational capability.

### Architectural Health & Rollback Strategy
- Every module enforces consistent, atomic rollback behavior (e.g. `rollbackAuthentication()`, `rollbackSession()`, `rollbackRegistration()`) to prevent partial or corrupt states.
- All exported state (`status()`, identities, profiles, registrations) are guaranteed immutable via deep cloning and freezing.
- ADR compliance has been audited with **no deviations detected**.

### Outstanding Risks & Next Steps
- Cloud backend connectivity and HTTP synchronization implementations are deferred to the cloud integration phases.
- **Phase 9 (Administration)** will introduce the required operational, reporting, and management layers.

## Deferred Architectural Decisions

The following improvements have been intentionally deferred because they belong to later implementation phases and introducing them earlier would violate slice boundaries.

- Phase 11
  - Durable synchronization outbox / background sync queue.
  - Connectivity-triggered automatic synchronization.
  - Background retry scheduling.

- Future Infrastructure
  - StorageEngine transaction() helper for multi-repository atomic operations.

- Future Authentication
  - Runtime role/token propagation after administrative role changes.

This prevents the same recommendations from appearing repeatedly during future audits.

## Quality Gate 3: Repository Validation Status
All Repositories (`WorkerRepository`, `AttendanceRepository`, `ShiftRepository`, `EventRepository`, `TrustedDeviceRepository`) have been comprehensively validated through a dedicated, isolated Validation Workspace. 

The validation proved that:
- Repositories are **completely decoupled** from any specific SQLite driver or runtime environment (they function flawlessly against both the `BunSQLiteAdapter` and potentially standard web SQLite).
- All SQLite operations map to predictable, strongly-typed domain errors (e.g., `WorkerRepositoryError.WORKER_ALREADY_EXISTS`).
- Foreign keys and constraints (such as `NOT NULL`) execute safely and reliably.
- No business logic leaks into the data access layer.

Repositories are considered **production-ready** and their public API contracts are now frozen.

## Quality Gate 4: Engine Validation Status
All Engines (`ConfigurationEngine`, `StorageEngine`, `AuthenticationEngine`, `UserContextEngine`, `WorkerAdminEngine`, `WorkerProfileEngine`, `WorkerSyncEngine`) have been comprehensively validated through a dedicated, isolated Validation Workspace. The validation proved that:
- Engines correctly manage runtime state, orchestration, and domain logic.
- Lifecycle methods (`initialize`, `load`) are fully idempotent and handle state transitions correctly.
- Strict architectural boundaries are maintained (no Engine executes direct SQL, and `AuthenticationEngine` remains the sole owner of the `SupabaseClient`).
- Public API responses use strongly-typed Result structures, and all status objects are appropriately deep frozen (immutable).
Engines are considered **production-ready** and their behavior is validated against the application requirements.

## Quality Gate 5: Integration Validation Status
All interaction boundaries and orchestration flows across implemented engines, repositories, and infrastructure have been comprehensively validated through the permanent Validation Framework (`validation/integration/integration.validation.ts`).

The validation proved that:
- **`ConfigurationEngine` → `AuthenticationEngine`**: Configuration parameters are correctly propagated during initialization without state corruption or circular dependencies.
- **`AuthenticationEngine` → `UserContextEngine`**: Authenticated identity flows seamlessly into runtime user context while enforcing strict payload validation and clean rollback on invalid data.
- **`UserContextEngine` → `WorkerProfileEngine`**: Profile loading retrieves matching worker records from `WorkerRepository` based on active user context identity and produces deep-frozen immutable domain profiles.
- **`WorkerAdministrationEngine` → `WorkerRepository`**: CRUD operations execute predictably through repository data boundaries, updating local SQLite persistence and mapping repository errors to standardized admin domain error codes.
- **`WorkerAdministrationEngine` → `WorkerSyncEngine`**: Administrative mutations fire non-blocking synchronization notifications (`pendingSync`), updating sync metadata without blocking local transactions.
- **`WorkerSyncEngine` → `WorkerRepository`**: Synchronizes remote worker changes directly into SQLite repository persistence when authenticated, rejecting unauthenticated sync attempts cleanly.
- **`StorageEngine` → `Repository`**: Repositories exclusively own SQL query generation and execution through `StorageEngine`, maintaining clean offline-first operation without SQL leakage into feature engines.

Quality Gate 5 is **VERIFIED** and cross-layer integration boundaries are officially frozen.

## Quality Gate 6: Cloud Integration Validation Status
The complete backend architecture has been validated against the live Supabase project (`https://ejluwdwklieobrknnboh.supabase.co`) using configured environment variables, seeded database records, and deployed schemas through the permanent Validation Framework (`validation/cloud/cloud.validation.ts` and `validation/synchronization/synchronization.validation.ts`).

The validation proved that:
- **Environment & Configuration**: `ConfigurationEngine` correctly loads HTTPS `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- **Single-Instance Auth Client**: `AuthenticationEngine` initializes a single, thread-safe Supabase client. Repeated initialization calls are strictly idempotent and create zero duplicate client instances or event listeners.
- **Deterministic Auth Error Translation**: Live auth failures (e.g., invalid credentials, missing session) are mapped from raw `AuthApiError` objects into strongly-typed `AuthenticationErrorCode` enumerations (`INVALID_CREDENTIALS`, `NO_SESSION`, `NETWORK_ERROR`).
- **Live Supabase Data & Seeded Reference Records**: Seeded reference data (`worker-admin`, `worker-active-a`, `worker-active-b`, `worker-inactive`) is queryable and verified across live Supabase tables (`workers`, `attendance`, `shifts`, `events`, `trusted_devices`).
- **Live Schema Integrity**: Deployed Supabase schema structures match application contract definitions without missing tables or pending migrations.
- **SDK Isolation Audit**: Pure architectural containment is maintained. Zero modules outside `modules/authentication/authentication.service.ts` import `@supabase/supabase-js`.
- **Offline-First Persistence Isolation**: All local application data operations persist strictly through local SQLite Repositories (`WorkerRepository`, `AttendanceRepository`, `ShiftRepository`, `EventRepository`, `TrustedDeviceRepository`), maintaining autonomous offline capabilities.
- **Live Cloud Synchronization**: `WorkerSyncEngine` executes delta synchronization using a live Supabase provider, fetching remote worker changes from Supabase and updating local SQLite repositories.
- **Deep Contract Immutability**: All status objects and public result payloads across all 7 engines remain deeply frozen (`Object.isFrozen`) and immutable.

Quality Gate 6 is **VERIFIED** and cloud integration boundaries are officially frozen.

## Operational Validation Layer (Slice OV-1)
The application incorporates a permanent **Operational Validation Layer** (`validation/operational/`) that extends the core Validation Framework. While lower-level validation suites (`repository`, `engine`, `integration`, `cloud`, `synchronization`) test isolated components, boundaries, and individual interfaces, the Operational Validation Layer proves complete multi-step business scenarios against the implemented backend infrastructure.

### Ownership & Structural Relationship
- **Relationship**: Extends `validation/framework.ts` and integrates into central execution runner `validation/run.ts` under the `operational` suite target.
- **Scenario Lifecycle Contract**: Every business workflow scenario implements `OperationalScenario` with four strict, isolated phases: `setup()`, `execute()`, `verify()`, and `cleanup()`.
- **Runner Architecture**: `OperationalScenarioRunner` executes scenarios sequentially, tracks metrics (duration, scenario pass/fail counts, assertion counts), isolates scenario failures, and outputs structured CLI & JSON reporting.
- **Scaffolding Fixtures**: Provides modular domain fixtures (`AuthFixture`, `WorkerFixture`, `AttendanceFixture`, `GPSFixture`, `ShiftFixture`, `TrustedDeviceFixture`, `SyncFixture`, `ConnectivityFixture`, `TimeFixture`) to simplify scenario setup and cleanup.
- **Assertion Engine**: Exposes domain assertions (`assertEqual`, `assertTrue`, `assertFalse`, `assertExists`, `assertFrozen`, `assertLifecycle`, `assertRepositoryCount`, `assertDatabaseState`, `assertSupabaseState`) that automatically record results into the operational test harness.
- **Strict Isolation**: Zero imports by production code; zero runtime impact; interacts strictly via public module engines and repositories.

## Validation Framework (Permanent Subsystem)
The application includes a permanent Validation Framework established during Quality Gate 4A and extended during Quality Gates 5, 6, and Slice OV-1. This subsystem provides a structured, modular environment for validating architectural integrity, module isolation, failure paths, and operational business workflows.

**Core Principles:**
- Complete isolation from production builds (resides entirely in `validation/`).
- Extensible, modular execution runner (`run.ts`) supporting targeted execution (`repository`, `engine`, `integration`, `cloud`, `synchronization`, `operational`).
- Standardized assertions categorized by: Public APIs, Lifecycle, Failure Paths, Immutability, Architecture, and Operational Business Workflows.
- Zero reliance on production databases; operates exclusively against an in-memory test database via `BunSQLiteAdapter`.

---

## Backend Freeze Policy (Release Candidate 1)

The backend has achieved **Backend Release Candidate 1 (RC1)** status following comprehensive validation across all unit, integration, cloud, synchronization, and operational scenario suites.

### 1. Frozen Modules List
The following 9 core engines and 5 repositories constitute the frozen backend architecture:
- **Core Infrastructure**: `ConfigurationEngine`, `StorageEngine`, `ConnectivityEngine`
- **Identity & Authentication**: `AuthenticationEngine`, `UserContextEngine`, `WorkerProfileEngine`, `TrustedDeviceEngine`
- **Domain Operations**: `AttendanceEngine`, `LocationEvaluationEngine`, `WorkerAdminEngine`
- **Synchronization**: `WorkerSyncEngine`
- **Repositories**: `WorkerRepository`, `AttendanceRepository`, `LocationRepository`, `ShiftRepository`, `TrustedDeviceRepository`

### 1.A. Trusted Device Stability Rule
The now-verified Trusted Device subsystem is a frozen baseline.
Future work must not modify:
- trusted-device authority logic;
- trusted-device decision logic;
- registration semantics;
- reconciliation semantics;
- administrator reset semantics;
- worker trusted-device enforcement;

unless:
- a verified defect requires the change, or
- an explicitly approved feature requires the change.

Do not modify the Trusted Device subsystem merely to accommodate future administrative functionality.

### 2. Contract Stability Statement
All public interfaces, method signatures, domain types, result codes, error classes, and state status objects exposed by the frozen modules are officially immutable. The Phase 10 Application Shell & UI layer must integrate against these exact contracts without altering method signatures or underlying data structures.

### 3. Permitted Future Backend Changes
Following this freeze, modifications to backend modules are strictly restricted to:
- **Critical Production Bug Fixes**: Correcting verified security vulnerabilities or runtime crash defects.
- **Security & Infrastructure Patching**: Upgrading low-level database drivers or SDK security patches without API changes.
- **Performance Optimizations**: Internal query optimization or indexing that preserves 100% contract compatibility.
- **Phase 11 Enhancements**: Approved future hardening features documented in product roadmap (e.g., background push synchronization, durable outbox queueing).

Any structural modification or API contract change requires an approved **Architecture Decision Record (ADR)** prior to implementation.




## Application Lifecycle

- The Application Shell owns the lifecycle exclusively (`src/shell/lifecycle`).
- The lifecycle model manages only high-level application states (`NOT_INITIALIZED`, `INITIALIZING`, `READY`, `ERROR`).
- Engine initialization updates the lifecycle state during bootstrap.
- Consumers may READ lifecycle state through the public API (`useApplicationLifecycle`) but may NOT mutate it.
- Feature components must not own, initialize, or anticipate lifecycle details.

### Initialization Ownership (ADR-012)

`StorageEngine.initialize()`

- Sequentially idempotent
- Concurrently single-flight
- Safe for any caller
- Independent of ApplicationLifecycle

`ApplicationLifecycle`

- Owns bootstrap orchestration
- Does not own StorageEngine API correctness

### Bootstrap Serialization (ADR-013)

`ApplicationLifecycle` serializes the complete application bootstrap sequence (`src/shell/lifecycle.context.tsx`). The protected sequence is:

```
ConfigurationEngine.load()
        ↓
StorageEngine.initialize()
        ↓
ConnectivityEngine.initialize()
        ↓
AuthenticationEngine.initialize()
        ↓
UserContextEngine.initialize()
        ↓
WorkerProfileEngine.initialize()
        ↓
AuthSession.initialize()
        ↓
TrustedDeviceEngine.initialize()
        ↓
TrustedDeviceEngine.load()
        ↓
READY
```

`AuthSession` is the application-facing session orchestrator that coordinates `AuthenticationEngine` and `UserContextEngine` (established by Slice 10A.5-R). `TrustedDeviceEngine` owns runtime device identity, which is application-level and independent of authentication (the engine contract: "a device exists even before login"); it is therefore initialized and loaded during bootstrap, not after login. `TrustedDeviceEngine.load()` never rejects (it returns a structured `DEVICE_ERROR` result on failure and degrades to `CLEARED`), so a device-load failure cannot block `READY`.

> **Connectivity Lifecycle Note**: `ConnectivityEngine.initialize()` resets the engine to its initial `STOPPED`/offline state. `ConnectivityEngine.startMonitoring()` transitions the engine to `MONITORING` and seeds `isOnline` from the native network, but it is **not currently invoked during bootstrap**. Until `startMonitoring()` is integrated into the lifecycle, `ConnectivityEngine.isOnline()` will report `false` and trusted-device verification will select `LOCAL_FALLBACK` even when the native Android network is connected.

The bootstrap entry point is single-flight:

- **Concurrent bootstrap**: A caller that arrives while a bootstrap is running joins the in-flight bootstrap instead of starting a second sequence.
- **Retry after failure**: A failed bootstrap clears its in-flight state and transitions to `ERROR`; a subsequent Retry Bootstrap starts a fresh sequence.
- **Sequential post-success invocation**: Once `READY` is reached, the bootstrap is never restarted.

React StrictMode development double-invocation therefore executes at most one bootstrap sequence and reaches `READY` once. The shell serializes bootstrap and does not duplicate `StorageEngine`'s single-flight implementation.

### Verified Root Cause — Connectivity Lifecycle and Trusted Device Authority (Slice 10A.6.Y)

Status: VERIFIED
Evidence source: Physical Android validation with automatic diagnostic trace.
Date: 2026-08-21

The trusted-device verification problem was initially investigated as a trusted-device/local-storage/reconciliation defect. Physical Android validation has now established that the failure occurs earlier in the execution chain.

#### Verified Physical Evidence

- `nativeConnected = true`
- `nativeConnectionType = wifi`
- `ConnectivityEngine.state = STOPPED`
- `ConnectivityEngine.isOnline() = false`
- `comparisonResult = ENGINE_OFFLINE_NATIVE_ONLINE`
- `trustedDeviceAuthorityPathSelected = LOCAL_FALLBACK`

#### Resulting Execution Path

```
Authentication
→ ConnectivityEngine reports offline
→ Trusted Device verification selects local fallback
→ local SQLite state determines the decision
```

This means the application does not reach the required Supabase-authority path while this condition exists.

#### Verified Root Cause

`ConnectivityEngine.initialize()` establishes/resets the engine into its initial stopped/offline state. `ConnectivityEngine.startMonitoring()` exists but is not currently invoked by the application lifecycle. Consequently, the engine does not transition into its monitoring/online state even when the native Android network is available. `ConnectivityEngine.isOnline()` therefore remains `false`. This causes trusted-device verification to select `LOCAL_FALLBACK`.

#### Architectural Consequence

The trusted-device registration/reconciliation layer is downstream of this failure. While the connectivity lifecycle is incorrectly reporting offline:

- Supabase trusted-device authority is not reached.
- Local SQLite state can influence the trusted-device decision.
- Stale local trusted-device records can therefore appear to be the primary cause.
- Reconciliation changes cannot reliably solve the root problem because the authoritative server state was never consulted.

Therefore:

> Connectivity readiness must be established before online trusted-device authority evaluation.

#### Required Authority Model

When network connectivity is genuinely available:

```
Authentication
↓
Connectivity readiness
↓
Supabase authority lookup
↓
Trusted-device decision
```

Supabase is authoritative. Local trusted-device state must not override Supabase while the application is online. The trusted-device decision must produce exactly one of:

**TRUSTED** — Supabase has an approved trusted device matching the current device. → Allow application access.

**NOT_REGISTERED** — Supabase has no approved trusted device for the worker. → Present the Register this device action.

**DIFFERENT_DEVICE** — Supabase has an approved trusted device belonging to another device. → Block application access.

Only genuine offline operation may use the local fallback path.

#### Verified Product Flow

The intended product behavior remains:

```
Authenticate
↓
Ask server
↓
Is this device trusted?
├── YES → ENTER
├── NO → REGISTER
└── OTHER DEVICE → BLOCK
```

This flow must not be implemented by allowing local SQLite state to substitute for Supabase when the device is actually online.

#### Implementation Ownership

The verified defect belongs to the Connectivity lifecycle/engine integration layer. It does NOT belong primarily to:

- `TrustedDeviceRegistrationEngine`
- `TrustedDeviceSyncEngine`
- `TrustedDeviceRepository`
- `DeviceVerificationGate`
- local trusted-device reconciliation

Those components should not be modified to compensate for an incorrectly initialized connectivity engine.

#### Required Future Implementation Constraint

Before trusted-device authority behavior is validated, the connectivity lifecycle must demonstrate:

- `ConnectivityEngine` initialized
- Connectivity monitoring started
- Actual native network state observed
- `ConnectivityEngine` reflects the native network state
- `ConnectivityEngine.isOnline()` returns `true` when the device is online
- Trusted-device verification selects `SUPABASE_AUTHORITY`

The following trace combination is evidence of an unresolved lifecycle defect:

`ENGINE_OFFLINE_NATIVE_ONLINE` combined with `LOCAL_FALLBACK`.

#### Investigation Boundary

The investigation is now split into two layers:

**Layer 1 — Connectivity Authority**
Determine whether the application can reliably establish and expose its actual online/offline state.

**Layer 2 — Trusted Device Authority**
Only after Layer 1 is correct should trusted-device behavior be evaluated:

```
Supabase lookup
→ authoritative decision
→ local reconciliation
→ registration/block/allow behavior
```

This prevents future investigations from modifying trusted-device logic when the application has not actually reached the server-authority layer.

### Identity Resolution Boundary (ADR-014)

`IdentityResolver` (`modules/identity-resolution/`) is the application-boundary owner that resolves the identity state consumed by the Device Verification flow. It is stateless — it performs no initialization and owns no lifecycle. It composes existing public contracts:

- **Authenticated worker identity**: `UserContextEngine.currentWorker()` (populated by `AuthSession` on login/restore — the single authoritative source of the currently authenticated worker).
- **Authoritative device identity availability**: `TrustedDeviceEngine.device()` combined with `selectDeviceIdentityProvider().kind`. A device identity is authoritative for trusted-device purposes **only** when the active provider is native (Capacitor/Android `ANDROID_ID`). The browser provider is explicitly development/test only.

Resolved states: `UNAUTHENTICATED` / `AUTHENTICATED_DEVICE_AVAILABLE` / `AUTHENTICATED_DEVICE_UNAVAILABLE` / `RESOLUTION_FAILED`. When running in a browser, the device identity is reported as **unavailable**, so the Device Verification UI keeps trusted-device registration unavailable — the browser never silently registers itself as a trusted Android device. Trusted-device enforcement (registration, verification, administrator reset) remains owned by `TrustedDeviceRegistrationEngine` / `TrustedDeviceRepository`; resolution and enforcement are deliberately separated.

### Trusted Device Investigation Learnings

#### Problem
Trusted-device registration appeared to complete locally, but remote synchronization failed and subsequent verification remained `NOT_REGISTERED`.

#### Verified Investigation Evidence
The investigation established that:
- authentication completed successfully;
- connectivity was online;
- the Supabase authority path was selected;
- the remote trusted-device lookup executed successfully;
- no approved remote device was initially found;
- local trusted-device state could exist independently of remote state;
- reconciliation subsequently revoked the local record because remote authority remained `NOT_FOUND`.

The defect was ultimately isolated at the repository persistence-mapping boundary.

#### Root Cause
The defect was in:
`modules/repositories/trusted-device/trusted-device.repository.ts`

inside `mapRowToRecord()`.

The SQLite result set exposes the database column as:
`device_id`

but the mapping read:
`row.deviceId`

This caused the domain record to contain an undefined device identifier.

When the record was subsequently uploaded to Supabase, the resulting payload contained a null `device_id`, producing the Supabase `NOT NULL` constraint failure.

#### Repair
The verified repair was:
`deviceId: row.deviceId`

changed to:
`deviceId: row.device_id`

No architectural redesign was required.

#### Verified Validation
Document that after the repair:
- local trusted-device read-back preserved the device identifier;
- registration persisted the device as `APPROVED`;
- trusted-device status resolved correctly;
- re-registration behaved correctly;
- administrator reset preserved historical state as `REVOKED`;
- the original `device_id` null constraint failure disappeared;
- remote synchronization progressed beyond the previous device-identity failure;
- the trusted-device flow was subsequently fully verified.

### Platform Runtime Contract

> Platform runtime dependencies (Capacitor plugins, SQLite, Camera, Background Tasks, GPS, etc.) must have their platform bootstrap validated independently before any application architecture is modified.
>
> Runtime failures caused by missing platform integration must never be "fixed" by changing business logic, lifecycle management, routing, repositories, or backend engines.
>
> Platform integration is treated as an infrastructure responsibility and must remain isolated from application architecture.

### Verified SQLite Runtime Compatibility

The web platform SQLite runtime stack has been validated during **Phase 10A.3**.

- **jeep-sqlite version**: 2.8.0
- **sql.js version**: 1.12.0

The runtime asset `public/assets/sql-wasm.wasm` must always originate from **sql.js 1.12.0**.

- The SQL.js runtime and the shipped WebAssembly binary must always originate from the same installed version.
- Upgrading sql.js requires explicit compatibility verification with jeep-sqlite before adoption.
- Do not upgrade sql.js independently.

The runtime compatibility has been validated during Phase 10A.3.

## Golden Rule — Platform Asset Verification

Before investigating application logic involving browser runtime components (WebAssembly, Service Workers, Web Workers, Capacitor Web plugins, static runtime assets, etc.), verify the runtime assets independently.

Verification must confirm:

- expected asset path

- actual requested URL

- HTTP response code

- MIME type

- file size

- binary signature (magic bytes)

- browser network response

Application code must never be modified until the platform asset has been proven valid.

Platform Integration defects must be isolated before Application Layer investigation begins.

## Golden Rule — Root Cause Before Repair

When debugging any subsystem:

- Never apply speculative fixes.
- Never stack multiple changes together.
- Never "try another approach" without identifying the exact failing layer.
- Every implementation slice must be preceded by a completed investigation proving the precise failure point.
- Every investigation must reduce the uncertainty window.
- Every implementation slice must repair exactly one verified root cause.
- After each repair, stop and validate before continuing.
- Never bypass a failure.
- Never introduce architectural changes while investigating runtime behaviour.
- Runtime evidence always overrides assumptions.
