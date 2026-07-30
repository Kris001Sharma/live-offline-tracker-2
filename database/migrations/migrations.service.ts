import { StorageEngine, StorageAdapter } from '../../modules/storage';
import { Migration, MigrationStatus } from './migrations.types';
import { MIGRATIONS_TABLE_NAME } from './migrations.constants';

export const MigrationEngine = {
  async run(migrations: Migration[]): Promise<void> {
    await StorageEngine.execute(`
      CREATE TABLE IF NOT EXISTS ${MIGRATIONS_TABLE_NAME} (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);

    const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version);

    const status = await this.status();
    const appliedVersions = new Set(status.map(s => s.version));

    for (const migration of sortedMigrations) {
      if (appliedVersions.has(migration.version)) {
        continue;
      }

      try {
        await StorageEngine.transaction(async (txAdapter: StorageAdapter) => {
          await migration.up(txAdapter);
          await txAdapter.execute(
            `INSERT INTO ${MIGRATIONS_TABLE_NAME} (version, name, applied_at) VALUES (?, ?, ?)`,
            [migration.version, migration.name, new Date().toISOString()]
          );
        });
      } catch (error) {
        throw new Error(`Migration Engine: Failed to execute migration ${migration.version} (${migration.name}). Execution stopped. ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  },

  async status(): Promise<MigrationStatus[]> {
    try {
      const result = await StorageEngine.execute<MigrationStatus>(
        `SELECT version, name, applied_at FROM ${MIGRATIONS_TABLE_NAME} ORDER BY version ASC`
      );
      return result.rows;
    } catch (error) {
      // Return empty array if the migrations table does not exist yet
      return [];
    }
  }
};
