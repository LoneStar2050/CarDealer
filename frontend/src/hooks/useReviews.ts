import { useCallback, useEffect, useState } from 'react';
import { api, ApiError, type RatingSummary, type Review, type ReviewInput } from '../api';

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; reviews: Review[]; summary: RatingSummary };

/**
 * Loads a vehicle's reviews and submits new ones. `onSummaryChange` lets the
 * inventory update the vehicle's rating; a 401 ends the session.
 */
export function useReviews(
  token: string,
  vehicleId: string,
  onSummaryChange: (summary: RatingSummary) => void,
  onSessionExpired: () => void,
) {
  const [state, setState] = useState<State>({ status: 'loading' });

  const load = useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const { reviews, summary } = await api.listReviews(token, vehicleId);
      setState({ status: 'ready', reviews, summary });
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else setState({ status: 'error', message: (error as Error).message });
    }
  }, [token, vehicleId, onSessionExpired]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Posts a review; resolves on success and rethrows the API error otherwise. */
  async function submit(input: ReviewInput): Promise<void> {
    try {
      const { review, summary } = await api.createReview(token, vehicleId, input);
      setState((current) => ({
        status: 'ready',
        reviews: [review, ...(current.status === 'ready' ? current.reviews : [])],
        summary,
      }));
      onSummaryChange(summary);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      throw error;
    }
  }

  return { state, reload: load, submit };
}
