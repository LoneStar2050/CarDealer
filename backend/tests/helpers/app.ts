import type { Express } from 'express';
import type { Pool } from 'pg';
import { createApp, type JwtConfig } from '../../src/app.js';

/** JWT settings for tests, loaded from .env.test by tests/setup.ts. */
export const testJwtConfig: JwtConfig = {
  secret: process.env['JWT_SECRET']!,
  expiresIn: process.env['JWT_EXPIRES_IN']!,
};

/** Builds the application wired to the test database and test JWT settings. */
export function createTestApp(pool: Pool): Express {
  return createApp({ pool, jwt: testJwtConfig });
}
