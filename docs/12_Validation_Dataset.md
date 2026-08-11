# Validation Dataset

This document describes the permanent validation dataset defined by `supabase/seeds/validation_dataset.sql`.
The dataset is deterministic, isolated from production, and reused across all Quality Gates.
It is provisioned to the linked Supabase project (`supabase db query --linked --file supabase/seeds/validation_dataset.sql`).
The seed is idempotent: every statement is an `INSERT ... ON CONFLICT (...) DO UPDATE SET ...` upsert, so re-applying it is safe.

The authoritative consumers of this dataset are the live validation suites (`validation/cloud` and
`validation/synchronization`). Identities below are fixed to match those consumers.

## 1. Baseline Workers

Seeded into `workers`.

| worker_id | email | display_name | employee_code | role | active |
|---|---|---|---|---|---|
| `worker-admin` | `admin@sapana.local` | `System Administrator` | `EMP-ADMIN` | `ADMIN` | 1 |
| `worker-active-a` | `worker.a@sapana.local` | `Active Worker A` | `EMP-001` | `WORKER` | 1 |
| `worker-active-b` | `worker.b@sapana.local` | `Active Worker B` | `EMP-002` | `WORKER` | 1 |
| `worker-inactive` | `inactive@sapana.local` | `Inactive Worker` | `EMP-003` | `WORKER` | 0 |

- `worker-admin` (`admin@sapana.local`) verifies access controls and the live sync of the seeded administrator.
- `worker-active-a` / `worker-active-b` verify active standard-worker behavior.
- `worker-inactive` (`active = 0`) verifies inactive-worker filtering in live queries.

## 2. Baseline Trusted Device

Seeded into `trusted_devices`.

| id | worker_id | device_id | manufacturer | model | platform | status | sync_status |
|---|---|---|---|---|---|---|---|
| `device-trusted-1` | `worker-active-a` | `DEV-001-AAA` | `Apple` | `iPhone 13` | `ios` | `APPROVED` | `SYNCED` |

## 3. Baseline Shift

Seeded into `shifts` (references `worker-active-a`).

| id | worker_id | status | started_at | ended_at |
|---|---|---|---|---|
| `shift-baseline-1` | `worker-active-a` | `COMPLETED` | now - 8h | now - 1h |

## 4. Baseline Attendance

Seeded into `attendance` (references `worker-active-a`).

| id | worker_id | check_in_at | check_out_at | sync_status |
|---|---|---|---|---|
| `attendance-baseline-1` | `worker-active-a` | now - 8h | now - 1h | `SYNCED` |

## 5. Baseline Tracking Events

Seeded into `events` (reference `worker-active-a` and `shift-baseline-1`).

| id | event_type | event_data | worker_id | shift_id | sync_status | sync_retry_count |
|---|---|---|---|---|---|---|
| `event-baseline-1` | `LOCATION_UPDATE` | `{"lat": 27.7172, "lng": 85.3240}` | `worker-active-a` | `shift-baseline-1` | `SYNCED` | 0 |
| `event-baseline-2` | `LOCATION_UPDATE` | `{"lat": 27.7175, "lng": 85.3245}` | `worker-active-a` | `shift-baseline-1` | `SYNCED` | 0 |

Event fields must satisfy the canonical `events` schema:

- `sync_status` is `NOT NULL` (no default). Baseline remote records use `SYNCED` (already synchronized),
  consistent with the seed's other remote-baseline rows.
- `sync_retry_count` is `NOT NULL` (no default). Baseline records use `0` (no failed sync attempts).

## 6. Reference Data Counts

After a successful application the live tables contain exactly the following baseline rows:

| Table | Count |
|---|---|
| `workers` | 4 (plus any worker rows created by operational scenarios, e.g. `SYSTEM`) |
| `trusted_devices` | 1 |
| `shifts` | 1 |
| `attendance` | 1 |
| `events` | 2 |

## 7. Validation Prerequisites

- The linked Supabase project must have the canonical schema applied
  (`supabase/migrations/20260806000001_canonical_schema.sql`).
- The seed must be applied before running the live validation suites
  (`validation/cloud/cloud.validation.ts`, `validation/synchronization/synchronization.validation.ts`).
- The seed is repeatable; re-application is an idempotent upsert and does not create duplicates.

## 8. Validation Auth Account

The live authentication validation account used by the operational scenarios (OV-2..OV-5),
`AuthFixture`, and the browser-verified UI slices is:

| email | password | worker |
|---|---|---|
| `admin@sapana.local` | `Validation@123` | `worker-admin` (role `ADMIN`, `EMP-ADMIN`) |

- The account must exist as a live Supabase Auth user with the password above.
- The password was aligned to the actual live credential during Slice 10A.5-R / 10A.5-RV,
  superseding the previously documented `Password123!`.
- Do not change this password in the live project without updating this document and the
  operational harness scenarios (`validation/operational/scenarios/ov2..ov5` + `AuthFixture`).
- The auth user id in the live project (as verified 2026-08-11) is `69d4e016-121e-4d62-b3ab-562efabda5ea`.
