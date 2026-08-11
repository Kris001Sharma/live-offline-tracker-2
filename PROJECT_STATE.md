# Project State: Sapana Live Tracker

## Project Metadata

- **Project Name**: Sapana Live Tracker
- **Current Phase**: Phase 10A — Worker Application / UI (ACTIVE)
- **Architecture Version**: v1.0
- **Project Status**: 10A.4 + 10A.4-V verified UI baseline frozen; 10A.5-R wiring repair + 10A.5-RV live-login validation complete (BASELINE VERIFIED); 10A.5-D trusted-device registration contract + browser-safe device identity foundation implemented and automated-validated (engine 40/40, full matrix 492/492) — browser State A→B self-registration is blocked by a pre-existing auth↔worker identity gap, queued for a dedicated wiring slice (see Slice 10A.5-D section)

## Canonical Phase Structure

### Phase 11 — Production Foundation / Validation
- **Purpose**: Production architecture, storage reliability, lifecycle correctness, validation infrastructure, environment provisioning, regression closure, production-readiness verification.
- **Status**: **COMPLETE / FROZEN**
- **Baseline**: closed with operational 301/301 PASS, synchronization 13/13 PASS, cloud 50/50 PASS, engine 27/27 PASS, repository 44/44 PASS, integration 44/44 PASS, TypeScript validation PASS, OV-6 live offline → online recovery PASS, live payload persistence verified.
- Phase 11 is **not** the active feature-development phase. Do not reopen it unless a future product slice produces evidence of a defect in the frozen foundation. The uncommitted/legacy changes from Slices 11.7–11.9 are intentional validation/documentation changes and are not an invitation to continue Phase 11 work.

### Phase 10A — Worker Application / UI
- **Purpose**: Build the worker-facing application experience on top of the frozen production foundation — application shell, authentication presentation, worker dashboard, attendance interaction, tracking visibility, synchronization visibility, worker-facing operational states, and other worker journey UI capabilities explicitly approved by the roadmap.
- **Status**: **ACTIVE PRODUCT-DEVELOPMENT STREAM**

## Development Model

Every product capability follows:

```text
PRODUCT/UI IMPLEMENTATION SLICE
        ↓
IMMEDIATE VALIDATION SLICE
        ↓
BASELINE VERIFIED
        ↓
FREEZE
        ↓
NEXT PRODUCT/UI SLICE
```

- Implementation slices use identifier `10A.X`; validation slices use `10A.X-V`.
- Slices are deliberately bite-sized: one user-facing problem, a small clearly owned area of the repository, consuming existing frozen public APIs, independently testable and reversible.
- UI owns presentation, interaction, local UI state, routing, user-facing error states, and composition of frozen public APIs. UI must not access SQLite directly, create its own Supabase client, bypass AuthenticationEngine/StorageEngine, duplicate domain logic, implement synchronization, modify lifecycle ownership, or introduce alternate persistence mechanisms.
- Validation is evidence collection proportional to the slice. On the first meaningful failure: STOP, identify the divergence, classify owner, repair only if the repair belongs to the current slice.
- A slice freezes only when implementation is complete, focused validation passes, required regression passes, manual/runtime checks pass, no unresolved production defect remains, temporary diagnostics are removed, documentation is updated, and the working tree contains only intentional changes.

## Current Application/UI Baseline

| Slice | Title | Status |
| ----- | ----- | ------ |
| 10A.1 | Application Bootstrap Foundation | ✅ COMPLETED |
| 10A.2 | Application Lifecycle | ✅ COMPLETED |
| 10A.3 | React Router / Application Shell | ✅ COMPLETED |
| 10A.4 | Worker Login (Authentication Gate UI) | ✅ COMPLETED |
| 10A.4-V | Worker Login Validation & Baseline Closure | ✅ **BASELINE VERIFIED** |
| 10A.5-R | Application Session & Device Identity Wiring Repair | ✅ COMPLETED |
| 10A.5-RV | Wiring Repair Validation & Baseline Closure | ✅ **BASELINE VERIFIED** |
| 10A.5-D | Trusted Device Registration Contract & Browser-Safe Device Verification Foundation | 🟡 IMPLEMENTED (domain/persistence boundary automated-validated; browser registration BLOCKED by identity gap — queued wiring slice) |

