CREATE TABLE IF NOT EXISTS trusted_devices (
    id TEXT PRIMARY KEY,
    worker_id TEXT NOT NULL,
    device_id TEXT NOT NULL,
    manufacturer TEXT NOT NULL,
    model TEXT NOT NULL,
    platform TEXT NOT NULL,
    app_version TEXT NOT NULL,
    registered_at TIMESTAMPTZ NOT NULL,
    approved_at TIMESTAMPTZ,
    approved_by TEXT,
    status TEXT NOT NULL,
    sync_status TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trusted_devices_worker_id ON trusted_devices(worker_id);
CREATE INDEX IF NOT EXISTS idx_trusted_devices_device_id ON trusted_devices(device_id);
