-- ==========================================
-- Validation Dataset Foundation
-- Quality Gate 2
-- ==========================================
-- This seed file is idempotent and establishes
-- the deterministic baseline for validation.
-- ==========================================

-- 1. Workers
INSERT INTO workers (worker_id, email, display_name, employee_code, role, organization, active, created_at, updated_at)
VALUES 
('worker-admin', 'admin@sapana.local', 'System Administrator', 'EMP-ADMIN', 'ADMIN', 'Sapana', 1, NOW(), NOW()),
('worker-active-a', 'worker.a@sapana.local', 'Active Worker A', 'EMP-001', 'WORKER', 'Sapana', 1, NOW(), NOW()),
('worker-active-b', 'worker.b@sapana.local', 'Active Worker B', 'EMP-002', 'WORKER', 'Sapana', 1, NOW(), NOW()),
('worker-inactive', 'inactive@sapana.local', 'Inactive Worker', 'EMP-003', 'WORKER', 'Sapana', 0, NOW(), NOW())
ON CONFLICT (worker_id) DO UPDATE SET 
    email = EXCLUDED.email,
    display_name = EXCLUDED.display_name,
    employee_code = EXCLUDED.employee_code,
    role = EXCLUDED.role,
    organization = EXCLUDED.organization,
    active = EXCLUDED.active,
    updated_at = NOW();

-- 2. Trusted Devices
INSERT INTO trusted_devices (id, worker_id, device_id, manufacturer, model, platform, app_version, status, sync_status, registered_at, approved_at, approved_by, created_at, updated_at)
VALUES 
('device-trusted-1', 'worker-active-a', 'DEV-001-AAA', 'Apple', 'iPhone 13', 'ios', '1.0.0', 'APPROVED', 'SYNCED', NOW(), NOW(), 'worker-admin', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
    worker_id = EXCLUDED.worker_id,
    device_id = EXCLUDED.device_id,
    status = EXCLUDED.status,
    sync_status = EXCLUDED.sync_status,
    updated_at = NOW();

-- 3. Shifts
INSERT INTO shifts (id, worker_id, status, started_at, ended_at)
VALUES 
('shift-baseline-1', 'worker-active-a', 'COMPLETED', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '1 hour')
ON CONFLICT (id) DO UPDATE SET 
    worker_id = EXCLUDED.worker_id,
    status = EXCLUDED.status,
    started_at = EXCLUDED.started_at,
    ended_at = EXCLUDED.ended_at;

-- 4. Attendance
INSERT INTO attendance (id, worker_id, check_in_at, check_out_at, latitude, longitude, accuracy, sync_status, created_at, updated_at)
VALUES 
('attendance-baseline-1', 'worker-active-a', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '1 hour', 27.7172, 85.3240, 10.5, 'SYNCED', NOW(), NOW())
ON CONFLICT (id) DO UPDATE SET 
    worker_id = EXCLUDED.worker_id,
    check_in_at = EXCLUDED.check_in_at,
    check_out_at = EXCLUDED.check_out_at,
    sync_status = EXCLUDED.sync_status,
    updated_at = NOW();

-- 5. Tracking Events
INSERT INTO events (id, event_type, event_data, occurred_at, worker_id, shift_id)
VALUES 
('event-baseline-1', 'LOCATION_UPDATE', '{"lat": 27.7172, "lng": 85.3240}', NOW() - INTERVAL '7 hours', 'worker-active-a', 'shift-baseline-1'),
('event-baseline-2', 'LOCATION_UPDATE', '{"lat": 27.7175, "lng": 85.3245}', NOW() - INTERVAL '6 hours', 'worker-active-a', 'shift-baseline-1')
ON CONFLICT (id) DO UPDATE SET 
    event_type = EXCLUDED.event_type,
    event_data = EXCLUDED.event_data,
    occurred_at = EXCLUDED.occurred_at,
    worker_id = EXCLUDED.worker_id,
    shift_id = EXCLUDED.shift_id;
