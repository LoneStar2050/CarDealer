import type { Vehicle } from './api';

export type SortOrder = 'featured' | 'newest' | 'rating' | 'price-asc' | 'price-desc' | 'name';

const nameOf = (v: Vehicle) => `${v.make} ${v.model}`;

/** Unrated vehicles sort after every rated one. */
const ratingOf = (v: Vehicle) => v.averageRating ?? -1;

const COMPARATORS: Record<Exclude<SortOrder, 'featured'>, (a: Vehicle, b: Vehicle) => number> = {
  newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
  rating: (a, b) => ratingOf(b) - ratingOf(a) || b.reviewCount - a.reviewCount,
  'price-asc': (a, b) => a.price - b.price,
  'price-desc': (a, b) => b.price - a.price,
  name: (a, b) => nameOf(a).localeCompare(nameOf(b)),
};

/** Returns a sorted copy; "featured" keeps the server's listing order. */
export function sortVehicles(vehicles: Vehicle[], sort: SortOrder): Vehicle[] {
  return sort === 'featured' ? [...vehicles] : [...vehicles].sort(COMPARATORS[sort]);
}

/** An error message if both prices are set and min exceeds max (the backend rejects that too). */
export function priceRangeError(minPrice: string, maxPrice: string): string | null {
  if (minPrice.trim() === '' || maxPrice.trim() === '') return null;
  return Number(minPrice) > Number(maxPrice) ? 'Min price must not be more than max price' : null;
}
