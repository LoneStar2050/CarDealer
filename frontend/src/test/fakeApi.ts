import { vi } from 'vitest';
import type { Purchase, Review, Vehicle } from '../api';

/**
 * A small in-memory stand-in for the backend, used only by tests. It mirrors
 * the real API's routes, status codes and { error } bodies so the UI can be
 * tested end to end without a server. The live app always uses the real API.
 */
export interface FakeApiOptions {
  vehicles?: Vehicle[];
  /** Force a status/body for a "METHOD /path" key, e.g. "POST /api/vehicles/v1/purchase". */
  overrides?: Record<string, { status: number; body?: unknown }>;
  /** Requests that wait until the test calls release(kind), to observe pending states without timing races. */
  hold?: HoldKind[];
  /** Existing reviews per vehicle id. */
  reviews?: Record<string, Review[]>;
  /** Orders that already exist for the signed-in user. */
  purchases?: Purchase[];
  /** Delay (ms) before responding to order-history and invoice requests. */
  ordersDelay?: number;
}

/** Kinds of request a test can hold: loading reviews, posting a review, purchasing, downloading an invoice. */
export type HoldKind = 'loadReviews' | 'postReview' | 'purchase' | 'invoice';

export interface FakeApi {
  vehicles: Vehicle[];
  reviews: Record<string, Review[]>;
  purchases: Purchase[];
  calls: { method: string; path: string; body: unknown; token: string | null }[];
  /** Lets held requests of this kind (see FakeApiOptions.hold) respond. */
  release: (kind: HoldKind) => void;
}

export const ADMIN_TOKEN = 'admin-token';
export const USER_TOKEN = 'user-token';

export function vehicle(overrides: Partial<Vehicle> = {}): Vehicle {
  return {
    id: overrides.id ?? `v-${Math.random().toString(36).slice(2, 8)}`,
    make: 'Hyundai',
    model: 'Creta',
    category: 'SUV',
    price: 1500000,
    quantity: 6,
    averageRating: null,
    reviewCount: 0,
    createdAt: '2026-10-01T10:00:00.000Z',
    ...overrides,
  };
}

/** Stores a logged-in session the same way the app does after login. */
export function signInAs(role: 'admin' | 'user') {
  localStorage.setItem(
    'dealership-session',
    JSON.stringify({
      token: role === 'admin' ? ADMIN_TOKEN : USER_TOKEN,
      user: { id: `${role}-id`, email: `${role}@example.com`, role },
    }),
  );
}

export function purchase(overrides: Partial<Purchase> = {}): Purchase {
  return {
    id: `p-${Math.random().toString(36).slice(2, 8)}`,
    invoiceNumber: 'INV-000001',
    vehicleId: 'v1',
    make: 'Hyundai',
    model: 'Creta',
    category: 'SUV',
    quantity: 1,
    unitPrice: 1500000,
    totalAmount: 1500000,
    purchasedAt: '2026-10-22T11:15:00.000Z',
    ...overrides,
  };
}

export function review(overrides: Partial<Review> = {}): Review {
  return {
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    rating: 4,
    comment: 'Great car.',
    author: 'o***@example.com',
    isOwn: false,
    createdAt: '2026-10-20T09:30:00.000Z',
    ...overrides,
  };
}

/** Mean rating rounded to one decimal, as the backend computes it. */
const summaryOf = (reviews: Review[]) => ({
  averageRating: reviews.length ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10 : null,
  reviewCount: reviews.length,
});

