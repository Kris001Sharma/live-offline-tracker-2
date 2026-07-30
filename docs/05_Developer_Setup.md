# 05 Developer Setup

## Purpose

This document describes the minimum requirements and steps required to set up a local development environment for the project.

---

# Prerequisites

Install the following software:

- Node.js (LTS)
- npm
- Git
- Android SDK
- Android Platform Tools (ADB)

Recommended:

- Visual Studio Code
- Google AI Studio

---

# Clone the Repository

```bash
git clone <repository-url>
cd live-offline-tracker
```

---

# Install Dependencies

```bash
npm install
```

---

# Environment Configuration

Create a local environment file from the example.

```bash
cp .env.example .env
```

Configure the required variables:

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Optional configuration values are documented in `.env.example`.

---

# Start Development

Run the development server.

```bash
npm run dev
```

Validate the project before committing.

```bash
npm run lint
```

---

# Android Development

Synchronize Capacitor.

```bash
npx cap sync
```

Run on a connected Android device.

```bash
npx cap run android
```

---

# Database

Database schema is managed through versioned migrations.

Do not manually create or modify database tables.

---

# References

Project architecture:

- 00_Project_Constitution.md
- 01_Foundation.md
- 02_System_Architecture.md
- 03_Engines.md
- 04_Database.md
- ARCHITECTURE_DECISIONS.md

Development verification:

- 06_Manual_Verification.md

Implementation roadmap:

- 07_Roadmap.md

AI implementation guidelines:

- 08_AI_Guide.md