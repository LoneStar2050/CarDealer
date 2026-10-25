import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { createTestApp, testJwtConfig } from '../helpers/app.js';
import { resetDatabase, setupTestDatabase } from '../helpers/db.js';

describe('POST /api/auth/login', () => {
  let pool: Pool;
  let app: Express;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createTestApp(pool);
  });

  beforeEach(async () => {
    await resetDatabase(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  const credentials = { email: 'buyer@example.com', password: 'correct-horse-battery' };

  /** Registers the test user through the public API and returns its id. */
  async function registerUser(): Promise<string> {
    const response = await request(app).post('/api/auth/register').send(credentials);
    expect(response.status).toBe(201);
    return response.body.user.id;
  }

  it('returns 200 with a signed JWT and the user for valid credentials', async () => {
    const userId = await registerUser();

    const response = await request(app).post('/api/auth/login').send(credentials);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      token: expect.any(String),
      user: { id: userId, email: credentials.email, role: 'user' },
    });

    // The token must verify with the configured secret and identify the user.
    const claims = jwt.verify(response.body.token, testJwtConfig.secret) as jwt.JwtPayload;
    expect(claims.sub).toBe(userId);
    expect(claims['role']).toBe('user');
    expect(claims.exp).toEqual(expect.any(Number));
  });

  it('never returns the password or its hash in the response', async () => {
    await registerUser();
    const stored = await pool.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE email = $1',
      [credentials.email],
    );
    const storedHash = stored.rows[0]!.password_hash;

    const response = await request(app).post('/api/auth/login').send(credentials);

    expect(response.status).toBe(200);
    const body = JSON.stringify(response.body);
    expect(body).not.toContain(credentials.password);
    expect(body).not.toContain(storedHash);
    expect(body).not.toMatch(/password/i);
  });
});
