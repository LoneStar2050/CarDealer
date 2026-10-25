import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { Express } from 'express';
import type { Pool } from 'pg';
import { createTestApp } from '../helpers/app.js';
import { createUser, expectAuthenticationRequired, type TestUser } from '../helpers/auth.js';
import { resetDatabase, setupTestDatabase } from '../helpers/db.js';
import { createVehicle, UNKNOWN_ID } from '../helpers/vehicles.js';

describe('Vehicle reviews API', () => {
  let pool: Pool;
  let app: Express;
  let admin: TestUser;
  let alice: TestUser;
  let bob: TestUser;
  let vehicleId: string;

  beforeAll(async () => {
    pool = await setupTestDatabase();
    app = createTestApp(pool);
  });

  beforeEach(async () => {
    await resetDatabase(pool);
    admin = await createUser(app, pool, 'admin');
    alice = await createUser(app, pool, 'user');
    bob = await createUser(app, pool, 'user');
    vehicleId = (await createVehicle(app, admin.token)).id;
  });

  afterAll(async () => {
    await pool.end();
  });

  const review = { rating: 4, comment: 'Smooth ride and great mileage.' };

  function postReview(user: TestUser, body: object = review, id = vehicleId) {
    return request(app)
      .post(`/api/vehicles/${id}/reviews`)
      .set('Authorization', `Bearer ${user.token}`)
      .send(body);
  }

  function getReviews(user: TestUser, id = vehicleId) {
    return request(app).get(`/api/vehicles/${id}/reviews`).set('Authorization', `Bearer ${user.token}`);
  }

  /** "alice-1@example.com" is shown as "a***@example.com". */
  const masked = (email: string) => `${email[0]}***@${email.split('@')[1]}`;

  describe('authentication', () => {
    it('requires a valid, unexpired token to list reviews', async () => {
      await expectAuthenticationRequired(app, 'get', `/api/vehicles/${vehicleId}/reviews`, alice.id);
    });

    it('requires a valid, unexpired token to post a review', async () => {
      await expectAuthenticationRequired(app, 'post', `/api/vehicles/${vehicleId}/reviews`, alice.id);
      const stored = await pool.query('SELECT 1 FROM reviews');
      expect(stored.rowCount).toBe(0);
    });
  });

  describe('POST /api/vehicles/:id/reviews', () => {
    it('stores the review for the logged-in user and returns 201 with the new summary', async () => {
      const response = await postReview(alice);

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        review: {
          id: expect.any(String),
          rating: 4,
          comment: review.comment,
          author: masked(alice.email),
          isOwn: true,
          createdAt: expect.any(String),
        },
        summary: { averageRating: 4, reviewCount: 1 },
      });
      expect(Number.isNaN(Date.parse(response.body.review.createdAt))).toBe(false);

      const stored = await pool.query('SELECT user_id, vehicle_id, rating, comment FROM reviews');
      expect(stored.rows).toEqual([
        { user_id: alice.id, vehicle_id: vehicleId, rating: 4, comment: review.comment },
      ]);
    });

    it('takes the author from the token, never from the request body', async () => {
      const response = await postReview(alice, { ...review, userId: bob.id, user_id: bob.id });

      expect(response.status).toBe(201);
      const stored = await pool.query('SELECT user_id FROM reviews');
      expect(stored.rows).toEqual([{ user_id: alice.id }]);
    });

    it('trims surrounding whitespace from the comment', async () => {
      const response = await postReview(alice, { rating: 5, comment: '   Loved it!  \n' });
      expect(response.status).toBe(201);
      expect(response.body.review.comment).toBe('Loved it!');
    });

    it('accepts the lowest and highest ratings', async () => {
      expect((await postReview(alice, { ...review, rating: 1 })).status).toBe(201);
      expect((await postReview(bob, { ...review, rating: 5 })).status).toBe(201);
    });

    it.each([
      ['a missing rating', { comment: 'ok' }],
      ['a rating of 0', { rating: 0, comment: 'ok' }],
      ['a rating of 6', { rating: 6, comment: 'ok' }],
      ['a fractional rating', { rating: 3.5, comment: 'ok' }],
      ['a rating sent as text', { rating: '4', comment: 'ok' }],
      ['a missing comment', { rating: 4 }],
      ['a blank comment', { rating: 4, comment: '   ' }],
      ['a non-text comment', { rating: 4, comment: 42 }],
      ['a comment over 1000 characters', { rating: 4, comment: 'a'.repeat(1001) }],
    ])('returns 400 for %s and stores nothing', async (_case, body) => {
      const response = await postReview(alice, body);

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
      const stored = await pool.query('SELECT 1 FROM reviews');
      expect(stored.rowCount).toBe(0);
    });

    it('accepts a comment of exactly 1000 characters', async () => {
      expect((await postReview(alice, { rating: 4, comment: 'a'.repeat(1000) })).status).toBe(201);
    });

    it('returns 409 when the same user reviews the same vehicle twice, keeping the first review', async () => {
      await postReview(alice).expect(201);

      const response = await postReview(alice, { rating: 1, comment: 'Changed my mind' });

      expect(response.status).toBe(409);
      expect(response.body).toEqual({ error: expect.stringMatching(/already reviewed/i) });
      const stored = await pool.query('SELECT rating FROM reviews');
      expect(stored.rows).toEqual([{ rating: 4 }]);
    });

    it('accepts only one of two simultaneous reviews by the same user', async () => {
      const statuses = (await Promise.all([postReview(alice), postReview(alice)]))
        .map((r) => r.status)
        .sort();
      expect(statuses).toEqual([201, 409]);
    });

    it('lets different users review the same vehicle, and one user review different vehicles', async () => {
      const other = await createVehicle(app, admin.token, { make: 'Honda', model: 'City', category: 'Sedan', price: 1100000, quantity: 1 });

      expect((await postReview(alice)).status).toBe(201);
      expect((await postReview(bob)).status).toBe(201);
      expect((await postReview(alice, review, other.id)).status).toBe(201);
    });

    it('returns 404 for an unknown vehicle', async () => {
      const response = await postReview(alice, review, UNKNOWN_ID);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });

    it('returns 400 for a malformed vehicle id', async () => {
      const response = await postReview(alice, review, 'not-a-uuid');
      expect(response.status).toBe(400);
    });
  });

  describe('GET /api/vehicles/:id/reviews', () => {
    it('returns an empty list and a null average when there are no reviews', async () => {
      const response = await getReviews(alice);

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ reviews: [], summary: { averageRating: null, reviewCount: 0 } });
    });

    it('lists reviews newest first with the average rating and count', async () => {
      await postReview(alice, { rating: 4, comment: 'First' }).expect(201);
      await postReview(bob, { rating: 5, comment: 'Second' }).expect(201);

      const response = await getReviews(alice);

      expect(response.status).toBe(200);
      expect(response.body.summary).toEqual({ averageRating: 4.5, reviewCount: 2 });
      expect(response.body.reviews.map((r: { comment: string }) => r.comment)).toEqual(['Second', 'First']);
    });

    it('marks only the requesting user\'s own review with isOwn', async () => {
      await postReview(alice).expect(201);
      await postReview(bob).expect(201);

      const response = await getReviews(bob);

      const own = response.body.reviews.map((r: { author: string; isOwn: boolean }) => [r.author, r.isOwn]);
      expect(own).toEqual(expect.arrayContaining([[masked(bob.email), true], [masked(alice.email), false]]));
    });

    it('never exposes reviewers\' full emails or user ids', async () => {
      await postReview(alice).expect(201);

      const response = await getReviews(bob);

      const body = JSON.stringify(response.body);
      expect(body).not.toContain(alice.email);
      expect(body).not.toContain(alice.id);
    });

    it('rounds the average rating to one decimal place', async () => {
      const carol = await createUser(app, pool, 'user');
      await postReview(alice, { rating: 5, comment: 'a' }).expect(201);
      await postReview(bob, { rating: 4, comment: 'b' }).expect(201);
      await postReview(carol, { rating: 4, comment: 'c' }).expect(201);

      expect((await getReviews(alice)).body.summary).toEqual({ averageRating: 4.3, reviewCount: 3 });
    });

    it('returns 404 for an unknown vehicle', async () => {
      const response = await getReviews(alice, UNKNOWN_ID);
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: expect.stringMatching(/\S/) });
    });
  });

  describe('ratings on vehicles', () => {
    it('includes each vehicle\'s average rating and review count in the vehicle list', async () => {
      await postReview(alice, { rating: 3, comment: 'ok' }).expect(201);
      await postReview(bob, { rating: 4, comment: 'good' }).expect(201);

      const response = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${alice.token}`);

      expect(response.body.vehicles).toEqual([
        expect.objectContaining({ id: vehicleId, averageRating: 3.5, reviewCount: 2 }),
      ]);
    });

    it('reports a null average and zero reviews for an unreviewed vehicle', async () => {
      const response = await request(app).get('/api/vehicles').set('Authorization', `Bearer ${alice.token}`);
      expect(response.body.vehicles[0]).toEqual(expect.objectContaining({ averageRating: null, reviewCount: 0 }));
    });

    it('deletes a vehicle\'s reviews when the vehicle is deleted', async () => {
      await postReview(alice).expect(201);

      await request(app)
        .delete(`/api/vehicles/${vehicleId}`)
        .set('Authorization', `Bearer ${admin.token}`)
        .expect(204);

      const stored = await pool.query('SELECT 1 FROM reviews');
      expect(stored.rowCount).toBe(0);
    });
  });
});
