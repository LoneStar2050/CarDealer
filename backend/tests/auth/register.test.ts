import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import bcrypt from 'bcryptjs';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { createTestApp } from '../helpers/app.js';
import { resetDatabase, setupTestDatabase } from '../helpers/db.js';

describe('POST /api/auth/register', () => {
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

  describe('validation', () => {
    async function countUsers(): Promise<number> {
      const result = await pool.query<{ count: string }>('SELECT COUNT(*) AS count FROM users');
      return Number(result.rows[0]!.count);
    }

    it('returns 400 and creates no user when the email is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ password: validUser.password });

      expect(response.status).toBe(400);
      // Error contract: a JSON body with a non-empty, human-readable message.
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
      expect(await countUsers()).toBe(0);
    });

    it.each(['not-an-email', 'buyer@example', 'buyer @example.com'])(
      'returns 400 and creates no user for the invalid email "%s"',
      async (email) => {
        const response = await request(app)
          .post('/api/auth/register')
          .send({ email, password: validUser.password });

        expect(response.status).toBe(400);
        expect(await countUsers()).toBe(0);
      },
    );

    it('returns 400 and creates no user when the password is missing', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: validUser.email });

      expect(response.status).toBe(400);
      expect(await countUsers()).toBe(0);
    });

    it('returns 400 and creates no user when the password is shorter than 8 characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: validUser.email, password: '1234567' });

      expect(response.status).toBe(400);
      expect(await countUsers()).toBe(0);
    });

    it('accepts a password of exactly 8 characters', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({ email: validUser.email, password: '12345678' });

      expect(response.status).toBe(201);
    });

    it('returns 409 and keeps a single user when the email is already registered', async () => {
      const first = await request(app).post('/api/auth/register').send(validUser);
      expect(first.status).toBe(201);

      const duplicate = await request(app).post('/api/auth/register').send(validUser);

      expect(duplicate.status).toBe(409);
      expect(await countUsers()).toBe(1);
    });
  });
});
