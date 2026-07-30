# 01 Foundation

## Purpose

This document defines **what** we are building and the agreed scope for the MVP.

---

# Product Summary

Sapana Live Tracker is an offline-first worker tracking platform designed for organizations whose field staff operate in areas with unreliable internet connectivity.

The worker application must continue functioning regardless of network availability while automatically synchronizing data once connectivity is restored.

---

# Product Goals

- Reliable offline GPS tracking
- Offline shift management
- Automatic synchronization
- Route playback for administrators
- Production-ready architecture
- Minimal operational cost
- Modular and reusable codebase

---

# Primary Users

## Worker

Uses the Android application to:

- Login
- Start Shift
- Stop Shift
- Allow location tracking
- Continue working without internet

---

## Administrator

Uses the web dashboard to:

- View workers
- View active shifts
- Review completed shifts
- Replay worker routes
- Monitor synchronization status

---

# MVP Scope

## Worker Application

### Authentication

- Login
- Logout
- Session persistence

---

### Shift

- Start Shift
- Stop Shift
- Shift status

All shift operations must function offline.

---

### Tracking

- Background GPS collection
- Foreground service
- Local storage
- Automatic resume after connectivity

---

### Synchronization

- Detect connectivity restoration
- Upload pending records
- Retry failed uploads
- Preserve upload order

---

### Status

Worker can always see:

- Shift status
- GPS status
- Sync status

---

## Admin Dashboard

### Dashboard

- Worker list

- Active workers

- Last known location

---

### Shift History

- Shift list

- Shift details

---

### Route Playback

- Route map

- Timeline

- GPS points

---

### Worker Status

Display:

- Online

- Offline

- Tracking

- Sync Pending

---

# Out of Scope

The following are intentionally excluded from MVP.

- Payroll

- Attendance calculation

- Leave management

- Geofencing

- Push notifications

- Reports

- Analytics

- iOS

- Multi-company support

---

# Functional Requirements

The system shall:

- Track worker location during active shifts.

- Continue tracking while offline.

- Store all GPS data locally.

- Automatically synchronize once internet returns.

- Preserve chronological order of uploaded locations.

- Record important worker events.

---

# Non-Functional Requirements

The system must be:

- Offline-first

- Battery conscious

- Recoverable

- Modular

- Easy to maintain

- Cost effective

---

# Approved Technology

| Area | Technology |
|-------|------------|
| Frontend | React |
| Language | TypeScript |
| Mobile | Capacitor |
| Native | Kotlin |
| Local Database | SQLite |
| Backend | Supabase |
| Maps | MapLibre |

---

# Success Criteria

The MVP is considered successful when:

- Worker completes an entire shift without internet.

- No GPS points are lost.

- Shift actions work offline.

- Synchronization completes automatically.

- Administrator can replay the complete route.

---

# Dependencies

Before implementation begins:

- GitHub repository

- AI Studio

- Supabase

- Android SDK

- Physical Android device

must all be operational.

---

# Related Documents

- 00_Project_Constitution.md

- 02_System_Architecture_and_Implementation.md

- 03_Engines.md