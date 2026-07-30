# 03 Engines

## Purpose

This document defines the reusable infrastructure ("Engines") that form the technical foundation of the application.

An Engine owns exactly one technical capability. Engines do not contain business workflows, UI logic, or feature-specific behavior. Features orchestrate Engines to deliver business functionality.

This separation keeps the architecture modular, reusable, and portable across future projects.

---

# Engine Principles

Every Engine must:

- own exactly one technical capability.
- expose only a minimal public API through `index.ts`.
- remain independent of UI and business workflows.
- depend only on approved lower-level Engines.
- remain independently testable.
- hide implementation details.
- be reusable across projects.

---

# Engine Dependency Diagram

```

Configuration
│
├──────────────┐
│              │
Storage      Event
│              │
├──────────────┤
│
Location Provider
│
Location Evaluation
│
Tracking
│
Sync

```

## Dependency Rules

- Configuration has no dependencies.
- Storage depends only on Configuration.
- Event depends only on Storage.
- Location Provider depends only on the native platform.
- Location Evaluation depends only on the Location Provider.
- Tracking orchestrates lower-level Engines but owns no infrastructure itself.
- Sync depends on previous Engines.
- Reverse dependencies are prohibited.

---

# Engine Standards

Every Engine should contain only the files it requires.

Typical structure:

```

index.ts

types.ts

constants.ts

service.ts

(optional)

repository.ts

adapter.ts

```

Avoid unnecessary files.

If an Engine contains fewer than approximately 300 lines of logic, prefer keeping it compact rather than artificially splitting files.

---

# Engine Lifecycle

Every Engine follows the same lifecycle.

```

Initialize

↓

Execute

↓

Return Result

↓

Dispose

```

Lifecycle management must never be handled by UI components.

---

# Engine Communication

Allowed

```

Feature

↓

Engine

↓

Engine

```

Not Allowed

```

Feature

↓

SQLite

```

```

Feature

↓

Supabase

```

```

Feature

↓

Native GPS

```

```

React Component

↓

Engine Internals

```

## Authentication Engine Supabase Client Ownership Rule

- `AuthenticationEngine` is the sole module permitted to instantiate and own the `SupabaseClient`.
- Repository modules, Feature Engines, Synchronization Engines, and UI components are strictly prohibited from directly importing `@supabase/supabase-js` or constructing Supabase clients.
- All future cloud interactions must occur exclusively through `AuthenticationEngine` (or a dedicated Cloud API layer introduced by a future architecture phase), and never bypass this boundary.

---

# 1. Configuration Engine

## Purpose

Provide all runtime configuration for the application.

## Responsibilities

- Environment configuration
- Application configuration
- Feature flags
- Runtime settings
- Retry policies

## Public Interface

```

load()

get(key)

isFeatureEnabled(feature)

```

## Dependencies

None

## Non Responsibilities

- Storage
- Networking
- GPS
- Authentication

---

# 2. Storage Engine

## Purpose

Provide the single interface for local persistence.

SQLite implementation remains hidden behind this Engine.

## Responsibilities

- Store data
- Retrieve data
- Update data
- Delete data
- Transactions
- Local persistence

## Public Interface

```

initialize()

save()

update()

delete()

find()

findMany()

transaction()

```

## Dependencies

- Configuration
- SQLite Adapter

## Rules

Only the Storage Engine may communicate with SQLite.

## Non Responsibilities

- Synchronization
- Networking
- GPS

---

# 3. Event Engine

## Purpose

Record operational events describing application behaviour.

Events explain system behaviour rather than business analytics.

## Responsibilities

- Record events
- Retrieve event history
- Maintain chronological event log

## Example Events

- Shift Started
- Shift Stopped
- GPS Disabled
- GPS Enabled
- Permission Granted
- Permission Revoked
- Tracking Started
- Tracking Stopped
- Sync Started
- Sync Completed
- Sync Failed

## Public Interface

```

record()

find()

findBetween()

clear()

```

## Dependencies

- Storage

## Non Responsibilities

- Analytics
- Reporting
- Notifications

---

# 4. Location Provider

## Purpose

Provide a single abstraction over native GPS capabilities.

## Responsibilities

- Permission management
- Current location acquisition
- Native GPS abstraction

## Public Interface