**10A.4 + 10A.4-V = FROZEN APPLICATION/UI BASELINE.** Do not reimplement or re-audit Worker Login unless a verified defect appears. Do not rename or reopen 10A.4. **10A.5-R + 10A.5-RV = VERIFIED WIRING REPAIR BASELINE**: the runtime identity contracts (`UserContextEngine` population via `AuthSession`, `TrustedDeviceEngine` bootstrap load) required by `TrustedDeviceRegistrationEngine` are validated end-to-end, including the login-dependent checks. Do not reopen unless a verified defect appears.

## Slice 10A.4-R — Application/UI Phase Structure Reset & Baseline Alignment

- **Status**: Completed — **planning/documentation only**
- **Summary**: Canonical planning/documentation alignment slice. Phase 11 explicitly recorded as **COMPLETE / FROZEN**; Phase 10A explicitly recorded as the **ACTIVE** Worker Application/UI phase. 10A.4 + 10A.4-V recorded as the current verified UI baseline. Implementation/validation naming convention (`10A.X` / `10A.X-V`) and the bite-sized slice → validation → freeze cycle established as binding for all future UI work. No product capability implemented; no production behaviour, engines, database/schema, or validation infrastructure modified.
- **Next roadmap capability identified (NOT implemented)**: **10A.5 — Device Verification** — the Worker Journey step immediately following Worker Login (docs/12_Product_Design.md): confirm the physical device matches the worker's registered trusted device before granting dashboard access. Implementable as a UI-only gate consuming the frozen `TrustedDeviceRegistrationEngine` public API (`status()` / `registerCurrentDevice()` / result codes). Appropriately bite-sized as a single vertical slice; no further split required. **Slice 10A.5 must not begin until this planning slice is closed.**

## Milestones and Status

### Completed
- [x] Repository Initialized (Folder structure, basic documentation, licenses, and ignore rules created)

### Next Milestone
- [ ] Foundation Documentation (Detailed specs for location formats, tracking paradigms, and offline-sync protocols)

### Future Milestones
- [ ] System Architecture Documentation
- [ ] Core Engines Development (Local database engine, GPS buffering engine, Supabase sync engine)
- [ ] Worker Mobile App MVP
- [ ] Admin Dashboard MVP
- [ ] Beta Release


### Potential rollback points
docs: freeze Configuration Engine and begin Storage Engine
docs: freeze Storage Foundation
docs: freeze Infrastructure Layer Complete until Repository layer

## Phase 10 — Application Shell & UI

### Slice 10A.4 — Worker Login (Authentication Gate UI)
- **Status**: Implemented — **SLICE COMPLETE — BASELINE FROZEN**
- **Summary**: Implemented the Worker Login authentication gate for the Phase 10 application shell. `AuthGate` (new `src/router/AuthGate.tsx`) restores the session once on mount (single-flight via `restoreRef`, StrictMode-safe), renders `LoginScreen` when unauthenticated, and renders the `DashboardPlaceholder` plus a Sign Out button when authenticated. `LoginScreen` (new `src/router/LoginScreen.tsx`) is a controlled email/password form calling the frozen `AuthenticationEngine.login()` public API, with client-side empty-field validation and `AuthenticationErrorCode` → user-facing error mapping (INVALID_CREDENTIALS, NETWORK_ERROR, SESSION_EXPIRED, OFFLINE_NO_SESSION, fallback detail). READY state now renders `<AuthGate />` instead of `DashboardPlaceholder` directly (`src/router/index.tsx`). Presentation/wiring only — no `modules/*`, shell-lifecycle, schema, migration, or seed change; no new ADR.
- **Validation**: lint (`tsc --noEmit`) PASS; `vite build` PASS (152 modules transformed; chunk-size warning pre-existing). Full regression matrix green — repository 44/44, engine 27/27, integration 44/44, cloud 50/50, synchronization 13/13, operational 301/301 (OV-1 → OV-6) — total 479/479 PASS.
- **Manual Validation**: dev-server serve HTTP 200 (root shell, `main.tsx`, `@vite/client`, and `AuthGate.tsx`/`LoginScreen.tsx`/`router/index.tsx` transforms all clean, zero dev-log errors). Seeded login success, invalid-credential failure, session restore, and logout are live-verified at engine level by OV-2 (7-stage workflow) and Cloud 3/6. Full DOM login interaction, StrictMode remount, and reload persistence (M-DOM steps) not headlessly executable — no browser automation available; protected by single-flight session restore (`restoreRef`) and covered programmatically by the live-verified suites.
- **Cleanup**: Stray `vite` dev-server processes from prior sessions (ports 3000/3001) and the slice's own dev server removed; ports verified clear. Working tree contains only intentional changes.
- **Final Baseline Decision**: **SLICE COMPLETE — BASELINE FROZEN** — implementation validated, all regression suites green, no frozen-backend modification, no unexpected findings, no temp artifacts, no unresolved live-environment failures.

