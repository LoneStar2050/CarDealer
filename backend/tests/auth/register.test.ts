import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { createApp } from '../../src/app.js';
import { resetDatabase, setupTestDatabase } from '../helpers/db.js';

describe('POST /api/auth/register', () => {
  let pool: Pool;
  let app: Express;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createApp({ pool });
  });

  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  const validUser = { email: 'buyer@example.com', password: 'correct-horse-battery' };

  it('registers a new user and returns 201 with the created user', async () => {
    const response = await request(app).post('/api/auth/register').send(validUser);

    expect(response.status).toBe(201);
    expect(response.body).toEqual({
      user: {
        id: expect.any(String),
        email: 'buyer@example.com',
        role: 'user',
      },
    });
  });

  it('never returns the password or its hash in the response', async () => {
    const response = await request(app).post('/api/auth/register').send(validUser);

    expect(response.status).toBe(201);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain(validUser.password);
    expect(body).not.toMatch(/password/i);
  });

  it('persists the user with a bcrypt hash instead of the plain-text password', async () => {
    await request(app).post('/api/auth/register').send(validUser);

    const result = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [validUser.email],
    );
    expect(result.rowCount).toBe(1);
    const storedHash = result.rows[0]!.password_hash;
    expect(storedHash).not.toBe(validUser.password);
    expect(await bcrypt.compare(validUser.password, storedHash)).toBe(true);
  });

  it('always creates a regular user, even if the request asks for the admin role', async () => {
    const response = await request(app)
      .post('/api/auth/register')
      .send({ ...validUser, role: 'admin' });

    expect(response.status).toBe(201);
    expect(response.body.user.role).toBe('user');
    const result = await pool.query<{ role: string }>(
      'SELECT role FROM users WHERE email = $1',
      [validUser.email],
    );
    expect(result.rows[0]!.role).toBe('user');
  });
});
