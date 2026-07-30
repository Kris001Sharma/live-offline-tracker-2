# 00_Project_Constitution

> Status: Approved
>
> Version: 1.0
>
> Owner: Architecture Office

---

# 1. Purpose

This Constitution defines the engineering laws governing this repository.

It specifies **how the project is designed, developed, reviewed and maintained**.

This document intentionally changes very rarely.

Product-specific decisions belong in later documents.

---

# 2. Vision

Build a production-ready, offline-first workforce tracking platform that:

- continues functioning without internet connectivity,
- safely stores critical operational data locally,
- automatically synchronizes when connectivity returns,
- remains maintainable by a solo developer,
- minimizes operational costs,
- is modular enough for reuse in future projects.

The project prioritizes **reliability over feature count**.

---

# 3. Engineering Philosophy

The following principles govern every engineering decision.

## 3.1 Offline First

The application must never assume internet availability.

All critical business operations must continue while offline.

Examples:

- Shift Start
- Shift Stop
- GPS Collection
- Event Logging

must all work without internet.

---

## 3.2 Local First Persistence

Important information is never sent directly to the server.

Instead:

```
Action

↓

Persist Locally

↓

Queue

↓

Synchronize

↓

Mark Complete
```

Local persistence always happens before synchronization.

---

## 3.3 Reliability Over Real-Time

Missing data is worse than delayed data.

A location uploaded five minutes late is acceptable.

A lost location is unacceptable.

---

## 3.4 Simple Architecture

Every solution should be the simplest implementation capable of satisfying the requirement.

Avoid unnecessary abstraction.

Avoid unnecessary frameworks.

Avoid unnecessary services.

---

## 3.5 Readability

Code is read significantly more often than it is written.

Readable code takes priority over clever implementations.

---

## 3.6 Composition Over Coupling

Independent modules should work together through well-defined interfaces.

Avoid tight coupling.

---

## 3.7 Reuse Before Rewrite

Whenever practical, reusable infrastructure should be extracted into Engines.

Future applications should be able to reuse major components with minimal modification.

---

# 4. Architecture Ownership

Two responsibilities exist.

---

## Architecture Office

Responsible for:

- Requirements
- Product Design
- Engineering Decisions
- Documentation
- Module Contracts
- Reviews
- Development Sequence
- Architecture Approval

---

## Engineering Team

Responsible for:

- Implementation
- Refactoring
- Bug Fixes
- Unit Tests
- Documentation updates requested by Architecture Office

The Engineering Team may not alter architecture without approval.

---

# 5. Architecture Model

The project follows four logical layers.

```
Applications

↓

Features

↓

Engines

↓

Platform
```

---

## Applications

Examples

Worker App

Admin Dashboard

Applications assemble Features.

Applications contain almost no business logic.

---

## Features

Examples

Authentication

Shift

Tracking

Playback

Dashboard

A Feature may use multiple Engines.

Features never communicate directly with each other.

---

## Engines

Engines provide reusable infrastructure.

Examples

Configuration Engine

Storage Engine

Tracking Engine

Sync Engine

Event Engine

Engines never depend on Features.

---

## Platform

Platform contains

SQLite

Supabase

Capacitor

Android

Kotlin

Browser APIs

Platform code is isolated.

---

# 6. Engineering Rules

The following rules are mandatory.

## UI

UI components

- display information
- capture user interaction

They do not contain business logic.

---

## Business Logic

Business logic belongs inside Features.

---

## Infrastructure

Infrastructure belongs inside Engines.

---

## Platform Code

Platform-specific implementation remains isolated.

Examples

Android Foreground Service

Capacitor Plugins

SQLite adapters

Supabase client

---

## Supabase Client Ownership Boundary

- `AuthenticationEngine` is the sole module permitted to instantiate and own the `SupabaseClient`.
- Repository modules, Feature Engines, Synchronization Engines, and UI components are strictly prohibited from directly importing `@supabase/supabase-js` or constructing Supabase clients.
- All future cloud interactions must occur exclusively through `AuthenticationEngine` (or a dedicated Cloud API layer introduced by a future architecture phase), and never bypass this boundary.

---

## Configuration

No hardcoded configuration values.

Configuration belongs inside the Configuration Engine.

---

## Error Handling

Errors must never silently terminate important processes.

Failures must produce:

- log entry
- event
- recoverable state

---

# 7. Modularity Rules

Every module must have

- single responsibility
- documented public interface
- minimal dependencies
- clear ownership

Hidden dependencies are prohibited.

---

# 8. Repository Structure

```
apps/
    worker-mobile/
    admin-web/

modules/
    configuration/
    storage/
    tracking/
    sync/
    events/

shared/

docs/

scripts/

README.md

PROJECT_STATE.md

ARCHITECTURE_DECISIONS.md

CHANGELOG.md

LICENSE

.env.example
```

---

# 9. Documentation Rules

Documentation is the primary source of truth.

Implementation follows documentation.

