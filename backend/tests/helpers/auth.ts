import request from 'supertest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import type { Role } from '../../src/auth/user.js';

const PASSWORD = 'correct-horse-battery';

/**
 * Registers a user through the API, optionally promotes them to admin
 * directly in the database (there is no public way to become admin),
 * then logs in and returns the JWT.
 */
export async function loginAs(app: Express, pool: Pool, role: Role): Promise<string> {
  const email = `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: PASSWORD }).expect(201);
  if (role === 'admin') {
    await pool.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [email]);
  }
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return response.body.token;
}
