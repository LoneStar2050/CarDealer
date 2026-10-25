import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { createTestApp } from '../helpers/app.js';
import { createUser, expectAuthenticationRequired, type TestUser } from '../helpers/auth.js';
import { resetDatabase, setupTestDatabase } from '../helpers/db.js';
import { createVehicle } from '../helpers/vehicles.js';

describe('GET /api/admin/analytics', () => {
  let pool: Pool;
  let app: Express;
  let admin: TestUser;
  let alice: TestUser;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createTestApp(pool);
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    admin = await createUser(app, pool, 'admin');
    alice = await createUser(app, pool, 'user');
  });

  afterAll(async () => {
    await pool.end();
  });

  const analytics = (user: TestUser, query = '') =>
    request(app).get(`/api/admin/analytics${query}`).set('Authorization', `Bearer ${user.token}`);

  /** Buys through the API, then optionally backdates the order. Returns the order. */
  async function buy(vehicleId: string, quantity: number, purchasedAt?: string) {
    const response = await request(app)
      .post(`/api/vehicles/${vehicleId}/purchase`)
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ quantity })
      .expect(200);
    if (purchasedAt) {
      await pool.query('UPDATE purchases SET purchased_at = $2 WHERE id = $1', [response.body.purchase.id, purchasedAt]);
    }
    return response.body.purchase;
  }

  describe('access', () => {
    it('requires a valid, unexpired token', async () => {
      await expectAuthenticationRequired(app, 'get', '/api/admin/analytics', admin.id);
    });

    it('returns 403 for a regular user, without any statistics', async () => {
      const response = await analytics(alice);
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: 'Admin access required' });
    });
  });

  it('reports zeros and empty lists when there is no data', async () => {
    const response = await analytics(admin);

    expect(response.status).toBe(200);
    expect(response.body).toEqual({
      range: { from: null, to: null },
      inventory: { vehicleModels: 0, unitsInStock: 0, outOfStockCount: 0, inventoryValue: 0, outOfStockVehicles: [] },
      sales: { orderCount: 0, unitsSold: 0, revenue: 0, topVehicles: [] },
    });
  });

  it('calculates inventory and sales figures from the stored vehicles and orders', async () => {
    const creta = await createVehicle(app, admin.token, { make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1500000, quantity: 5 });
    const swift = await createVehicle(app, admin.token, { make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback', price: 800000.25, quantity: 4 });
    const virtus = await createVehicle(app, admin.token, { make: 'Volkswagen', model: 'Virtus', category: 'Sedan', price: 1200000, quantity: 1 });
    await buy(creta.id, 2);
    await buy(swift.id, 1);
    await buy(swift.id, 3);
    await buy(virtus.id, 1);

    const { body } = await analytics(admin);

    // Stock left: Creta 3, Swift 0, Virtus 0.
    expect(body.inventory).toEqual({
      vehicleModels: 3,
      unitsInStock: 3,
      outOfStockCount: 2,
      inventoryValue: 4500000,
      outOfStockVehicles: [
        { id: swift.id, make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback' },
        { id: virtus.id, make: 'Volkswagen', model: 'Virtus', category: 'Sedan' },
      ],
    });
    expect(body.sales).toEqual({
      orderCount: 4,
      unitsSold: 7,
      revenue: 3000000 + 4 * 800000.25 + 1200000,
      topVehicles: [
        { vehicleId: swift.id, make: 'Maruti Suzuki', model: 'Swift', unitsSold: 4, revenue: 3200001 },
        { vehicleId: creta.id, make: 'Hyundai', model: 'Creta', unitsSold: 2, revenue: 3000000 },
        { vehicleId: virtus.id, make: 'Volkswagen', model: 'Virtus', unitsSold: 1, revenue: 1200000 },
      ],
    });
  });

  it('lists at most five top-selling vehicles', async () => {
    for (let i = 1; i <= 6; i++) {
      const vehicle = await createVehicle(app, admin.token, { make: 'Make', model: `M${i}`, category: 'SUV', price: 100, quantity: 10 });
      await buy(vehicle.id, i);
    }

    const { body } = await analytics(admin);

    expect(body.sales.topVehicles.map((v: { model: string }) => v.model)).toEqual(['M6', 'M5', 'M4', 'M3', 'M2']);
    expect(body.sales.unitsSold).toBe(21);
  });

  it('keeps sales of a deleted vehicle in the totals', async () => {
    const creta = await createVehicle(app, admin.token, { make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1000, quantity: 5 });
    await buy(creta.id, 2);
    await request(app).delete(`/api/vehicles/${creta.id}`).set('Authorization', `Bearer ${admin.token}`).expect(204);

    const { body } = await analytics(admin);

    expect(body.sales).toEqual(expect.objectContaining({ orderCount: 1, unitsSold: 2, revenue: 2000 }));
    expect(body.sales.topVehicles).toEqual([{ vehicleId: null, make: 'Hyundai', model: 'Creta', unitsSold: 2, revenue: 2000 }]);
    expect(body.inventory.vehicleModels).toBe(0);
  });

  describe('date range', () => {
    let vehicleId: string;

    beforeEach(async () => {
      vehicleId = (await createVehicle(app, admin.token, { make: 'Kia', model: 'Seltos', category: 'SUV', price: 100, quantity: 50 })).id;
      await buy(vehicleId, 1, '2026-01-31T23:59:59Z');
      await buy(vehicleId, 2, '2026-02-01T00:00:00Z');
      await buy(vehicleId, 3, '2026-02-28T23:59:59Z');
      await buy(vehicleId, 4, '2026-03-01T00:00:00Z');
    });

    it('counts only orders between from and to, both days inclusive (UTC)', async () => {
      const { body } = await analytics(admin, '?from=2026-02-01&to=2026-02-28');

      expect(body.range).toEqual({ from: '2026-02-01', to: '2026-02-28' });
      expect(body.sales).toEqual(expect.objectContaining({ orderCount: 2, unitsSold: 5, revenue: 500 }));
    });

    it('supports an open-ended range', async () => {
      expect((await analytics(admin, '?from=2026-02-01')).body.sales.unitsSold).toBe(9);
      expect((await analytics(admin, '?to=2026-01-31')).body.sales.unitsSold).toBe(1);
    });

    it('does not filter the current inventory by date', async () => {
      const { body } = await analytics(admin, '?from=2030-01-01');
      expect(body.sales.orderCount).toBe(0);
      expect(body.inventory.unitsInStock).toBe(40);
    });

    it.each([
      '?from=2026-13-01',
      '?from=2026-02-30',
      '?to=yesterday',
      '?from=2026-2-1',
      '?from=2026-03-01&to=2026-02-01',
    ])('returns 400 for the invalid range "%s"', async (query) => {
      const response = await analytics(admin, query);
      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });
  });
});
