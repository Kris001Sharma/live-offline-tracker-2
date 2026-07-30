# Validation Dataset

This document outlines the permanent validation dataset used by the Validation Workspace to verify system correctness.
The dataset is designed to be deterministic, isolated from production, and reused across all Quality Gates.

## 1. Baseline Dataset

Permanent records that should never change.

- **System Administrator (w-admin)**
  - `workerId`: `w-admin`
  - `email`: `admin@system.local`
  - `displayName`: `System Administrator`
  - `role`: `ADMIN`
  - `active`: `true`
  - **Purpose**: Verifies access controls and administrative operations.

- **Standard Worker (w-1)**
  - `workerId`: `w-1`
  - `email`: `worker.one@system.local`
  - `displayName`: `Worker One`
  - `role`: `WORKER`
  - `active`: `true`
  - **Purpose**: Verifies standard worker behavior, shift creation, and event logging.

- **Trusted Device (d-admin-1)**
  - `id`: `d-admin-1`
  - `workerId`: `w-admin`
  - `deviceId`: `dev-admin-123`
  - `status`: `APPROVED`
  - **Purpose**: Verifies authenticated sessions and offline functionality for trusted clients.

## 2. Dynamic Scenarios

Records representing state changes and application workflows.

- **Shift Lifecycle**
  - Scenario 1: Open Shift. Represents a worker currently signed in. (Status: `ACTIVE`)
  - Scenario 2: Closed Shift. Represents a worker who completed their day. (Status: `CLOSED`)
  - **Purpose**: Validates active session resolution and historical queries.

- **Attendance Check-in**
  - Scenario 1: Checked In. (check_out_at is NULL)
  - Scenario 2: Checked Out. (check_out_at is populated)
  - **Purpose**: Verifies time tracking and constraint logic.

## 3. Edge Cases

Records designed specifically to provoke failures or boundary conditions.

- **Duplicate Email Worker**
  - `email`: `worker.one@system.local` (Reused)
  - **Expected Behavior**: Throws `WorkerRepositoryError.WORKER_ALREADY_EXISTS`.
  - **Purpose**: Verifies UNIQUE constraints on the database level.

- **Inactive Worker**
  - `workerId`: `w-inactive`
  - `active`: `false`
  - **Expected Behavior**: Excluded from active worker queries.
  - **Purpose**: Verifies correct filtering in repository queries.

- **Foreign Key Violation (Orphaned Shift/Device)**
  - `workerId`: `non-existent-worker`
  - **Expected Behavior**: Validates foreign key constraints (or logical validation if PRAGMA foreign_keys is off).
