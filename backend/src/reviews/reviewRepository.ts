import type { Pool } from 'pg';
import { isForeignKeyViolation, isUniqueViolation } from '../db/postgresErrors.js';
import { ConflictError, NotFoundError } from '../errors/httpErrors.js';
import { ratingSummarySql, toAverageRating, type RatingSummaryRow } from './ratingSql.js';
import type { RatingSummary, Review, ReviewInput } from './review.js';

interface ReviewRow {
  id: string;
  rating: number;
  comment: string;
  email: string;
  is_own: boolean;
  created_at: Date;
}

/** "buyer@example.com" → "b***@example.com", so reviewers stay anonymous. */
export function maskEmail(email: string): string {
  const [local = '', domain = ''] = email.split('@');
  return `${local.slice(0, 1)}***@${domain}`;
}

function toReview(row: ReviewRow): Review {
  return {
    id: row.id,
    rating: row.rating,
    comment: row.comment,
    author: maskEmail(row.email),
    isOwn: row.is_own,
    createdAt: row.created_at.toISOString(),
  };
}

/** Data access for the reviews table. All queries are parameterized. */
export class ReviewRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Stores a review. The unique (vehicle_id, user_id) constraint makes a
   * second review by the same user a ConflictError, even under concurrency;
   * a missing vehicle is a NotFoundError.
   */
  async create(vehicleId: string, userId: string, input: ReviewInput): Promise<Review> {
    try {
      const result = await this.pool.query<ReviewRow>(
        `WITH inserted AS (
           INSERT INTO reviews (vehicle_id, user_id, rating, comment)
           VALUES ($1, $2, $3, $4)
           RETURNING id, user_id, rating, comment, created_at
         )
         SELECT inserted.id, inserted.rating, inserted.comment, inserted.created_at,
                users.email, true AS is_own
         FROM inserted JOIN users ON users.id = inserted.user_id`,
        [vehicleId, userId, input.rating, input.comment],
      );
      return toReview(result.rows[0]!);
    } catch (error) {
      if (isUniqueViolation(error)) throw new ConflictError('You have already reviewed this vehicle');
      if (isForeignKeyViolation(error)) throw new NotFoundError('Vehicle not found');
      throw error;
    }
  }

  /** Reviews of one vehicle, newest first; `viewerId` decides `isOwn`. */
  async listForVehicle(vehicleId: string, viewerId: string): Promise<Review[]> {
    const result = await this.pool.query<ReviewRow>(
      `SELECT reviews.id, reviews.rating, reviews.comment, reviews.created_at,
              users.email, reviews.user_id = $2 AS is_own
       FROM reviews JOIN users ON users.id = reviews.user_id
       WHERE reviews.vehicle_id = $1
       ORDER BY reviews.created_at DESC, reviews.id`,
      [vehicleId, viewerId],
    );
    return result.rows.map(toReview);
  }

  async summaryForVehicle(vehicleId: string): Promise<RatingSummary> {
    const result = await this.pool.query<RatingSummaryRow>(ratingSummarySql('$1'), [vehicleId]);
    const row = result.rows[0]!;
    return { averageRating: toAverageRating(row.average_rating), reviewCount: row.review_count };
  }
}