## Phase 10 — Application Shell & UI

### Slice 10A.4-V — Worker Login Validation & Baseline Closure
- **Status**: Implemented — **BASELINE VERIFIED**
- **Summary**: Independent validation/closure slice for the implemented Worker Login capability (Slice 10A.4). No production implementation. Verified the Worker Login flow end-to-end in a real browser (headless Chrome via Chrome DevTools Protocol, driven by a temporary script living outside the repository and removed after use) against the live Supabase backend, on top of the frozen authentication and application-lifecycle foundations.
- **V1–V7 (browser-verified)**: V1 app reaches READY (no ERROR, no bootstrap error); V2 no-session boot renders LoginScreen only (no Dashboard, no Sign Out, no navigation); V3 invalid credentials rejected (error feedback shown, LoginScreen remains, no authenticated state, no app ERROR, exactly 1 login POST); V4 seeded login (`admin@sapana.local`) succeeds (Dashboard + Sign Out render, error cleared, exactly 1 login POST); V5 reload restores the persisted session to Dashboard (0 auth POSTs during restore — storage read-back, single effective restore); V6 Sign Out returns to LoginScreen (Dashboard inaccessible, exactly 1 logout POST); V7 StrictMode safety (0 console errors; exactly 2 password-login POSTs total across V3/V4 — one per submit; exactly 1 logout POST; 0 auth POSTs during fresh-mount session check). All 7/7 PASS.
- **V8 (regression smoke)**: `tsc --noEmit` PASS; `vite build` PASS; engine suite 27/27 (incl. AuthenticationEngine); operational suite 301/301 (OV-1 → OV-6, incl. OV-2 authentication workflow). No rerun of the full historical matrix required.
- **Methodology note**: Two earlier driver runs produced a V5/V6 false-negative caused by a measurement race (single-shot DOM queries during reload navigation); a DOM-debug probe confirmed the correct app state and the driver was hardened to poll transitions — the defect was in the temporary validation harness, not the production implementation.
- **Cleanup**: Headless Chrome, dev server, and all stray vite processes removed; temp CDP scripts and browser profile deleted; ports verified clear; no repository pollution (temp scripts lived outside the repo).
- **Final Baseline Decision**: **BASELINE VERIFIED** — Worker Login (Slice 10A.4) behaves correctly end-to-end on the frozen foundations; no production code, schema, migration, seed, or validation infrastructure modified; no unexpected findings; clean baseline.

## Slice 10A.5-R — Application Session & Device Identity Wiring Repair

