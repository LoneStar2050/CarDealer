import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { createTestApp } from '../helpers/app.js';
import { setupTestDatabase } from '../helpers/db.js';

describe('error responses', () => {
  let pool: Pool;
  let app: Express;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createTestApp(pool);
  });

  afterAll(async () => {
    await pool.end();
  });

  it('answers a malformed JSON body with 400 and the standard JSON error shape', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email": ');

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: 'Request body is not valid JSON' });
    expect(response.text).not.toMatch(/SyntaxError|at .*node_modules/);
  });
});
