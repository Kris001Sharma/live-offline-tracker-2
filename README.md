# Sapana Live Tracker

An offline-first workforce location tracking platform designed for field teams operating in areas with intermittent or no internet connectivity.

## Overview

Sapana Live Tracker is an open-source, enterprise-grade workforce tracking solution. It provides reliable location gathering, robust offline buffering, and elegant path reconstruction. Built with an architecture centered on reliability and data integrity, it guarantees that field records are never lost, even during days of complete disconnection.

## Why this project exists

Field teams, conservationists, and emergency responders often operate in remote, low-connectivity terrains where standard GPS systems fail to record continuously or lose data on connection drops. Existing systems either require a constant data connection or consume excessive battery. Sapana Live Tracker solves this by providing a reliable, battery-optimized offline-first background tracking system that buffers data locally and synchronizes seamlessly when a connection is restored.

## Project Vision

To be the standard open-source platform for robust, privacy-respecting, and offline-resilient field team tracking, enabling operations in the most challenging environments on Earth.

## Core Principles

- **Offline First**: All operations are built with the assumption that the network is unavailable. Local storage is the primary source of truth.
- **Local First**: User interactions, tracking records, and configuration changes are processed locally first, then synchronized.
- **Modular Design**: Separation of concerns ensures that components are highly testable, cohesive, and easy to maintain.
- **Engine + Feature Architecture**: Reusable infrastructure components (engines) are built independently of user-facing screens and flows (features).
- **AI Assisted Development**: The repository is designed with clear modular boundaries and comprehensive documentation to facilitate seamless AI-driven code generation and updates.

## Planned MVP Features

- **Offline GPS Tracking**: Battery-efficient background location gathering with precise coordinates and timestamps.
- **Automatic Synchronization**: Dynamic, connection-aware queuing to upload buffered points to the cloud without manual intervention.
- **Worker Mobile App**: Clean, simple interface for field workers to start shifts, view status, and track connection health.
- **Admin Dashboard**: Visual supervisory platform for reviewing real-time locations and tracking statuses.
- **Route Playback**: Graphical timeline to replay historical worker journeys and analyze paths.
- **Tracking Health Monitoring**: System metrics tracking GPS signal quality, battery levels, and local queue depth.
- **Shift Management**: Simple worker controls to log active hours and pause tracking automatically during breaks.

## Technology Stack

- **React** (Frontend development framework)
- **TypeScript** (Strong typing and modular codebases)
- **Capacitor** (Native bridges for running on Android devices)
- **Kotlin** (Native Android code for robust background geolocation tracking)
- **SQLite** (High-reliability local database engine on mobile devices)
- **Supabase** (Backend database and synchronization target)
- **PostgreSQL** (Durable relational storage and geodetic querying)
- **MapLibre** (High-performance vector map rendering)
- **OpenStreetMap** (Underlying geographic dataset and basemaps)

## Repository Structure

```text
sapana-live-tracker/
├── .github/                  # GitHub workflow and CI/CD templates
├── apps/                     # Application layer projects
│   ├── admin-web/            # Supervisor administration dashboard
│   └── worker-mobile/        # Field worker Capacitor mobile app
├── docs/                     # Design, architecture, and roadmap documentation
├── modules/                  # Standardized business and tracking engines
├── shared/                   # Shared TypeScript models, constants, and utilities
├── scripts/                  # Development automation and deployment scripts
├── PROJECT_STATE.md          # Real-time state of the repository
└── ARCHITECTURE_DECISIONS.md # Historic log of architectural decisions
```

## Development Workflow

Our engineering workflow is documentation-driven:
1. **Documentation First**: All system changes and APIs are fully specified in `docs/` before code is introduced.
2. **Engine Isolation**: Reusable modules and database schemas (the "engines") are implemented and thoroughly verified before developing the user interface.
3. **Feature Composition**: User-facing screens are composed by gluing together stable modules with minimal direct business logic in views.

## Current Status

- **Status**: Repository Bootstrap
- **Architecture Version**: Frozen v1.0
- **Logic**: No application or database logic is implemented yet. The foundation has been established to support structured iterative development.

## High-Level Roadmap

```text
Repository Bootstrap (Current)
        │
        ▼
Foundation Documentation
        │
        ▼
Architecture Documentation
        │
        ▼
Core Engines (Location, Database, Sync)
        │
        ▼
Business Features (UI, Playback, Shifts)
        │
        ▼
Testing and Optimization (Battery, Stress)
        │
        ▼
Beta Release
```

## Contributing

Thank you for your interest in contributing to Sapana Live Tracker. As an open-source project, we welcome community feedback, issue reports, and documentation improvements. Detailed contribution guidelines will be released alongside our core engine development.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
