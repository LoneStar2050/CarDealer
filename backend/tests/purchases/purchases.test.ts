import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { createTestApp } from '../helpers/app.js';
import { createUser, expectAuthenticationRequired, type TestUser } from '../helpers/auth.js';
import { resetDatabase, setupTestDatabase } from '../helpers/db.js';
import { createVehicle, UNKNOWN_ID } from '../helpers/vehicles.js';

describe('Purchases API', () => {
  let pool: Pool;
  let app: Express;
  let admin: TestUser;
  let alice: TestUser;
  let bob: TestUser;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createTestApp(pool);
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    admin = await createUser(app, pool, 'admin');
    alice = await createUser(app, pool, 'user');
    bob = await createUser(app, pool, 'user');
  });

  afterAll(async () => {
    await pool.end();
  });

  const creta = { make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1500000, quantity: 5 };

  function buy(user: TestUser, vehicleId: string, body?: object) {
    const pending = request(app)
      .post(`/api/vehicles/${vehicleId}/purchase`)
      .set('Authorization', `Bearer ${user.token}`);
    return body === undefined ? pending : pending.send(body);
  }

  const get = (user: TestUser, path: string) =>
    request(app).get(path).set('Authorization', `Bearer ${user.token}`);

  async function stockOf(vehicleId: string): Promise<number> {
    const result = await pool.query<{ quantity: number }>('SELECT quantity FROM vehicles WHERE id = $1', [vehicleId]);
    return result.rows[0]!.quantity;
  }

  async function purchaseRows() {
    const result = await pool.query(
      `SELECT user_id, vehicle_id, quantity, unit_price::float AS unit_price, total_amount::float AS total_amount
       FROM purchases ORDER BY purchased_at`,
    );
    return result.rows;
  }

  describe('POST /api/vehicles/:id/purchase', () => {
    it('records one unit for the logged-in user by default and returns the order', async () => {
      const vehicle = await createVehicle(app, admin.token, creta);

      const response = await buy(alice, vehicle.id);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        vehicle: { ...vehicle, quantity: 4 },
        purchase: {
          id: expect.any(String),
          invoiceNumber: expect.stringMatching(/^INV-\d{6,}$/),
          vehicleId: vehicle.id,
          make: 'Hyundai',
          model: 'Creta',
          category: 'SUV',
          quantity: 1,
          unitPrice: 1500000,
          totalAmount: 1500000,
          purchasedAt: expect.any(String),
        },
      });
      expect(Math.abs(Date.now() - Date.parse(response.body.purchase.purchasedAt))).toBeLessThan(60_000);
      expect(await purchaseRows()).toEqual([
        { user_id: alice.id, vehicle_id: vehicle.id, quantity: 1, unit_price: 1500000, total_amount: 1500000 },
      ]);
    });

    it('buys several units at once, charging unit price × quantity', async () => {
      const vehicle = await createVehicle(app, admin.token, creta);

      const response = await buy(alice, vehicle.id, { quantity: 3 });

      expect(response.status).toBe(200);
      expect(response.body.vehicle.quantity).toBe(2);
      expect(response.body.purchase).toEqual(expect.objectContaining({ quantity: 3, unitPrice: 1500000, totalAmount: 4500000 }));
      expect(await stockOf(vehicle.id)).toBe(2);
    });

    it('derives the price, total and buyer on the server, ignoring client-supplied values', async () => {
      const vehicle = await createVehicle(app, admin.token, creta);

      const response = await buy(alice, vehicle.id, {
        quantity: 2,
        price: 1,
        unitPrice: 1,
        totalAmount: 1,
        userId: bob.id,
        user_id: bob.id,
      });

      expect(response.status).toBe(200);
      expect(await purchaseRows()).toEqual([
        { user_id: alice.id, vehicle_id: vehicle.id, quantity: 2, unit_price: 1500000, total_amount: 3000000 },
      ]);
    });

    it('gives every order a distinct, increasing invoice number', async () => {
      const vehicle = await createVehicle(app, admin.token, creta);

      const first = (await buy(alice, vehicle.id)).body.purchase.invoiceNumber as string;
      const second = (await buy(bob, vehicle.id)).body.purchase.invoiceNumber as string;

      expect(second).not.toBe(first);
      expect(Number(second.slice(4))).toBeGreaterThan(Number(first.slice(4)));
    });

    it.each([[0], [-1], [1.5], ['2'], [101], [null]])(
      'returns 400 for the quantity %s and changes nothing',
      async (quantity) => {
        const vehicle = await createVehicle(app, admin.token, creta);

        const response = await buy(alice, vehicle.id, { quantity });

        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
        expect(await stockOf(vehicle.id)).toBe(5);
        expect(await purchaseRows()).toEqual([]);
      },
    );

    it('returns 409 when fewer units are in stock than requested, keeping the stock', async () => {
      const vehicle = await createVehicle(app, admin.token, { ...creta, quantity: 2 });

      const response = await buy(alice, vehicle.id, { quantity: 3 });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'Only 2 units in stock' });
      expect(await stockOf(vehicle.id)).toBe(2);
      expect(await purchaseRows()).toEqual([]);
    });

    it('returns 409 for an out-of-stock vehicle and records nothing', async () => {
      const vehicle = await createVehicle(app, admin.token, { ...creta, quantity: 0 });

      const response = await buy(alice, vehicle.id);

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: 'Vehicle is out of stock' });
      expect(await purchaseRows()).toEqual([]);
    });

    it('returns 404 for an unknown vehicle and records nothing', async () => {
      const response = await buy(alice, UNKNOWN_ID);

      expect(response.status).toBe(404);
      expect(await purchaseRows()).toEqual([]);
    });

    it('never oversells when many users buy at the same time', async () => {
      const vehicle = await createVehicle(app, admin.token, { ...creta, quantity: 3 });
      const buyers = await Promise.all([1, 2, 3, 4, 5, 6].map(() => createUser(app, pool, 'user')));

      const statuses = (await Promise.all(buyers.map((b) => buy(b, vehicle.id)))).map((r) => r.status).sort();

      expect(statuses).toEqual([200, 200, 200, 409, 409, 409]);
      expect(await stockOf(vehicle.id)).toBe(0);
      expect(await purchaseRows()).toHaveLength(3);
    });

    it('never oversells with simultaneous multi-unit orders', async () => {
      const vehicle = await createVehicle(app, admin.token, { ...creta, quantity: 5 });

      const responses = await Promise.all([alice, bob, alice, bob].map((u) => buy(u, vehicle.id, { quantity: 2 })));

      expect(responses.filter((r) => r.status === 200)).toHaveLength(2);
      expect(await stockOf(vehicle.id)).toBe(1);
      const rows = await purchaseRows();
      expect(rows.reduce((sum, row) => sum + row.quantity, 0)).toBe(4);
    });

    describe('when recording the order fails', () => {
      beforeEach(async () => {
        await pool.query(`
          CREATE OR REPLACE FUNCTION fail_purchase_insert() RETURNS trigger AS $$
          BEGIN RAISE EXCEPTION 'simulated failure'; END; $$ LANGUAGE plpgsql;
          CREATE TRIGGER fail_purchase_insert BEFORE INSERT ON purchases
            FOR EACH ROW EXECUTE FUNCTION fail_purchase_insert();`);
      });

      afterEach(async () => {
        await pool.query(`
          DROP TRIGGER IF EXISTS fail_purchase_insert ON purchases;
          DROP FUNCTION IF EXISTS fail_purchase_insert();`);
      });

      it('rolls back the stock change and returns a generic 500 without internal details', async () => {
        const vehicle = await createVehicle(app, admin.token, creta);

        const response = await buy(alice, vehicle.id);

        expect(response.status).toBe(500);
        expect(response.body).toEqual({ error: 'Internal server error' });
        expect(response.text).not.toMatch(/simulated failure|at .*\.ts/);
        expect(await stockOf(vehicle.id)).toBe(5);
      });
    });

    it('keeps the order with its original price after the vehicle is repriced or deleted', async () => {
      const vehicle = await createVehicle(app, admin.token, creta);
      const { purchase } = (await buy(alice, vehicle.id)).body;

      await request(app).put(`/api/vehicles/${vehicle.id}`).set('Authorization', `Bearer ${admin.token}`).send({ price: 1 }).expect(200);
      await request(app).delete(`/api/vehicles/${vehicle.id}`).set('Authorization', `Bearer ${admin.token}`).expect(204);

      const response = await get(alice, `/api/purchases/${purchase.id}`);
      expect(response.status).toBe(200);
      expect(response.body.purchase).toEqual({ ...purchase, vehicleId: null });
    });
  });

  describe('GET /api/purchases', () => {
    it('requires a valid, unexpired token', async () => {
      await expectAuthenticationRequired(app, 'get', '/api/purchases', alice.id);
    });

    it('returns an empty list for a user without orders', async () => {
      const response = await get(alice, '/api/purchases');
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ purchases: [] });
    });

    it('lists only the caller\'s own orders, newest first', async () => {
      const suv = await createVehicle(app, admin.token, creta);
      const hatch = await createVehicle(app, admin.token, { make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback', price: 800000, quantity: 5 });
      const first = (await buy(alice, suv.id)).body.purchase;
      await buy(bob, suv.id).expect(200);
      const second = (await buy(alice, hatch.id, { quantity: 2 })).body.purchase;

      const response = await get(alice, '/api/purchases');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ purchases: [second, first] });
    });

    it('shows an admin only their own orders here as well', async () => {
      const vehicle = await createVehicle(app, admin.token, creta);
      await buy(alice, vehicle.id).expect(200);

      const response = await get(admin, '/api/purchases');
      expect(response.body).toEqual({ purchases: [] });
    });
  });

  describe('GET /api/purchases/:id', () => {
    it('requires a valid, unexpired token', async () => {
      await expectAuthenticationRequired(app, 'get', `/api/purchases/${UNKNOWN_ID}`, alice.id);
    });

    it('returns the caller\'s own order', async () => {
      const vehicle = await createVehicle(app, admin.token, creta);
      const { purchase } = (await buy(alice, vehicle.id)).body;

      const response = await get(alice, `/api/purchases/${purchase.id}`);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ purchase });
    });

    it('returns 404 for another user\'s order, so its existence is not revealed', async () => {
      const vehicle = await createVehicle(app, admin.token, creta);
      const { purchase } = (await buy(alice, vehicle.id)).body;

      for (const other of [bob, admin]) {
        const response = await get(other, `/api/purchases/${purchase.id}`);
        expect(response.status).toBe(404);
        expect(response.body).toEqual({ error: 'Order not found' });
      }
    });

    it('returns 404 for an unknown order and 400 for a malformed id', async () => {
      expect((await get(alice, `/api/purchases/${UNKNOWN_ID}`)).body).toEqual({ error: 'Order not found' });
      const malformed = await get(alice, '/api/purchases/not-a-uuid');
      expect(malformed.status).toBe(400);
      expect(malformed.body).toEqual({ error: expect.stringMatching(/\S/) });
    });
  });
});
