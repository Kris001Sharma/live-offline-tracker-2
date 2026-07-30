-- Convert external_id to email, id to worker_id, name to display_name
ALTER TABLE workers RENAME COLUMN id TO worker_id;
ALTER TABLE workers RENAME COLUMN external_id TO email;
ALTER TABLE workers RENAME COLUMN name TO display_name;

-- Add new columns
ALTER TABLE workers ADD COLUMN employee_code TEXT;
ALTER TABLE workers ADD COLUMN role TEXT NOT NULL DEFAULT 'WORKER';
ALTER TABLE workers ADD COLUMN organization TEXT;
ALTER TABLE workers ADD COLUMN active INTEGER NOT NULL DEFAULT 1;
ALTER TABLE workers ADD COLUMN synced_at TIMESTAMPTZ;

-- Drop default for role as it's only needed for backfilling existing records
ALTER TABLE workers ALTER COLUMN role DROP DEFAULT;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_workers_email ON workers(email);
CREATE INDEX IF NOT EXISTS idx_workers_employee_code ON workers(employee_code);
CREATE INDEX IF NOT EXISTS idx_workers_active ON workers(active);
