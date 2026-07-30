# 02 System Architecture and Implementation

## Purpose

This document defines the agreed software architecture, module boundaries, dependency flow, and implementation sequence for the project.

It describes **how the system is structured**, not how individual modules are implemented.

---

# Architecture Overview

The project follows a layered architecture to keep business logic reusable and platform-independent.

```
┌──────────────────────────────┐
│ Applications                 │
├──────────────────────────────┤
│ Features                     │
├──────────────────────────────┤
│ Engines                      │
├──────────────────────────────┤
│ Platform / External Services │
└──────────────────────────────┘
```

Each layer only depends on the layer below it.

---

# Layer Responsibilities

## Applications

Applications are the user-facing products.

Current applications:

```
apps/
    worker-mobile/
    admin-web/
```

Responsibilities:

- Routing
- Screens
- Navigation
- UI composition

Applications should contain very little business logic.

---

## Features

Features implement business capabilities.

Examples:

```
Authentication

Shift

Tracking

Synchronization

Playback

Dashboard
```

Responsibilities:

- Business rules
- User workflows
- Engine coordination

Features should never directly communicate with other Features.

Shared functionality must move into an Engine.

---

## Engines

Engines provide reusable infrastructure.

Unlike Features, Engines are designed to be portable across projects.

Initial engines:

```
Configuration

Storage

Events

Tracking

Sync
```

An Engine should not know anything about the application using it.

---

## Platform

Platform-specific implementations.

Examples:

```
Capacitor

Android Foreground Service

SQLite

Supabase

Browser APIs
```

Platform code remains isolated.

If another platform replaces it later, only adapters should change.

---

# Dependency Rules

Allowed:

```
Application

↓

Feature

↓

Engine

↓

Platform
```

Not allowed:

```
Feature

↓

Feature
```

```
Engine

↓

Feature
```

```
Platform

↓

Business Logic
```

## Supabase Client Ownership Boundary

- `AuthenticationEngine` is the sole module permitted to instantiate and own the `SupabaseClient`.
- Repository modules, Feature Engines, Synchronization Engines, and UI components are strictly prohibited from directly importing `@supabase/supabase-js` or constructing Supabase clients.
- All future cloud interactions must occur exclusively through `AuthenticationEngine` (or a dedicated Cloud API layer introduced by a future architecture phase), and never bypass this boundary.

---

# Repository Structure

```
apps/
    worker-mobile/
    admin-web/

modules/
    configuration/
    storage/
    events/
    tracking/
    sync/

shared/

docs/

scripts/
```

---

# Shared Directory

Contains reusable assets shared across applications.

Examples:

```
Types

Constants

Utilities

Validation

Date Helpers

Interfaces
```

Business logic should not exist here.

---

# Engine Design Rules

Each Engine must have:

- One responsibility
- Public interface
- Internal implementation
- Configuration
- Independent testing
- Minimal dependencies

---

# Feature Design Rules

Each Feature owns:

- UI workflow
- Business rules
- Engine orchestration

A Feature never performs:

- SQLite operations directly
- HTTP requests directly
- GPS collection directly

Those belong to Engines.

---

# Engine Dependency Order

The project will be implemented in this order.

## 1. Configuration Engine

Provides runtime configuration.

Everything depends on this.

---

## 2. Storage Engine

Provides local persistence.

Owns SQLite access.

Nothing else talks directly to SQLite.

---

## 3. Event Engine

Records significant worker events.

Examples:

- Shift Started

- Shift Stopped

- GPS Disabled

- Internet Restored

- Sync Failed

---

## 4. Tracking Engine

Owns:

- GPS collection
- Foreground service communication
- Location buffering
- Location validation

Produces GPS records.

Does not upload them.

---

## 5. Sync Engine

Responsible for:

- Connectivity detection
- Upload queue
- Retry strategy
- Conflict handling
- Upload ordering

Consumes locally stored records.

---

# Feature Implementation Order

Once all Engines exist:

```
Authentication

↓

Shift

↓

Worker Home

↓

Tracking

↓

Synchronization

↓

Dashboard

↓

Playback
```

---

# Worker Application Structure

```
Login

↓

Home

↓

Shift

↓

Tracking Status

↓

Settings
```

Worker interaction should remain minimal.

The application is intended to run in the background.

---

# Admin Application Structure

```
Dashboard

↓

Workers

↓

Shift History

↓

Route Playback
```

The dashboard focuses on operational visibility.

No worker management beyond MVP requirements.

---

# Background Tracking Strategy

Worker starts shift.

↓

Tracking Engine starts.

↓

GPS collected periodically.

↓

Storage Engine persists locally.

↓

Sync Engine uploads when online.

↓

Admin dashboard receives synchronized data.

The Tracking Engine must never depend on internet availability.

---

# Offline Strategy

Every critical action follows the same pattern.

```
Action

↓

Validate

↓

Store Locally

↓

Queue

↓

Synchronize Later
```

Examples:

- Shift Start
- Shift Stop
- GPS Location
- Worker Events

---

# Connectivity Strategy

The application should not constantly poll the server.

Instead:

- Listen for connectivity changes.
- Resume synchronization automatically.
- Retry with exponential backoff when uploads fail.

Tracking continues regardless of network state.

---

# Error Strategy

Errors should generate Events instead of stopping execution.

Examples:

```
GPS Permission Lost

↓

Event Logged

↓

Tracking Suspended

↓

Resume when permission restored
```

This provides traceability without excessive complexity.

---

# Code Organization

Each Engine should follow a consistent structure.

Example:

```
tracking/

    index.ts

    tracking.service.ts

    tracking.types.ts

    tracking.events.ts

    tracking.constants.ts
```

Avoid unnecessary folders until required.

---

# Configuration

All configurable values belong to the Configuration Engine.

Examples:

- GPS interval
- Sync interval
- Retry limits
- Accuracy threshold

No magic numbers inside business logic.

---

# Logging

Development logging should be centralized.

Production logging should only capture actionable information.

Avoid excessive console output.

---

# Manual Development Workflow

For every implementation cycle:

1. Update documentation.
2. Commit documentation.
3. Sync repository.
4. AI Studio reads updated documents.
5. Implement one Engine or one Feature.
6. Review implementation.
7. Fix issues.
8. Commit.
9. Update PROJECT_STATE.md.

No implementation should begin without its supporting documentation.

---

# Acceptance Criteria

Architecture is considered correctly implemented when:

- Business logic is isolated from UI.
- SQLite is only accessed through the Storage Engine.
- GPS is only accessed through the Tracking Engine.
- Synchronization is only handled by the Sync Engine.
- Features remain independent.
- Engines are reusable.
- Platform-specific code is isolated.
- AuthenticationEngine is the sole module permitted to instantiate and own the SupabaseClient.

---

# Related Documents

- 00_Project_Constitution.md
- 01_Foundation.md
- 03_Engines.md