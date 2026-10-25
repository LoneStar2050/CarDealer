import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, type RatingSummary, type Session, type Vehicle, type VehicleInput } from '../api';
import { useCompare } from '../hooks/useCompare';
import { useFavorites } from '../hooks/useFavorites';
import { DeleteDialog, RestockDialog, VehicleFormDialog } from './AdminDialogs';
import { priceRangeError, sortVehicles } from '../discovery';
import { CompareTray } from './CompareTray';
import { EMPTY_FILTERS, Filters, type FilterValues, type SortOrder } from './Filters';
import { InventoryStats } from './InventoryStats';
import { Hero } from './Layout';
import { StockTable } from './StockTable';
import { Reviews } from './Reviews';
import { NoticeBanner, Spinner, ui, type Notice } from './ui';
import { VehicleCard } from './VehicleCard';
import { VehicleDetails } from './VehicleDetails';

type AdminAction =
  | { type: 'add' }
  | { type: 'edit'; vehicle: Vehicle }
  | { type: 'restock'; vehicle: Vehicle }
  | { type: 'delete'; vehicle: Vehicle }
  | null;

const nameOf = (v: Vehicle) => `${v.make} ${v.model}`;

/** The details view lives at #vehicle/<id>, so it can be linked to and the Back button works. */
const detailsIdFromHash = () => window.location.hash.match(/^#vehicle\/(.+)$/)?.[1] ?? null;

/** Scrolls to a page section (e.g. #inventory) once it has been rendered. */
function scrollToHashTarget() {
  requestAnimationFrame(() => document.getElementById(window.location.hash.slice(1))?.scrollIntoView?.());
}
const hasFilters = (f: FilterValues) => Object.values(f).some((value) => value.trim() !== '');


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
  const [priceError, setPriceError] = useState<string | null>(null);
  const [purchasing, setPurchasing] = useState<Set<string>>(new Set());
  const pendingPurchases = useRef(new Set<string>());
  const [action, setAction] = useState<AdminAction>(null);
  const favorites = useFavorites(session.user.id);
  const [view, setView] = useState<'all' | 'favorites'>('all');
  const [detailsId, setDetailsId] = useState<string | null>(detailsIdFromHash);

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
    // Arriving from another page via #inventory or #manage: scroll there once rendered.
    void load(EMPTY_FILTERS).then(() => {
      if (window.location.hash && !detailsIdFromHash()) scrollToHashTarget();
    });
  }, [load]);

  // Follow the URL: #vehicle/<id> shows details; any other link (#inventory, #manage) shows the list.
  useEffect(() => {
    const onHashChange = () => {
      const id = detailsIdFromHash();
      setDetailsId(id);
      if (id) window.scrollTo?.({ top: 0 });
      else scrollToHashTarget();
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const categories = useMemo(
    () => [...new Set(all.map((v) => v.category))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [all],
  );
  const compare = useCompare(all);
  const sorted = useMemo(() => sortVehicles(results, sort), [results, sort]);
  const visible = view === 'favorites' ? sorted.filter((v) => favorites.isFavorite(v.id)) : sorted;
  // Only count favorites for vehicles that still exist.
  const favoriteCount = all.filter((v) => favorites.isFavorite(v.id)).length;
  const details = detailsId ? all.find((v) => v.id === detailsId) : undefined;

  function openDetails(id: string) {
    setDetailsId(id);
    window.location.hash = `vehicle/${id}`;
    window.scrollTo?.({ top: 0 });
  }

  function closeDetails() {
    setDetailsId(null);
    window.location.hash = 'inventory';
    scrollToHashTarget();
  }

  function changeFilters(next: FilterValues) {
    if (next.minPrice !== filters.minPrice || next.maxPrice !== filters.maxPrice) setPriceError(null);
    setFilters(next);
  }

  function applyFilters() {
    const error = priceRangeError(filters.minPrice, filters.maxPrice);
    setPriceError(error);
    if (error) return;
    setApplied(filters);
    void load(filters);
  }

  function clearFilters() {
    setPriceError(null);
    setFilters(EMPTY_FILTERS);
    setApplied(EMPTY_FILTERS);
    setSort('featured');
    void load(EMPTY_FILTERS);
  }

  /** Applies a changed vehicle to both the full list and the current results. */
  function replaceVehicle(id: string, change: (v: Vehicle) => Vehicle) {
    const replace = (list: Vehicle[]) => list.map((v) => (v.id === id ? change(v) : v));
    setAll(replace);
    setResults(replace);
  }

  const updateRating = useCallback(
    (id: string, summary: RatingSummary) => replaceVehicle(id, (v) => ({ ...v, ...summary })),
    [],
  );

  /** Buys `quantity` units (one from a card). Resolves true on success. */
  async function purchase(vehicle: Vehicle, quantity?: number): Promise<boolean> {
    if (pendingPurchases.current.has(vehicle.id)) return false; // ignore duplicate clicks
    pendingPurchases.current.add(vehicle.id);
    setPurchasing(new Set(pendingPurchases.current));
    setNotice(null);
    try {
      const result = await api.purchase(session.token, vehicle.id, quantity);
      const updated = result.vehicle;
      replaceVehicle(updated.id, () => updated);
      const bought = result.purchase.quantity === 1 ? `a ${nameOf(updated)}` : `${result.purchase.quantity} × ${nameOf(updated)}`;
      setNotice({
        kind: 'success',
        text: `You purchased ${bought} (order ${result.purchase.invoiceNumber}). ${updated.quantity} left in stock.`,
      });
      return true;
    } catch (error) {
      fail(error);
      return false;
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
  const noticeBanner = (
    <div className="sticky top-16 z-30 empty:hidden">
      <NoticeBanner notice={notice} onDismiss={() => setNotice(null)} />
    </div>
  );
  const compareTray = (
    <CompareTray vehicles={compare.selected} onRemove={compare.remove} onClear={compare.clear} />
  );
  const bottomPadding = compare.selected.length > 0 ? 'pb-28' : '';

  if (details) {
    return (
      <>
        <main className={`mx-auto max-w-7xl space-y-6 px-4 py-10 sm:px-6 ${bottomPadding}`}>
          {noticeBanner}
          <VehicleDetails
            vehicle={details}
            purchasing={purchasing.has(details.id)}
            favorite={favorites.isFavorite(details.id)}
            comparing={compare.isSelected(details.id)}
            compareFull={compare.isFull}
            onPurchase={(quantity) => purchase(details, quantity)}
            onToggleFavorite={() => favorites.toggle(details.id)}
            onToggleCompare={() => compare.toggle(details.id)}
            onBack={closeDetails}
          >
            <Reviews
              key={details.id}
              token={session.token}
              vehicleId={details.id}
              onSummaryChange={(summary) => updateRating(details.id, summary)}
              onSessionExpired={onSessionExpired}
            />
          </VehicleDetails>
        </main>
        {compareTray}
      </>
    );
  }

  return (
    <>
      <Hero vehicleCount={all.length} />

      <main className={`mx-auto max-w-7xl space-y-12 px-4 py-10 sm:px-6 ${bottomPadding}`}>
        {noticeBanner}

        <section id="inventory" className="scroll-mt-24 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Inventory</h2>
              <p className="text-sm text-slate-500">Search by make or model, filter by category and price.</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
                {(['all', 'favorites'] as const).map((option) => (
                  <button
                    key={option}
                    type="button"
                    aria-pressed={view === option}
                    className={`rounded-md px-3 py-1.5 text-sm font-semibold transition ${view === option ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'}`}
                    onClick={() => setView(option)}
                  >
                    {option === 'all' ? 'All vehicles' : `Favorites (${favoriteCount})`}
                  </button>
                ))}
              </div>
              <p className="text-sm font-semibold text-slate-700">{count} {count === 1 ? 'vehicle' : 'vehicles'}</p>
            </div>
          </div>

          <Filters
            values={filters}
            categories={categories}
            sort={sort}
            onChange={changeFilters}
            priceError={priceError}
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
                {view === 'favorites' && favoriteCount === 0
                  ? "You haven't saved any favorites yet."
                  : hasFilters(applied)
                    ? `No ${view === 'favorites' ? 'favorites' : 'vehicles'} match your filters.`
                    : 'No vehicles in the inventory yet.'}
              </p>
              {view === 'favorites' && favoriteCount === 0 ? (
                <button type="button" className={`${ui.button} ${ui.secondary} mt-4`} onClick={() => setView('all')}>Browse all vehicles</button>
              ) : (
                hasFilters(applied) && <p className="mt-1 text-sm text-slate-500">Try widening the price range or clearing the filters.</p>
              )}
            </div>
          ) : (
            <div className={`grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 ${loading ? 'opacity-60' : ''}`}>
              {visible.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  isAdmin={isAdmin}
                  purchasing={purchasing.has(v.id)}
                  favorite={favorites.isFavorite(v.id)}
                  comparing={compare.isSelected(v.id)}
                  compareFull={compare.isFull}
                  onPurchase={() => void purchase(v)}
                  onToggleFavorite={() => favorites.toggle(v.id)}
                  onToggleCompare={() => compare.toggle(v.id)}
                  onDetails={() => openDetails(v.id)}
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
            stats={<InventoryStats vehicles={all} />}
            vehicles={all}
            onAdd={() => setAction({ type: 'add' })}
            onRestock={(v) => setAction({ type: 'restock', vehicle: v })}
            onEdit={(v) => setAction({ type: 'edit', vehicle: v })}
          />
        )}
      </main>
      {compareTray}

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
