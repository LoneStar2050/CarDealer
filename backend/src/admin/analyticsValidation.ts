import { ValidationError } from '../errors/httpErrors.js';
import type { DateRange } from './analytics.js';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** False for impossible days such as 2026-13-01 or 2026-02-30. */
function isRealDay(day: string): boolean {
  const date = new Date(`${day}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === day;
}

/** Accepts a real calendar day in YYYY-MM-DD form (rejects e.g. 2026-02-30). */
function optionalDate(value: unknown, name: string): string | null {
  if (value === undefined || value === '') return null;
  if (typeof value !== 'string' || !DATE_PATTERN.test(value) || !isRealDay(value)) {
    throw new ValidationError(`${name} must be a date in YYYY-MM-DD format`);
  }
  return value;
}

/** Validates the optional ?from and ?to query parameters. */
export function validateDateRange(query: Record<string, unknown>): DateRange {
  const from = optionalDate(query['from'], 'from');
  const to = optionalDate(query['to'], 'to');
  // ISO dates compare correctly as strings.
  if (from !== null && to !== null && from > to) {
    throw new ValidationError('from must not be after to');
  }
  return { from, to };
}
