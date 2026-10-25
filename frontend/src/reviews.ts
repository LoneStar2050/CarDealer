/** Client-side checks that mirror the backend's review rules, for instant feedback. */
export const MAX_COMMENT_LENGTH = 1000;

export interface ReviewFormErrors {
  rating?: string;
  comment?: string;
}

export function validateReviewForm(rating: number | null, comment: string): ReviewFormErrors {
  const errors: ReviewFormErrors = {};
  if (rating === null || rating < 1 || rating > 5) errors.rating = 'Choose a rating from 1 to 5 stars';
  const trimmed = comment.trim();
  if (trimmed.length === 0) errors.comment = 'Write a short comment';
  else if (trimmed.length > MAX_COMMENT_LENGTH) errors.comment = `Keep it under ${MAX_COMMENT_LENGTH} characters`;
  return errors;
}
