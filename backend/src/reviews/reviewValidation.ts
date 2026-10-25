import { ValidationError } from '../errors/httpErrors.js';
import { MAX_COMMENT_LENGTH, MAX_RATING, MIN_RATING, type ReviewInput } from './review.js';

/** Validates a review body: a whole-number rating from 1 to 5 and a non-blank comment. */
export function validateReview(body: unknown): ReviewInput {
  const { rating, comment } = (body ?? {}) as Record<string, unknown>;

  if (typeof rating !== 'number' || !Number.isInteger(rating) || rating < MIN_RATING || rating > MAX_RATING) {
    throw new ValidationError(`rating must be a whole number from ${MIN_RATING} to ${MAX_RATING}`);
  }
  if (typeof comment !== 'string' || comment.trim().length === 0) {
    throw new ValidationError('comment is required');
  }
  const trimmed = comment.trim();
  if (trimmed.length > MAX_COMMENT_LENGTH) {
    throw new ValidationError(`comment must be at most ${MAX_COMMENT_LENGTH} characters`);
  }
  return { rating, comment: trimmed };
}
