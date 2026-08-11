# Project Roadmap

This document outlines the milestones, feature releases, and chronological plan for the development of Sapana Live Tracker.

---

## Phase Summary

| Phase | Title | Status |
| ----- | ----- | ------ |
| **Phase 1–4** | Core Infrastructure | ✅ COMPLETED |
| **Phase 5** | Offline GPS Tracking | ✅ COMPLETED |
| **Phase 6** | Attendance | ✅ COMPLETED |
| **Phase 7** | Identity & Authentication | ✅ COMPLETED |
| **Phase 8** | Synchronization | ✅ COMPLETED |
| **Phase 9** | Administration | ✅ COMPLETED |
| **Phase 9.5** | Operational Validation | ✅ COMPLETED |
| **Backend RC1** | Backend Release Candidate Freeze | ✅ COMPLETED |
| **Phase 10A** | Application Shell & UI | 🚧 ACTIVE |
| **Phase 11** | Production Hardening | ✅ COMPLETED / FROZEN |
| **Phase 12** | Deployment & Release | ⏳ PLANNED |

---

## Detailed Phase Breakdown

### Phase 1–4: Core Infrastructure
- **Status**: COMPLETED ✅
- **Scope**: Core configuration, storage, SQLite adapter, repository layer, domain types, event engine, location provider, and evaluation infrastructure.

---

### Phase 5: Offline GPS Tracking
- **Status**: COMPLETED ✅
- **Scope**:
  - Tracking Engine
  - Tracking Session
  - Background Execution
  - Tracking Health
  - Recovery
  - End-to-End Validation

---

### Phase 6: Attendance
- **Status**: COMPLETED ✅
- **Scope**:
  - Attendance Engine
  - Location Validation
  - Attendance Repository
  - Event Integration
  - Attendance Recovery
  - End-to-End Validation

---

### Phase 7: Identity & Authentication
- **Status**: COMPLETED ✅
- **Scope**:

| Slice | Title | Status |
| ----- | ----- | ------ |
| **7A** | Authentication Engine | ✅ COMPLETED |
| **7B** | User Context Engine | ✅ COMPLETED |
| **7C** | Authentication Session | ✅ COMPLETED |
| **7D** | Worker Profile Engine | ✅ COMPLETED |
| **7D-A** | Worker Profile Hardening | ✅ COMPLETED |
| **7E** | Trusted Device Registration | ✅ COMPLETED |
| **7E-A** | Trusted Device Engine Hardening | ✅ COMPLETED |
| **7E-B** | Trusted Device Engine Final Hardening | ✅ COMPLETED |
| **7F** | Trusted Device Registration | ✅ COMPLETED |
| **7F-A** | Trusted Device Registration Hardening | ✅ COMPLETED |
| **7G** | Authentication Hardening | ✅ COMPLETED |
| **7H** | End-to-End Identity Validation | ✅ COMPLETED |

#### Slice Responsibilities
- **7A Authentication Engine**: Supabase Auth integration, sign-in/out, session restoration, error handling.
- **7B User Context Engine**: In-memory, immutable current worker identity state and role accessor.
- **7C Authentication Session**: Orchestration between Authentication Engine and User Context Engine with rollback support.
- **7D Worker Profile Engine**: Manages application-specific worker metadata (employee code, role, active status, organization, trusted device reference, profile sync). Replaces temporary placeholders in Auth Session.
- **7E Trusted Device Registration**: Single trusted Android device management, device registration, admin approval, device replacement. Intentionally simple without root/emulator detection.
- **7F Trusted Device Registration**: SQLite device registration persistence, status check, pending registration management.
- **7F-A Trusted Device Registration Hardening**: Atomic registration transaction, defensive runtime validation, registration rollback, repository ownership, exception translation, deep freeze immutability.
- **7G Authentication Hardening**: Session consistency validation, robust offline authentication behavior, immutable state, single rollback path.
- **7H End-to-End Identity Validation**: Architecture audit, offline authentication verification, session restore, logout recovery, trusted device scenarios, documentation freeze.

