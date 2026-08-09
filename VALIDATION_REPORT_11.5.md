# Slice 11.5 — Post-Bootstrap Baseline Validation & Freeze

**Status: COMPLETE**
**Baseline Decision: BASELINE VERIFIED**

Scope: validate the complete Phase 11 bootstrap / storage / transaction / migration repair chain
after Slice 11B.11 (transaction ownership), Slice 11.4A (StorageEngine single-flight),
Slice 11.4B (ApplicationLifecycle bootstrap single-flight), and Slice 11.4C (defect investigation).

Validation-only slice. No production code was modified.

---

## 1. Validation Summary

| ID | Check | Result | Evidence class |
|----|-------|--------|----------------|
| V1  | Build integrity (`npm run lint`, tsc --noEmit) | **PASS** | VERIFIED |
| V2  | Transaction regression (no raw SQL transaction control; explicit transaction API only) | **PASS** | VERIFIED |
| V3  | StorageEngine single-flight initialization (sequential / concurrent / failure / retry) | **PASS** | VERIFIED |
| V4  | ApplicationLifecycle bootstrap single-flight (StrictMode = one effective bootstrap) | **PASS** | VERIFIED (by implication) |
| V5  | Browser startup — 5 consecutive headless loads reach READY, 0 exceptions | **PASS** | VERIFIED |
| V6  | Migration idempotency (1 `_migrations` row, 7 tables, 15 indexes, no duplicates) | **PASS** | VERIFIED |
| V7  | Web persistence (IndexedDB snapshot persists schema + migrations; reload READY) | **PASS** | VERIFIED |
| V8  | Router / UI boundary (READY → Dashboard Placeholder; ERROR → error screen + Retry) | **PASS** | VERIFIED |
| V9  | Controlled bootstrap failure → ERROR screen → Retry → fresh READY | **PASS** | VERIFIED |
| V10 | Existing validation suites regression | **PASS (see caveat)** | VERIFIED |

**V10 caveat:** 10 pre-existing environmental failures remain. All require live-Supabase seed data
that is not applied to the live project. They are unrelated to the modified modules and existed
before this slice (validation files unchanged since `7a69c0c`). See Section 4.

---

## 2. Evidence

### V1 — Build integrity
`npm run lint` (TypeScript `--noEmit`) completes with zero errors.

### V2 — Transaction regression
- Repository-wide scan for raw `BEGIN` / `COMMIT` / `ROLLBACK`: **0 hits**.
- `StorageAdapter` exposes and uses explicit transaction API:
  `beginTransaction()`, `isTransactionActive()`, `commitTransaction()`, `rollbackTransaction()`.
- Web persistence is written via `saveToStore(DATABASE_NAME)` after commit.
- Inner writes use `db.run(query, params, false)` (`transaction=false`).
- `MigrationEngine` wraps migration runs in `adapter.transaction()`.

Transaction ownership resides solely in the adapter layer. No nested-transaction or
database-not-opened error paths reintroduced.

### V3 — StorageEngine single-flight
Dedicated concurrency harness (temporary, removed after validation):
- Sequential `initialize()` ×2 → **one** adapter init, **one** migration INSERT.
- Concurrent `initialize()` ×2 → **one** adapter init, **one** migration INSERT.
- Forced adapter failure → both callers receive failure, `health() === false`, in-flight cleared.
- Retry after failure → fresh adapter init, idempotent migrations, `health() === true`.

### V4 — ApplicationLifecycle bootstrap single-flight
StrictMode is enabled (`src/main.tsx`). Across all headless browser loads each bootstrap produced
exactly one effective initialization (`getVersion` call) and a single READY transition — no
duplicate bootstrap work observed. Consistent with ADR-013 behaviour.

### V5 — Browser startup (5 loads)
Headless Chrome driven via CDP harness. All 5 loads:
- Reached READY + Dashboard Placeholder.
- **0 exceptions**; no bootstrap / database-not-opened / nested-transaction errors.
- Exactly 1 effective `getVersion` per load.
- Only request noise: `favicon.ico` 404 (cosmetic, expected).

### V6 — Migration idempotency
DB snapshot analysed (via `sql.js`) after every load:
- `_migrations` table: exactly **1 row** (version 1).
- **7 tables**, **15 indexes**, all present and consistent.
- No duplicate migration inserts across any load.

### V7 — Web persistence
- Live DB migrates correctly on first load.
- Persisted IndexedDB snapshot (`jeepSqliteStore` / `databases` / `sapana_local_storageSQLite.db`)
  retains full schema, all 15 indexes, and the `_migrations` row.
- `user_version = 0` in the snapshot is the documented known non-defect (see Section 4).
- Subsequent reloads reach READY; migrations remain idempotent.

### V8 — Router / UI boundary
- `READY → "/" → DashboardPlaceholder` renders correctly.
- ERROR state renders the error panel with a "Retry Bootstrap" control.
- No routing exceptions observed.

