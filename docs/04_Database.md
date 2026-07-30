# 04 Database

## Purpose

This document defines the application's logical data model.

The application maintains two databases:

- Local SQLite (offline source of truth)
- Supabase PostgreSQL (central synchronized source)

Both databases should maintain equivalent schemas wherever practical to simplify synchronization.

---

# Database Philosophy

The application is **Offline First**.

Every business record follows the same lifecycle.

```
Create

↓

Store Locally

↓

Mark Pending

↓

Synchronize

↓

Mark Synced
```

The application never writes directly to Supabase.

---

# Repository Ownership

Every persisted entity is accessed exclusively through its Repository.

| Entity | Repository |
|----------|----------------------|
| Worker | WorkerRepository |
| Shift | ShiftRepository |
| Location | LocationRepository |
| Event | EventRepository |

Repositories own business-specific persistence.

Only the Storage Engine communicates with SQLite.

Features and Engines must never execute SQL directly.

---

# UUID Strategy

Every business entity uses UUID v4.

UUIDs are generated on the device.

Benefits:

- Offline creation
- No ID conflicts
- Simple synchronization
- Future portability

Auto-increment IDs must never be used for business entities.

---

# Timestamp Standard

All timestamps use UTC ISO-8601.

Example:

```
2026-07-18T08:42:31Z
```

Every persisted entity should include:

```
created_at
updated_at
```

where applicable.

---

# Worker

Represents an authenticated employee.

Worker records originate from Supabase and are read-only on the device.

| Field | Type |
|----------|-----------|
| id | UUID |
| full_name | Text |
| employee_code | Text |
| active | Boolean |
| created_at | Timestamp |

---

# Shift

Represents a single work session.

Created locally and synchronized after completion.

| Field | Type |
|----------|-----------|
| id | UUID |
| worker_id | UUID |
| started_at | Timestamp |
| ended_at | Timestamp (nullable) |
| status | Text |
| sync_status | Text |
| created_at | Timestamp |
| updated_at | Timestamp |

Status values:

```
ACTIVE
COMPLETED
```

---

# Location

Represents an accepted location sample.

This is expected to become the application's largest table.

| Field | Type |
|----------|-----------|
| id | UUID |
| shift_id | UUID |
| worker_id | UUID |
| latitude | Real |
| longitude | Real |
| accuracy | Real |
| altitude | Real (nullable) |
| speed | Real (nullable) |
| heading | Real (nullable) |
| recorded_at | Timestamp |
| sync_status | Text |
| created_at | Timestamp |

Required:

- latitude
- longitude
- accuracy
- recorded_at

Remaining fields are optional.

Accepted GPS locations are persisted in the locations table. 
Operational tracking history (such as tracking lifecycle events and location rejections) is persisted separately in the events table. 
These stores serve different purposes and intentionally coexist.


---

# Event

Stores operational events explaining application behaviour.

Events are operational records, not analytics.

| Field | Type |
|----------|-----------|
| id | UUID |
| worker_id | UUID |
| shift_id | UUID (nullable) |
| event_type | Text |
| message | Text |
| recorded_at | Timestamp |
| sync_status | Text |

Typical events include:

```
SHIFT_STARTED
SHIFT_STOPPED
TRACKING_STARTED
TRACKING_STOPPED
GPS_DISABLED
GPS_ENABLED
INTERNET_LOST
INTERNET_RESTORED
SYNC_STARTED
SYNC_COMPLETED
SYNC_FAILED
APP_RESTARTED
FOREGROUND_SERVICE_RESTARTED
```

---

# Relationships

```
Worker

│

├── Shift

│      │

│      ├── Location

│      │

│      └── Event
```

---

# Synchronization

Synchronization is determined by each entity's `sync_status`.

The Sync Engine uploads only pending records.

```
PENDING

↓

SYNCED
```

Failed uploads remain pending until successfully retried.

No dedicated queue table is required.

---

# SQLite Tables

```
workers

shifts

locations

events
```

---

# Supabase Tables

```
workers

shifts

locations

events
```

Equivalent naming simplifies synchronization, debugging, and migrations.

---

# Local Only Data

The following data remains exclusively on the device:

- Configuration cache
- Authentication session
- Application settings
- Temporary runtime state

This data is never synchronized.

---

# Indexes

SQLite should maintain indexes on:

```
worker_id

shift_id

recorded_at

sync_status
```

Only introduce additional indexes when justified by measured performance.

---

# Upload Rules

Only records with

```
PENDING
```

may be uploaded.

```
FAILED
```

records require retry.

```
SYNCED
```

records must never be uploaded again.

---

# Conflict Resolution

The mobile application is the system of record for field data.

If synchronization conflicts occur, the latest synchronized update wins.

Complex conflict resolution is outside the MVP scope.

---

# Data Retention

Business records are retained locally until synchronization succeeds.

Historical cleanup may be introduced later and is outside the MVP scope.

---

# Migration Strategy

Database schema changes must always be versioned.

Production schemas must never be modified manually.

Every schema change should be accompanied by a migration and, where practical, a rollback.