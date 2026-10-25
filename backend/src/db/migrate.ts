import type { Pool } from 'pg';

/**
 * Database schema. Every statement is idempotent (IF NOT EXISTS),
 * so migrate() can safely run on every startup or test run.
 * gen_random_uuid() is built into PostgreSQL 13+.
 */
const SCHEMA = `
  CREATE TABLE IF NOT EXISTS users (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email         TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS vehicles (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    make       TEXT NOT NULL,
    model      TEXT NOT NULL,
    category   TEXT NOT NULL,
    price      NUMERIC(12, 2) NOT NULL CHECK (price >= 0),
    quantity   INTEGER NOT NULL CHECK (quantity >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
  );
`;

/** Creates all application tables if they do not already exist. */
export async function migrate(pool: Pool): Promise<void> {
  await pool.query(SCHEMA);
}
