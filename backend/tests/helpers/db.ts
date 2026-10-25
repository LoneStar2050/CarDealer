import type { Pool } from 'pg';
import { createPool } from '../../src/db/pool.js';
import { migrate } from '../../src/db/migrate.js';

/** Opens a pool to the test database and ensures the schema exists. */
export async function setupTestDatabase(): Promise<Pool> {
  const pool = createPool(process.env['DATABASE_URL']!);
  await migrate(pool);
  return pool;
}

/** Removes all rows so each test starts from a clean state. */
export async function resetDatabase(pool: Pool): Promise<void> {
  await pool.query('TRUNCATE TABLE vehicles, users RESTART IDENTITY CASCADE');
}