- **Status**: Implemented — **BASELINE VERIFIED** (closure: Slice 10A.5-RV)
- **Summary**: Minimal architectural wiring repair (investigation + repair slice, no device-verification UI). Two missing runtime-identity integrations were repaired using existing frozen public contracts:

  1. **Authentication/session orchestration (Repair A)** — The application now routes authentication through the existing `AuthSession` public contract instead of calling `AuthenticationEngine` directly from the UI. `src/router/LoginScreen.tsx` now calls `AuthSession.login()`, `src/router/AuthGate.tsx` now calls `AuthSession.restore()` for session restoration and `AuthSession.logout()` for sign-out. This establishes `UserContextEngine.setCurrentWorker()` on successful login/restore and clears it on logout (atomic session construction with rollback), which the previous direct-`AuthenticationEngine` flow never populated.
  2. **Trusted device initialization (Repair B)** — The application bootstrap (`src/shell/lifecycle.context.tsx`) now calls `AuthSession.initialize()`, `TrustedDeviceEngine.initialize()`, and awaits `TrustedDeviceEngine.load()` before `READY`. Device identity is application-level (independent of the worker — the engine contract states "a device exists even before login"), so it is established during bootstrap, not tied to authentication. `TrustedDeviceEngine.device()` is therefore available to `TrustedDeviceRegistrationEngine` after bootstrap instead of always returning `null`.

  No frozen engine, repository, schema, migration, seed, or dependency was modified. No new abstraction or orchestration was introduced. No device-verification UI was implemented.
- **Dependency ordering (documented)**: `ConfigurationEngine.load()` → `StorageEngine.initialize()` → `ConnectivityEngine.initialize()` → `AuthenticationEngine.initialize()` → `UserContextEngine.initialize()` → `WorkerProfileEngine.initialize()` → `AuthSession.initialize()` → `TrustedDeviceEngine.initialize()` → `await TrustedDeviceEngine.load()` → `READY`. `TrustedDeviceEngine.load()` never rejects (structured `DEVICE_ERROR` result on failure) so a device-load failure degrades to `CLEARED` without blocking `READY`.
- **Environment prerequisite resolved**: The documented validation account `admin@sapana.local` was found to use the live credential `Validation@123` (not the previously documented `Password123!`). Direct `signInWithPassword` probe against live Supabase `https://ejluwdwklieobrknnboh.supabase.co` returned success (auth user `69d4e016-121e-4d62-b3ab-562efabda5ea`). This unblocked the live valid-login validation. The operational validation harness (OV-2..OV-5) and `AuthFixture` were aligned to the live credential `Validation@123` (validation-harness change only — no production code). The canonical documented password is now `Validation@123`.
- **Validation performed**:
  - `npm run lint` (`tsc --noEmit`) PASS; `npm run build` PASS (chunk-size warning pre-existing).
  - Runtime (real browser against live Supabase `https://ejluwdwklieobrknnboh.supabase.co`, via temporary headless-Chrome CDP driver living outside the repository and removed after use): fresh boot reaches `READY` → `LoginScreen` only; invalid credentials still rejected through the `AuthSession.login()` path (live 400 translated to `INVALID_CREDENTIALS` UI error); pre-login `TrustedDeviceEngine.status()` = `{initialized: true, state: READY}` with a complete `device()` identity; local SQLite `trusted_devices` table present (canonical migration chain applied in the running app).
  - Live database contract re-verified: canonical tables present (`workers`, `shifts`, `locations`, `events`, `attendance`, `trusted_devices`); validation dataset present (`worker-admin`, `worker-active-a/b`, `worker-inactive`, `device-trusted-1`/`worker-active-a`/`DEV-001-AAA`/`APPROVED`); connected project is the documented `ejluwdwklieobrknnboh`.
