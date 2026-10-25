import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { migrate } from './migrate.js';
import { createPool } from './pool.js';

/**
 * Creates the admin account from ADMIN_EMAIL / ADMIN_PASSWORD, or promotes
 * and resets it if it already exists. Run with `npm run seed:admin`.
 */
const email = process.env['ADMIN_EMAIL'];
const password = process.env['ADMIN_PASSWORD'];
const databaseUrl = process.env['DATABASE_URL'];
if (!email || !password || !databaseUrl) {
  throw new Error('Set DATABASE_URL, ADMIN_EMAIL and ADMIN_PASSWORD in .env');
}
if (password.length < 8) {
  throw new Error('ADMIN_PASSWORD must be at least 8 characters long');
}

const pool = createPool(databaseUrl);
try {
  await migrate(pool);
  const passwordHash = await bcrypt.hash(password, 10);
  await pool.query(
    `INSERT INTO users (email, password_hash, role) VALUES ($1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = 'admin'`,
    [email, passwordHash],
  );
  console.log(`Admin account ready: ${email}`);
} finally {
  await pool.end();
}
