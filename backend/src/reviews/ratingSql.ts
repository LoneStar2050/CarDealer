/**
 * SQL that computes a vehicle's rating summary, shared by the vehicle and
 * review queries so both always agree. `vehicleId` is a SQL expression
 * (a column or a placeholder), never user input.
 */
export function ratingSummarySql(vehicleId: string): string {
  return `SELECT ROUND(AVG(rating), 1) AS average_rating, COUNT(*)::int AS review_count
          FROM reviews WHERE reviews.vehicle_id = ${vehicleId}`;
}

/** Row shape produced by ratingSummarySql (NUMERIC arrives as a string). */
export interface RatingSummaryRow {
  average_rating: string | null;
  review_count: number;
}

export function toAverageRating(value: string | null): number | null {
  return value === null ? null : Number(value);
}
