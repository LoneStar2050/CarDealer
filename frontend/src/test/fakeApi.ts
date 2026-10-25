import { vi } from 'vitest';
import type { Vehicle } from '../api';

/**
 * A small in-memory stand-in for the backend, used only by tests. It mirrors
 * the real API's routes, status codes and { error } bodies so the UI can be
 * tested end to end without a server. The live app always uses the real API.
 */
export interface FakeApiOptions {
  vehicles?: Vehicle[];
  /** Force a status/body for a "METHOD /path" key, e.g. "POST /api/vehicles/v1/purchase". */
  overrides?: Record<string, { status: number; body?: unknown }>;
  /** Delay (ms) before responding to purchases, to observe pending states. */
  purchaseDelay?: number;
}

export interface FakeApi {
  vehicles: Vehicle[];
  calls: { method: string; path: string; body: unknown; token: string | null }[];
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

export function installFakeApi(options: FakeApiOptions = {}): FakeApi {
  // Copy each vehicle so state changes (purchases, edits) never leak between tests.
  const api: FakeApi = { vehicles: (options.vehicles ?? []).map((v) => ({ ...v })), calls: [] };
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

    if (!path.startsWith('/api/vehicles')) return json(404, { error: 'Not found' });
    if (token !== ADMIN_TOKEN && token !== USER_TOKEN) return json(401, { error: 'Authentication required' });
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
          (!q.get('maxPrice') || v.price <= Number(q.get('maxPrice'))),
      );
      return json(200, { vehicles: results });
    }
    if (path === '/api/vehicles' && method === 'POST') {
      if (!isAdmin) return forbidden();
      const created = { id: `v-new-${api.vehicles.length}`, ...body };
      api.vehicles.push(created);
      return json(201, { vehicle: created });
    }

    const match = path.match(/^\/api\/vehicles\/([^/]+)(?:\/(purchase|restock))?$/);
    const target = match && api.vehicles.find((v) => v.id === match[1]);
    if (!match || !target) return json(404, { error: 'Vehicle not found' });
    const action = match[2];

    if (action === 'purchase' && method === 'POST') {
      if (options.purchaseDelay) await new Promise((r) => setTimeout(r, options.purchaseDelay));
      if (target.quantity === 0) return json(409, { error: 'Vehicle is out of stock' });
      target.quantity -= 1;
      return json(200, { vehicle: { ...target } });
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