```

checkPermission()

requestPermission()

getCurrentLocation()

```

## Dependencies

- Native GPS Adapter

## Non Responsibilities

- Tracking
- Attendance
- Geofence evaluation
- Storage
- Event creation

---

# 5. Location Evaluation

## Purpose

Provide the single authoritative implementation for evaluating captured locations.

## Responsibilities

- GPS accuracy evaluation
- Distance evaluation
- Time evaluation
- Geofence evaluation

## Public Interface

```

evaluate()

```

## Rules

All location-based decisions must be delegated to this Engine.

Tracking, Attendance, Patrols, Geofencing, and future location-based features must never implement their own evaluation logic.

## Dependencies

- Location Provider

## Non Responsibilities

- GPS acquisition
- Event creation
- Storage
- Tracking
- Synchronization

---

# 6. Tracking Engine

## Purpose

Own the lifecycle of location tracking by orchestrating lower-level Engines.

## Responsibilities

- Start tracking
- Stop tracking
- Coordinate location acquisition
- Coordinate location evaluation
- Record accepted locations
- Manage tracking lifecycle
- Monitor provider availability
- Coordinate Android Foreground Service

## Public Interface

```

start()

stop()

pause()

resume()

status()

currentLocation()

```

## Tracking Lifecycle

```

Shift Started

↓

Acquire Location

↓

Evaluate Location

↓

Record Accepted Location

↓

Repeat

```

## Evaluation Rule

The Tracking Engine must never implement its own GPS validation logic.

All spatial and temporal evaluation must be delegated exclusively to the Location Evaluation Engine.

## Storage Rule

Accepted locations are immediately persisted locally.

Tracking never uploads data.

## Failure Behaviour

If GPS becomes unavailable:

```

Record Event

↓

Remain Active

↓

Retry

↓

Resume Automatically

```

## Dependencies

- Configuration
- Location Provider
- Location Evaluation
- Event
- Storage

## Non Responsibilities

- Synchronization
- Networking
- Authentication

---

# 7. Sync Engine

## Purpose

Synchronize locally stored information with Supabase.

Own every network interaction.

## Responsibilities

- Detect connectivity
- Upload pending data
- Retry failures
- Preserve upload order
- Prevent duplicate uploads

## Public Interface

```

start()

stop()

sync()

retry()

pending()

status()

```

## Synchronization Strategy

```

Connectivity Restored

↓

Fetch Pending Records

↓

Upload Oldest First

↓

Mark Uploaded

↓

Repeat

```

## Rules

- Upload chronologically.
- Retry only failed uploads.
- Use exponential backoff.
- Listen for connectivity changes.
- Storage owns data.
- Sync owns upload state.

## Dependencies

- Configuration
- Storage
- Event
- Supabase Adapter

## Non Responsibilities

- GPS
- Business workflows
- SQLite implementation

---

# Engine Boundaries

| Engine | Owns |
|----------|--------------------------------------|
| Configuration | Runtime configuration |
| Storage | Local persistence |
| Event | Operational event log |
| Location Provider | Native GPS integration |
| Location Evaluation | Location acceptance rules |
| Tracking | Tracking orchestration |
| Sync | Network synchronization |

If ownership is unclear, it belongs in neither until reviewed.

---

# Single Source of Truth

Each technical capability has exactly one authoritative Engine.

| Capability | Authoritative Engine |
|------------|----------------------|
| Runtime Configuration | Configuration |
| Local Persistence | Storage |
| Native GPS | Location Provider |
| Location Evaluation | Location Evaluation |
| Operational Events | Event |
| Tracking Lifecycle | Tracking |
| Network Synchronization | Sync |

Duplicate implementations of the same capability are prohibited.

---

# Implementation Order

Engines must be implemented in the following order:

```

Configuration

↓

Storage

↓

Event

↓

Location Provider

↓

Location Evaluation

↓

Tracking

↓

Sync

```

No Engine may begin before all required dependencies are complete.

---

# Acceptance Criteria

An Engine is complete when:

- Public API is implemented.
- Responsibilities match this document.
- Dependency rules are satisfied.
- No prohibited responsibilities exist.
- The Engine remains independently testable.
- No feature-specific business logic has been introduced.
- Only AuthenticationEngine instantiates and owns the SupabaseClient instance.