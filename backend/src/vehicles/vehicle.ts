/** A vehicle in the dealership's inventory. */
export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
  /** Mean review rating rounded to one decimal, or null when unreviewed. Read-only. */
  averageRating: number | null;
  /** Number of reviews. Read-only. */
  reviewCount: number;
}

/** The editable fields of a vehicle. */
export type VehicleInput = Omit<Vehicle, 'id' | 'averageRating' | 'reviewCount'>;

/** Optional search filters; text filters match partially, ignoring case. */
export interface VehicleSearch {
  make?: string;
  model?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}
