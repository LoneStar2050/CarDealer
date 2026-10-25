import request from 'supertest';
import jwt from 'jsonwebtoken';
import { expect } from 'vitest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import type { Role } from '../../src/auth/user.js';
import { testJwtConfig } from './app.js';

const PASSWORD = 'correct-horse-battery';

/** A registered, logged-in test user. */
export interface TestUser {
  id: string;
  email: string;
  token: string;
}

/**
 * Registers a user through the API, optionally promotes them to admin
 * directly in the database (there is no public way to become admin),
 * then logs in and returns the user's id, email and JWT.
 */
export async function createUser(app: Express, pool: Pool, role: Role): Promise<TestUser> {
  const email = `${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  await request(app).post('/api/auth/register').send({ email, password: PASSWORD }).expect(201);
  if (role === 'admin') {
    await pool.query(`UPDATE users SET role = 'admin' WHERE email = $1`, [email]);
  }
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email, password: PASSWORD })
    .expect(200);
  return { id: response.body.user.id, email, token: response.body.token };
}

/** Like createUser, but returns only the JWT. */
export async function loginAs(app: Express, pool: Pool, role: Role): Promise<string> {
  return (await createUser(app, pool, role)).token;
}

/** A correctly signed token for the given user that expired a minute ago. */
export function expiredTokenFor(userId: string, role: Role = 'user'): string {
  const oneMinuteAgo = Math.floor(Date.now() / 1000) - 60;
  return jwt.sign({ role, exp: oneMinuteAgo }, testJwtConfig.secret, {
    subject: userId,
    algorithm: 'HS256',
  });
}

type Method = 'get' | 'post' | 'put' | 'delete';

/**
 * Asserts that a route rejects a missing header, a malformed token, a token
 * signed with the wrong secret and an expired token, each with 401 and the
 * standard `{ error }` body.
 */
export async function expectAuthenticationRequired(
  app: Express,
  method: Method,
  path: string,
  userId: string,
): Promise<void> {
  const forged = jwt.sign({ role: 'admin' }, 'not-the-real-secret', { subject: userId });
  const headers: [string, string | undefined][] = [
    ['missing', undefined],
    ['malformed', 'Bearer not-a-jwt'],
    ['wrong scheme', `Basic ${forged}`],
    ['forged', `Bearer ${forged}`],
    ['expired', `Bearer ${expiredTokenFor(userId)}`],
  ];
  for (const [label, header] of headers) {
    const pending = request(app)[method](path);
    const response = await (header ? pending.set('Authorization', header) : pending);
    expect(response.status, `${label} token`).toBe(401);
    expect(response.body, `${label} token`).toEqual({ error: expect.stringMatching(/\S/) });
  }
}
