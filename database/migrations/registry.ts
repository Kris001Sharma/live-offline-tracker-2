import { Migration } from './migrations.types';
import { migration001 } from './versions/001_canonical_schema';

export const migrations: Migration[] = [
  migration001
];
