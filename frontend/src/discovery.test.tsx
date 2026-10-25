import { describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { installFakeApi, signInAs, vehicle } from './test/fakeApi';

const creta = vehicle({ id: 'v1', make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1500000, quantity: 6, averageRating: 4, reviewCount: 1, createdAt: '2026-09-01T00:00:00.000Z' });
const venue = vehicle({ id: 'v2', make: 'Hyundai', model: 'Venue', category: 'SUV', price: 900000, quantity: 0, averageRating: 4.8, reviewCount: 5, createdAt: '2026-10-15T00:00:00.000Z' });
const swift = vehicle({ id: 'v3', make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback', price: 800000, quantity: 10, averageRating: null, reviewCount: 0, createdAt: '2026-10-01T00:00:00.000Z' });
const nexon = vehicle({ id: 'v4', make: 'Tata', model: 'Nexon', category: 'SUV', price: 1000000, quantity: 2, averageRating: 4, reviewCount: 3, createdAt: '2026-08-01T00:00:00.000Z' });

async function renderInventory() {
  signInAs('user');
  const api = installFakeApi({ vehicles: [creta, venue, swift, nexon] });
  render(<App />);
  await screen.findByRole('article', { name: 'Hyundai Creta' });
  return { api, user: userEvent.setup() };
}

const names = () => screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));
const searchCalls = (api: Awaited<ReturnType<typeof renderInventory>>['api']) =>
  api.calls.filter((c) => c.path.startsWith('/api/vehicles/search'));

describe('sorting', () => {
  it('sorts the newest listings first', async () => {
    const { user } = await renderInventory();
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Newest first');
    expect(names()).toEqual(['Hyundai Venue', 'Maruti Suzuki Swift', 'Hyundai Creta', 'Tata Nexon']);
  });

  it('sorts by rating, breaking ties by review count and listing unrated vehicles last', async () => {
    const { user } = await renderInventory();
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Top rated');
    expect(names()).toEqual(['Hyundai Venue', 'Tata Nexon', 'Hyundai Creta', 'Maruti Suzuki Swift']);
  });
});

describe('availability filter', () => {
  it('sends the availability filter to the search endpoint and shows only matching vehicles', async () => {
    const { api, user } = await renderInventory();

    await user.selectOptions(screen.getByLabelText('Availability'), 'In stock');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(names()).toEqual(['Hyundai Creta', 'Maruti Suzuki Swift', 'Tata Nexon']));
    expect(new URLSearchParams(searchCalls(api)[0]!.path.split('?')[1]).get('availability')).toBe('in_stock');

    await user.selectOptions(screen.getByLabelText('Availability'), 'Out of stock');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(names()).toEqual(['Hyundai Venue']));
  });

  it('combines text, availability and sorting', async () => {
    const { api, user } = await renderInventory();

    await user.type(screen.getByLabelText('Make'), 'hyundai');
    await user.selectOptions(screen.getByLabelText('Availability'), 'Any availability');
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Price: low to high');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(names()).toEqual(['Hyundai Venue', 'Hyundai Creta']));
    expect(Object.fromEntries(new URLSearchParams(searchCalls(api)[0]!.path.split('?')[1]))).toEqual({ make: 'hyundai' });
  });

  it('is reset by Clear filters', async () => {
    const { user } = await renderInventory();
    await user.selectOptions(screen.getByLabelText('Availability'), 'Out of stock');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await waitFor(() => expect(names()).toHaveLength(1));

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    await waitFor(() => expect(names()).toHaveLength(4));
    expect(screen.getByLabelText('Availability')).toHaveValue('');
  });
});

describe('price range validation', () => {
  it('explains an inverted price range instead of searching, and clears the message once fixed', async () => {
    const { api, user } = await renderInventory();

    await user.type(screen.getByLabelText('Min price'), '2000000');
    await user.type(screen.getByLabelText('Max price'), '1000000');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(screen.getByText('Min price must not be more than max price')).toBeInTheDocument();
    expect(screen.getByLabelText('Max price')).toHaveAttribute('aria-invalid', 'true');
    expect(searchCalls(api)).toHaveLength(0);
    expect(names()).toHaveLength(4);

    await user.clear(screen.getByLabelText('Min price'));
    expect(screen.queryByText('Min price must not be more than max price')).not.toBeInTheDocument();
  });
});