export function installFakeApi(options: FakeApiOptions = {}): FakeApi {
  const gates = new Map<HoldKind, () => void>();
  const held = new Map<HoldKind, Promise<void>>();
  for (const kind of options.hold ?? []) held.set(kind, new Promise((resolve) => gates.set(kind, resolve)));
  // Copy each vehicle so state changes (purchases, edits) never leak between tests.
  const api: FakeApi = {
    vehicles: (options.vehicles ?? []).map((v) => ({ ...v })),
    reviews: Object.fromEntries(Object.entries(options.reviews ?? {}).map(([id, list]) => [id, list.map((r) => ({ ...r }))])),
    purchases: (options.purchases ?? []).map((p) => ({ ...p })),
    calls: [],
    release: (kind) => gates.get(kind)?.(),
  };
  const json = (status: number, body?: unknown) =>
    new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json' },
    });

  vi.stubGlobal('fetch', async (input: string, init: RequestInit = {}) => {
    const url = new URL(input, 'http://localhost');
    const method = init.method ?? 'GET';
    const body = init.body ? JSON.parse(String(init.body)) : undefined;
    const auth = new Headers(init.headers).get('Authorization');
    const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
    api.calls.push({ method, path: url.pathname + url.search, body, token });

    const override = options.overrides?.[`${method} ${url.pathname}`];
    if (override) return json(override.status, override.body);

    const path = url.pathname;
    if (path === '/api/auth/login' && method === 'POST') {
      if (body.password !== 'correct-password') return json(401, { error: 'Invalid email or password' });
      const role = body.email.startsWith('admin') ? 'admin' : 'user';
      return json(200, {
        token: role === 'admin' ? ADMIN_TOKEN : USER_TOKEN,
        user: { id: `${role}-id`, email: body.email, role },
      });
    }
    if (path === '/api/auth/register' && method === 'POST') {
      return json(201, { user: { id: 'new-id', email: body.email, role: 'user' } });
    }

    if (!path.startsWith('/api/')) return json(404, { error: 'Not found' });
    if (token !== ADMIN_TOKEN && token !== USER_TOKEN) return json(401, { error: 'Authentication required' });

    if (path.startsWith('/api/purchases')) {
      if (options.ordersDelay) await new Promise((r) => setTimeout(r, options.ordersDelay));
      if (path === '/api/purchases' && method === 'GET') return json(200, { purchases: api.purchases });
      const invoice = path.match(/^\/api\/purchases\/([^/]+)\/invoice$/);
      const order = invoice && api.purchases.find((p) => p.id === invoice[1]);
      if (!order) return json(404, { error: 'Order not found' });
      await held.get('invoice');
      return new Response(`PRESTIGE MOTORS\nINVOICE\nInvoice number: ${order.invoiceNumber}\n`, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${order.invoiceNumber}.txt"`,
        },
      });
    }
    if (path === '/api/admin/analytics' && method === 'GET') {
      if (token !== ADMIN_TOKEN) return json(403, { error: 'Admin access required' });
      if (options.ordersDelay) await new Promise((r) => setTimeout(r, options.ordersDelay));
      // Same calculations as the backend, over the fake's vehicles and orders.
      const from = url.searchParams.get('from');
      const to = url.searchParams.get('to');
      const day = (iso: string) => iso.slice(0, 10);
      const sold = api.purchases.filter((p) => (!from || day(p.purchasedAt) >= from) && (!to || day(p.purchasedAt) <= to));
      const top = new Map<string, { vehicleId: string | null; make: string; model: string; unitsSold: number; revenue: number }>();
      for (const p of sold) {
        const key = `${p.vehicleId}|${p.make}|${p.model}`;
        const entry = top.get(key) ?? { vehicleId: p.vehicleId, make: p.make, model: p.model, unitsSold: 0, revenue: 0 };
        entry.unitsSold += p.quantity;
        entry.revenue += p.totalAmount;
        top.set(key, entry);
      }
      const outOfStock = api.vehicles.filter((v) => v.quantity === 0);
      return json(200, {
        range: { from, to },
        inventory: {
          vehicleModels: api.vehicles.length,
          unitsInStock: api.vehicles.reduce((n, v) => n + v.quantity, 0),
          outOfStockCount: outOfStock.length,
          inventoryValue: api.vehicles.reduce((n, v) => n + v.price * v.quantity, 0),
          outOfStockVehicles: outOfStock.map(({ id, make, model, category }) => ({ id, make, model, category })),
        },
        sales: {
          orderCount: sold.length,
          unitsSold: sold.reduce((n, p) => n + p.quantity, 0),
          revenue: sold.reduce((n, p) => n + p.totalAmount, 0),
          topVehicles: [...top.values()].sort((a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue).slice(0, 5),
        },
      });
    }
    if (!path.startsWith('/api/vehicles')) return json(404, { error: 'Not found' });
    const isAdmin = token === ADMIN_TOKEN;
    const forbidden = () => json(403, { error: 'Admin access required' });

    if (path === '/api/vehicles' && method === 'GET') return json(200, { vehicles: api.vehicles });
    if (path === '/api/vehicles/search' && method === 'GET') {
      const q = url.searchParams;
      const has = (field: string, value: string) => !q.get(field) || value.toLowerCase().includes(q.get(field)!.toLowerCase());
      const results = api.vehicles.filter(
        (v) =>
          has('make', v.make) &&
          has('model', v.model) &&
          has('category', v.category) &&
          (!q.get('minPrice') || v.price >= Number(q.get('minPrice'))) &&
          (!q.get('maxPrice') || v.price <= Number(q.get('maxPrice'))) &&
          (q.get('availability') !== 'in_stock' || v.quantity > 0) &&
          (q.get('availability') !== 'out_of_stock' || v.quantity === 0),
      );
      return json(200, { vehicles: results });
    }
    if (path === '/api/vehicles' && method === 'POST') {
      if (!isAdmin) return forbidden();
      const created = { id: `v-new-${api.vehicles.length}`, ...body };
      api.vehicles.push(created);
      return json(201, { vehicle: created });
    }

    const reviewsMatch = path.match(/^\/api\/vehicles\/([^/]+)\/reviews$/);
    if (reviewsMatch) {
      const id = reviewsMatch[1]!;
      const reviewed = api.vehicles.find((v) => v.id === id);
      await held.get(method === 'POST' ? 'postReview' : 'loadReviews');
      if (!reviewed) return json(404, { error: 'Vehicle not found' });
      const list = (api.reviews[id] ??= []);
      if (method === 'GET') return json(200, { reviews: list, summary: summaryOf(list) });
      if (method === 'POST') {
        if (list.some((r) => r.isOwn)) return json(409, { error: 'You have already reviewed this vehicle' });
        const created = review({ id: `r-new-${list.length}`, rating: body.rating, comment: body.comment.trim(), author: 'y***@example.com', isOwn: true, createdAt: new Date().toISOString() });
        list.unshift(created);
        Object.assign(reviewed, summaryOf(list));
        return json(201, { review: created, summary: summaryOf(list) });
      }
    }

    const match = path.match(/^\/api\/vehicles\/([^/]+)(?:\/(purchase|restock))?$/);
    const target = match && api.vehicles.find((v) => v.id === match[1]);
    if (!match || !target) return json(404, { error: 'Vehicle not found' });
    const action = match[2];

    if (action === 'purchase' && method === 'POST') {
      await held.get('purchase');
      const quantity = body?.quantity ?? 1;
      if (target.quantity === 0) return json(409, { error: 'Vehicle is out of stock' });
      if (target.quantity < quantity) return json(409, { error: `Only ${target.quantity} units in stock` });
      target.quantity -= quantity;
      const order = purchase({
        id: `p-new-${api.purchases.length}`,
        invoiceNumber: `INV-${String(api.purchases.length + 1).padStart(6, '0')}`,
        vehicleId: target.id,
        make: target.make,
        model: target.model,
        category: target.category,
        quantity,
        unitPrice: target.price,
        totalAmount: target.price * quantity,
        purchasedAt: new Date().toISOString(),
      });
      api.purchases.unshift(order);
      return json(200, { vehicle: { ...target }, purchase: order });
    }
    if (!isAdmin) return forbidden();
    if (action === 'restock' && method === 'POST') {
      target.quantity += body.quantity;
      return json(200, { vehicle: { ...target } });
    }
    if (!action && method === 'PUT') {
      Object.assign(target, body);
      return json(200, { vehicle: { ...target } });
    }
    if (!action && method === 'DELETE') {
      api.vehicles = api.vehicles.filter((v) => v !== target);
      return new Response(null, { status: 204 });
    }
    return json(404, { error: 'Not found' });
  });
  return api;
}
