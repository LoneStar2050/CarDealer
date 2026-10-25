import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { createTestApp } from '../helpers/app.js';
import { loginAs } from '../helpers/auth.js';
import { resetDatabase, setupTestDatabase } from '../helpers/db.js';

describe('Vehicles API', () => {
  let pool: Pool;
  let app: Express;
  let adminToken: string;
  let userToken: string;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createTestApp(pool);
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    adminToken = await loginAs(app, pool, 'admin');
    userToken = await loginAs(app, pool, 'user');
  });

  afterAll(async () => {
    await pool.end();
  });

  const corolla = { make: 'Toyota', model: 'Corolla', category: 'Sedan', price: 20000, quantity: 3 };

  /** Creates a vehicle as admin and returns the response body's vehicle. */
  async function createVehicle(data: object = corolla) {
    const response = await request(app)
      .post('/api/vehicles')
      .set('Authorization', `Bearer ${adminToken}`)
      .send(data);
    expect(response.status).toBe(201);
    return response.body.vehicle;
  }

  describe('authentication', () => {
    it('returns 401 when no token is sent', async () => {
      const response = await request(app).get('/api/vehicles');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });

    it('returns 401 for an invalid token', async () => {
      const response = await request(app)
        .get('/api/vehicles')
        .set('Authorization', 'Bearer not-a-real-token');
      expect(response.status).toBe(401);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });
  });

  describe('POST /api/vehicles', () => {
    it('lets an admin add a vehicle and returns 201 with a unique id', async () => {
      const response = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(corolla);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({ vehicle: { id: expect.any(String), ...corolla } });
    });

    it('returns 403 for a non-admin user', async () => {
      const response = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${userToken}`)
        .send(corolla);

      expect(response.status).toBe(403);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });

    it.each([
      ['missing make', { ...corolla, make: undefined }],
      ['empty model', { ...corolla, model: '' }],
      ['negative price', { ...corolla, price: -1 }],
      ['non-numeric price', { ...corolla, price: 'cheap' }],
      ['negative quantity', { ...corolla, quantity: -1 }],
      ['fractional quantity', { ...corolla, quantity: 1.5 }],
    ])('returns 400 for %s', async (_case, data) => {
      const response = await request(app)
        .post('/api/vehicles')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(data);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });
  });

  describe('GET /api/vehicles', () => {
    it('lists all vehicles for any logged-in user, including out-of-stock ones', async () => {
      const first = await createVehicle();
      const second = await createVehicle({ ...corolla, model: 'Camry', quantity: 0 });

      const response = await request(app)
        .get('/api/vehicles')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.vehicles).toHaveLength(2);
      expect(response.body.vehicles).toEqual(expect.arrayContaining([first, second]));
    });
  });

  describe('GET /api/vehicles/search', () => {
    beforeEach(async () => {
      await createVehicle({ make: 'Toyota', model: 'Corolla', category: 'Sedan', price: 20000, quantity: 3 });
      await createVehicle({ make: 'Toyota', model: 'RAV4', category: 'SUV', price: 32000, quantity: 2 });
      await createVehicle({ make: 'Ford', model: 'Mustang', category: 'Coupe', price: 45000, quantity: 1 });
    });

    async function search(query: string) {
      return request(app)
        .get(`/api/vehicles/search?${query}`)
        .set('Authorization', `Bearer ${userToken}`);
    }

    function models(response: request.Response): string[] {
      return response.body.vehicles.map((v: { model: string }) => v.model).sort();
    }

    it('filters by make, ignoring case and matching partial text', async () => {
      const response = await search('make=toy');
      expect(response.status).toBe(200);
      expect(models(response)).toEqual(['Corolla', 'RAV4']);
    });

    it('filters by model', async () => {
      expect(models(await search('model=mustang'))).toEqual(['Mustang']);
    });

    it('filters by category', async () => {
      expect(models(await search('category=suv'))).toEqual(['RAV4']);
    });

    it('filters by an inclusive price range', async () => {
      expect(models(await search('minPrice=20000&maxPrice=32000'))).toEqual(['Corolla', 'RAV4']);
    });

    it('combines filters', async () => {
      expect(models(await search('make=toyota&maxPrice=25000'))).toEqual(['Corolla']);
    });

    it.each(['minPrice=abc', 'maxPrice=-5', 'minPrice=50000&maxPrice=1000'])(
      'returns 400 for the invalid price filter "%s"',
      async (query) => {
        const response = await search(query);
        expect(response.status).toBe(400);
        expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
      },
    );
  });

  describe('PUT /api/vehicles/:id', () => {
    it('lets an admin update some fields and returns the updated vehicle', async () => {
      const vehicle = await createVehicle();
      const response = await request(app)
        .put(`/api/vehicles/${vehicle.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 19500, quantity: 5 });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ vehicle: { ...vehicle, price: 19500, quantity: 5 } });
    });

    it('returns 403 for a non-admin user', async () => {
      const vehicle = await createVehicle();
      const response = await request(app)
        .put(`/api/vehicles/${vehicle.id}`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ price: 1 });
      expect(response.status).toBe(403);
    });

    it('returns 404 for an unknown vehicle', async () => {
      const response = await request(app)
        .put('/api/vehicles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 1 });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });

    it.each([
      ['an empty body', {}],
      ['a negative price', { price: -5 }],
      ['an empty make', { make: '' }],
    ])('returns 400 for %s', async (_case, data) => {
      const vehicle = await createVehicle();
      const response = await request(app)
        .put(`/api/vehicles/${vehicle.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send(data);
      expect(response.status).toBe(400);
    });

    it('returns 400 for a malformed id', async () => {
      const response = await request(app)
        .put('/api/vehicles/not-a-uuid')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ price: 1 });
      expect(response.status).toBe(400);
    });
  });

  describe('DELETE /api/vehicles/:id', () => {
    it('lets an admin delete a vehicle', async () => {
      const vehicle = await createVehicle();
      const response = await request(app)
        .delete(`/api/vehicles/${vehicle.id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(204);
      const list = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${adminToken}`);
      expect(list.body.vehicles).toEqual([]);
    });

    it('returns 403 for a non-admin user and keeps the vehicle', async () => {
      const vehicle = await createVehicle();
      const response = await request(app)
        .delete(`/api/vehicles/${vehicle.id}`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(403);
      const list = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${userToken}`);
      expect(list.body.vehicles).toHaveLength(1);
    });

    it('returns 404 for an unknown vehicle', async () => {
      const response = await request(app)
        .delete('/api/vehicles/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${adminToken}`);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });
  });

  describe('POST /api/vehicles/:id/purchase', () => {
    it('lets any logged-in user buy one, decreasing the quantity by 1', async () => {
      const vehicle = await createVehicle({ ...corolla, quantity: 2 });
      const response = await request(app)
        .post(`/api/vehicles/${vehicle.id}/purchase`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ vehicle: { ...vehicle, quantity: 1 } });
    });

    it('returns 409 when the vehicle is out of stock and keeps quantity at 0', async () => {
      const vehicle = await createVehicle({ ...corolla, quantity: 0 });
      const response = await request(app)
        .post(`/api/vehicles/${vehicle.id}/purchase`)
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
      const list = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${userToken}`);
      expect(list.body.vehicles[0].quantity).toBe(0);
    });

    it('sells the last unit only once when purchases happen at the same time', async () => {
      const vehicle = await createVehicle({ ...corolla, quantity: 1 });
      const buy = () =>
        request(app)
          .post(`/api/vehicles/${vehicle.id}/purchase`)
          .set('Authorization', `Bearer ${userToken}`);
      const statuses = (await Promise.all([buy(), buy(), buy()])).map((r) => r.status).sort();
      expect(statuses).toEqual([200, 409, 409]);
    });

    it('returns 404 for an unknown vehicle', async () => {
      const response = await request(app)
        .post('/api/vehicles/00000000-0000-0000-0000-000000000000/purchase')
        .set('Authorization', `Bearer ${userToken}`);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });
  });

  describe('POST /api/vehicles/:id/restock', () => {
    it('lets an admin increase the quantity', async () => {
      const vehicle = await createVehicle({ ...corolla, quantity: 1 });
      const response = await request(app)
        .post(`/api/vehicles/${vehicle.id}/restock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 4 });
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ vehicle: { ...vehicle, quantity: 5 } });
    });

    it('returns 403 for a non-admin user', async () => {
      const vehicle = await createVehicle();
      const response = await request(app)
        .post(`/api/vehicles/${vehicle.id}/restock`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({ quantity: 4 });
      expect(response.status).toBe(403);
    });

    it.each([[0], [-2], [1.5], ['3']])('returns 400 for the restock amount %s', async (quantity) => {
      const vehicle = await createVehicle();
      const response = await request(app)
        .post(`/api/vehicles/${vehicle.id}/restock`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity });
      expect(response.status).toBe(400);
    });

    it('returns 404 for an unknown vehicle', async () => {
      const response = await request(app)
        .post('/api/vehicles/00000000-0000-0000-0000-000000000000/restock')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ quantity: 1 });
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });
  });
});
