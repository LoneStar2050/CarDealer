import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPool } from '../../src/db/pool.js';
import { migrate } from '../../src/db/migrate.js';

describe('database migration', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPool(process.env['DATABASE_URL']!);
    // Start from an empty schema so we prove migrate() creates everything.
    await pool.query('DROP TABLE IF EXISTS vehicles, users');
    await migrate(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  async function columnsOf(table: string): Promise<string[]> {
    const result = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY column_name`,
      [table],
    );
    return result.rows.map((row) => row.column_name);
  }

  it('creates the users table', async () => {
    expect(await columnsOf('users')).toEqual(
      ['created_at', 'email', 'id', 'password_hash', 'role'],
    );
  });

  it('creates the vehicles table with every required vehicle field', async () => {
    expect(await columnsOf('vehicles')).toEqual(
      ['category', 'created_at', 'id', 'make', 'model', 'price', 'quantity', 'updated_at'],
    );
  });

  it('is safe to run more than once', async () => {
    await expect(migrate(pool)).resolves.not.toThrow();
  });

  it('generates a unique id for each vehicle', async () => {
    const insert = `INSERT INTO vehicles (make, model, category, price, quantity)
                    VALUES ('Toyota', 'Corolla', 'Sedan', 20000, 1) RETURNING id`;
    const first = await pool.query<{ id: string }>(insert);
    const second = await pool.query<{ id: string }>(insert);
    expect(first.rows[0]!.id).toBeTruthy();
    expect(first.rows[0]!.id).not.toEqual(second.rows[0]!.id);
  });

  it('rejects a negative vehicle quantity', async () => {
    await expect(
      pool.query(`INSERT INTO vehicles (make, model, category, price, quantity)
                  VALUES ('Ford', 'Focus', 'Hatchback', 15000, -1)`),
    ).rejects.toThrow(/check constraint/);
  });

  it('rejects a negative vehicle price', async () => {
    await expect(
      pool.query(`INSERT INTO vehicles (make, model, category, price, quantity)
                  VALUES ('Ford', 'Focus', 'Hatchback', -1, 1)`),
    ).rejects.toThrow(/check constraint/);
  });

  it('defaults new users to the "user" role and rejects unknown roles', async () => {
    const result = await pool.query<{ role: string }>(
      `INSERT INTO users (email, password_hash) VALUES ('a@example.com', 'hash') RETURNING role`,
    );
    expect(result.rows[0]!.role).toBe('user');

    await expect(
      pool.query(`INSERT INTO users (email, password_hash, role)
                  VALUES ('b@example.com', 'hash', 'superuser')`),
    ).rejects.toThrow(/check constraint/);
  });

  it('rejects duplicate user emails', async () => {
    await expect(
      pool.query(`INSERT INTO users (email, password_hash) VALUES ('a@example.com', 'hash')`),
    ).rejects.toThrow(/duplicate key/);
  });
});
