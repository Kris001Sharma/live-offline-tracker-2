export interface WorkerEntity {
  id: string;
  external_id: string;
  name: string;
  created_at: string;
  updated_at: string;
}

export interface ShiftEntity {
  id: string;
  worker_id: string;
  status: string;
  started_at: string;
  ended_at: string | null;
}

export interface EventEntity {
  id: string;
  event_type: string;
  event_data: string;
  occurred_at: string;
  worker_id: string;
  shift_id: string | null;
  sync_status: string;
  sync_retry_count: number;
  sync_last_error: string | null;
  sync_last_attempt_at: string | null;
}
