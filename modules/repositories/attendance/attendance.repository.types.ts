export interface AttendanceEntity {
  readonly id: string;
  readonly worker_id: string;
  readonly check_in_at: string;
  readonly check_out_at: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
  readonly sync_status: string;
  readonly created_at: string;
  readonly updated_at: string;
}

export interface AppendAttendanceRequest {
  readonly id: string;
  readonly worker_id: string;
  readonly check_in_at: string;
  readonly check_out_at?: string | null;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
}

export class AttendanceRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AttendanceRepositoryError';
  }
}