---

### Milestone: Architecture Baseline Audit (Pre-Phase 8)
- **Status**: COMPLETED ✅
- **Scope**: All completed backend engines verified. Architecture validated. Backend ready for synchronization.

---

### Phase 8: Synchronization
- **Status**: COMPLETED ✅
- **Scope**: Upload pipeline for Locations, Attendance, Events, and future Photos. SQLite remains the authoritative offline source of truth.

| Slice | Title | Status |
| ----- | ----- | ------ |
| **8A** | Sync Foundation | ✅ COMPLETED |
| **8A-A** | Sync Engine Hardening | ✅ COMPLETED |
| **8B** | Connectivity Monitoring | ✅ COMPLETED |
| **8B-A** | Connectivity Engine Hardening | ✅ COMPLETED |
| **8C** | Upload Pipeline | ✅ COMPLETED |
| **8C-A** | Upload Pipeline Hardening | ✅ COMPLETED |
| **8D** | Retry Strategy | ✅ COMPLETED |

| **8E** | Conflict Handling | ✅ COMPLETED |
| **8F** | End-to-End Validation | ✅ COMPLETED |

---

### Phase 9: Administration
- **Status**: COMPLETED ✅
- **Scope**: Worker profiles, trusted device approvals, worker administration capabilities, and Quality Gate 6 Cloud Integration Validation.

| Slice | Title | Status |
| ----- | ----- | ------ |
| **9A** | Worker Repository Foundation | ✅ COMPLETED |
| **9B** | Worker Profile Repository Integration | ✅ COMPLETED |
| **9B-A** | Worker Profile Repository Integration Hardening | ✅ COMPLETED |
| **9C** | Worker Synchronization Foundation | ✅ COMPLETED |
| **9D** | Worker Administration Foundation | ✅ COMPLETED |
| **9E** | Worker Administration Synchronization | ✅ COMPLETED |
| **9F** | Worker Administration Validation | ✅ COMPLETED |

---

### Phase 9.5: Operational Validation
- **Status**: COMPLETED ✅
- **Scope**: Permanent operational validation framework executing end-to-end multi-step business scenarios against backend infrastructure.

| Slice | Title | Status |
| ----- | ----- | ------ |
| **OV-1** | Operational Validation Framework | ✅ COMPLETED |
| **OV-2** | Authentication & Session Operational Validation | ✅ COMPLETED |
| **OV-3** | Attendance Operational Validation | ✅ COMPLETED |
| **OV-4** | GPS Operational Validation | ✅ COMPLETED |
| **OV-4A** | GPS Operational Validation Hardening | ✅ COMPLETED |
| **OV-5** | Complete Local Workday Operational Validation | ✅ COMPLETED |
| **OV-6** | Offline Synchronization & Recovery Operational Validation | ✅ COMPLETED |

---

### Backend Release Candidate 1 (RC1) — Final Audit & Freeze
- **Status**: COMPLETED ✅
- **Scope**: Final synchronization atomicity audit, partial failure recovery audit, cross-engine architecture audit, and official backend contract freeze.
- **Milestones**:
  - Synchronization Atomicity Audit: Verified entity batch synchronization model (`Attendance` batch -> `Location` batch) with idempotent SQLite recovery.
  - Partial Failure Recovery Audit: Verified error preservation, failure counter incrementing, zero data loss, and eventual consistency upon reconnection.
  - Architecture Audit: Confirmed 100% compliance across all 9 engines and 4 repositories.
  - Backend Freeze: All public interfaces and contracts are officially frozen for Phase 10 UI development.

## Phase Structure & Development Model

Phase 11 (Production Foundation / Validation) is **COMPLETE / FROZEN** and is not the active feature-development phase. Phase 10A (Worker Application / UI) is the **ACTIVE product-development stream**, building worker-facing UI on top of the frozen production foundation.

