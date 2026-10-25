/** Shapes returned by the backend API. */
export type Role = 'user' | 'admin';
export interface User { id: string; email: string; role: Role }
export interface Vehicle {
  id: string;
  make: string;
  model: string;
  category: string;
  price: number;
  quantity: number;
  /** Mean review rating (one decimal), or null when unreviewed. */
  averageRating: number | null;
  reviewCount: number;
  /** When the vehicle was listed (ISO 8601). */
  createdAt: string;
}
/** The fields an admin can set; the rest are computed by the server. */
export type VehicleInput = Pick<Vehicle, 'make' | 'model' | 'category' | 'price' | 'quantity'>;
export interface RatingSummary { averageRating: number | null; reviewCount: number }
export interface Review {
  id: string;
  rating: number;
  comment: string;
  /** Masked by the server, e.g. "b***@example.com". */
  author: string;
  isOwn: boolean;
  createdAt: string;
}
export interface ReviewInput { rating: number; comment: string }
/** A completed order. Prices and totals are calculated by the server. */
export interface Purchase {
  id: string;
  invoiceNumber: string;
  /** Null if the vehicle has since been deleted. */
  vehicleId: string | null;
  make: string;
  model: string;
  category: string;
  quantity: number;
  unitPrice: number;
  totalAmount: number;
  purchasedAt: string;
}
/** Admin dashboard figures, calculated by the server from stored data. */
export interface Analytics {
  range: { from: string | null; to: string | null };
  inventory: {
    vehicleModels: number;
    unitsInStock: number;
    outOfStockCount: number;
    inventoryValue: number;
    outOfStockVehicles: { id: string; make: string; model: string; category: string }[];
  };
  sales: {
    orderCount: number;
    unitsSold: number;
    revenue: number;
    topVehicles: { vehicleId: string | null; make: string; model: string; unitsSold: number; revenue: number }[];
  };
}
/** A file returned by the API, e.g. an invoice. */
export interface DownloadedFile { blob: Blob; filename: string }
export interface Session { token: string; user: User }

/** An API error carrying the HTTP status and the server's error message. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

interface RequestOptions { method?: string; token?: string; body?: unknown }

/** Sends a request to the backend; throws an ApiError for network failures and error statuses. */
async function send(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  if (options.token) headers['Authorization'] = `Bearer ${options.token}`;

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch {
    throw new ApiError(0, 'Cannot reach the server. Is the backend running?');
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(response.status, data?.error ?? `Request failed (${response.status})`);
  }
  return response;
}

/** Sends a JSON request to the backend and returns the parsed body. */
async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await send(path, options);
  if (response.status === 204) return undefined as T;
  return (await response.json().catch(() => null)) as T;
}

/** Downloads a file, taking its name from the Content-Disposition header. */
async function requestFile(path: string, token: string, fallbackName: string): Promise<DownloadedFile> {
  const response = await send(path, { token });
  const disposition = response.headers.get('Content-Disposition') ?? '';
  const filename = disposition.match(/filename="([^"]+)"/)?.[1] ?? fallbackName;
  return { blob: await response.blob(), filename };
}

export const api = {
  register: (email: string, password: string) =>
    request<{ user: User }>('/auth/register', { method: 'POST', body: { email, password } }),
  login: (email: string, password: string) =>
    request<Session>('/auth/login', { method: 'POST', body: { email, password } }),
  listVehicles: (token: string) => request<{ vehicles: Vehicle[] }>('/vehicles', { token }),
  searchVehicles: (token: string, filters: Record<string, string>) => {
    const query = new URLSearchParams(Object.entries(filters).filter(([, v]) => v.trim() !== ''));
    return request<{ vehicles: Vehicle[] }>(`/vehicles/search?${query}`, { token });
  },
  createVehicle: (token: string, input: VehicleInput) =>
    request<{ vehicle: Vehicle }>('/vehicles', { method: 'POST', token, body: input }),
  updateVehicle: (token: string, id: string, input: VehicleInput) =>
    request<{ vehicle: Vehicle }>(`/vehicles/${id}`, { method: 'PUT', token, body: input }),
  deleteVehicle: (token: string, id: string) =>
    request<void>(`/vehicles/${id}`, { method: 'DELETE', token }),
  /** Buys `quantity` units (1 if omitted). The server decides the price. */
  purchase: (token: string, id: string, quantity?: number) =>
    request<{ vehicle: Vehicle; purchase: Purchase }>(`/vehicles/${id}/purchase`, {
      method: 'POST',
      token,
      body: quantity === undefined ? undefined : { quantity },
    }),
  listPurchases: (token: string) => request<{ purchases: Purchase[] }>('/purchases', { token }),
  downloadInvoice: (token: string, order: Purchase) =>
    requestFile(`/purchases/${order.id}/invoice`, token, `${order.invoiceNumber}.txt`),
  listReviews: (token: string, vehicleId: string) =>
    request<{ reviews: Review[]; summary: RatingSummary }>(`/vehicles/${vehicleId}/reviews`, { token }),
  createReview: (token: string, vehicleId: string, input: ReviewInput) =>
    request<{ review: Review; summary: RatingSummary }>(`/vehicles/${vehicleId}/reviews`, { method: 'POST', token, body: input }),
  /** Admin only. Dates are YYYY-MM-DD, inclusive; empty means unbounded. */
  analytics: (token: string, range: { from: string; to: string }) => {
    const query = new URLSearchParams(Object.entries(range).filter(([, v]) => v !== '')).toString();
    return request<Analytics>(`/admin/analytics${query ? `?${query}` : ''}`, { token });
  },
  restock: (token: string, id: string, quantity: number) =>
    request<{ vehicle: Vehicle }>(`/vehicles/${id}/restock`, { method: 'POST', token, body: { quantity } }),
};
