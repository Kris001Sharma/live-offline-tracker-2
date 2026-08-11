import { Migration } from './migrations.types';
import { migration001 } from './versions/001_canonical_schema';
import { migration002 } from './versions/002_trusted_device_one_active_per_worker';

export const migrations: Migration[] = [
  migration001,
  migration002
];
