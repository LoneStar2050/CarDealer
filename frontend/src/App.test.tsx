import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { installFakeApi, signInAs, vehicle, ADMIN_TOKEN } from './test/fakeApi';

const creta = vehicle({ id: 'v1', make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1500000, quantity: 6 });
const swift = vehicle({ id: 'v2', make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback', price: 800000, quantity: 10 });
const virtus = vehicle({ id: 'v3', make: 'Volkswagen', model: 'Virtus', category: 'Sedan', price: 1500000, quantity: 0 });

/** The card for one vehicle, found by its accessible name. */
const card = (name: string) => screen.getByRole('article', { name });

async function renderSignedIn(role: 'admin' | 'user', vehicles = [creta, swift, virtus], options = {}) {
  signInAs(role);
  const api = installFakeApi({ vehicles, ...options });
  render(<App />);
  await screen.findByRole('article', { name: `${vehicles[0]!.make} ${vehicles[0]!.model}` });
  return api;
}

describe('authentication', () => {
  it('signs in through the login form and shows the inventory', async () => {
    const user = userEvent.setup();
    installFakeApi({ vehicles: [creta] });
    render(<App />);

    await user.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('article', { name: 'Hyundai Creta' })).toBeInTheDocument();
    expect(screen.getByText('buyer@example.com')).toBeInTheDocument();
  });

  it('shows the API error message when the credentials are wrong', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);

    await user.type(screen.getByLabelText('Email'), 'buyer@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Invalid email or password');
  });

  it('validates the password length inline when registering', async () => {
    const user = userEvent.setup();
    const api = installFakeApi();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Create an account' }));
    await user.type(screen.getByLabelText('Email'), 'new@example.com');
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create account' }));

    expect(screen.getByText('Password must be at least 8 characters')).toBeInTheDocument();
    expect(api.calls.some((c) => c.path === '/api/auth/register')).toBe(false);
  });

  it('clears an inline auth error once that field is edited', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByText('Email is required')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Email'), 'b');

    expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
  });

  it('can show and hide the password', async () => {
    const user = userEvent.setup();
    installFakeApi();
    render(<App />);
    const password = screen.getByLabelText('Password');

    expect(password).toHaveAttribute('type', 'password');
    await user.click(screen.getByRole('button', { name: 'Show password' }));
    expect(password).toHaveAttribute('type', 'text');
  });

  it('returns to the sign-in page when the session has expired (401)', async () => {
    signInAs('user');
    installFakeApi({ overrides: { 'GET /api/vehicles': { status: 401, body: { error: 'Invalid or expired token' } } } });
    render(<App />);

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Your session has expired');
  });
});

describe('inventory', () => {
  it('shows a hero section with an Explore Inventory action', async () => {
    await renderSignedIn('user');
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Explore Inventory' })).toHaveAttribute('href', '#inventory');
  });

  it('renders each vehicle as a card with category, rupee price, stock and an image', async () => {
    await renderSignedIn('user');

    const creta = card('Hyundai Creta');
    expect(within(creta).getByText('SUV')).toBeInTheDocument();
    expect(within(creta).getByText('₹15,00,000')).toBeInTheDocument();
    expect(within(creta).getByText('6 in stock')).toBeInTheDocument();
    expect(within(creta).getByRole('img', { name: 'Hyundai Creta' })).toBeInTheDocument();
    expect(screen.getByText('3 vehicles')).toBeInTheDocument();
  });

  it('shows an error message when the inventory cannot be loaded', async () => {
    signInAs('user');
    installFakeApi({ overrides: { 'GET /api/vehicles': { status: 500, body: { error: 'Database unavailable' } } } });
    render(<App />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Database unavailable');
  });

  it('shows an empty state when nothing matches', async () => {
    await renderSignedIn('user', [creta]);
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Make'), 'Ferrari');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    expect(await screen.findByText('No vehicles match your filters.')).toBeInTheDocument();
    expect(screen.getByText('0 vehicles')).toBeInTheDocument();
  });
});

describe('search and filters', () => {
  it('sends make, model, category and price filters to the search endpoint', async () => {
    const api = await renderSignedIn('user');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Make'), 'hyun');
    await user.type(screen.getByLabelText('Model'), 'cre');
    await user.selectOptions(screen.getByLabelText('Category'), 'SUV');
    await user.type(screen.getByLabelText('Min price'), '1000000');
    await user.type(screen.getByLabelText('Max price'), '2000000');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));

    await waitFor(() => expect(screen.queryByRole('article', { name: 'Maruti Suzuki Swift' })).not.toBeInTheDocument());
    expect(card('Hyundai Creta')).toBeInTheDocument();
    expect(screen.getByText('1 vehicle')).toBeInTheDocument();
    const search = api.calls.find((c) => c.path.startsWith('/api/vehicles/search'))!;
    const params = new URLSearchParams(search.path.split('?')[1]);
    expect(Object.fromEntries(params)).toEqual({
      make: 'hyun', model: 'cre', category: 'SUV', minPrice: '1000000', maxPrice: '2000000',
    });
  });

  it('offers the categories present in the inventory', async () => {
    await renderSignedIn('user');
    const options = within(screen.getByLabelText('Category')).getAllByRole('option').map((o) => o.textContent);
    expect(options).toEqual(['All categories', 'Hatchback', 'Sedan', 'SUV']);
  });

  it('clears the filters and shows all vehicles again', async () => {
    await renderSignedIn('user');
    const user = userEvent.setup();

    await user.type(screen.getByLabelText('Make'), 'hyun');
    await user.click(screen.getByRole('button', { name: 'Apply filters' }));
    await screen.findByText('1 vehicle');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));

    expect(await screen.findByText('3 vehicles')).toBeInTheDocument();
    expect(screen.getByLabelText('Make')).toHaveValue('');
  });

  it('sorts by price and by name', async () => {
    await renderSignedIn('user');
    const user = userEvent.setup();
    const names = () => screen.getAllByRole('article').map((a) => a.getAttribute('aria-label'));

    await user.selectOptions(screen.getByLabelText('Sort by'), 'Price: low to high');
    expect(names()[0]).toBe('Maruti Suzuki Swift');
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Price: high to low');
    expect(names()[2]).toBe('Maruti Suzuki Swift');
    await user.selectOptions(screen.getByLabelText('Sort by'), 'Name: A to Z');
    expect(names()).toEqual(['Hyundai Creta', 'Maruti Suzuki Swift', 'Volkswagen Virtus']);
  });
});