- **Login-dependent checks (previously blocked) now executed via Slice 10A.5-RV**: valid login `admin@sapana.local` / `Validation@123` succeeds end-to-end; `UserContextEngine.currentWorker()` populated with `{id: 69d4e016-121e-4d62-b3ab-562efabda5ea, email: admin@sapana.local, displayName: admin@sapana.local, role: WORKER, active: true}` (AuthSession placeholder mapping); reload restores the persisted session and repopulates `currentWorker` (0 auth POSTs during restore); logout clears `currentWorker` and returns to `LoginScreen`; `TrustedDeviceRegistrationEngine.status()` = `NOT_REGISTERED` executed against the real authenticated worker + real local DB.
- **Cleanup**: temporary CDP driver, auth probe scripts, headless Chrome profile, and dev server removed; ports verified clear; working tree contains only intentional changes.
- **Final Baseline Decision**: **BASELINE VERIFIED** — the wiring repair is validated end-to-end, including the previously blocked login-dependent contract checks. Slice 10A.5 (Device Verification UI) may now proceed.

## Slice 10A.5-RV — Application Session & Device Identity Wiring Repair Validation & Baseline Closure

- **Status**: Implemented — **BASELINE VERIFIED**
- **Summary**: Independent validation/closure slice for the 10A.5-R wiring repair. No production implementation. Executed the previously blocked live valid-login checks in a real browser (headless Chrome via Chrome DevTools Protocol, temporary driver outside the repository and removed after use) against the live Supabase backend, on top of the frozen authentication, session-orchestration, and device-identity foundations. The missing environment prerequisite (working validation credential) was resolved: the live validation account `admin@sapana.local` authenticates with `Validation@123`; the operational harness scenarios (OV-2..OV-5) and `AuthFixture` were aligned to that live credential (validation-harness change only).
- **V1–V8 (browser-verified)**: V1 fresh boot reaches `READY` → `LoginScreen` only (no Dashboard, no Sign Out, no navigation); V2 pre-login `TrustedDeviceEngine.status()` = `{initialized: true, state: READY}` with complete `device()` identity (`deviceId 106cfe88-…`, manufacturer `Google Inc.`, model `Windows NT 10.0`, platform `web`); V3 local SQLite canonical tables present (`workers`, `trusted_devices`, `_migrations`); V4 invalid credentials rejected through the `AuthSession.login()` path (error feedback shown, stays on `LoginScreen`, unauthenticated, exactly 1 login POST); V5 valid login `admin@sapana.local` / `Validation@123` succeeds (Dashboard + Sign Out render, error cleared, exactly 1 additional login POST), `UserContextEngine.currentWorker()` = `{id: 69d4e016-121e-4d62-b3ab-562efabda5ea, email: admin@sapana.local, displayName: admin@sapana.local, role: WORKER, active: true}` matches the documented placeholder mapping, and `TrustedDeviceRegistrationEngine.status()` = `NOT_REGISTERED` executes against the real authenticated worker + real local DB; V6 reload restores the persisted session to Dashboard and repopulates `currentWorker` (0 auth POSTs during restore — storage read-back); V7 Sign Out returns to `LoginScreen` and clears `currentWorker` (unauthenticated); V8 zero console errors across the full flow. All 8/8 PASS.
- **Regression (with corrected credential)**: `npm run lint` (`tsc --noEmit`) PASS; `npm run build` PASS (chunk-size warning pre-existing); full matrix green — repository 44/44, engine 27/27, integration 44/44, cloud 50/50, synchronization 13/13, operational 301/301 (OV-1 → OV-6, incl. OV-2 authentication workflow and OV-6 offline-sync) — total 479/479 PASS.
- **Methodology note**: The OV-2..OV-5 operational scenarios previously hardcoded the stale `Password123!` and would have failed live login; they were aligned to the actual live credential `Validation@123`. This is a validation-harness/environment alignment, not a production change and not a frozen-engine change.
- **Cleanup**: Headless Chrome, dev server, and all stray vite processes removed; temp CDP scripts and browser profile deleted; ports verified clear; no repository pollution (temp scripts lived outside the repo).
- **Final Baseline Decision**: **BASELINE VERIFIED** — the 10A.5-R wiring repair behaves correctly end-to-end, including the login-dependent identity contracts that were previously blocked; no production code, schema, migration, seed, or validation infrastructure beyond the documented credential alignment was modified; clean baseline.

## Slice 10A.5-D — Trusted Device Registration Contract & Browser-Safe Device Verification Foundation

