-- One active trusted device per worker.
--
-- The worker may keep multiple historical trusted-device records, but at most
-- one record may be APPROVED at any time. This partial/filtered unique index
-- enforces the active-device rule at the database level. Historical records
-- (PENDING_APPROVAL / REJECTED / REVOKED) are preserved; an administrator
-- reset demotes the APPROVED record to REVOKED instead of deleting it.
CREATE UNIQUE INDEX idx_trusted_devices_one_active_per_worker
  ON trusted_devices (worker_id)
  WHERE status = 'APPROVED';
