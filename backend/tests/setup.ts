import { config } from 'dotenv';

// Tests always run against the dedicated test database defined in .env.test.
config({ path: '.env.test', quiet: true });

// Guard: tests drop and truncate tables, so refuse to run against
// anything that is not clearly a test database.
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set. Copy .env.test.example to .env.test.');
}
const databaseName = new URL(databaseUrl).pathname.slice(1);
if (!databaseName.endsWith('_test')) {
  throw new Error(`Refusing to run tests against non-test database "${databaseName}".`);
}
