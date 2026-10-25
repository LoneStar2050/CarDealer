import pg from 'pg';

/** Creates a PostgreSQL connection pool for the given connection string. */
export function createPool(connectionString: string): pg.Pool {
  return new pg.Pool({ connectionString });
}
