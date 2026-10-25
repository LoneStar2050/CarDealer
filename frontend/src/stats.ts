import type { Vehicle } from './api';

export interface InventoryStats {
  /** Number of distinct vehicle models (one row per make/model in the inventory). */
  models: number;
  /** Total units in stock across all models. */
  units: number;
  /** Models with zero units in stock. */
  outOfStock: number;
  /** Sum of price × quantity, in rupees. */
  totalValue: number;
}

/** Calculates admin inventory statistics from the vehicles returned by the API. */
export function inventoryStats(vehicles: Vehicle[]): InventoryStats {
  return vehicles.reduce<InventoryStats>(
    (stats, v) => ({
      models: stats.models + 1,
      units: stats.units + v.quantity,
      outOfStock: stats.outOfStock + (v.quantity === 0 ? 1 : 0),
      totalValue: stats.totalValue + v.price * v.quantity,
    }),
    { models: 0, units: 0, outOfStock: 0, totalValue: 0 },
  );
}
