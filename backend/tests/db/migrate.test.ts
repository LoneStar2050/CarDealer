import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { Pool } from 'pg';
import { createPool } from '../../src/db/pool.js';
import { migrate } from '../../src/db/migrate.js';
import { resetDatabaseAndClose } from '../helpers/db.js';

describe('database migration', () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = createPool(process.env['DATABASE_URL']!);
    // Start from an empty schema so we prove migrate() creates everything.
    await pool.query('DROP TABLE IF EXISTS purchases, reviews, vehicles, users');
    await migrate(pool);
  });

  afterAll(async () => {
    // Leave the schema in place but remove the rows these tests inserted.
    await resetDatabaseAndClose(pool);
  });

  async function columnsOf(table: string): Promise<string[]> {
    const result = await pool.query<{ column_name: string }>(
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = $1
       ORDER BY column_name`,
      [table],
    );
    return result.rows.map((row) => row.column_name);
  }

  it('creates the users table', async () => {
    expect(await columnsOf('users')).toEqual(
      ['created_at', 'email', 'id', 'password_hash', 'role'],
    );
  });

  it('creates the vehicles table with every required vehicle field', async () => {
    expect(await columnsOf('vehicles')).toEqual(
      ['category', 'created_at', 'id', 'make', 'model', 'price', 'quantity', 'updated_at'],
    );
  });

  it('is safe to run more than once', async () => {
    await expect(migrate(pool)).resolves.not.toThrow();
  });

  it('generates a unique id for each vehicle', async () => {
    const insert = `INSERT INTO vehicles (make, model, category, price, quantity)
                    VALUES ('Toyota', 'Corolla', 'Sedan', 20000, 1) RETURNING id`;
    const first = await pool.query<{ id: string }>(insert);
    const second = await pool.query<{ id: string }>(insert);
    expect(first.rows[0]!.id).toBeTruthy();
    expect(first.rows[0]!.id).not.toEqual(second.rows[0]!.id);
  });

  it('rejects a negative vehicle quantity', async () => {
    await expect(
      pool.query(`INSERT INTO vehicles (make, model, category, price, quantity)
                  VALUES ('Ford', 'Focus', 'Hatchback', 15000, -1)`),
    ).rejects.toThrow(/check constraint/);
  });

  it('rejects a negative vehicle price', async () => {
    await expect(
      pool.query(`INSERT INTO vehicles (make, model, category, price, quantity)
                  VALUES ('Ford', 'Focus', 'Hatchback', -1, 1)`),
    ).rejects.toThrow(/check constraint/);
  });

  it('defaults new users to the "user" role and rejects unknown roles', async () => {
    const result = await pool.query<{ role: string }>(
      `INSERT INTO users (email, password_hash) VALUES ('a@example.com', 'hash') RETURNING role`,
    );
    expect(result.rows[0]!.role).toBe('user');

    await expect(
      pool.query(`INSERT INTO users (email, password_hash, role)
                  VALUES ('b@example.com', 'hash', 'superuser')`),
    ).rejects.toThrow(/check constraint/);
  });

  it('rejects duplicate user emails', async () => {
    const insert = `INSERT INTO users (email, password_hash) VALUES ('dup@example.com', 'hash')`;
    await pool.query(insert);
    await expect(pool.query(insert)).rejects.toThrow(/duplicate key/);
  });

  describe('reviews table', () => {
    /** Inserts a fresh user and vehicle and returns their ids. */
    async function userAndVehicle(): Promise<{ userId: string; vehicleId: string }> {
      const user = await pool.query<{ id: string }>(
        `INSERT INTO users (email, password_hash) VALUES (gen_random_uuid() || '@example.com', 'hash') RETURNING id`,
      );
      const vehicle = await pool.query<{ id: string }>(
        `INSERT INTO vehicles (make, model, category, price, quantity)
         VALUES ('Kia', 'Seltos', 'SUV', 1, 1) RETURNING id`,
      );
      return { userId: user.rows[0]!.id, vehicleId: vehicle.rows[0]!.id };
    }

    const insertReview = (userId: string, vehicleId: string, rating: number) =>
      pool.query(
        `INSERT INTO reviews (user_id, vehicle_id, rating, comment) VALUES ($1, $2, $3, 'text')`,
        [userId, vehicleId, rating],
      );

    it('creates the reviews table', async () => {
      expect(await columnsOf('reviews')).toEqual(
        ['comment', 'created_at', 'id', 'rating', 'user_id', 'vehicle_id'],
      );
    });

    it.each([0, 6])('rejects a rating of %i', async (rating) => {
      const { userId, vehicleId } = await userAndVehicle();
      await expect(insertReview(userId, vehicleId, rating)).rejects.toThrow(/check constraint/);
    });

    it('allows only one review per user and vehicle', async () => {
      const { userId, vehicleId } = await userAndVehicle();
      await insertReview(userId, vehicleId, 5);
      await expect(insertReview(userId, vehicleId, 4)).rejects.toThrow(/duplicate key/);
    });

    it('rejects a review by a user that does not exist', async () => {
      const { vehicleId } = await userAndVehicle();
      await expect(
        insertReview('00000000-0000-0000-0000-000000000000', vehicleId, 5),
      ).rejects.toThrow(/foreign key/);
    });

    it('rejects a review for a vehicle that does not exist', async () => {
      const { userId } = await userAndVehicle();
      await expect(
        insertReview(userId, '00000000-0000-0000-0000-000000000000', 5),
      ).rejects.toThrow(/foreign key/);
    });
  });

  describe('purchases table', () => {
    async function buyerId(): Promise<string> {
      const user = await pool.query<{ id: string }>(
        `INSERT INTO users (email, password_hash) VALUES (gen_random_uuid() || '@example.com', 'hash') RETURNING id`,
      );
      return user.rows[0]!.id;
    }

    const insertPurchase = (userId: string, quantity: number, unitPrice: number, total: number) =>
      pool.query<{ order_number: string }>(
        `INSERT INTO purchases (user_id, make, model, category, quantity, unit_price, total_amount)
         VALUES ($1, 'Kia', 'Seltos', 'SUV', $2, $3, $4) RETURNING order_number`,
        [userId, quantity, unitPrice, total],
      );

    it('creates the purchases table with order, vehicle snapshot and money columns', async () => {
      expect(await columnsOf('purchases')).toEqual([
        'category', 'id', 'make', 'model', 'order_number', 'purchased_at', 'quantity',
        'total_amount', 'unit_price', 'user_id', 'vehicle_id',
      ]);
    });

    it('numbers orders automatically and uniquely', async () => {
      const userId = await buyerId();
      const first = await insertPurchase(userId, 1, 100, 100);
      const second = await insertPurchase(userId, 1, 100, 100);
      expect(Number(second.rows[0]!.order_number)).toBeGreaterThan(Number(first.rows[0]!.order_number));
    });

    it.each([0, -1])('rejects a quantity of %i', async (quantity) => {
      await expect(insertPurchase(await buyerId(), quantity, 100, 100 * quantity)).rejects.toThrow(/check constraint/);
    });

    it('rejects a total that is not unit price × quantity', async () => {
      await expect(insertPurchase(await buyerId(), 2, 100, 150)).rejects.toThrow(/check constraint/);
    });

    it('rejects an order for a user that does not exist', async () => {
      await expect(
        insertPurchase('00000000-0000-0000-0000-000000000000', 1, 100, 100),
      ).rejects.toThrow(/foreign key/);
    });
  });
});