### V9 — Failure / retry
Controlled failure injected at the jeep-sqlite boundary (temporary CDP script, removed after):
- Error propagation: adapter → StorageEngine → lifecycle ERROR.
- ERROR screen shown: "Storage Engine: Initialization failed…"; `Bootstrap failed:` logged;
  READY not reached; 0 uncaught exceptions.
- With failure flag cleared, Retry performed a **fresh** bootstrap: READY reached,
  exactly 1 `getVersion`, 0 exceptions.
- Post-retry snapshot: 1 `_migrations` row, 7 tables, 15 indexes — idempotent.
- Confirmed in-flight state cleared and a fresh adapter is used on retry.

### V10 — Regression suites

| Suite | Result |
|-------|--------|
| repository | 44/44 PASS |
| engine | 27/27 PASS |
| integration | 44/44 PASS |
| synchronization | 11/13 PASS (2 environmental) |
| cloud | 43/50 PASS (7 environmental) |
| operational | 238/239 PASS (1 environmental) |

All 10 failures are in live-Supabase dependent checks (see Section 4).

---

## 3. Regression Matrix

| Concern | Pre-slice risk | Post-slice status |
|---------|----------------|-------------------|
| Transaction ownership (adapter-only) | Nested/raw transactions | VERIFIED — no raw SQL control; explicit API only |
| Inner writes (`transaction=false`) | Re-entrancy | VERIFIED — no nested transaction errors |
| StorageEngine single-flight | Double init / double migration | VERIFIED — 1 init, 1 migration |
| ApplicationLifecycle bootstrap single-flight | StrictMode double bootstrap | VERIFIED — 1 effective bootstrap / load |
| Migration idempotency | Duplicate migrations | VERIFIED — exactly 1 row across all loads |
| Web persistence | Lost schema/migrations on reload | VERIFIED — schema + migrations persist |
| Retry path | Stuck in-flight / broken state | VERIFIED — fresh adapter, fresh READY |
| Router / UI boundary | READY/ERROR misrender | VERIFIED — correct screens rendered |
| Baseline suites | Regression from repairs | PASS — only pre-existing environmental failures |

---

## 4. Known Non-Defects

1. **`user_version = 0` in persisted Web snapshot** — jeep-sqlite reports `user_version=0` via
   `getVersion` from the persisted snapshot, while the authoritative `_migrations` table contains
   the correct row. Schema, tables, and indexes are all present and correct. This is documented
   known behaviour and is **not** a defect; `user_version` persistence is intentionally not changed.

2. **Two `getVersion` messages on first clean load** — artifact of the validation harness's
   IndexedDB-clear navigate/reload. Subsequent loads emit exactly one. Not an application defect.

3. **V10 environmental failures (10)** — all live-Supabase dependent checks whose seed data
   (`supabase/seeds/validation_dataset.sql`) has not been applied to the live project:
   - synchronization: 2 (live `workers` table empty; expects seeded rows + `worker-admin`)
   - cloud: 7 (seed-data dependent checks)
   - operational: 1 (OV-SCENARIO-06, Phase 7 live sync to Supabase)
   Validation files unchanged since `7a69c0c`; failures pre-date this slice and are not caused by
   the modified modules. They block only `[LIVE VERIFIED]` classification for those checks.

---

## 5. Unexpected Findings

None. All observed behaviour matched documented expectations. The only noteworthy nuance
(internal): `StorageEngine` is a module singleton, so the V3 harness exercised each scenario with
a fresh adapter and explicit `close()` between scenarios — a harness design detail, not a defect.

---

## 6. Documentation Status

All documentation is consistent with verified behaviour. No doc changes required:

- `ARCHITECTURE_DECISIONS.md` — ADR-012 (initialization ownership), ADR-013 (bootstrap serialization)
- `docs/11_Production_Architecture.md` — Bootstrap Serialization section
- `PROJECT_STATE.md` — Slice 11.4A / 11.4B entries

---

## 7. Repository Status

- Working tree contains exactly the 4 pre-existing modified files:
  `ARCHITECTURE_DECISIONS.md`, `PROJECT_STATE.md`, `docs/11_Production_Architecture.md`,
  `src/shell/lifecycle.context.tsx`.
- All temporary validation harnesses, reports, and profiles removed (`.tmp-validation/` deleted).
- No headless-Chrome or dev-server processes remain (ports 3000 / 9223 free).
- Pre-existing tracked diagnostic files at repo root (`fix_*.ts`, `test-bun.ts`, `test-sqlite.ts`)
  were left untouched — out of scope for this slice.

---

## 8. Baseline Decision

**BASELINE VERIFIED.**

The bootstrap / storage / transaction / migration / routing chain is validated as a stable
production baseline. All slice success criteria are met: lint passes, transaction repair intact,
StorageEngine and ApplicationLifecycle single-flight valid, StrictMode yields one effective
bootstrap, READY consistently reached with zero exceptions, migrations idempotent, retry works,
and all existing validation suites pass except for pre-existing environmental (live-seed)
dependencies that are unrelated to the modified modules.

**Residue (actionable, not blocking):** apply `supabase/seeds/validation_dataset.sql` to the live
Supabase project to promote the 10 affected live-dependent checks to PASS. This is an operational
precondition, not a code defect.
