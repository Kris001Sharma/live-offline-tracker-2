-- One worker per APPROVED trusted device.
--
-- The device may be associated with multiple historical trusted-device records, but at most
-- one worker may be associated with an APPROVED device at any time. This partial/filtered unique index
-- enforces the worker-device rule at the database level. Historical records
-- (PENDING_APPROVAL / REJECTED / REVOKED) are preserved; a worker change demotes the APPROVED record to REVOKED instead of deleting it.
CREATE UNIQUE INDEX idx_trusted_devices_one_worker_per_device
  ON trusted_devices (device_id)
  WHERE status = 'APPROVED';