describe('purchasing', () => {
  it('enables Purchase when in stock and disables it with an Out of stock label at zero', async () => {
    await renderSignedIn('user');

    expect(within(card('Hyundai Creta')).getByRole('button', { name: 'Purchase' })).toBeEnabled();
    const virtusCard = card('Volkswagen Virtus');
    expect(within(virtusCard).getByText('Out of stock')).toBeInTheDocument();
    expect(within(virtusCard).getByRole('button', { name: 'Purchase' })).toBeDisabled();
  });

  it('shows a pending state, blocks duplicate clicks and updates the stock on success', async () => {
    const api = await renderSignedIn('user', [creta], { hold: ['purchase'] });
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Purchase' }));
    const pending = within(card('Hyundai Creta')).getByRole('button', { name: 'Purchasing…' });
    expect(pending).toBeDisabled();
    await user.click(pending);
    api.release('purchase');

    expect(await screen.findByRole('status')).toHaveTextContent('You purchased a Hyundai Creta');
    expect(within(card('Hyundai Creta')).getByText('5 in stock')).toBeInTheDocument();
    expect(api.calls.filter((c) => c.path.endsWith('/purchase'))).toHaveLength(1);
  });

  it('shows the API error when a purchase fails', async () => {
    await renderSignedIn('user', [creta], {
      overrides: { 'POST /api/vehicles/v1/purchase': { status: 409, body: { error: 'Vehicle is out of stock' } } },
    });
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Purchase' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Vehicle is out of stock');
  });

  it('refreshes a vehicle that sold out after the page loaded, keeping the error', async () => {
    const api = await renderSignedIn('user', [{ ...creta, quantity: 1 }]);
    const user = userEvent.setup();
    expect(within(card('Hyundai Creta')).getByText('1 in stock')).toBeInTheDocument();

    // Another buyer takes the last unit after the inventory was loaded.
    api.vehicles[0]!.quantity = 0;
    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Purchase' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Vehicle is out of stock');
    const creta0 = card('Hyundai Creta');
    expect(await within(creta0).findByText('Out of stock')).toBeInTheDocument();
    expect(within(creta0).queryByText('1 in stock')).not.toBeInTheDocument();
    expect(within(creta0).getByRole('button', { name: 'Purchase' })).toBeDisabled();
    expect(screen.getByRole('alert')).toHaveTextContent('Vehicle is out of stock');
  });
});

