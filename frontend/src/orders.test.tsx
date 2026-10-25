import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { installFakeApi, purchase, signInAs, USER_TOKEN, vehicle, type FakeApiOptions } from './test/fakeApi';

const creta = vehicle({ id: 'v1', make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1500000, quantity: 6 });

const orders = [
  purchase({ id: 'p2', invoiceNumber: 'INV-000002', vehicleId: 'v2', make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback', quantity: 2, unitPrice: 800000, totalAmount: 1600000, purchasedAt: '2026-10-24T09:00:00.000Z' }),
  purchase({ id: 'p1', invoiceNumber: 'INV-000001', purchasedAt: '2026-10-22T11:15:00.000Z' }),
];

function renderAt(hash: string, options: FakeApiOptions = {}, role: 'user' | 'admin' = 'user') {
  window.location.hash = hash;
  signInAs(role);
  const api = installFakeApi({ vehicles: [creta], ...options });
  render(<App />);
  return { api, user: userEvent.setup() };
}

const history = () => screen.getByRole('region', { name: 'Purchase history' });

describe('navigation', () => {
  it('links to the purchase history from the navbar', async () => {
    const { user } = renderAt('', { purchases: orders });
    await screen.findByRole('article', { name: 'Hyundai Creta' });

    expect(screen.getByRole('link', { name: 'My orders' })).toHaveAttribute('href', '#orders');
    await user.click(screen.getByRole('link', { name: 'My orders' }));

    expect(await screen.findByRole('heading', { name: 'Purchase history' })).toBeInTheDocument();
    expect(screen.queryByRole('article', { name: 'Hyundai Creta' })).not.toBeInTheDocument();
  });
});

describe('purchase history page', () => {
  it('shows a loading state, then every order with its details, newest first', async () => {
    renderAt('#orders', { purchases: orders, ordersDelay: 30 });

    expect(within(history()).getByText('Loading your orders…')).toBeInTheDocument();
    const list = await within(history()).findByRole('list', { name: 'Orders' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(2);

    const swift = within(items[0]!);
    expect(swift.getByRole('heading', { name: 'Maruti Suzuki Swift' })).toBeInTheDocument();
    expect(swift.getByText('INV-000002')).toBeInTheDocument();
    expect(swift.getByText('p2')).toBeInTheDocument();
    expect(swift.getByText('24 Oct 2026')).toBeInTheDocument();
    expect(swift.getByText('Hatchback')).toBeInTheDocument();
    const field = (label: string) => swift.getByText(label, { selector: 'dt' }).nextElementSibling;
    expect(field('Quantity')).toHaveTextContent('2');
    expect(field('Unit price')).toHaveTextContent('₹8,00,000');
    expect(field('Total')).toHaveTextContent('₹16,00,000');
    expect(within(history()).getByText('2 orders · ₹31,00,000 spent')).toBeInTheDocument();
  });

  it('shows an empty state with a way back to the inventory', async () => {
    renderAt('#orders');

    expect(await within(history()).findByText("You haven't bought any vehicles yet.")).toBeInTheDocument();
    expect(within(history()).getByRole('link', { name: 'Browse inventory' })).toHaveAttribute('href', '#inventory');
  });

  it('shows a recoverable error when orders cannot be loaded', async () => {
    const { api, user } = renderAt('#orders', {
      overrides: { 'GET /api/purchases': { status: 500, body: { error: 'Internal server error' } } },
    });

    expect(await within(history()).findByRole('alert')).toHaveTextContent("Couldn't load your orders: Internal server error");
    await user.click(within(history()).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(api.calls.filter((c) => c.path === '/api/purchases')).toHaveLength(2));
  });

  it('returns to sign-in when the session has expired', async () => {
    renderAt('#orders', { overrides: { 'GET /api/purchases': { status: 401, body: { error: 'Invalid or expired token' } } } });

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });

  it('includes an order just placed from the inventory', async () => {
    const { user } = renderAt('');
    await user.click(within(await screen.findByRole('article', { name: 'Hyundai Creta' })).getByRole('button', { name: 'Purchase' }));
    expect(await screen.findByRole('status')).toHaveTextContent('You purchased a Hyundai Creta (order INV-000001). 5 left in stock.');

    await user.click(screen.getByRole('link', { name: 'My orders' }));

    const items = within(await within(history()).findByRole('list', { name: 'Orders' })).getAllByRole('listitem');
    expect(items).toHaveLength(1);
    expect(within(items[0]!).getByText('INV-000001')).toBeInTheDocument();
  });
});

describe('invoice download', () => {
  let clicked: { href: string; download: string }[];

  beforeEach(() => {
    clicked = [];
    URL.createObjectURL = vi.fn(() => 'blob:invoice');
    URL.revokeObjectURL = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push({ href: this.href, download: this.download });
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('downloads the invoice file with the signed-in user\'s token', async () => {
    const { api, user } = renderAt('#orders', { purchases: orders, hold: ['invoice'] });
    const list = await within(history()).findByRole('list', { name: 'Orders' });

    await user.click(within(list).getByRole('button', { name: 'Download invoice INV-000001' }));

    expect(within(list).getByRole('button', { name: 'Download invoice INV-000001' })).toBeDisabled();
    api.release('invoice');
    await waitFor(() => expect(clicked).toEqual([{ href: 'blob:invoice', download: 'INV-000001.txt' }]));
    const call = api.calls.find((c) => c.path === '/api/purchases/p1/invoice')!;
    expect(call).toMatchObject({ method: 'GET', token: USER_TOKEN });
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0]![0] as Blob;
    expect(await blob.text()).toContain('INV-000001');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:invoice');
    await waitFor(() => expect(within(list).getByRole('button', { name: 'Download invoice INV-000001' })).toBeEnabled());
  });

  it('shows an error if the invoice cannot be downloaded', async () => {
    const { user } = renderAt('#orders', {
      purchases: orders,
      overrides: { 'GET /api/purchases/p1/invoice': { status: 404, body: { error: 'Order not found' } } },
    });
    const list = await within(history()).findByRole('list', { name: 'Orders' });

    await user.click(within(list).getByRole('button', { name: 'Download invoice INV-000001' }));

    expect(await within(history()).findByRole('alert')).toHaveTextContent("Couldn't download invoice INV-000001: Order not found");
    expect(clicked).toEqual([]);
  });
});

describe('buying several units', () => {
  it('lets the buyer choose a quantity on the details page, limited to the stock', async () => {
    const { api, user } = renderAt('#vehicle/v1');
    const details = await screen.findByRole('region', { name: 'Vehicle details' });

    const quantity = within(details).getByLabelText('Quantity');
    expect(quantity).toHaveAttribute('max', '6');
    await user.clear(quantity);
    await user.type(quantity, '2');
    expect(within(details).getByText('Total: ₹30,00,000')).toBeInTheDocument();
    await user.click(within(details).getByRole('button', { name: 'Purchase' }));

    expect(await within(details).findByText('4 in stock')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('You purchased 2 × Hyundai Creta (order INV-000001). 4 left in stock.');
    expect(api.calls.find((c) => c.path === '/api/vehicles/v1/purchase')).toMatchObject({ body: { quantity: 2 } });
    expect(quantity).toHaveValue(1);
  });

  it('disables Purchase and explains when the quantity is not available', async () => {
    const { api, user } = renderAt('#vehicle/v1');
    const details = await screen.findByRole('region', { name: 'Vehicle details' });

    const quantity = within(details).getByLabelText('Quantity');
    await user.clear(quantity);
    await user.type(quantity, '7');

    expect(within(details).getByText('Only 6 in stock')).toBeInTheDocument();
    expect(within(details).getByRole('button', { name: 'Purchase' })).toBeDisabled();
    expect(api.calls.some((c) => c.path.endsWith('/purchase'))).toBe(false);
  });
});
