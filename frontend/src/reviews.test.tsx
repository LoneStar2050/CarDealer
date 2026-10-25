import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { installFakeApi, review, signInAs, USER_TOKEN, vehicle, type FakeApiOptions } from './test/fakeApi';

const creta = vehicle({ id: 'v1', make: 'Hyundai', model: 'Creta', averageRating: 4.5, reviewCount: 2 });
const swift = vehicle({ id: 'v2', make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback', price: 800000 });

const cretaReviews = [
  review({ id: 'r1', rating: 5, comment: 'Superb comfort on long drives.', author: 'a***@example.com', createdAt: '2026-10-21T08:00:00.000Z' }),
  review({ id: 'r2', rating: 4, comment: 'Good mileage, firm suspension.', author: 'b***@example.com', createdAt: '2026-10-19T08:00:00.000Z' }),
];

const card = (name: string) => screen.getByRole('article', { name });

async function openDetails(name: string, options: FakeApiOptions = {}) {
  signInAs('user');
  const api = installFakeApi({ vehicles: [creta, swift], reviews: { v1: cretaReviews }, ...options });
  render(<App />);
  const user = userEvent.setup();
  await user.click(await screen.findByRole('button', { name: `View details for ${name}` }));
  return { api, user, details: screen.getByRole('region', { name: 'Vehicle details' }) };
}

const reviewsSection = () => screen.getByRole('region', { name: 'Customer reviews' });

describe('ratings on vehicle cards', () => {
  it('shows the average rating and review count, or that there are no reviews yet', async () => {
    signInAs('user');
    installFakeApi({ vehicles: [creta, swift] });
    render(<App />);

    expect(await within(await screen.findByRole('article', { name: 'Hyundai Creta' })).findByRole('img', { name: 'Rated 4.5 out of 5 from 2 reviews' })).toBeInTheDocument();
    expect(within(card('Hyundai Creta')).getByText('4.5')).toBeInTheDocument();
    expect(within(card('Maruti Suzuki Swift')).getByText('No reviews yet')).toBeInTheDocument();
  });
});

describe('customer reviews on the details page', () => {
  it('shows a loading state, then the summary and each review with author, rating, date and comment', async () => {
    const { api } = await openDetails('Hyundai Creta', { hold: ['loadReviews'] });

    expect(within(reviewsSection()).getByText('Loading reviews…')).toBeInTheDocument();
    api.release('loadReviews');
    const list = await within(reviewsSection()).findByRole('list', { name: 'Reviews' });
    expect(within(reviewsSection()).getByText('4.5 out of 5 · 2 reviews')).toBeInTheDocument();

    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);
    expect(within(items[0]!).getByText('a***@example.com')).toBeInTheDocument();
    expect(within(items[0]!).getByRole('img', { name: 'Rated 5 out of 5' })).toBeInTheDocument();
    expect(within(items[0]!).getByText('21 Oct 2026')).toBeInTheDocument();
    expect(within(items[0]!).getByText('Superb comfort on long drives.')).toBeInTheDocument();
  });

  it('shows an empty state inviting the first review', async () => {
    await openDetails('Maruti Suzuki Swift');

    expect(await within(reviewsSection()).findByText('No reviews yet. Be the first to review this vehicle.')).toBeInTheDocument();
  });

  it('shows a recoverable error when reviews cannot be loaded', async () => {
    const { api, user } = await openDetails('Hyundai Creta', {
      overrides: { 'GET /api/vehicles/v1/reviews': { status: 500, body: { error: 'Internal server error' } } },
    });

    const alert = await within(reviewsSection()).findByRole('alert');
    expect(alert).toHaveTextContent("Couldn't load reviews: Internal server error");
    const before = api.calls.filter((c) => c.path === '/api/vehicles/v1/reviews').length;
    await user.click(within(reviewsSection()).getByRole('button', { name: 'Try again' }));
    expect(api.calls.filter((c) => c.path === '/api/vehicles/v1/reviews').length).toBe(before + 1);
  });

  it('submits a review with the chosen rating, then shows it and the new summary', async () => {
    const { api, user } = await openDetails('Maruti Suzuki Swift', { hold: ['postReview'] });
    const section = reviewsSection();
    await within(section).findByText(/No reviews yet/);

    const form = within(section).getByRole('form', { name: 'Write a review' });
    await user.click(within(form).getByRole('radio', { name: '4 stars' }));
    await user.type(within(form).getByLabelText('Your review'), '  Peppy and easy to park.  ');
    await user.click(within(form).getByRole('button', { name: 'Submit review' }));

    expect(within(section).getByRole('button', { name: 'Submitting…' })).toBeDisabled();
    api.release('postReview');
    expect(await within(section).findByRole('status')).toHaveTextContent('Thanks! Your review was posted.');
    expect(within(section).getByText('Peppy and easy to park.')).toBeInTheDocument();
    expect(within(section).getByText('4 out of 5 · 1 review')).toBeInTheDocument();
    expect(within(section).queryByRole('form', { name: 'Write a review' })).not.toBeInTheDocument();
    expect(within(section).getByText("You've reviewed this vehicle.")).toBeInTheDocument();

    expect(api.calls.find((c) => c.method === 'POST' && c.path === '/api/vehicles/v2/reviews')).toMatchObject({
      token: USER_TOKEN,
      body: { rating: 4, comment: 'Peppy and easy to park.' },
    });
  });

  it('updates the vehicle card rating after reviewing', async () => {
    const { user } = await openDetails('Maruti Suzuki Swift');
    const form = await within(reviewsSection()).findByRole('form', { name: 'Write a review' });

    await user.click(within(form).getByRole('radio', { name: '5 stars' }));
    await user.type(within(form).getByLabelText('Your review'), 'Excellent');
    await user.click(within(form).getByRole('button', { name: 'Submit review' }));
    await within(reviewsSection()).findByRole('status');
    await user.click(screen.getByRole('button', { name: 'Back to inventory' }));

    expect(within(card('Maruti Suzuki Swift')).getByRole('img', { name: 'Rated 5 out of 5 from 1 review' })).toBeInTheDocument();
  });

  it('validates the rating and comment before sending', async () => {
    const { api, user } = await openDetails('Maruti Suzuki Swift');
    const form = await within(reviewsSection()).findByRole('form', { name: 'Write a review' });

    await user.click(within(form).getByRole('button', { name: 'Submit review' }));
    expect(within(form).getByText('Choose a rating from 1 to 5 stars')).toBeInTheDocument();
    expect(within(form).getByText('Write a short comment')).toBeInTheDocument();
    expect(within(form).getByLabelText('Your review')).toHaveAttribute('aria-invalid', 'true');

    await user.click(within(form).getByRole('radio', { name: '3 stars' }));
    expect(within(form).queryByText('Choose a rating from 1 to 5 stars')).not.toBeInTheDocument();
    await user.click(within(form).getByLabelText('Your review'));
    await user.paste('x'.repeat(1001));
    await user.click(within(form).getByRole('button', { name: 'Submit review' }));
    expect(within(form).getByText('Keep it under 1000 characters')).toBeInTheDocument();

    expect(api.calls.some((c) => c.method === 'POST' && c.path.endsWith('/reviews'))).toBe(false);
  });

  it('shows the server error if the review is rejected', async () => {
    const { user } = await openDetails('Maruti Suzuki Swift', {
      overrides: { 'POST /api/vehicles/v2/reviews': { status: 409, body: { error: 'You have already reviewed this vehicle' } } },
    });
    const form = await within(reviewsSection()).findByRole('form', { name: 'Write a review' });

    await user.click(within(form).getByRole('radio', { name: '2 stars' }));
    await user.type(within(form).getByLabelText('Your review'), 'Meh');
    await user.click(within(form).getByRole('button', { name: 'Submit review' }));

    expect(await within(form).findByRole('alert')).toHaveTextContent('You have already reviewed this vehicle');
    expect(within(form).getByRole('button', { name: 'Submit review' })).toBeEnabled();
  });

  it('does not offer the form to a user who has already reviewed the vehicle', async () => {
    await openDetails('Hyundai Creta', {
      reviews: { v1: [review({ id: 'mine', isOwn: true, comment: 'Mine', author: 'u***@example.com' })] },
    });

    expect(await within(reviewsSection()).findByText("You've reviewed this vehicle.")).toBeInTheDocument();
    expect(within(reviewsSection()).queryByRole('form', { name: 'Write a review' })).not.toBeInTheDocument();
    expect(within(reviewsSection()).getByText('Your review')).toBeInTheDocument();
  });
});
