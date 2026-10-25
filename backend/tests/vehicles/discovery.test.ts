import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { createTestApp } from '../helpers/app.js';
import { createUser, type TestUser } from '../helpers/auth.js';
import { resetDatabase, setupTestDatabase } from '../helpers/db.js';
import { createVehicle } from '../helpers/vehicles.js';

describe('Vehicle discovery: sorting and availability', () => {
  let pool: Pool;
  let app: Express;
  let admin: TestUser;
  let alice: TestUser;
  let bob: TestUser;
  const ids: Record<string, string> = {};

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createTestApp(pool);
  });

  // Created in this order, so "newest" is Mustang, RAV4, Corolla.
  beforeEach(async () => {
    await resetDatabase(pool);
    admin = await createUser(app, pool, 'admin');
    alice = await createUser(app, pool, 'user');
    bob = await createUser(app, pool, 'user');
    for (const vehicle of [
      { make: 'Toyota', model: 'Corolla', category: 'Sedan', price: 20000, quantity: 3 },
      { make: 'Toyota', model: 'RAV4', category: 'SUV', price: 32000, quantity: 0 },
      { make: 'Ford', model: 'Mustang', category: 'Coupe', price: 45000, quantity: 1 },
    ]) {
      ids[vehicle.model] = (await createVehicle(app, admin.token, vehicle)).id;
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  const search = (query: string) =>
    request(app).get(`/api/vehicles/search?${query}`).set('Authorization', `Bearer ${alice.token}`);

  const models = (response: request.Response): string[] =>
    response.body.vehicles.map((v: { model: string }) => v.model);

  const review = (user: TestUser, model: string, rating: number) =>
    request(app)
      .post(`/api/vehicles/${ids[model]}/reviews`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ rating, comment: 'review' })
      .expect(201);

  it('includes when each vehicle was listed as an ISO timestamp', async () => {
    const response = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${alice.token}`);
    for (const vehicle of response.body.vehicles) {
      expect(new Date(vehicle.createdAt).toISOString()).toBe(vehicle.createdAt);
    }
  });

  describe('sort', () => {
    it('sorts by price, low to high and high to low', async () => {
      expect(models(await search('sort=price_asc'))).toEqual(['Corolla', 'RAV4', 'Mustang']);
      expect(models(await search('sort=price_desc'))).toEqual(['Mustang', 'RAV4', 'Corolla']);
    });

    it('sorts the newest listings first', async () => {
      expect(models(await search('sort=newest'))).toEqual(['Mustang', 'RAV4', 'Corolla']);
    });

    it('sorts by average rating, best first, with unreviewed vehicles last', async () => {
      await review(alice, 'RAV4', 5);
      await review(alice, 'Corolla', 4);
      await review(bob, 'Corolla', 2);

      expect(models(await search('sort=rating'))).toEqual(['RAV4', 'Corolla', 'Mustang']);
    });

    it('breaks rating ties by the number of reviews', async () => {
      await review(alice, 'Mustang', 4);
      await review(alice, 'Corolla', 4);
      await review(bob, 'Corolla', 4);

      expect(models(await search('sort=rating')).slice(0, 2)).toEqual(['Corolla', 'Mustang']);
    });

    it('keeps the listing order when no sort is given, like other empty filters', async () => {
      expect(models(await search(''))).toEqual(['Corolla', 'RAV4', 'Mustang']);
      expect(models(await search('sort=&availability='))).toEqual(['Corolla', 'RAV4', 'Mustang']);
    });
  });

  describe('availability', () => {
    it('returns only vehicles in stock', async () => {
      expect(models(await search('availability=in_stock'))).toEqual(['Corolla', 'Mustang']);
    });

    it('returns only out-of-stock vehicles', async () => {
      expect(models(await search('availability=out_of_stock'))).toEqual(['RAV4']);
    });
  });

  it('combines text, price, availability and sort filters', async () => {
    const response = await search('make=toyota&maxPrice=40000&availability=in_stock&sort=price_desc');
    expect(response.status).toBe(200);
    expect(models(response)).toEqual(['Corolla']);

    expect(models(await search('minPrice=20000&sort=price_desc'))).toEqual(['Mustang', 'RAV4', 'Corolla']);
  });

  it('returns an empty list when nothing matches', async () => {
    const response = await search('make=Tesla&availability=in_stock');
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ vehicles: [] });
  });

  it.each([
    'sort=cheapest',
    'sort=price_asc;DROP TABLE vehicles',
    'availability=maybe',
  ])('returns 400 for the invalid option "%s"', async (query) => {
    const response = await search(query);
    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
  });

  describe('query safety', () => {
    it.each(['%', '_', '%25', 'C_rolla'])(
      'treats LIKE wildcards in text filters literally (model "%s")',
      async (model) => {
        expect(models(await search(`model=${encodeURIComponent(model)}`))).toEqual([]);
      },
    );

    it('treats SQL in a filter as plain text', async () => {
      const response = await search(`make=${encodeURIComponent("' OR '1'='1")}`);

      expect(response.status).toBe(200);
      expect(response.body.vehicles).toEqual([]);
      const count = await pool.query('SELECT count(*)::int AS n FROM vehicles');
      expect(count.rows[0].n).toBe(3);
    });
  });
});
