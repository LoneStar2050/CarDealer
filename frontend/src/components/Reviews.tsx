import { useId, useState, type FormEvent } from 'react';
import type { RatingSummary, ReviewInput } from '../api';
import { formatDate, plural } from '../format';
import { useReviews } from '../hooks/useReviews';
import { MAX_COMMENT_LENGTH, validateReviewForm, type ReviewFormErrors } from '../reviews';
import { Stars } from './Rating';
import { NoticeBanner, Spinner, ui } from './ui';

interface ReviewsProps {
  token: string;
  vehicleId: string;
  onSummaryChange: (summary: RatingSummary) => void;
  onSessionExpired: () => void;
}

/** "Customer reviews" on the details page: summary, list and the review form. */
export function Reviews({ token, vehicleId, onSummaryChange, onSessionExpired }: ReviewsProps) {
  const { state, reload, submit } = useReviews(token, vehicleId, onSummaryChange, onSessionExpired);
  const [posted, setPosted] = useState(false);

  const alreadyReviewed = state.status === 'ready' && state.reviews.some((r) => r.isOwn);

  return (
    <section aria-label="Customer reviews" className="space-y-6 rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-10">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h3 className="text-2xl font-bold text-slate-900">Customer reviews</h3>
        {state.status === 'ready' && state.summary.averageRating !== null && (
          <p className="text-sm font-semibold text-slate-700">
            {state.summary.averageRating} out of 5 · {plural(state.summary.reviewCount, 'review')}
          </p>
        )}
      </div>

      {posted && <NoticeBanner notice={{ kind: 'success', text: 'Thanks! Your review was posted.' }} />}

      {state.status === 'loading' && (
        <p className="flex items-center gap-2 text-slate-500"><Spinner /> Loading reviews…</p>
      )}

      {state.status === 'error' && (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          <span>Couldn't load reviews: {state.message}</span>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => void reload()}>Try again</button>
        </div>
      )}

      {state.status === 'ready' && (
        <>
          {alreadyReviewed ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm font-medium text-slate-700">You've reviewed this vehicle.</p>
          ) : (
            <ReviewForm
              onSubmit={async (input) => {
                await submit(input);
                setPosted(true);
              }}
            />
          )}

          {state.reviews.length === 0 ? (
            <p className="text-slate-500">No reviews yet. Be the first to review this vehicle.</p>
          ) : (
            <ul aria-label="Reviews" className="divide-y divide-slate-100">
              {state.reviews.map((review) => (
                <li key={review.id} className="space-y-2 py-4">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <Stars value={review.rating} />
                    <span className="text-sm font-semibold text-slate-800">{review.author}</span>
                    {review.isOwn && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">Your review</span>}
                    <span className="text-sm text-slate-400">{formatDate(review.createdAt)}</span>
                  </div>
                  <p className="whitespace-pre-line text-slate-700">{review.comment}</p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

/** Star picker and comment field. Validates locally, then shows the server's error if it refuses. */
function ReviewForm({ onSubmit }: { onSubmit: (input: ReviewInput) => Promise<void> }) {
  const [rating, setRating] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [errors, setErrors] = useState<ReviewFormErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const commentId = useId();
  const ratingErrorId = useId();
  const commentErrorId = useId();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const found = validateReviewForm(rating, comment);
    setErrors(found);
    setServerError(null);
    if (found.rating || found.comment) return;

    setSubmitting(true);
    try {
      await onSubmit({ rating: rating!, comment: comment.trim() });
    } catch (error) {
      setServerError((error as Error).message);
      setSubmitting(false);
    }
  }

  return (
    <form aria-label="Write a review" noValidate onSubmit={handleSubmit} className="space-y-4 rounded-2xl bg-slate-50 p-5">
      <fieldset aria-describedby={errors.rating ? ratingErrorId : undefined}>
        <legend className={ui.label}>Your rating</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((value) => (
            <label key={value} className="cursor-pointer">
              <input
                type="radio"
                name="rating"
                value={value}
                checked={rating === value}
                aria-label={plural(value, 'star')}
                className="peer sr-only"
                onChange={() => {
                  setRating(value);
                  setErrors((e) => ({ ...e, rating: undefined }));
                }}
              />
              <span
                aria-hidden="true"
                className={`block rounded px-0.5 text-3xl leading-none transition peer-focus-visible:ring-2 peer-focus-visible:ring-amber-500 ${
                  rating !== null && value <= rating ? 'text-amber-500' : 'text-slate-300 hover:text-amber-300'
                }`}
              >
                ★
              </span>
            </label>
          ))}
        </div>
        {errors.rating && <p id={ratingErrorId} className={ui.fieldError}>{errors.rating}</p>}
      </fieldset>

      <div>
        <label htmlFor={commentId} className={ui.label}>Your review</label>
        <textarea
          id={commentId}
          rows={3}
          className={ui.input}
          placeholder="What did you like or dislike?"
          value={comment}
          aria-invalid={errors.comment ? true : undefined}
          aria-describedby={errors.comment ? commentErrorId : undefined}
          onChange={(e) => {
            setComment(e.target.value);
            setErrors((current) => ({ ...current, comment: undefined }));
          }}
        />
        <div className="flex justify-between gap-4">
          {errors.comment ? <p id={commentErrorId} className={ui.fieldError}>{errors.comment}</p> : <span />}
          <p className="mt-1 text-xs text-slate-400">{comment.trim().length}/{MAX_COMMENT_LENGTH}</p>
        </div>
      </div>

      {serverError && <NoticeBanner notice={{ kind: 'error', text: serverError }} />}

      <button type="submit" className={`${ui.button} ${ui.primary}`} disabled={submitting}>
        {submitting ? (<><Spinner /> Submitting…</>) : 'Submit review'}
      </button>
    </form>
  );
}
