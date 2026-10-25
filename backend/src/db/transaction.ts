import type pg from 'pg';

/** Anything that can run a query: the pool, or a client inside a transaction. */
export type Queryable = Pick<pg.ClientBase, 'query'>;

/**
 * Runs `work` inside a single database transaction on one pooled client.
 * Commits if it resolves; rolls back and rethrows if it throws.
 */
export async function withTransaction<T>(pool: pg.Pool, work: (client: pg.PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
