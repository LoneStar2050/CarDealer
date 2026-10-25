/** PostgreSQL error codes the application reacts to. */
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';

const codeOf = (error: unknown) => (error as { code?: unknown }).code;

/** True if a query failed because it would duplicate a unique value. */
export function isUniqueViolation(error: unknown): boolean {
  return codeOf(error) === UNIQUE_VIOLATION;
}

/** True if a query failed because a referenced row does not exist. */
export function isForeignKeyViolation(error: unknown): boolean {
  return codeOf(error) === FOREIGN_KEY_VIOLATION;
}
