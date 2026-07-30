import { StorageAdapter } from '../../modules/storage';

export interface Migration {
  version: number;
  name: string;
  up: (adapter: StorageAdapter) => Promise<void>;
}

export interface MigrationStatus {
  version: number;
  name: string;
  applied_at: string;
}
