import { ValidationError } from '../errors/httpErrors.js';

export const MIN_PASSWORD_LENGTH = 8;

/** Basic text@domain.tld shape: no whitespace, one "@", a dot in the domain. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegistrationInput {
  email: string;
  password: string;
}

/**
 * Validates a registration request body and returns the typed input.
 * Throws a ValidationError (400) describing the first problem found.
 */
export function validateRegistration(body: unknown): RegistrationInput {
  const { email, password } = (body ?? {}) as Record<string, unknown>;

  if (typeof email !== 'string' || email.length === 0) {
    throw new ValidationError('Email is required');
  }
  if (!EMAIL_PATTERN.test(email)) {
    throw new ValidationError('Email must be a valid email address');
  }
  if (typeof password !== 'string' || password.length === 0) {
    throw new ValidationError('Password is required');
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    throw new ValidationError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long`);
  }

  return { email, password };
}
