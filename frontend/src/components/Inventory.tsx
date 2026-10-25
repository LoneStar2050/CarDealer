import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type Session, type Vehicle, type VehicleInput } from '../api';
import { DeleteDialog, RestockDialog, VehicleFormDialog } from './AdminDialogs';
import { EMPTY_FILTERS, Filters, type FilterValues, type SortOrder } from './Filters';
import { Hero } from './Layout';
import { StockTable } from './StockTable';
import { NoticeBanner, Spinner, type Notice } from './ui';
import { VehicleCard } from './VehicleCard';

type AdminAction =
  | { type: 'add' }
  | { type: 'edit'; vehicle: Vehicle }
  | { type: 'restock'; vehicle: Vehicle }
  | { type: 'delete'; vehicle: Vehicle }
  | null;

const nameOf = (v: Vehicle) => `${v.make} ${v.model}`;
const hasFilters = (f: FilterValues) => Object.values(f).some((value) => value.trim() !== '');

function sortVehicles(vehicles: Vehicle[], sort: SortOrder): Vehicle[] {
  const sorted = [...vehicles];
  if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
  if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
  if (sort === 'name') sorted.sort((a, b) => nameOf(a).localeCompare(nameOf(b)));
  return sorted;
}

/** The signed-in experience: hero, inventory grid with filters, and admin management. */
export function Inventory({ session, onSessionExpired }: { session: Session; onSessionExpired: () => void }) {
  const isAdmin = session.user.role === 'admin';
  const [all, setAll] = useState<Vehicle[]>([]);
  const [results, setResults] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<Notice>(null);
  const [filters, setFilters] = useState<FilterValues>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<FilterValues>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortOrder>('featured');
  const [purchasing, setPurchasing] = useState<Set<string>>(new Set());
  const pendingPurchases = useRef(new Set<string>());
  const [action, setAction] = useState<AdminAction>(null);

  /** Shows an API failure; an expired or invalid session sends the user back to sign in. */
  const fail = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError && error.status === 401) onSessionExpired();
      else setNotice({ kind: 'error', text: (error as Error).message });
    },
    [onSessionExpired],
  );

  /** Reloads the full list and, if filters are applied, the filtered results. */
  const load = useCallback(
    async (active: FilterValues) => {
      setLoading(true);
      try {
        const everything = (await api.listVehicles(session.token)).vehicles;
        setAll(everything);
        setResults(hasFilters(active) ? (await api.searchVehicles(session.token, { ...active })).vehicles : everything);
      } catch (error) {
        fail(error);
      } finally {
        setLoading(false);
      }
    },
    [session.token, fail],
  );

  useEffect(() => {
    void load(EMPTY_FILTERS);
  }, [load]);

  const categories = useMemo(
    () => [...new Set(all.map((v) => v.category))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [all],
  );
  const visible = useMemo(() => sortVehicles(results, sort), [results, sort]);

  function applyFilters() {
    setApplied(filters);
    void load(filters);
  }

  function clearFilters() {
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setSort('featured');
    void load(EMPTY_FILTERS);
  }

  async function purchase(vehicle: Vehicle) {
    if (pendingPurchases.current.has(vehicle.id)) return; // ignore duplicate clicks
    pendingPurchases.current.add(vehicle.id);
    setPurchasing(new Set(pendingPurchases.current));
    setNotice(null);
    try {
      const updated = (await api.purchase(session.token, vehicle.id)).vehicle;
      const replace = (list: Vehicle[]) => list.map((v) => (v.id === updated.id ? updated : v));
      setAll(replace);
      setResults(replace);
      setNotice({ kind: 'success', text: `You purchased a ${nameOf(updated)}. ${updated.quantity} left in stock.` });
    } catch (error) {
      fail(error);
    } finally {
      pendingPurchases.current.delete(vehicle.id);
      setPurchasing(new Set(pendingPurchases.current));
    }
  }

  /** Runs an admin request; on success closes the dialog, shows a message and reloads. */
  async function runAdmin(request: () => Promise<unknown>, success: string): Promise<boolean> {
    setNotice(null);
    try {
      await request();
      setAction(null);
      setNotice({ kind: 'success', text: success });
      await load(applied);
      return true;
    } catch (error) {
      setAction(null);
      fail(error);
      return false;
    }
  }

  const saveVehicle = (input: VehicleInput) =>
    action?.type === 'edit'
      ? runAdmin(() => api.updateVehicle(session.token, action.vehicle.id, input), `${input.make} ${input.model} was updated.`)
      : runAdmin(() => api.createVehicle(session.token, input), `${input.make} ${input.model} was added.`);

  const count = visible.length;

  return (
    <>
      <Hero vehicleCount={all.length} />

      <main className="mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6">
        <div className="sticky top-16 z-30 empty:hidden">
          <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />
        </div>

        <section id="inventory" className="scroll-mt-24 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Inventory</h2>
              <p className="text-sm text-slate-500">Search by make or model, filter by category and price.</p>
            </div>
            <p className="text-sm font-semibold text-slate-700">{count} {count === 1 ? 'vehicle' : 'vehicles'}</p>
          </div>

          <Filters
            values={filters}
            categories={categories}
            sort={sort}
            onChange={setFilters}
            onSortChange={setSort}
            onApply={applyFilters}
            onClear={clearFilters}
          />

          {loading && results.length === 0 ? (
            <div className="flex items-center justify-center gap-3 rounded-2xl bg-white py-20 text-slate-500 ring-1 ring-slate-200">
              <Spinner className="h-6 w-6" /> Loading inventory…
            </div>
          ) : count === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-300 bg-white py-16 text-center">
              <p className="text-lg font-semibold text-slate-700">
                {hasFilters(applied) ? 'No vehicles match your filters.' : 'No vehicles in the inventory yet.'}
              </p>
              {hasFilters(applied) && <p className="mt-1 text-sm text-slate-500">Try widening the price range or clearing the filters.</p>}
            </div>
          ) : (
            <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
              {visible.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  isAdmin={isAdmin}
                  purchasing={purchasing.has(v.id)}
                  onPurchase={() => void purchase(v)}
                  onEdit={() => setAction({ type: 'edit', vehicle: v })}
                  onRestock={() => setAction({ type: 'restock', vehicle: v })}
                  onDelete={() => setAction({ type: 'delete', vehicle: v })}
                />
              ))}
            </div>
          )}
        </section>

        {isAdmin && (
          <StockTable
            vehicles={all}
            onAdd={() => setAction({ type: 'add' })}
            onRestock={(v) => setAction({ type: 'restock', vehicle: v })}
            onEdit={(v) => setAction({ type: 'edit', vehicle: v })}
          />
        )}
      </main>

      {isAdmin && (action?.type === 'add' || action?.type === 'edit') && (
        <VehicleFormDialog
          vehicle={action.type === 'edit' ? action.vehicle : null}
          categories={categories}
          onSave={saveVehicle}
          onClose={() => setAction(null)}
        />
      )}
      {isAdmin && action?.type === 'restock' && (
        <RestockDialog
          vehicle={action.vehicle}
          onRestock={(quantity) =>
            runAdmin(() => api.restock(session.token, action.vehicle.id, quantity), `${nameOf(action.vehicle)} restocked (+${quantity}).`)
          }
          onClose={() => setAction(null)}
        />
      )}
      {isAdmin && action?.type === 'delete' && (
        <DeleteDialog
          vehicle={action.vehicle}
          onConfirm={() => runAdmin(() => api.deleteVehicle(session.token, action.vehicle.id), `${nameOf(action.vehicle)} was deleted.`)}
          onClose={() => setAction(null)}
        />
      )}
    </>
  );
}
