import { ValidationError } from '../errors/httpErrors.js';
import { requireUuid } from '../validation/uuid.js';
import { MAX_PURCHASE_QUANTITY } from './purchase.js';

/** Validates an order id from the URL (400 if it is not a UUID). */
export function validatePurchaseId(id: unknown): string {
  return requireUuid(id, 'Order id must be a valid UUID');
}

/**
 * Reads the optional quantity from a purchase body (default 1). Any other
 * field, such as a price or user id, is deliberately ignored.
 */
export function validatePurchaseQuantity(body: unknown): number {
  const quantity = ((body ?? {}) as Record<string, unknown>)['quantity'];
  if (quantity === undefined) return 1;
  if (typeof quantity !== 'number' || !Number.isInteger(quantity) || quantity < 1 || quantity > MAX_PURCHASE_QUANTITY) {
    throw new ValidationError(`quantity must be a whole number from 1 to ${MAX_PURCHASE_QUANTITY}`);
  }
  return quantity;
}
