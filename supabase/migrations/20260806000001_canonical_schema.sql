CREATE TABLE workers (
    worker_id TEXT PRIMARY KEY,
    employee_code TEXT,
    email TEXT UNIQUE NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL,
    organization TEXT,
    active INTEGER NOT NULL DEFAULT 1,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    synced_at TEXT
);

CREATE TABLE shifts (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    status TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE RESTRICT
);

CREATE TABLE locations (
    id TEXT PRIMARY KEY,
    shift_id TEXT,
    worker_id TEXT NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL NOT NULL,
    altitude REAL,
    speed REAL,
    heading REAL,
    recorded_at TEXT NOT NULL,
    sync_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE RESTRICT,
    FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE RESTRICT
);

CREATE TABLE events (
    id TEXT PRIMARY KEY,
    event_type TEXT NOT NULL,
    event_data TEXT NOT NULL,
    occurred_at TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    shift_id TEXT,
    sync_status TEXT NOT NULL,
    sync_retry_count INTEGER NOT NULL,
    sync_last_error TEXT,
    sync_last_attempt_at TEXT,
    FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE RESTRICT,
    FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE RESTRICT
);

CREATE TABLE attendance (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    check_in_at TEXT NOT NULL,
    check_out_at TEXT,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    accuracy REAL NOT NULL,
    sync_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE RESTRICT
);

CREATE TABLE trusted_devices (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    platform TEXT NOT NULL,
    app_version TEXT NOT NULL,
    registered_at TEXT NOT NULL,
    approved_at TEXT,
    approved_by TEXT,
    status TEXT NOT NULL,
    sync_status TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (worker_id) REFERENCES workers(worker_id) ON DELETE RESTRICT
);

CREATE INDEX idx_workers_active ON workers(active);

CREATE INDEX idx_shifts_worker_id ON shifts(worker_id);
CREATE INDEX idx_shifts_started_at ON shifts(started_at);

CREATE INDEX idx_locations_worker_id ON locations(worker_id);
CREATE INDEX idx_locations_recorded_at ON locations(recorded_at);
CREATE INDEX idx_locations_sync_status ON locations(sync_status);

CREATE INDEX idx_events_occurred_at ON events(occurred_at);
CREATE INDEX idx_events_shift_id ON events(shift_id);
CREATE INDEX idx_events_sync_status ON events(sync_status);

CREATE INDEX idx_attendance_worker_id ON attendance(worker_id);
CREATE INDEX idx_attendance_check_in_at ON attendance(check_in_at);
CREATE INDEX idx_attendance_sync_status ON attendance(sync_status);

CREATE INDEX idx_trusted_devices_worker_id ON trusted_devices(worker_id);
CREATE INDEX idx_trusted_devices_device_id ON trusted_devices(device_id);
CREATE INDEX idx_trusted_devices_status ON trusted_devices(status);
