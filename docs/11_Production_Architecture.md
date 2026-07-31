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
