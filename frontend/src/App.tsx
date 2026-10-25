import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Session, type Vehicle, type VehicleInput } from './api';

const SESSION_KEY = 'dealership-session';

type Message = { kind: 'success' | 'error'; text: string } | null;

const input = 'border border-slate-300 rounded px-2 py-1 w-full';
const button = 'rounded px-3 py-1 font-medium disabled:opacity-40 disabled:cursor-not-allowed';
const primary = `${button} bg-blue-600 text-white hover:bg-blue-700`;
const secondary = `${button} bg-slate-200 hover:bg-slate-300`;
const danger = `${button} bg-red-600 text-white hover:bg-red-700`;

function loadSession(): Session | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null');
  } catch {
    return null;
  }
}

function Banner({ message }: { message: Message }) {
  if (!message) return null;
  const colors = message.kind === 'success' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800';
  return <p role="status" className={`rounded px-3 py-2 ${colors}`}>{message.text}</p>;
}

export function App() {
  const [session, setSession] = useState<Session | null>(loadSession);

  const signIn = (next: Session) => {
    localStorage.setItem(SESSION_KEY, JSON.stringify(next));
    setSession(next);
  };
  const signOut = () => {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
  };

  return (
    <main className="mx-auto max-w-5xl p-4 space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Car Dealership Inventory</h1>
        {session && (
          <div className="flex items-center gap-3 text-sm">
            <span>
              {session.user.email} ({session.user.role})
            </span>
            <button className={secondary} onClick={signOut}>Log out</button>
          </div>
        )}
      </header>
      {session ? <Inventory session={session} onSessionExpired={signOut} /> : <AuthForm onSignIn={signIn} />}
    </main>
  );
}

