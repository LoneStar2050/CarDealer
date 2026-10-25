import 'dotenv/config';
import type { JwtConfig } from './auth/tokenService.js';

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name} (see .env.example)`);
  }
  return value;
}

/** Application settings, read once from the environment (.env). */
export const config = {
  port: Number(process.env['PORT'] ?? 3000),
  databaseUrl: required('DATABASE_URL'),
  jwt: {
    secret: required('JWT_SECRET'),
    expiresIn: process.env['JWT_EXPIRES_IN'] ?? '1h',
  } satisfies JwtConfig,
};
