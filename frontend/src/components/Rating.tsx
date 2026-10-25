import { plural } from '../format';

/** Five stars, filled up to the rounded rating. Decorative: callers provide the accessible label. */
function StarRow({ value, className = '' }: { value: number; className?: string }) {
  const filled = Math.round(value);
  return (
    <span aria-hidden="true" className={`tracking-tight ${className}`}>
      <span className="text-amber-500">{'★'.repeat(filled)}</span>
      <span className="text-slate-300">{'★'.repeat(5 - filled)}</span>
    </span>
  );
}

/** A single review's rating, e.g. "Rated 4 out of 5". */
export function Stars({ value, className }: { value: number; className?: string }) {
  return (
    <span role="img" aria-label={`Rated ${value} out of 5`} className="inline-flex">
      <StarRow value={value} className={className} />
    </span>
  );
}

/** A vehicle's average rating and review count, or "No reviews yet". */
export function RatingBadge({ averageRating, reviewCount }: { averageRating: number | null; reviewCount: number }) {
  if (averageRating === null || reviewCount === 0) {
    return <span className="text-sm text-slate-400">No reviews yet</span>;
  }
  return (
    <span role="img" aria-label={`Rated ${averageRating} out of 5 from ${plural(reviewCount, 'review')}`} className="inline-flex items-center gap-1.5 text-sm">
      <StarRow value={averageRating} />
      <span className="font-semibold text-slate-800">{averageRating}</span>
      <span className="text-slate-500">({reviewCount})</span>
    </span>
  );
}