describe('admin controls', () => {
  it('are not shown to regular users', async () => {
    await renderSignedIn('user');

    expect(screen.queryByRole('button', { name: 'Add vehicle' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Edit|Restock|Delete) / })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Manage' })).not.toBeInTheDocument();
  });

  it('are shown to admins, including a stock management table', async () => {
    await renderSignedIn('admin');

    expect(screen.getByRole('button', { name: 'Add vehicle' })).toBeInTheDocument();
    for (const action of ['Edit', 'Restock', 'Delete']) {
      expect(screen.getAllByRole('button', { name: new RegExp(`^${action} Hyundai Creta$`) }).length).toBeGreaterThan(0);
    }
    const table = screen.getByRole('table', { name: 'Stock management' });
    const row = within(table).getByRole('row', { name: /Volkswagen Virtus/ });
    expect(within(row).getByText('Out of stock')).toBeInTheDocument();
  });

  it('adds a vehicle, validating the form first', async () => {
    const api = await renderSignedIn('admin');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    const dialog = screen.getByRole('dialog', { name: 'Add vehicle' });
    await user.click(within(dialog).getByRole('button', { name: 'Save vehicle' }));
    expect(within(dialog).getByText('Make is required')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Make'), 'Tata');
    await user.type(within(dialog).getByLabelText('Model'), 'Nexon');
    await user.type(within(dialog).getByLabelText('Category'), 'SUV');
    await user.type(within(dialog).getByLabelText('Price (₹)'), '1000000');
    await user.type(within(dialog).getByLabelText('Quantity'), '9');
    await user.click(within(dialog).getByRole('button', { name: 'Save vehicle' }));

    expect(await screen.findByRole('article', { name: 'Tata Nexon' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Tata Nexon was added');
    expect(api.calls.find((c) => c.method === 'POST' && c.path === '/api/vehicles')).toMatchObject({
      token: ADMIN_TOKEN,
      body: { make: 'Tata', model: 'Nexon', category: 'SUV', price: 1000000, quantity: 9 },
    });
  });

  it('clears a field error as soon as that field is corrected', async () => {
    await renderSignedIn('admin');
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Add vehicle' }));
    const dialog = screen.getByRole('dialog', { name: 'Add vehicle' });
    await user.click(within(dialog).getByRole('button', { name: 'Save vehicle' }));
    expect(within(dialog).getByText('Make is required')).toBeInTheDocument();
    expect(within(dialog).getByText('Model is required')).toBeInTheDocument();

    await user.type(within(dialog).getByLabelText('Make'), 'Tata');

    expect(within(dialog).queryByText('Make is required')).not.toBeInTheDocument();
    expect(within(dialog).getByText('Model is required')).toBeInTheDocument();
  });

  it('edits a vehicle', async () => {
    const api = await renderSignedIn('admin');
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Edit Hyundai Creta' }));
    const dialog = screen.getByRole('dialog', { name: 'Edit vehicle' });
    const price = within(dialog).getByLabelText('Price (₹)');
    await user.clear(price);
    await user.type(price, '1450000');
    await user.click(within(dialog).getByRole('button', { name: 'Save vehicle' }));

    expect(await within(card('Hyundai Creta')).findByText('₹14,50,000')).toBeInTheDocument();
    expect(api.calls.find((c) => c.method === 'PUT')).toMatchObject({ path: '/api/vehicles/v1' });
  });

  it('restocks a vehicle using a quantity input', async () => {
    const api = await renderSignedIn('admin');
    const user = userEvent.setup();

    await user.click(within(card('Volkswagen Virtus')).getByRole('button', { name: 'Restock Volkswagen Virtus' }));
    const dialog = screen.getByRole('dialog', { name: 'Restock Volkswagen Virtus' });
    await user.type(within(dialog).getByLabelText('Quantity to add'), '4');
    await user.click(within(dialog).getByRole('button', { name: 'Restock' }));

    expect(await within(card('Volkswagen Virtus')).findByText('4 in stock')).toBeInTheDocument();
    expect(within(card('Volkswagen Virtus')).getByRole('button', { name: 'Purchase' })).toBeEnabled();
    expect(api.calls.find((c) => c.path.endsWith('/restock'))).toMatchObject({ body: { quantity: 4 } });
  });

  it('deletes a vehicle only after confirmation', async () => {
    const api = await renderSignedIn('admin');
    const user = userEvent.setup();

    await user.click(within(card('Maruti Suzuki Swift')).getByRole('button', { name: 'Delete Maruti Suzuki Swift' }));
    const dialog = screen.getByRole('dialog', { name: 'Delete vehicle?' });
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(api.calls.some((c) => c.method === 'DELETE')).toBe(false);

    await user.click(within(card('Maruti Suzuki Swift')).getByRole('button', { name: 'Delete Maruti Suzuki Swift' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete vehicle?' })).getByRole('button', { name: 'Delete' }));

    await waitFor(() => expect(screen.queryByRole('article', { name: 'Maruti Suzuki Swift' })).not.toBeInTheDocument());
    expect(api.calls.find((c) => c.method === 'DELETE')).toMatchObject({ path: '/api/vehicles/v2' });
  });

  it('shows the server error if the backend refuses an admin action (403)', async () => {
    await renderSignedIn('admin', [creta], {
      overrides: { 'DELETE /api/vehicles/v1': { status: 403, body: { error: 'Admin access required' } } },
    });
    const user = userEvent.setup();

    await user.click(within(card('Hyundai Creta')).getByRole('button', { name: 'Delete Hyundai Creta' }));
    await user.click(within(screen.getByRole('dialog', { name: 'Delete vehicle?' })).getByRole('button', { name: 'Delete' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Admin access required');
    expect(card('Hyundai Creta')).toBeInTheDocument();
  });
});