- **Status**: Implemented — registration contract + browser-safe device-identity foundation implemented and automated-validated (engine 40/40, full matrix 492/492); browser State A→B self-registration is **BLOCKED** by a pre-existing auth↔worker identity gap, queued for a dedicated wiring slice. **NOT BASELINE VERIFIED** (UI closure deferred).
- **Summary**: Minimum correct foundation for worker↔trusted-device association, one-active-device-per-worker enforcement, administrator reset, and browser-safe development/testing device identity, with a platform boundary isolating real Android native identity for a later native-device slice. Components:

  1. **Device identity provider boundary** (`modules/trusted-device/device-identity.provider.ts` + `.browser.ts` + `.native.ts` + `.types.ts`, new) — `selectDeviceIdentityProvider()` returns a native provider on Capacitor (`Device.getId()`, real Android `ANDROID_ID`) and a browser provider otherwise. The browser provider is **DEVELOPMENT/TEST ONLY**: deterministic per browser profile (persisted in localStorage keys `sapana.device_identity.browser.v1` and `sapana.device_identity.browser.override.v1`), an explicit `setOverride()` to simulate different devices for testing, and no fingerprinting/IP/UA. `TrustedDeviceEngine.load()` now resolves device identity through the provider.
  2. **Migration 002 — one active trusted device per worker** (`database/migrations/versions/002_trusted_device_one_active_per_worker.ts` + `supabase/migrations/20260811000002_trusted_device_one_active_per_worker.sql`) — partial/filtered unique index `idx_trusted_devices_one_active_per_worker` enforcing at most one `APPROVED` device per worker at the persistence boundary. **Applied to the live Supabase project via `supabase db push` and behaviorally verified** (duplicate `APPROVED` insert rejected by the index, `23505`; no data pollution). Local migration applies cleanly on upgrade (verified in the running app — `_migrations` v1 + v2).
  3. **Repository** (`modules/repositories/trusted-device/trusted-device.repository.ts` + `.types.ts`) — added `registerActive()`, `resetActive()`, and `REVOKED` status type.
  4. **Registration engine** (`modules/trusted-device-registration/trusted-device-registration.service.ts` + `.types.ts`) — `status()` now returns a `verification` result (`NOT_REGISTERED` / `TRUSTED` / `DIFFERENT_DEVICE` / `ERROR`); `registerCurrentDevice()` uses `registerActive()` (re-activates a historical record rather than duplicating, and the superseded `PENDING_APPROVAL` path is removed in favour of immediate first-device self-registration); new `resetActiveDevice(workerId)` administrator reset capability (domain-level only, preserves history as `REVOKED`, no Admin UI).
  5. **Browser UI** (`src/router/DeviceVerificationGate.tsx`, wired into `AuthGate`) — the four required states: **State A** no device → register prompt; **State B** trusted device → continue to Dashboard; **State C** different device → blocked + contact admin; **State D** clear non-technical error. Sign Out is rendered in **all** non-trusted states so a worker is never stuck. Consumes only the frozen `TrustedDeviceRegistrationEngine` public API (`status()` / `registerCurrentDevice()`).
- **Validation**:
  - `npm run lint` (`tsc --noEmit`) PASS; `npm run build` PASS (chunk-size warning pre-existing).
  - Engine suite expanded with a `TrustedDeviceRegistrationEngine` block: **40/40** (was 27/27), covering the required scenarios — no-device → `NOT_REGISTERED`; registration succeeds; same device → `TRUSTED`; different device → `DIFFERENT_DEVICE`/blocked; administrator reset; register-after-reset succeeds; and the persistence-boundary check (second `APPROVED` rejected by the partial unique index).
  - Full regression matrix green: repository 44/44, engine 40/40, integration 44/44, cloud 50/50, synchronization 13/13, operational 301/301 — total **492/492** PASS.
  - Live migration verification: partial unique index present on live Supabase; behavioral probe confirmed the duplicate-`APPROVED` insert is rejected.
