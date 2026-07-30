# Modules

This directory contains standalone, reusable modules that implement core business and infrastructure engines.

## Purpose

Modules isolate key concerns and domain logic of the Sapana Live Tracker project. By keeping them independent from specific applications, we ensure high testability, clean boundaries, and reuse across both mobile and admin web targets.

## Core Engines

- **Location Tracking Engine**: Manages background GPS coordinates acquisition and buffering.
- **Sync Engine**: Handles queue operations, connection monitoring, and automated push/pull synchronization with Supabase.
- **Database Engine**: Provides local SQLite storage access, migration management, and structured queue mechanisms.
- **Map & Route Engine**: Prepares geo-spatial lines, route-smoothing algorithms, and visualizations.
