/** A vehicle in the dealership's inventory. */
export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
}

/** The editable fields of a vehicle. */
export type VehicleInput = Omit<Vehicle, 'id'>;

/** Optional search filters; text filters match partially, ignoring case. */
export interface VehicleSearch {
  make?: string;
  model?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
}
