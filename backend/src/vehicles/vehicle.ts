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
  /** When the vehicle was listed (ISO 8601). Read-only. */
  createdAt: string;
}

/** The editable fields of a vehicle. */
export type VehicleInput = Omit<Vehicle, 'id' | 'averageRating' | 'reviewCount' | 'createdAt'>;

export const VEHICLE_SORTS = ['price_asc', 'price_desc', 'newest', 'rating'] as const;
export type VehicleSort = (typeof VEHICLE_SORTS)[number];

export const AVAILABILITIES = ['in_stock', 'out_of_stock'] as const;
export type Availability = (typeof AVAILABILITIES)[number];

/** Optional search filters; text filters match partially, ignoring case. */
export interface VehicleSearch {
  make?: string;
  model?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  availability?: Availability;
  /** Result order; the listing order (oldest first) when omitted. */
  sort?: VehicleSort;
}
