import { describe, expect, it } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { installFakeApi, signInAs, vehicle } from './test/fakeApi';

const creta = vehicle({ id: 'v1', make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1500000, quantity: 6, averageRating: 4.5, reviewCount: 2, createdAt: '2026-09-01T10:00:00.000Z' });
const swift = vehicle({ id: 'v2', make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback', price: 800000, quantity: 0, averageRating: null, reviewCount: 0, createdAt: '2026-10-12T10:00:00.000Z' });
const nexon = vehicle({ id: 'v3', make: 'Tata', model: 'Nexon', category: 'SUV', price: 1000000, quantity: 2, averageRating: 4.8, reviewCount: 1, createdAt: '2026-08-15T10:00:00.000Z' });

const card = (name: string) => screen.getByRole('article', { name });

async function openComparison(names: string[]) {
  signInAs('user');
  installFakeApi({ vehicles: [creta, swift, nexon] });
  render(<App />);
  const user = userEvent.setup();
  await screen.findByRole('article', { name: 'Hyundai Creta' });
  for (const name of names) await user.click(within(card(name)).getByRole('button', { name: `Compare ${name}` }));
  await user.click(within(screen.getByRole('region', { name: 'Compare tray' })).getByRole('button', { name: 'Compare vehicles' }));
  const dialog = screen.getByRole('dialog', { name: 'Compare vehicles' });
  return { user, dialog, table: within(dialog).getByRole('table', { name: 'Vehicle comparison' }) };
}

const cells = (table: HTMLElement, label: string) =>
  within(within(table).getByRole('row', { name: new RegExp(`^${label}`) })).getAllByRole('cell').map((c) => c.textContent);

describe('comparison details', () => {
  it('compares availability, rating and listing date, with readable fallbacks for missing values', async () => {
    const { table } = await openComparison(['Hyundai Creta', 'Maruti Suzuki Swift', 'Tata Nexon']);

    expect(cells(table, 'Availability')).toEqual(['In stock', 'Out of stock', 'In stock']);
    expect(cells(table, 'Rating')).toEqual(['4.5 / 5 (2 reviews)', 'No reviews yet', '4.8 / 5 (1 review)']);
    expect(cells(table, 'Listed')).toEqual(['1 Sept 2026', '12 Oct 2026', '15 Aug 2026']);
  });

  it('highlights the lowest price and the best rating', async () => {
    const { table } = await openComparison(['Hyundai Creta', 'Maruti Suzuki Swift', 'Tata Nexon']);

    expect(cells(table, 'Price')).toEqual(['₹15,00,000', '₹8,00,000Lowest price', '₹10,00,000']);
    expect(cells(table, 'Rating')[2]).toBe('4.8 / 5 (1 review)');
    const bestRated = within(within(table).getByRole('row', { name: /^Rating/ })).getAllByRole('cell')[2]!;
    expect(bestRated).toHaveAttribute('data-best', 'true');
  });
});

describe('comparison controls', () => {
  it('removes a vehicle from inside the comparison table', async () => {
    const { user, dialog, table } = await openComparison(['Hyundai Creta', 'Maruti Suzuki Swift', 'Tata Nexon']);

    await user.click(within(table).getByRole('button', { name: 'Remove Maruti Suzuki Swift from comparison' }));

    expect(within(table).getAllByRole('columnheader').map((h) => h.textContent?.replace(/Remove.*$/, ''))).toEqual(['', 'Hyundai Creta', 'Tata Nexon']);
    expect(within(screen.getByRole('region', { name: 'Compare tray' })).getByText('2 of 3 selected')).toBeInTheDocument();
    expect(dialog).toBeInTheDocument();
  });

  it('closes the comparison once fewer than two vehicles remain', async () => {
    const { user, table } = await openComparison(['Hyundai Creta', 'Tata Nexon']);

    await user.click(within(table).getByRole('button', { name: 'Remove Tata Nexon from comparison' }));

    expect(screen.queryByRole('dialog', { name: 'Compare vehicles' })).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Compare tray' })).getByText('1 of 3 selected')).toBeInTheDocument();
  });

  it('moves focus into the dialog and returns it to the Compare button on Escape', async () => {
    const { user, dialog } = await openComparison(['Hyundai Creta', 'Tata Nexon']);

    expect(dialog).toContainElement(document.activeElement as HTMLElement);

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(within(screen.getByRole('region', { name: 'Compare tray' })).getByRole('button', { name: 'Compare vehicles' })).toHaveFocus();
  });
});
