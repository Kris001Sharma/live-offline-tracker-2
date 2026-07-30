export interface LocationEntity {
  readonly id: string;
  readonly shift_id: string;
  readonly worker_id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
  readonly altitude: number | null;
  readonly speed: number | null;
  readonly heading: number | null;
  readonly recorded_at: string;
  readonly sync_status: string;
  readonly created_at: string;
}

export interface AppendLocationRequest {
  readonly id: string;
  readonly shift_id: string;
  readonly worker_id: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly accuracy: number;
  readonly altitude?: number | null;
  readonly speed?: number | null;
  readonly heading?: number | null;
  readonly recorded_at: string;
}
