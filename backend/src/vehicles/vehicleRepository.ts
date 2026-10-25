import type { Pool } from 'pg';
import { ConflictError, NotFoundError } from '../errors/httpErrors.js';
import type { Vehicle, VehicleInput, VehicleSearch } from './vehicle.js';

/** Columns returned for every vehicle query. */
const COLUMNS = 'id, make, model, category, price, quantity';

interface VehicleRow {
  id: string;
  make: string;
  model: string;
  category: string;
  price: string; // PostgreSQL NUMERIC arrives as a string
  quantity: number;
}

function toVehicle(row: VehicleRow): Vehicle {
  return { ...row, price: Number(row.price) };
}

/** Data access for the vehicles table. All queries are parameterized. */
export class VehicleRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: VehicleInput): Promise<Vehicle> {
    const result = await this.pool.query<VehicleRow>(
      `INSERT INTO vehicles (make, model, category, price, quantity)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING ${COLUMNS}`,
      [input.make, input.model, input.category, input.price, input.quantity],
    );
    return toVehicle(result.rows[0]!);
  }

  async findAll(): Promise<Vehicle[]> {
    const result = await this.pool.query<VehicleRow>(
      `SELECT ${COLUMNS} FROM vehicles ORDER BY created_at, id`,
    );
    return result.rows.map(toVehicle);
  }

  async search(filters: VehicleSearch): Promise<Vehicle[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    const add = (sql: (placeholder: string) => string, value: unknown) => {
      values.push(value);
      conditions.push(sql(`$${values.length}`));
    };

    if (filters.make !== undefined) add((p) => `make ILIKE '%' || ${p} || '%'`, filters.make);
    if (filters.model !== undefined) add((p) => `model ILIKE '%' || ${p} || '%'`, filters.model);
    if (filters.category !== undefined) {
      add((p) => `category ILIKE '%' || ${p} || '%'`, filters.category);
    }
    if (filters.minPrice !== undefined) add((p) => `price >= ${p}`, filters.minPrice);
    if (filters.maxPrice !== undefined) add((p) => `price <= ${p}`, filters.maxPrice);

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    const result = await this.pool.query<VehicleRow>(
      `SELECT ${COLUMNS} FROM vehicles ${where} ORDER BY created_at, id`,
      values,
    );
    return result.rows.map(toVehicle);
  }

  /** Updates only the given fields. Throws NotFoundError if there is no such vehicle. */
  async update(id: string, changes: Partial<VehicleInput>): Promise<Vehicle> {
    const entries = Object.entries(changes);
    const assignments = entries.map(([column], index) => `${column} = $${index + 2}`);
    const result = await this.pool.query<VehicleRow>(
      `UPDATE vehicles SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, ...entries.map(([, value]) => value)],
    );
    return this.foundOrThrow(result.rows[0]);
  }

  /** Throws NotFoundError if there is no such vehicle. */
  async delete(id: string): Promise<void> {
    const result = await this.pool.query('DELETE FROM vehicles WHERE id = $1', [id]);
    if (result.rowCount === 0) throw new NotFoundError('Vehicle not found');
  }

  /**
   * Sells one unit. The stock check and decrement are a single statement,
   * so concurrent purchases can never push the quantity below zero.
   */
  async purchase(id: string): Promise<Vehicle> {
    const result = await this.pool.query<VehicleRow>(
      `UPDATE vehicles SET quantity = quantity - 1, updated_at = now()
       WHERE id = $1 AND quantity > 0 RETURNING ${COLUMNS}`,
      [id],
    );
    if (result.rows[0]) return toVehicle(result.rows[0]);

    const exists = await this.pool.query('SELECT 1 FROM vehicles WHERE id = $1', [id]);
    if (exists.rowCount === 0) throw new NotFoundError('Vehicle not found');
    throw new ConflictError('Vehicle is out of stock');
  }

  /** Adds stock. Throws NotFoundError if there is no such vehicle. */
  async restock(id: string, amount: number): Promise<Vehicle> {
    const result = await this.pool.query<VehicleRow>(
      `UPDATE vehicles SET quantity = quantity + $2, updated_at = now()
       WHERE id = $1 RETURNING ${COLUMNS}`,
      [id, amount],
    );
    return this.foundOrThrow(result.rows[0]);
  }

  private foundOrThrow(row: VehicleRow | undefined): Vehicle {
    if (!row) throw new NotFoundError('Vehicle not found');
    return toVehicle(row);
  }
}