Architecture changes require documentation updates before implementation.

---

## Required Reading Order

1 Constitution

2 Foundation

3 System Architecture

4 Engines

5 Database

6 Worker Mobile

7 Admin Web

---

# 10. Git Strategy

```
main
```

Primary development branch.

AI Studio synchronizes directly with this branch.

---

```
production
```

Stable deployment branch.

Only reviewed code reaches production.

---

Development sequence

```
Documentation

↓

Implementation

↓

Review

↓

Commit

↓

Promotion
```

---

# 11. Approved Technology Stack

| Layer | Technology |
|----------|---------------------------|
| Language | TypeScript |
| Framework | React |
| Mobile | Capacitor |
| Native | Kotlin |
| Database | SQLite |
| Backend | Supabase |
| DB Engine | PostgreSQL |
| Maps | MapLibre |
| Tiles | OpenStreetMap |
| Version Control | GitHub |
| IDE | Google AI Studio |

No technology substitutions without architectural approval.

---

# 12. Cost Philosophy

Recurring costs should be minimized.

Prefer

- Open Source
- Self Managed
- Built-in platform capabilities

Avoid unnecessary paid services.

---

# 13. Security Principles

Service Role keys must never be distributed to clients.

Only public client credentials may exist inside the mobile application.

Sensitive configuration belongs outside the repository.

---

# 14. Scope Discipline

Every proposed feature must answer

Does this directly improve the MVP?

If not,

defer it.

---

# 15. Architecture Decision Records

Changes affecting

- storage
- synchronization
- repository
- module boundaries
- engine contracts
- security
- deployment

must be recorded in

```
ARCHITECTURE_DECISIONS.md
```

---

# 16. Quality Standard

Every implementation should satisfy

✓ Understandable

✓ Modular

✓ Recoverable

✓ Testable

✓ Maintainable

✓ Reusable

before it is considered complete.

---

# 17. Definition of Done

A feature is complete only when

- implementation complete
- reviewed
- documentation updated
- build successful
- tested
- PROJECT_STATE updated

---

# 18. Amendment Policy

This Constitution changes only when the engineering direction of the project fundamentally changes.

Routine implementation decisions must never modify this document.


# Repository Convention 001 — Engine Module Structure

## Status

**Frozen**

This convention applies to every engine introduced into the repository unless a justified architectural exception is approved.

---

## Objective

Maintain a consistent, predictable, and modular project structure that promotes code reuse, simplifies navigation, and minimizes architectural drift as the application grows.

Every engine should have a single, well-defined responsibility and expose a minimal public interface.

---

## Standard Engine Structure

Every engine shall follow the structure below.

```text
modules/

    engine-name/

        index.ts
        engine-name.service.ts
        engine-name.types.ts
        engine-name.constants.ts
```

---

## File Responsibilities

### index.ts

- Sole public entry point.
- Re-export only the approved public API.
- Prevent direct imports from internal implementation files.

---

### engine-name.service.ts

- Contains the implementation.
- Owns the engine lifecycle.
- Coordinates internal logic.
- Must not expose internal helpers.

---

### engine-name.types.ts

- Contains all interfaces.
- Contains all type aliases.
- Contains enums when applicable.
- No implementation logic.

---

### engine-name.constants.ts

- Contains default values.
- Contains immutable constants.
- Contains event names, limits, thresholds, and configuration values that belong exclusively to the engine.

No executable logic.

---

## Optional Files

Additional files should only be introduced when they encapsulate a distinct responsibility.

Examples include:

```text
tracking.scheduler.ts

tracking.permissions.ts

sync.worker.ts

sync.retry.ts

events.serializer.ts
```

Optional files must remain cohesive and narrowly focused.

---

## Prohibited Practices

Do not create utility files without a clearly defined responsibility.

Avoid files such as:

```
helpers.ts
utils.ts
common.ts
misc.ts
temp.ts
```

Generic utility files encourage architectural drift and should be replaced with focused modules.

---

## Public API Rule

Only `index.ts` may be imported by external modules.

Example:

✔

import { TrackingEngine } from '@/modules/tracking';

✘

import { TrackingService } from '@/modules/tracking/tracking.service';

---

## Dependency Direction

The dependency graph must always flow downward.

```text
UI

↓

Business Engines

↓

Repositories

↓

Storage Engine

↓

SQLite Adapter

↓

SQLite
```

No lower layer may depend on a higher layer.

Circular dependencies are prohibited.

---

## Design Principles

Every engine should satisfy the following principles:

- Single Responsibility Principle
- Plug-and-Play Architecture
- Dependency Isolation
- Strong Typing
- Minimal Public Surface
- Reusable Across Projects
- Testable in Isolation

---

## Architectural Goal

An engine should be removable, replaceable, or reusable in another project with minimal changes.

Business logic must remain independent from infrastructure wherever practical.

This convention is considered **frozen** for the lifetime of the project unless an architectural review determines that a deviation provides a measurable benefit.