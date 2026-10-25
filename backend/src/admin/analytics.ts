/** Inclusive range of UTC calendar days (YYYY-MM-DD); null means unbounded. */
export interface DateRange {
  from: string | null;
  to: string | null;
}

export interface InventoryAnalytics {
  vehicleModels: number;
  unitsInStock: number;
  outOfStockCount: number;
  /** Sum of price × quantity over the current stock, in rupees. */
  inventoryValue: number;
  outOfStockVehicles: { id: string; make: string; model: string; category: string }[];
}

export interface TopVehicle {
  /** Null if the vehicle has since been deleted. */
  vehicleId: string | null;
  make: string;
  model: string;
  unitsSold: number;
  revenue: number;
}

export interface SalesAnalytics {
  orderCount: number;
  unitsSold: number;
  revenue: number;
  topVehicles: TopVehicle[];
}

/** Admin dashboard figures, all calculated from stored rows. */
export interface Analytics {
  range: DateRange;
  /** Always the current inventory, regardless of the range. */
  inventory: InventoryAnalytics;
  /** Orders placed within the range. */
  sales: SalesAnalytics;
}

/** How many best-selling vehicles the dashboard lists. */
export const TOP_VEHICLE_LIMIT = 5;
