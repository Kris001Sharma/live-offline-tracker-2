# Architecture Decisions

This document records the key architectural decisions made for the Sapana Live Tracker project.

---

## ADR-001: Mobile Platform Selection

- **Decision**: Capacitor selected for the mobile application.
- **Reason**: Allows a single web codebase (React + TypeScript) while supporting native Android plugins and platform integration required for long-running background GPS tracking and platform services.
- **Status**: Approved

---

## ADR-002: Local Data Persistence

- **Decision**: SQLite selected as local storage.
- **Reason**: Provides a reliable, transactional local database engine on mobile devices, ensuring zero data loss during network dropouts and offering robust indexing for queuing and location buffer queries.
- **Status**: Approved

---

## ADR-003: Cloud Backend Infrastructure

- **Decision**: Supabase selected as backend.
- **Reason**: Provides an out-of-the-box PostgreSQL relational database with geodetic extensions, standard user authentication, and secure file storage, minimizing backend deployment and maintenance complexity.
- **Status**: Approved

---

## ADR-004: Architectural Pattern

- **Decision**: Engine + Feature Architecture adopted.
- **Reason**: Decouples reusable core modules (the "engines", such as GPS tracking, local queuing, and server sync) from user-facing UI components and screens (the "features"). This maximizes code reuse, structural clarity, and unit testability.
- **Status**: Approved

---

## ADR-005: Offline-First Philosophy

- **Decision**: Offline First architecture.
- **Reason**: Field workers operate in remote, low-connectivity terrains where they may remain disconnected for extended periods. The local storage is treated as the primary source of truth, with synchronization to the cloud treated as a background, asynchronous process.
- **Status**: Approved

## ADR-006: Engine Dependency Direction

- **Decision**: No Engine shall directly instantiate or depend on another Engine's internal implementation. All Engine interactions shall occur exclusively through their public APIs, with dependencies injected during application bootstrap where required.
- **Reason**: This preserves strict module boundaries, prevents tight coupling between Engines, improves testability, and allows individual Engines to be replaced or extended without affecting the overall architecture.
- **Status**: Approved


## ADR-007: Single Persistence Responsibility

- **Decision**: Each Engine shall perform only one logical persistence operation for a single business action. Where multiple persistence operations appear necessary, the architecture shall be reviewed to simplify the data model or move orchestration to a lower architectural layer.
- **Reason**: This minimizes transactional complexity, reduces failure scenarios, prevents duplicated persistence logic, and keeps Engine responsibilities focused and predictable.
- **Status**: Approved


## ADR-008: Shared Location Services

- **Decision**: All location-based features shall consume a shared Location Provider and shared Location Rule Services. No feature may directly access the native Geolocation APIs or implement its own location validation, distance calculation, or geofence logic.
- **Reason**: Centralizing all location-related functionality eliminates duplicate implementations, guarantees consistent business rules across the application, improves maintainability, and enables new location-based features such as Tracking, Attendance, Client Visits, and Geofencing to be added in a plug-and-play manner.
- **Status**: Approved

## ADR-009: Tracking Pipeline Ownership

- **Decision**: The tracking pipeline shall be decomposed into dedicated Engines, each owning exactly one responsibility. TrackingSession owns **when** location collection occurs, TrackingEngine owns **what** happens to each collected location, BackgroundExecution owns **where** the scheduler executes (foreground/background lifecycle), and TrackingHealth owns **observing** pipeline health. Engines may collaborate only through approved public APIs and shall not assume another Engine's responsibility.
- **Reason**: Separating scheduling, orchestration, platform lifecycle, and diagnostics prevents responsibility leakage, preserves clear architectural boundaries, improves testability, and allows each component to evolve independently without impacting the remainder of the tracking pipeline.
- **Status**: Approved

---

## ADR-010: Authentication Engine Supabase Client Ownership

- **Decision**: `AuthenticationEngine` is the sole module permitted to instantiate and own the `SupabaseClient`.
- **Reason**: Centralizing Supabase client creation inside `AuthenticationEngine` ensures single-instance token/session lifecycle management, eliminates duplicated connections, prevents credential leaks, and establishes a strict security boundary. Repository modules, Feature Engines, Synchronization Engines, and UI components are strictly prohibited from directly importing `@supabase/supabase-js` or instantiating Supabase clients. All future cloud interactions must occur through `AuthenticationEngine` (or a dedicated Cloud API layer introduced by a future architecture phase) and never bypass this boundary.
- **Status**: Approved

---

## ADR-011: Backend Release Candidate Freeze

- **Decision**: The entire backend architecture — comprising 9 core engines (`ConfigurationEngine`, `StorageEngine`, `ConnectivityEngine`, `AuthenticationEngine`, `UserContextEngine`, `WorkerProfileEngine`, `TrustedDeviceEngine`, `AttendanceEngine`, `LocationEvaluationEngine`, `WorkerAdminEngine`, `WorkerSyncEngine`) and 5 repositories (`WorkerRepository`, `AttendanceRepository`, `LocationRepository`, `ShiftRepository`, `TrustedDeviceRepository`) — is officially declared **Backend Release Candidate 1 (RC1)** and frozen.
- **Reason**: The backend has undergone complete, multi-layered validation across Unit Engine/Repository suites, Cross-Layer Integration, Live Cloud Supabase, Offline Delta Synchronization, and End-to-End Operational Scenarios (OV-1 through OV-6) with 100% test pass rate and clean TypeScript compilation. Freezing the backend contract ensures total stability for Phase 10 Application Shell & UI development.
- **Rules**:
  1. All public API contracts, method signatures, domain error codes, and status payload schemas are immutable.
  2. UI development in Phase 10 must consume frozen backend contracts without modifying internal engine logic.
  3. Any structural modification or contract alteration requires an approved Architecture Decision Record (ADR) prior to implementation.
- **Status**: Approved

---

## ADR-012: Initialization Ownership

- **Decision**: `ApplicationLifecycle` owns application bootstrap serialization. `StorageEngine` owns concurrency safety of its public `initialize()` API. Engine correctness must never depend on caller behaviour. Bootstrap serialization and Engine API safety are independent architectural responsibilities.
- **Reason**: Investigation Slices 11.2, 11.3, and 11.3B proved that React StrictMode double-invocation caused two concurrent `StorageEngine.initialize()` calls to corrupt the shared jeep-sqlite connection registry (`Execute: sapana_local_storage database not opened`). The trigger lives in the Application Shell (bootstrap orchestration); the vulnerability lives in `StorageEngine` (its `initialized` flag was committed only after the full async chain, so the guard was not concurrency-safe). These belong to different architectural layers: the shell owns the application lifecycle state machine, while `StorageEngine` owns its public API contract and must be safe for any caller (React, validation framework, future engines, CLI utilities, tests, background services) independent of React.
- **Status**: Accepted