/** Login and registration form. Registration then logs the user in. */
function AuthForm({ onSignIn }: { onSignIn: (session: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      if (mode === 'register') await api.register(email, password);
      onSignIn(await api.login(email, password));
    } catch (error) {
      setMessage({ kind: 'error', text: (error as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mx-auto max-w-sm space-y-3 rounded bg-white p-6 shadow">
      <h2 className="text-xl font-semibold">{mode === 'login' ? 'Log in' : 'Create an account'}</h2>
      <Banner message={message} />
      <label className="block">
        Email
        <input className={input} type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
      </label>
      <label className="block">
        Password
        <input
          className={input}
          type="password"
          required
          minLength={mode === 'register' ? 8 : undefined}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button className={`${primary} w-full`} disabled={busy}>
        {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Register'}
      </button>
      <button
        type="button"
        className="w-full text-sm text-blue-700 underline"
        onClick={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          setMessage(null);
        }}
      >
        {mode === 'login' ? 'No account? Register' : 'Have an account? Log in'}
      </button>
    </form>
  );
}

const EMPTY_FORM = { make: '', model: '', category: '', price: '', quantity: '' };
const EMPTY_FILTERS = { make: '', model: '', category: '', minPrice: '', maxPrice: '' };

/** Inventory table with search, purchase and (for admins) management controls. */
function Inventory({ session, onSessionExpired }: { session: Session; onSessionExpired: () => void }) {
  const isAdmin = session.user.role === 'admin';
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<Message>(null);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);

  /** Shows an API failure; an expired or invalid session logs the user out. */
  const handleError = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) {
        onSessionExpired();
        return;
      }
      setMessage({ kind: 'error', text: (error as Error).message });
    },
    [onSessionExpired],
  );

  const load = useCallback(
    async (activeFilters = EMPTY_FILTERS) => {
      setLoading(true);
      try {
        const hasFilters = Object.values(activeFilters).some((v) => v.trim() !== '');
        const result = hasFilters
          ? await api.searchVehicles(session.token, activeFilters)
          : await api.listVehicles(session.token);
        setVehicles(result.vehicles);
      } catch (error) {
        handleError(error);
      } finally {
        setLoading(false);
      }
    },
    [session.token, handleError],
  );

  useEffect(() => {
    void load();
  }, [load]);

  /** Runs an action, then shows success and refreshes the list (current filters). */
  async function run(action: () => Promise<unknown>, success: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ kind: 'success', text: success });
      await load(filters);
    } catch (error) {
      handleError(error);
    }
  }

  async function saveVehicle(event: FormEvent) {
    event.preventDefault();
    const data: VehicleInput = {
      make: form.make,
      model: form.model,
      category: form.category,
      price: Number(form.price),
      quantity: Number(form.quantity),
    };
    await run(
      () => (editingId ? api.updateVehicle(session.token, editingId, data) : api.createVehicle(session.token, data)),
      editingId ? 'Vehicle updated.' : 'Vehicle added.',
    );
    setForm(EMPTY_FORM);
    setEditingId(null);
  }

  function startEdit(vehicle: Vehicle) {
    setEditingId(vehicle.id);
    setForm({ ...vehicle, price: String(vehicle.price), quantity: String(vehicle.quantity) });
  }

  function restock(vehicle: Vehicle) {
    const answer = window.prompt(`Add how many ${vehicle.make} ${vehicle.model}?`, '1');
    if (answer === null) return;
    void run(() => api.restock(session.token, vehicle.id, Number(answer)), 'Vehicle restocked.');
  }

  function remove(vehicle: Vehicle) {
    if (!window.confirm(`Delete ${vehicle.make} ${vehicle.model}?`)) return;
    void run(() => api.deleteVehicle(session.token, vehicle.id), 'Vehicle deleted.');
  }

  return (
    <div className="space-y-4">
      <Banner message={message} />

      <form
        className="grid grid-cols-2 gap-2 rounded bg-white p-4 shadow md:grid-cols-6"
        onSubmit={(e) => {
          e.preventDefault();
          void load(filters);
        }}
      >
        {(['make', 'model', 'category'] as const).map((field) => (
          <input
            key={field}
            className={input}
            placeholder={field[0]!.toUpperCase() + field.slice(1)}
            value={filters[field]}
            onChange={(e) => setFilters({ ...filters, [field]: e.target.value })}
          />
        ))}
        <input className={input} type="number" min="0" placeholder="Min price" value={filters.minPrice}
          onChange={(e) => setFilters({ ...filters, minPrice: e.target.value })} />
        <input className={input} type="number" min="0" placeholder="Max price" value={filters.maxPrice}
          onChange={(e) => setFilters({ ...filters, maxPrice: e.target.value })} />
        <div className="flex gap-2">
          <button className={primary}>Search</button>
          <button
            type="button"
            className={secondary}
            onClick={() => {
              setFilters(EMPTY_FILTERS);
              void load();
            }}
          >
            Clear
          </button>
        </div>
      </form>

      <div className="overflow-x-auto rounded bg-white shadow">
        <table className="w-full text-left">
          <thead className="bg-slate-200">
            <tr>
              {['Make', 'Model', 'Category', 'Price', 'In stock', 'Actions'].map((h) => (
                <th key={h} className="px-3 py-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={6} className="px-3 py-4 text-center">Loading vehicles…</td></tr>
            )}
            {!loading && vehicles.length === 0 && (
              <tr><td colSpan={6} className="px-3 py-4 text-center">No vehicles found.</td></tr>
            )}
            {!loading &&
              vehicles.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="px-3 py-2">{v.make}</td>
                  <td className="px-3 py-2">{v.model}</td>
                  <td className="px-3 py-2">{v.category}</td>
                  <td className="px-3 py-2">${v.price.toLocaleString()}</td>
                  <td className="px-3 py-2">{v.quantity}</td>
                  <td className="flex flex-wrap gap-2 px-3 py-2">
                    <button
                      className={primary}
                      disabled={v.quantity === 0}
                      onClick={() => void run(() => api.purchase(session.token, v.id), 'Purchase complete.')}
                    >
                      Purchase
                    </button>
                    {isAdmin && (
                      <>
                        <button className={secondary} onClick={() => startEdit(v)}>Edit</button>
                        <button className={secondary} onClick={() => restock(v)}>Restock</button>
                        <button className={danger} onClick={() => remove(v)}>Delete</button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {isAdmin && (
        <form onSubmit={saveVehicle} className="grid grid-cols-2 gap-2 rounded bg-white p-4 shadow md:grid-cols-6">
          <h2 className="col-span-2 font-semibold md:col-span-6">{editingId ? 'Edit vehicle' : 'Add a vehicle'}</h2>
          {(['make', 'model', 'category'] as const).map((field) => (
            <input key={field} className={input} required placeholder={field[0]!.toUpperCase() + field.slice(1)}
              value={form[field]} onChange={(e) => setForm({ ...form, [field]: e.target.value })} />
          ))}
          <input className={input} required type="number" min="0" step="0.01" placeholder="Price"
            value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
          <input className={input} required type="number" min="0" step="1" placeholder="Quantity"
            value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          <div className="flex gap-2">
            <button className={primary}>{editingId ? 'Save' : 'Add'}</button>
            {editingId && (
              <button type="button" className={secondary} onClick={() => { setEditingId(null); setForm(EMPTY_FORM); }}>
                Cancel
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
}
