import { ValidationError } from '../errors/httpErrors.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Returns `value` if it is a UUID; otherwise throws a ValidationError (400) with `message`. */
export function requireUuid(value: unknown, message: string): string {
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    throw new ValidationError(message);
  }
  return value;
}
