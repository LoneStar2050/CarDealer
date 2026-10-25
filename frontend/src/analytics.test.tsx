import { describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import { ADMIN_TOKEN, installFakeApi, purchase, signInAs, vehicle, type FakeApiOptions } from './test/fakeApi';

const creta = vehicle({ id: 'v1', make: 'Hyundai', model: 'Creta', category: 'SUV', price: 1500000, quantity: 3 });
const swift = vehicle({ id: 'v2', make: 'Maruti Suzuki', model: 'Swift', category: 'Hatchback', price: 800000, quantity: 0 });

const orders = [
  purchase({ id: 'p1', vehicleId: 'v2', make: 'Maruti Suzuki', model: 'Swift', quantity: 3, unitPrice: 800000, totalAmount: 2400000, purchasedAt: '2026-09-10T10:00:00.000Z' }),
  purchase({ id: 'p2', vehicleId: 'v1', make: 'Hyundai', model: 'Creta', quantity: 1, unitPrice: 1500000, totalAmount: 1500000, purchasedAt: '2026-10-05T10:00:00.000Z' }),
  purchase({ id: 'p3', vehicleId: 'v2', make: 'Maruti Suzuki', model: 'Swift', quantity: 1, unitPrice: 800000, totalAmount: 800000, purchasedAt: '2026-10-20T10:00:00.000Z' }),
];

function renderAt(hash: string, role: 'admin' | 'user', options: FakeApiOptions = {}) {
  window.location.hash = hash;
  signInAs(role);
  const api = installFakeApi({ vehicles: [creta, swift], purchases: orders, ...options });
  render(<App />);
  return { api, user: userEvent.setup() };
}

const dashboard = () => screen.getByRole('region', { name: 'Sales and inventory analytics' });
const metric = (name: string) => within(within(dashboard()).getByRole('group', { name })).getByText(/./, { selector: 'dd' });
const analyticsCalls = (api: ReturnType<typeof renderAt>['api']) => api.calls.filter((c) => c.path.startsWith('/api/admin/analytics'));

describe('admin analytics navigation', () => {
  it('shows the Analytics link to admins only', async () => {
    renderAt('', 'admin');
    await screen.findByRole('article', { name: 'Hyundai Creta' });
    expect(screen.getByRole('link', { name: 'Analytics' })).toHaveAttribute('href', '#analytics');
  });

  it('hides the Analytics link from regular users', async () => {
    renderAt('', 'user');
    await screen.findByRole('article', { name: 'Hyundai Creta' });
    expect(screen.queryByRole('link', { name: 'Analytics' })).not.toBeInTheDocument();
  });
});

describe('admin analytics dashboard', () => {
  it('shows sales and inventory figures from the API, with a loading state first', async () => {
    const { api } = renderAt('#analytics', 'admin', { ordersDelay: 30 });

    expect(within(dashboard()).getByText('Loading analytics…')).toBeInTheDocument();
    await within(dashboard()).findByRole('group', { name: 'Revenue' });

    expect(metric('Revenue')).toHaveTextContent('₹47,00,000');
    expect(metric('Orders')).toHaveTextContent('3');
    expect(metric('Units sold')).toHaveTextContent('5');
    expect(metric('Units in stock')).toHaveTextContent('3');
    expect(metric('Out-of-stock models')).toHaveTextContent('1');
    expect(metric('Inventory value')).toHaveTextContent('₹45,00,000');

    const top = within(dashboard()).getByRole('table', { name: 'Top-selling vehicles' });
    const rows = within(top).getAllByRole('row').slice(1).map((r) => within(r).getAllByRole('cell').map((c) => c.textContent));
    expect(rows).toEqual([
      ['4', '₹32,00,000'],
      ['1', '₹15,00,000'],
    ]);
    expect(within(top).getAllByRole('rowheader').map((h) => h.textContent)).toEqual(['Maruti Suzuki Swift', 'Hyundai Creta']);

    const outOfStock = within(dashboard()).getByRole('list', { name: 'Out-of-stock vehicles' });
    expect(within(outOfStock).getAllByRole('listitem').map((i) => i.textContent)).toEqual(['Maruti Suzuki Swift (Hatchback)']);

    expect(analyticsCalls(api)[0]).toMatchObject({ path: '/api/admin/analytics', token: ADMIN_TOKEN });
  });

  it('filters sales by an inclusive date range', async () => {
    const { api, user } = renderAt('#analytics', 'admin');
    await within(dashboard()).findByRole('group', { name: 'Revenue' });

    await user.type(within(dashboard()).getByLabelText('From'), '2026-10-01');
    await user.type(within(dashboard()).getByLabelText('To'), '2026-10-20');
    await user.click(within(dashboard()).getByRole('button', { name: 'Apply dates' }));

    await waitFor(() => expect(metric('Revenue')).toHaveTextContent('₹23,00,000'));
    expect(metric('Orders')).toHaveTextContent('2');
    expect(analyticsCalls(api).at(-1)!.path).toBe('/api/admin/analytics?from=2026-10-01&to=2026-10-20');
    expect(within(dashboard()).getByText('Sales from 1 Oct 2026 to 20 Oct 2026')).toBeInTheDocument();

    await user.click(within(dashboard()).getByRole('button', { name: 'All time' }));
    await waitFor(() => expect(metric('Orders')).toHaveTextContent('3'));
    expect(within(dashboard()).getByLabelText('From')).toHaveValue('');
  });

  it('rejects a start date after the end date without calling the API', async () => {
    const { api, user } = renderAt('#analytics', 'admin');
    await within(dashboard()).findByRole('group', { name: 'Revenue' });

    await user.type(within(dashboard()).getByLabelText('From'), '2026-10-20');
    await user.type(within(dashboard()).getByLabelText('To'), '2026-10-01');
    await user.click(within(dashboard()).getByRole('button', { name: 'Apply dates' }));

    expect(within(dashboard()).getByText('The start date must not be after the end date')).toBeInTheDocument();
    expect(analyticsCalls(api)).toHaveLength(1);
  });

  it('shows an empty state when there are no sales in the period', async () => {
    renderAt('#analytics', 'admin', { purchases: [] });

    expect(await within(dashboard()).findByText('No sales in this period.')).toBeInTheDocument();
    expect(metric('Revenue')).toHaveTextContent('₹0');
  });

  it('shows a recoverable error when analytics cannot be loaded', async () => {
    const { api, user } = renderAt('#analytics', 'admin', {
      overrides: { 'GET /api/admin/analytics': { status: 500, body: { error: 'Internal server error' } } },
    });

    expect(await within(dashboard()).findByRole('alert')).toHaveTextContent("Couldn't load analytics: Internal server error");
    await user.click(within(dashboard()).getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(analyticsCalls(api)).toHaveLength(2));
  });
});

describe('analytics access control', () => {
  it('tells a regular user they cannot view analytics and never requests them', async () => {
    const { api } = renderAt('#analytics', 'user');

    const denied = await screen.findByRole('region', { name: 'Access denied' });
    expect(within(denied).getByText('Analytics are only available to administrators.')).toBeInTheDocument();
    expect(within(denied).getByRole('link', { name: 'Back to inventory' })).toHaveAttribute('href', '#inventory');
    expect(analyticsCalls(api)).toHaveLength(0);
  });

  it('shows access denied if the server refuses (403)', async () => {
    renderAt('#analytics', 'admin', {
      overrides: { 'GET /api/admin/analytics': { status: 403, body: { error: 'Admin access required' } } },
    });

    expect(await screen.findByRole('region', { name: 'Access denied' })).toBeInTheDocument();
  });

  it('returns to sign-in when the session has expired', async () => {
    renderAt('#analytics', 'admin', {
      overrides: { 'GET /api/admin/analytics': { status: 401, body: { error: 'Invalid or expired token' } } },
    });

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
  });
});
