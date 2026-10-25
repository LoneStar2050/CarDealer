/** A customer review as shown to API clients. Never includes the author's id or full email. */
export interface Review {
  id: string;
  rating: number;
  comment: string;
  /** The author's email, masked: "buyer@example.com" becomes "b***@example.com". */
  author: string;
  /** True if the requesting user wrote this review. */
  isOwn: boolean;
  /** ISO 8601 timestamp. */
  createdAt: string;
}

/** The validated fields of a new review. */
export interface ReviewInput {
  rating: number;
  comment: string;
}

/** Aggregate rating of one vehicle. */
export interface RatingSummary {
  /** Mean rating rounded to one decimal, or null when there are no reviews. */
  averageRating: number | null;
  reviewCount: number;
}

export const MIN_RATING = 1;
export const MAX_RATING = 5;
export const MAX_COMMENT_LENGTH = 1000;