Every future product capability follows the cycle: **implementation slice (`10A.X`) → immediate validation slice (`10A.X-V`) → baseline verified → freeze → next slice.** Slices are deliberately bite-sized (one user-facing problem, a small clearly owned repository area, consuming existing frozen public APIs, independently testable and reversible). The UI layer consumes existing engine contracts only and must not access SQLite directly, create its own Supabase client, bypass AuthenticationEngine/StorageEngine, duplicate domain logic, or implement synchronization.

### Phase 10A: Application Shell & UI (ACTIVE)

- **Status**: ACTIVE 🚧
- **Scope**: Application shell, authentication presentation, worker dashboard, attendance interaction, tracking visibility, synchronization visibility, worker-facing operational states, and other worker-journey UI capabilities explicitly approved by the roadmap.

| Slice | Title | Status |
| ----- | ----- | ------ |
| **10A.1** | Application Bootstrap Foundation | ✅ COMPLETED |
| **10A.2** | Application Lifecycle | ✅ COMPLETED |
| **10A.3** | React Router Foundation | ✅ COMPLETED |
| **10A.3.1** | Platform Runtime Contract Documentation + Minimal Web Platform Bootstrap | ✅ COMPLETED |
| **10A.4** | Worker Login (Authentication Gate UI) | ✅ COMPLETED |
| **10A.4-V** | Worker Login Validation & Baseline Closure | ✅ COMPLETED (BASELINE VERIFIED) |
| **10A.4-R** | Application/UI Phase Structure Reset & Baseline Alignment (planning/documentation) | ✅ COMPLETED |
| **10A.5-R** | Application Session & Device Identity Wiring Repair | ✅ COMPLETED (BASELINE VERIFIED via 10A.5-RV) |
| **10A.5-RV** | Application Session & Device Identity Wiring Repair — Validation & Baseline Closure | ✅ COMPLETED (BASELINE VERIFIED) |
| **10A.5** | Device Verification (trusted-device gate after login) | ⏳ PLANNED — identified, NOT implemented |

**Current UI baseline (frozen)**: 10A.4 + 10A.4-V = verified Worker Login baseline. Do not reimplement or re-audit Worker Login unless a verified defect appears.

**Wiring repair (10A.5-R + 10A.5-RV, implemented, BASELINE VERIFIED)**: The application authentication flow now consumes the existing `AuthSession` public contract (`login` / `restore` / `logout`) so a successful authenticated session populates `UserContextEngine.setCurrentWorker()`; the application bootstrap now initializes and loads `TrustedDeviceEngine` so device identity is available before login. This restores the runtime-identity contracts required by `TrustedDeviceRegistrationEngine`. It does NOT implement the device-verification UI. The previously blocked live valid-login validation is now complete: the live validation credential is `admin@sapana.local` / `Validation@123` (the documented validation password is `Validation@123`, superseding the stale `Password123!`), and the login-dependent checks (post-login `currentWorker` population, session-restore repopulation, logout clearing, `TrustedDeviceRegistrationEngine.status()` = `NOT_REGISTERED` against the real authenticated worker) are browser-verified in 10A.5-RV.

**Next roadmap capability**: **10A.5 — Device Verification**, the Worker Journey step immediately following Worker Login (docs/12_Product_Design.md): the app confirms the physical device matches the worker's registered trusted device before granting dashboard access. This is implementable on the frozen foundation as a UI-only gate consuming the `TrustedDeviceRegistrationEngine` public API (`status()` / `registerCurrentDevice()` / result codes). It is appropriately bite-sized as a single vertical slice and does not require splitting. **10A.5 is now unblocked: the 10A.5-R wiring repair is baseline verified (10A.5-RV) and the validation credential prerequisite is resolved (`Validation@123`).**

### Future Phases
- **Phase 12**: Deployment & Release
