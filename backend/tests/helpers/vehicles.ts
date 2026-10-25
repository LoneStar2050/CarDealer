import request from 'supertest';
import { expect } from 'vitest';
import type { Express } from 'express';

export const corolla = { make: 'Toyota', model: 'Corolla', category: 'Sedan', price: 20000, quantity: 3 };

/** Creates a vehicle through the API as an admin and returns it. */
export async function createVehicle(app: Express, adminToken: string, data: object = corolla) {
  const response = await request(app)
    .post('/api/vehicles')
    .set('Authorization', `Bearer ${adminToken}`)
    .send(data);
  expect(response.status).toBe(201);
  return response.body.vehicle;
}

/** A well-formed id that belongs to no row. */
export const UNKNOWN_ID = '00000000-0000-0000-0000-000000000000';