- **Browser manual validation (partial)**: temporary headless-Chrome CDP driver (outside the repository, removed after use) verified — fresh boot reaches `READY` → `LoginScreen` only; login → **State A** register prompt (Dashboard gated, Sign Out available); **State C** and **State D** render correctly; a failed registration surfaces as a clear State D error; Sign Out from non-trusted states returns to `LoginScreen`; zero console errors. **State A→B self-registration FAILED** (see Blocker below).
- **Blocker (STOP condition per slice rule)**: clicking "Register this device" fails with `FOREIGN KEY constraint failed` → `PERSISTENCE_ERROR` → State D. Root cause verified in the running app: `AuthSession.mapToWorker()` (`modules/auth-session/auth-session.service.ts`) sets `currentWorker.id` = the auth UUID (`69d4e016-121e-4d62-b3ab-562efabda5ea`) as the documented 10A.5-R placeholder mapping; the local SQLite `workers` table is **empty** (nothing in `src/` populates it — worker profile sync is not wired into bootstrap, `WorkerProfileEngine` is initialized but never loaded); `trusted_devices.worker_id` has a NOT-NULL foreign key to `workers(worker_id)` enforced on web (`PRAGMA foreign_keys = ON`), so the write cannot satisfy the constraint. **Classification: pre-existing application identity/wiring gap (introduced by the 10A.5-R placeholder mapping), NOT a 10A.5-D defect.** Per the slice rule (on first meaningful failure STOP and repair only if the repair belongs to the current slice), the browser validation stopped here and the identity resolution is **queued as a dedicated wiring slice** (mirroring the 10A.5-R precedent). Engine-level tests exercise the contract in isolation by creating the canonical local worker row directly and pointing `UserContextEngine` at it.
- **Queued wiring slice (next capability, NOT started)**: resolve canonical worker identity for an authenticated session so `currentWorker.id` matches a canonical local `workers` row (e.g., bootstrap resolves the worker by email and populates the local `workers` table), enabling browser State A→B registration; then complete the 10A.5-D browser validation and close the slice as **BASELINE VERIFIED**.
- **Cleanup**: dev server, headless Chrome, and all temporary CDP scripts/profiles removed; ports verified clear; working tree contains only intentional changes.
- **Final Baseline Decision**: **NOT BASELINE VERIFIED** — the registration contract and browser-safe foundation are implemented and automated-validated, but browser end-to-end registration is blocked by the identity gap. UI closure and BASELINE VERIFIED are deferred until the queued wiring slice lands.

## Phase 11 — Production Hardening

### Slice 11.4A — StorageEngine Single-Flight Initialization
- **Status**: Implemented
- **Summary**: `StorageEngine` now guarantees single-flight initialization. Concurrent callers share one in-flight initialization instead of creating independent initializations, preserving the documented idempotent public API contract for all callers. Application bootstrap serialization is intentionally deferred to Slice 11.4B (ADR-012).

### Slice 11.4B — Application Bootstrap Serialization
- **Status**: Implemented
- **Summary**: `ApplicationLifecycle` now owns serialization of the complete application bootstrap sequence (ADR-013). `initializeBackend()` is single-flight: concurrent callers join the in-flight bootstrap, a post-`READY` invocation never restarts the sequence, and a failed bootstrap clears its in-flight state so Retry Bootstrap always starts fresh. React StrictMode double-invocation executes at most one bootstrap sequence and reaches `READY` once. `StorageEngine` and its single-flight implementation (Slice 11.4A) are unmodified.

