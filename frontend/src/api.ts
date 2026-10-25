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
}
export type VehicleInput = Omit<Vehicle, 'id'>;
export interface Session { token: string; user: User }

/** An API error carrying the HTTP status and the server's error message. */
export class ApiError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

/** Sends a JSON request to the backend and returns the parsed body. */
async function request<T>(path: string, options: { method?: string; token?: string; body?: unknown } = {}): Promise<T> {
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

  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new ApiError(response.status, data?.error ?? `Request failed (${response.status})`);
  }
  return data as T;
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
  purchase: (token: string, id: string) =>
    request<{ vehicle: Vehicle }>(`/vehicles/${id}/purchase`, { method: 'POST', token }),
  restock: (token: string, id: string, quantity: number) =>
    request<{ vehicle: Vehicle }>(`/vehicles/${id}/restock`, { method: 'POST', token, body: { quantity } }),
};
