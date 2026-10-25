import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { createTestApp } from '../helpers/app.js';
import { createUser, expectAuthenticationRequired, type TestUser } from '../helpers/auth.js';
import { resetDatabase, setupTestDatabase } from '../helpers/db.js';
import { createVehicle, UNKNOWN_ID } from '../helpers/vehicles.js';

describe('GET /api/purchases/:id/invoice', () => {
  let pool: Pool;
  let app: Express;
  let admin: TestUser;
  let alice: TestUser;
  let bob: TestUser;
  let purchase: {
    id: string;
    invoiceNumber: string;
    vehicleId: string;
    purchasedAt: string;
  };

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createTestApp(pool);
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    admin = await createUser(app, pool, 'admin');
    alice = await createUser(app, pool, 'user');
    bob = await createUser(app, pool, 'user');
    const vehicle = await createVehicle(app, admin.token, {
      make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1500000.5, quantity: 5,
    });
    const response = await request(app)
      .post(`/api/vehicles/${vehicle.id}/purchase`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ quantity: 2 })
      .expect(200);
    purchase = response.body.purchase;
  });

  afterAll(async () => {
    await pool.end();
  });

  const download = (user: TestUser, id = purchase.id) =>
    request(app).get(`/api/purchases/${id}/invoice`).set('Authorization', `Bearer ${user.token}`);

  it('downloads the buyer\'s invoice as a UTF-8 text attachment named after the invoice number', async () => {
    const response = await download(alice);

    expect(response.status).toBe(200);
    expect(response.headers['content-type']).toBe('text/plain; charset=utf-8');
    expect(response.headers['content-disposition']).toBe(`attachment; filename="${purchase.invoiceNumber}.txt"`);
    expect(response.headers['cache-control']).toBe('no-store');
  });

  it('contains the invoice number, order reference, date, buyer, vehicle, quantity, unit price and total', async () => {
    const { text } = await download(alice);

    expect(text).toContain('Prestige Motors');
    expect(text).toMatch(new RegExp(`Invoice number:\\s+${purchase.invoiceNumber}`));
    expect(text).toMatch(new RegExp(`Order reference:\\s+${purchase.id}`));
    expect(text).toMatch(new RegExp(`Purchase date:\\s+${purchase.purchasedAt.slice(0, 10)} \\d{2}:\\d{2} UTC`));
    expect(text).toMatch(new RegExp(`Billed to:\\s+${alice.email}`));
    expect(text).toMatch(/Vehicle:\s+Hyundai Creta \(SUV\)/);
    expect(text).toMatch(/Quantity:\s+2\n/);
    expect(text).toMatch(/Unit price:\s+INR 15,00,000\.50\n/);
    expect(text).toMatch(/Total:\s+INR 30,00,001\.00\n/);
  });

  it('still produces the invoice after the vehicle has been deleted', async () => {
    await request(app)
      .delete(`/api/vehicles/${purchase.vehicleId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);

    const response = await download(alice);
    expect(response.status).toBe(200);
    expect(response.text).toMatch(/Vehicle:\s+Hyundai Creta \(SUV\)/);
  });

  it('returns 404 JSON for another user\'s invoice, including an admin\'s request', async () => {
    for (const other of [bob, admin]) {
      const response = await download(other);
      expect(response.status).toBe(404);
      expect(response.headers['content-type']).toMatch(/application\/json/);
      expect(response.body).toEqual({ error: 'Order not found' });
    }
  });

  it('returns 404 for an unknown order and 400 for a malformed id', async () => {
    expect((await download(alice, UNKNOWN_ID)).status).toBe(404);
    const malformed = await download(alice, 'not-a-uuid');
    expect(malformed.status).toBe(400);
    expect(malformed.body).toEqual({ error: expect.stringMatching(/\S/) });
  });

  it('requires a valid, unexpired token', async () => {
    await expectAuthenticationRequired(app, 'get', `/api/purchases/${purchase.id}/invoice`, alice.id);
  });
});