### Slice 11.7 — Validation Dataset Contract Repair & Environment Re-Provisioning
- **Status**: Implemented (OV-6 remains blocked — harness issue)
- **Summary**: Repaired the validation dataset defect (Slice 11.6): `supabase/seeds/validation_dataset.sql` `events` INSERT omitted the canonical `NOT NULL` columns `sync_status`/`sync_retry_count` and failed to apply. The seed now supplies `sync_status` (`SYNCED`) / `sync_retry_count` (`0`) for baseline remote event rows, consistent with the seed's other remote-baseline rows and the application sync contract. Live Supabase validation environment re-provisioned (workers 5, trusted_devices 1, shifts 1, attendance 1, events 2; FK valid). Docs aligned: `docs/12_Validation_Dataset.md` rewritten to the actual identity contract, `docs/09_Manual_Verification.md` QG2 updated and OV-6 claims corrected.
- **Validation**: synchronization 13/13, cloud 50/50, engine 27/27, repository 44/44, integration 44/44, `tsc --noEmit` PASS; operational OV-1..OV-5 PASS, OV-6 FAIL at Phase 7 — `23502 null value in column "sync_status"` caused by the OV-6 `uploadLocations` provider payload omitting `sync_status`/`sync_retry_count`. Verified via live probe: identical INSERT fails with 23502, corrected payload accepted. This is a validation-harness defect (owner: OV-6 scenario), not a production defect (`WorkerSyncEngine.sync()` correctly propagates the provider error). No production or migration code modified.

### Slice 11.8 — OV-6 Validation Harness Contract Repair (Part 1)
- **Status**: Implemented (Phase 10 precision assertion remained — closed in 11.9)
- **Summary**: Repaired the OV-6 `uploadLocations` provider to include the canonical `events` sync contract fields (`sync_status: 'SYNCED'`, `sync_retry_count: 0`) and made OV-6 setup self-contained for geofence configuration (previously order-dependent on OV-3/OV-5 env mutation). Independent OV-6 then passed Phase 7 sync upload against live Supabase. A previously-latent second harness defect surfaced at Phase 10: exact-equality coordinate assertions across SQLite float8 and Postgres `REAL`/float4 are unsatisfiable for 7-significant-digit coordinates (`100.5018::REAL → 100.502`). Classification: validation harness defect; STOP per slice rule; no production changes.

### Slice 11.9 — OV-6 Coordinate Precision Contract Repair & Baseline Closure
- **Status**: Implemented — **BASELINE VERIFIED**
- **Summary**: Replaced the two OV-6 Phase 10 coordinate assertions with precision-aware comparisons (tolerance `0.0005`, half the 6th-significant-digit place value for ~100° coordinates, matching verified Postgres `REAL`/float4 behaviour; live columns confirmed `real`/`float4`). OV-6 now passes independently (105/105) and in the full operational suite (301/301, OV-1 → OV-6 all PASS). All regression suites green. The original `docs/09_Manual_Verification.md` QG OV-6 claims (105 / 301) are now reproducible; the Slice 11.7 "BLOCKED" correction is superseded by a Slice 11.9 Resolution note. Only `validation/operational/scenarios/ov6-offline-sync.scenario.ts` changed this slice.
- **Validation**: operational 301/301 (OV-1 → OV-6), synchronization 13/13, cloud 50/50, engine 27/27, repository 44/44, integration 44/44, `tsc --noEmit` PASS. Live verification: uploaded event payload round-trips as `SYNCED`/`0` with valid worker/shift FKs; live validation dataset intact (workers 5, trusted_devices 1, shifts 1, attendance 1, events 2). No production code, schema, migration, or seed modified.
- **Manual Validation**: production build (`vite build`, 150 modules) and dev-server serve (HTTP 200, root shell + `main.tsx` transform) PASS. Seeded environment verified live (M3). Remote→local sync verified by cloud suite Cloud 9 (M4). OV-6 end-to-end offline→online recovery + coordinate round-trip within float4 tolerance evidenced by independent OV-6 run + live payload read-back (M5). Full DOM READY/Dashboard rendering, StrictMode remount and reload stability (M1/M2/M6) not executable headlessly — no browser automation available; protected by 11.4A/11.4B single-flight code (`inFlightRef`/`readyRef` in `src/shell/lifecycle.context.tsx`) and covered programmatically by the live-verified suites.
- **Final Baseline Decision**: **BASELINE VERIFIED** — full validation matrix green, no production/schema/migration/seed change, no unexpected findings, no temp artifacts, no unresolved live-environment failures.

