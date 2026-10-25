import { ValidationError } from '../errors/httpErrors.js';
import { requireUuid } from '../validation/uuid.js';
import type { VehicleInput, VehicleSearch } from './vehicle.js';

type Fields = Record<string, unknown>;

function requireText(fields: Fields, name: 'make' | 'model' | 'category'): string {
  const value = fields[name];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new ValidationError(`${name} is required`);
  }
  return value.trim();
}

function requirePrice(fields: Fields): number {
  const value = fields['price'];
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new ValidationError('price must be a number of 0 or more');
  }
  return value;
}

function requireQuantity(fields: Fields, name = 'quantity'): number {
  const value = fields[name];
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
    throw new ValidationError(`${name} must be a whole number of 0 or more`);
  }
  return value;
}

/** Validates a vehicle id from the URL (400 if it is not a UUID). */
export function validateVehicleId(id: unknown): string {
  return requireUuid(id, 'Vehicle id must be a valid UUID');
}

/** Validates a request body containing all vehicle fields. */
export function validateVehicle(body: unknown): VehicleInput {
  const fields = (body ?? {}) as Fields;
  return {
    make: requireText(fields, 'make'),
    model: requireText(fields, 'model'),
    category: requireText(fields, 'category'),
    price: requirePrice(fields),
    quantity: requireQuantity(fields),
  };
}

function optionalText(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

function optionalPrice(value: unknown, name: string): number | undefined {
  if (value === undefined || value === '') return undefined;
  const price = typeof value === 'string' ? Number(value) : NaN;
  if (!Number.isFinite(price) || price < 0) {
    throw new ValidationError(`${name} must be a number of 0 or more`);
  }
  return price;
}

/** Validates search query parameters. */
export function validateSearch(query: Fields): VehicleSearch {
  const search: VehicleSearch = {};
  const make = optionalText(query['make']);
  const model = optionalText(query['model']);
  const category = optionalText(query['category']);
  const minPrice = optionalPrice(query['minPrice'], 'minPrice');
  const maxPrice = optionalPrice(query['maxPrice'], 'maxPrice');

  if (minPrice !== undefined && maxPrice !== undefined && minPrice > maxPrice) {
    throw new ValidationError('minPrice must not be greater than maxPrice');
  }
  if (make !== undefined) search.make = make;
  if (model !== undefined) search.model = model;
  if (category !== undefined) search.category = category;
  if (minPrice !== undefined) search.minPrice = minPrice;
  if (maxPrice !== undefined) search.maxPrice = maxPrice;
  return search;
}

/** Validates a partial update: at least one field, each valid if present. */
export function validateVehicleUpdate(body: unknown): Partial<VehicleInput> {
  const fields = (body ?? {}) as Fields;
  const update: Partial<VehicleInput> = {};
  if (fields['make'] !== undefined) update.make = requireText(fields, 'make');
  if (fields['model'] !== undefined) update.model = requireText(fields, 'model');
  if (fields['category'] !== undefined) update.category = requireText(fields, 'category');
  if (fields['price'] !== undefined) update.price = requirePrice(fields);
  if (fields['quantity'] !== undefined) update.quantity = requireQuantity(fields);
  if (Object.keys(update).length === 0) {
    throw new ValidationError('Provide at least one field to update');
  }
  return update;
}

/** Validates a restock body: a whole number of 1 or more. */
export function validateRestock(body: unknown): number {
  const quantity = ((body ?? {}) as Fields)['quantity'];
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1) {
    throw new ValidationError('quantity must be a whole number of 1 or more');
  }
  return quantity;
}
