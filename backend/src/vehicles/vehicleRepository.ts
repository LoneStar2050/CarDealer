import type { Queryable } from '../db/transaction.js';
import { ConflictError, NotFoundError } from '../errors/httpErrors.js';
import { ratingSummarySql, toAverageRating } from '../reviews/ratingSql.js';
import type { Vehicle, VehicleInput, VehicleSearch } from './vehicle.js';

/** Columns returned for every vehicle query, read from the CTE "v" and its ratings "r". */
const COLUMNS = `v.id, v.make, v.model, v.category, v.price, v.quantity,
  r.average_rating, r.review_count`;

interface VehicleRow {
  id: string;
  make: string;
  model: string;
  category: string;
  price: string; // PostgreSQL NUMERIC arrives as a string
  quantity: number;
  average_rating: string | null;
  review_count: number;
}

function toVehicle(row: VehicleRow): Vehicle {
  return {
    id: row.id,
    make: row.make,
    model: row.model,
    category: row.category,
    price: Number(row.price),
    quantity: row.quantity,
    averageRating: toAverageRating(row.average_rating),
    reviewCount: row.review_count,
  };
}

/**
 * Data access for the vehicles table. All queries are parameterized.
 * Pass a transaction client instead of the pool to join a transaction.
 */
export class VehicleRepository {
  constructor(private readonly db: Queryable) {}

  /**
   * Runs `source` (a SELECT, or an INSERT/UPDATE ... RETURNING *) as the CTE
   * "v" and adds each vehicle's rating summary, so every endpoint returns
   * vehicles in the same shape. `suffix` may add ORDER BY clauses.
   */
  private async query(source: string, values: unknown[] = [], suffix = ''): Promise<Vehicle[]> {
    const result = await this.db.query<VehicleRow>(
      `WITH v AS (${source})
       SELECT ${COLUMNS} FROM v
       CROSS JOIN LATERAL (${ratingSummarySql('v.id')}) r
       ${suffix}`,
      values,
    );
    return result.rows.map(toVehicle);
  }

  async create(input: VehicleInput): Promise<Vehicle> {
    const [vehicle] = await this.query(
      `INSERT INTO vehicles (make, model, category, price, quantity)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [input.make, input.model, input.category, input.price, input.quantity],
    );
    return vehicle!;
  }

  async findAll(): Promise<Vehicle[]> {
    return this.query('SELECT * FROM vehicles', [], 'ORDER BY v.created_at, v.id');
  }

  async exists(id: string): Promise<boolean> {
    const result = await this.db.query('SELECT 1 FROM vehicles WHERE id = $1', [id]);
    return result.rowCount !== 0;
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
    return this.query(`SELECT * FROM vehicles ${where}`, values, 'ORDER BY v.created_at, v.id');
  }

  /** Updates only the given fields. Throws NotFoundError if there is no such vehicle. */
  async update(id: string, changes: Partial<VehicleInput>): Promise<Vehicle> {
    const entries = Object.entries(changes);
    const assignments = entries.map(([column], index) => `${column} = $${index + 2}`);
    const [vehicle] = await this.query(
      `UPDATE vehicles SET ${assignments.join(', ')}, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, ...entries.map(([, value]) => value)],
    );
    return this.foundOrThrow(vehicle);
  }

  /** Throws NotFoundError if there is no such vehicle. */
  async delete(id: string): Promise<void> {
    const result = await this.db.query('DELETE FROM vehicles WHERE id = $1', [id]);
    if (result.rowCount === 0) throw new NotFoundError('Vehicle not found');
  }

  /**
   * Sells `quantity` units. The stock check and decrement are a single
   * statement, so concurrent purchases can never push the quantity below
   * zero. Throws NotFoundError or ConflictError (not enough stock).
   */
  async purchase(id: string, quantity = 1): Promise<Vehicle> {
    const [vehicle] = await this.query(
      `UPDATE vehicles SET quantity = quantity - $2, updated_at = now()
       WHERE id = $1 AND quantity >= $2 RETURNING *`,
      [id, quantity],
    );
    if (vehicle) return vehicle;

    const current = await this.db.query<{ quantity: number }>('SELECT quantity FROM vehicles WHERE id = $1', [id]);
    const inStock = current.rows[0]?.quantity;
    if (inStock === undefined) throw new NotFoundError('Vehicle not found');
    if (inStock === 0) throw new ConflictError('Vehicle is out of stock');
    throw new ConflictError(`Only ${inStock} ${inStock === 1 ? 'unit' : 'units'} in stock`);
  }

  /** Adds stock. Throws NotFoundError if there is no such vehicle. */
  async restock(id: string, amount: number): Promise<Vehicle> {
    const [vehicle] = await this.query(
      `UPDATE vehicles SET quantity = quantity + $2, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [id, amount],
    );
    return this.foundOrThrow(vehicle);
  }

  private foundOrThrow(vehicle: Vehicle | undefined): Vehicle {
    if (!vehicle) throw new NotFoundError('Vehicle not found');
    return vehicle;
  }
}
