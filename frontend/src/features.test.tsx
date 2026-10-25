import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { installFakeApi, signInAs, vehicle } from './test/fakeApi';

const creta = vehicle({ id: 'v1', make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1500000, quantity: 6 });
const swift = vehicle({ id: 'v2', make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback', price: 800000, quantity: 10 });
const virtus = vehicle({ id: 'v3', make: 'Volkswagen', model: 'Virtus', category: 'Sedan', price: 1500000, quantity: 0 });
const nexon = vehicle({ id: 'v4', make: 'Tata', model: 'Nexon', category: 'SUV', price: 1000000, quantity: 9 });

const card = (name: string) => screen.getByRole('article', { name });

async function renderSignedIn(role: 'admin' | 'user', vehicles = [creta, swift, virtus]) {
  signInAs(role);
  const api = installFakeApi({ vehicles });
  render(<App />);
  await screen.findByRole('article', { name: 'Hyundai Creta' });
  return api;
}

describe('favorites', () => {
  it('lets a user favorite vehicles, view only favorites, and unfavorite', async () => {
    await renderSignedIn('user');
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Add Hyundai Creta to favorites' }));
    await user.click(within(card('Volkswagen Virtus')).getByRole('button', { name: 'Add Volkswagen Virtus to favorites' }));
    expect(within(card('Hyundai Creta')).getByRole('button', { name: 'Remove Hyundai Creta from favorites' }))
      .toHaveAttribute('aria-pressed', 'true');

    await user.click(screen.getByRole('button', { name: 'Favorites (2)' }));
    expect(screen.getByRole('button', { name: 'Favorites (2)' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'All vehicles' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'))).toEqual(['Hyundai Creta', 'Volkswagen Virtus']);
    expect(screen.getByText('2 vehicles')).toBeInTheDocument();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Remove Hyundai Creta from favorites' }));
    expect(screen.queryByRole('article', { name: 'Hyundai Creta' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'All vehicles' }));
    expect(screen.getByText('3 vehicles')).toBeInTheDocument();
  });

  it('shows an empty state when the user has no favorites', async () => {
    await renderSignedIn('user');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Favorites (0)' }));

    expect(screen.getByText("You haven't saved any favorites yet.")).toBeInTheDocument();
  });

  it('keeps favorites per user in local storage, without any token', async () => {
    await renderSignedIn('user');
    const user = userEvent.setup();

    await user.click(within(card('Maruti Suzuki Swift')).getByRole('button', { name: 'Add Maruti Suzuki Swift to favorites' }));

    expect(JSON.parse(localStorage.getItem('dealership-favorites:user-id')!)).toEqual(['v2']);
    expect(localStorage.getItem('dealership-favorites:user-id')).not.toContain('token');
  });

  it('restores saved favorites after signing in again', async () => {
    localStorage.setItem('dealership-favorites:user-id', JSON.stringify(['v3']));
    await renderSignedIn('user');

    expect(within(card('Volkswagen Virtus')).getByRole('button', { name: 'Remove Volkswagen Virtus from favorites' }))
      .toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Favorites (1)' })).toBeInTheDocument();
  });
});

describe('compare cars', () => {
  it('compares up to three selected vehicles side by side', async () => {
    await renderSignedIn('user', [creta, swift, virtus, nexon]);
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Compare Hyundai Creta' }));
    await user.click(within(card('Maruti Suzuki Swift')).getByRole('button', { name: 'Compare Maruti Suzuki Swift' }));
    await user.click(within(card('Volkswagen Virtus')).getByRole('button', { name: 'Compare Volkswagen Virtus' }));

    const tray = screen.getByRole('region', { name: 'Compare tray' });
    expect(within(tray).getByText('3 of 3 selected')).toBeInTheDocument();
    expect(within(card('Tata Nexon')).getByRole('button', { name: 'Compare Tata Nexon' })).toBeDisabled();

    await user.click(within(tray).getByRole('button', { name: 'Compare vehicles' }));
    const table = within(screen.getByRole('dialog', { name: 'Compare vehicles' })).getByRole('table', { name: 'Vehicle comparison' });
    const headers = within(table).getAllByRole('columnheader').map((h) => h.textContent);
    expect(headers).toEqual(['', 'Hyundai Creta', 'Maruti Suzuki Swift', 'Volkswagen Virtus']);
    const cells = (label: string) =>
      within(within(table).getByRole('row', { name: new RegExp(`^${label}`) })).getAllByRole('cell').map((c) => c.textContent);
    expect(cells('Make')).toEqual(['Hyundai', 'Maruti Suzuki', 'Volkswagen']);
    expect(cells('Model')).toEqual(['Creta', 'Swift', 'Virtus']);
    expect(cells('Category')).toEqual(['SUV', 'Hatchback', 'Sedan']);
    expect(cells('Price')).toEqual(['₹15,00,000', '₹8,00,000', '₹15,00,000']);
    expect(cells('Stock')).toEqual(['6 in stock', '10 in stock', 'Out of stock']);
  });

  it('lets the user remove a vehicle from the comparison and clear it', async () => {
    await renderSignedIn('user');
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Compare Hyundai Creta' }));
    await user.click(within(card('Maruti Suzuki Swift')).getByRole('button', { name: 'Compare Maruti Suzuki Swift' }));
    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Compare Hyundai Creta' }));
    expect(within(screen.getByRole('region', { name: 'Compare tray' })).getByText('1 of 3 selected')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear comparison' }));
    expect(screen.queryByRole('region', { name: 'Compare tray' })).not.toBeInTheDocument();
  });

  it('needs at least two vehicles before comparing', async () => {
    await renderSignedIn('user');
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Compare Hyundai Creta' }));

    expect(within(screen.getByRole('region', { name: 'Compare tray' })).getByRole('button', { name: 'Compare vehicles' })).toBeDisabled();
  });
});

describe('vehicle details', () => {
  it('opens a details view with image, fields, stock and a working Purchase action', async () => {
    await renderSignedIn('user');
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'View details for Hyundai Creta' }));

    const details = screen.getByRole('region', { name: 'Vehicle details' });
    expect(within(details).getByRole('heading', { name: 'Hyundai Creta' })).toBeInTheDocument();
    expect(within(details).getByRole('img', { name: 'Hyundai Creta' })).toBeInTheDocument();
    expect(within(details).getByText('SUV')).toBeInTheDocument();
    expect(within(details).getByText('₹15,00,000')).toBeInTheDocument();
    expect(within(details).getByText('6 in stock')).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Maruti Suzuki Swift' })).not.toBeInTheDocument();

    await user.click(within(details).getByRole('button', { name: 'Purchase' }));
    expect(await within(details).findByText('5 in stock')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You purchased a Hyundai Creta');

    await user.click(within(details).getByRole('button', { name: 'Back to inventory' }));
    expect(card('Maruti Suzuki Swift')).toBeInTheDocument();
    expect(within(card('Hyundai Creta')).getByText('5 in stock')).toBeInTheDocument();
  });

  it('gives the details view its own URL and closes it when navigating to another section', async () => {
    await renderSignedIn('user');
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'View details for Hyundai Creta' }));
    expect(window.location.hash).toBe('#vehicle/v1');

    window.location.hash = '#inventory'; // e.g. the navbar's Inventory link

    await waitFor(() => expect(screen.queryByRole('region', { name: 'Vehicle details' })).not.toBeInTheDocument());
    expect(card('Maruti Suzuki Swift')).toBeInTheDocument();
  });

  it('opens the details view directly from a #vehicle/<id> link', async () => {
    window.location.hash = '#vehicle/v2';
    signInAs('user');
    installFakeApi({ vehicles: [creta, swift, virtus] });
    render(<App />);

    const details = await screen.findByRole('region', { name: 'Vehicle details' });
    expect(within(details).getByRole('heading', { name: 'Maruti Suzuki Swift' })).toBeInTheDocument();
  });

  it('shows Out of stock with Purchase disabled for an unavailable vehicle', async () => {
    await renderSignedIn('user');
    const user = userEvent.setup();

    await user.click(within(card('Volkswagen Virtus')).getByRole('button', { name: 'View details for Volkswagen Virtus' }));

    const details = screen.getByRole('region', { name: 'Vehicle details' });
    expect(within(details).getByText('Out of stock')).toBeInTheDocument();
    expect(within(details).getByRole('button', { name: 'Purchase' })).toBeDisabled();
  });
});

describe('admin inventory statistics', () => {
  it('shows statistics calculated from the loaded inventory to admins', async () => {
    await renderSignedIn('admin');

    const stats = screen.getByRole('region', { name: 'Inventory statistics' });
    const stat = (name: string) => within(within(stats).getByRole('group', { name })).getByText(/./, { selector: 'dd' });
    expect(stat('Vehicle models')).toHaveTextContent('3');
    expect(stat('Units in stock')).toHaveTextContent('16');
    expect(stat('Out-of-stock models')).toHaveTextContent('1');
    expect(stat('Total inventory value')).toHaveTextContent('₹1,70,00,000');
  });

  it('updates the statistics after a purchase', async () => {
    await renderSignedIn('admin');
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Purchase' }));

    const stats = screen.getByRole('region', { name: 'Inventory statistics' });
    await waitFor(() =>
      expect(within(within(stats).getByRole('group', { name: 'Units in stock' })).getByText('15')).toBeInTheDocument(),
    );
    expect(within(within(stats).getByRole('group', { name: 'Total inventory value' })).getByText('₹1,55,00,000')).toBeInTheDocument();
  });

  it('are not shown to regular users', async () => {
    await renderSignedIn('user');
    expect(screen.queryByRole('region', { name: 'Inventory statistics' })).not.toBeInTheDocument();
  });
});
