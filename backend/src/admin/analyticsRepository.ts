import type { Pool } from 'pg';
import {
  TOP_VEHICLE_LIMIT,
  type DateRange,
  type InventoryAnalytics,
  type SalesAnalytics,
} from './analytics.js';

/** Read-only aggregate queries for the admin dashboard. All queries are parameterized. */
export class AnalyticsRepository {
  constructor(private readonly pool: Pool) {}

  async inventory(): Promise<InventoryAnalytics> {
    const [totals, outOfStock] = await Promise.all([
      this.pool.query<{ vehicle_models: number; units_in_stock: number; out_of_stock_count: number; inventory_value: string }>(
        `SELECT count(*)::int AS vehicle_models,
                COALESCE(sum(quantity), 0)::int AS units_in_stock,
                (count(*) FILTER (WHERE quantity = 0))::int AS out_of_stock_count,
                COALESCE(sum(price * quantity), 0) AS inventory_value
         FROM vehicles`,
      ),
      this.pool.query<{ id: string; make: string; model: string; category: string }>(
        `SELECT id, make, model, category FROM vehicles WHERE quantity = 0 ORDER BY make, model, id`,
      ),
    ]);
    const row = totals.rows[0]!;
    return {
      vehicleModels: row.vehicle_models,
      unitsInStock: row.units_in_stock,
      outOfStockCount: row.out_of_stock_count,
      inventoryValue: Number(row.inventory_value),
      outOfStockVehicles: outOfStock.rows,
    };
  }

  /** Sales of orders placed within the range (whole UTC days, both ends inclusive). */
  async sales(range: DateRange): Promise<SalesAnalytics> {
    // $1 / $2 may be NULL, meaning "no bound".
    const where = `WHERE ($1::date IS NULL OR purchased_at >= $1::date::timestamp AT TIME ZONE 'UTC')
                     AND ($2::date IS NULL OR purchased_at < ($2::date + 1)::timestamp AT TIME ZONE 'UTC')`;
    const values = [range.from, range.to];
    const [totals, top] = await Promise.all([
      this.pool.query<{ order_count: number; units_sold: number; revenue: string }>(
        `SELECT count(*)::int AS order_count,
                COALESCE(sum(quantity), 0)::int AS units_sold,
                COALESCE(sum(total_amount), 0) AS revenue
         FROM purchases ${where}`,
        values,
      ),
      this.pool.query<{ vehicle_id: string | null; make: string; model: string; units_sold: number; revenue: string }>(
        `SELECT vehicle_id, make, model, sum(quantity)::int AS units_sold, sum(total_amount) AS revenue
         FROM purchases ${where}
         GROUP BY vehicle_id, make, model
         ORDER BY units_sold DESC, revenue DESC, make, model
         LIMIT ${TOP_VEHICLE_LIMIT}`,
        values,
      ),
    ]);
    const row = totals.rows[0]!;
    return {
      orderCount: row.order_count,
      unitsSold: row.units_sold,
      revenue: Number(row.revenue),
      topVehicles: top.rows.map((v) => ({
        vehicleId: v.vehicle_id,
        make: v.make,
        model: v.model,
        unitsSold: v.units_sold,
        revenue: Number(v.revenue),
      })),
    };
  }
}
