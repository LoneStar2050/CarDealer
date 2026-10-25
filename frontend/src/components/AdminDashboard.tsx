import { useCallback, useEffect, useState, type FormEvent } from 'react';
import { api, ApiError, type Analytics, type Session } from '../api';
import { formatDay, formatRupees } from '../format';
import { AccessDenied } from './Layout';
import { Spinner, ui } from './ui';

export const ANALYTICS_DENIED = 'Analytics are only available to administrators.';

type State =
  | { status: 'loading' }
  | { status: 'denied' }
  | { status: 'error'; message: string }
  | { status: 'ready'; analytics: Analytics };

interface DateRange { from: string; to: string }
const ALL_TIME: DateRange = { from: '', to: '' };

function rangeLabel({ from, to }: Analytics['range']): string {
  if (from && to) return `Sales from ${formatDay(from)} to ${formatDay(to)}`;
  if (from) return `Sales since ${formatDay(from)}`;
  if (to) return `Sales up to ${formatDay(to)}`;
  return 'All-time sales';
}

/** Admin-only sales and inventory dashboard at #analytics. Every figure comes from the API. */
export function AdminDashboard({ session, onSessionExpired }: { session: Session; onSessionExpired: () => void }) {
  const [state, setState] = useState<State>({ status: 'loading' });
  const [dates, setDates] = useState<DateRange>(ALL_TIME);
  const [dateError, setDateError] = useState<string | null>(null);

  const load = useCallback(
    async (range: DateRange) => {
      setState((current) => (current.status === 'ready' ? current : { status: 'loading' }));
      try {
        setState({ status: 'ready', analytics: await api.analytics(session.token, range) });
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) onSessionExpired();
        else if (error instanceof ApiError && error.status === 403) setState({ status: 'denied' });
        else setState({ status: 'error', message: (error as Error).message });
      }
    },
    [session.token, onSessionExpired],
  );

  useEffect(() => {
    void load(ALL_TIME);
  }, [load]);

  function apply(event: FormEvent) {
    event.preventDefault();
    // ISO dates compare correctly as strings.
    if (dates.from && dates.to && dates.from > dates.to) {
      setDateError('The start date must not be after the end date');
      return;
    }
    setDateError(null);
    void load(dates);
  }

  function reset() {
    setDates(ALL_TIME);
    setDateError(null);
    void load(ALL_TIME);
  }

  if (state.status === 'denied') return <AccessDenied message={ANALYTICS_DENIED} />;

  return (
    <main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <section aria-label="Sales and inventory analytics" className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Sales &amp; inventory analytics</h2>
            <p className="text-sm text-slate-500">
              {state.status === 'ready' ? rangeLabel(state.analytics.range) : 'Calculated from recorded orders and the live inventory.'}
            </p>
          </div>
          <form onSubmit={apply} noValidate className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="analytics-from" className={ui.label}>From</label>
              <input id="analytics-from" type="date" className={ui.input} value={dates.from} max={dates.to || undefined}
                aria-invalid={dateError ? true : undefined} aria-describedby={dateError ? 'analytics-date-error' : undefined}
                onChange={(e) => setDates({ ...dates, from: e.target.value })} />
            </div>
            <div>
              <label htmlFor="analytics-to" className={ui.label}>To</label>
              <input id="analytics-to" type="date" className={ui.input} value={dates.to} min={dates.from || undefined}
                onChange={(e) => setDates({ ...dates, to: e.target.value })} />
            </div>
            <button type="submit" className={`${ui.button} ${ui.primary}`}>Apply dates</button>
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={reset}>All time</button>
            {dateError && <p id="analytics-date-error" className={`${ui.fieldError} w-full`}>{dateError}</p>}
          </form>
        </div>

        {state.status === 'loading' && (
          <div className="flex items-center justify-center gap-3 rounded-2xl bg-white py-16 text-slate-500 ring-1 ring-slate-200">
            <Spinner className="h-6 w-6" /> Loading analytics…
          </div>
        )}

        {state.status === 'error' && (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            <span>Couldn't load analytics: {state.message}</span>
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => void load(dates)}>Try again</button>
          </div>
        )}

        {state.status === 'ready' && <AnalyticsBody analytics={state.analytics} />}
      </section>
    </main>
  );
}

function AnalyticsBody({ analytics: { sales, inventory } }: { analytics: Analytics }) {
  const metrics: [string, string, string][] = [
    ['Revenue', formatRupees(sales.revenue), 'text-slate-900'],
    ['Orders', String(sales.orderCount), 'text-slate-900'],
    ['Units sold', String(sales.unitsSold), 'text-slate-900'],
    ['Units in stock', String(inventory.unitsInStock), 'text-emerald-700'],
    ['Out-of-stock models', String(inventory.outOfStockCount), inventory.outOfStockCount > 0 ? 'text-red-600' : 'text-slate-900'],
    ['Inventory value', formatRupees(inventory.inventoryValue), 'text-slate-900'],
  ];

  return (
    <>
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {metrics.map(([label, value, color]) => (
          <div key={label} role="group" aria-label={label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <dt className="text-sm font-medium text-slate-500">{label}</dt>
            <dd className={`mt-2 text-2xl font-bold ${color}`}>{value}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:col-span-2">
          <h3 className="mb-3 text-lg font-bold text-slate-900">Top-selling vehicles</h3>
          {sales.topVehicles.length === 0 ? (
            <p className="py-6 text-center text-slate-500">No sales in this period.</p>
          ) : (
            <div className="overflow-x-auto">
              <table aria-label="Top-selling vehicles" className="w-full min-w-[360px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Vehicle</th>
                    <th className="py-2 pr-4 text-right">Units sold</th>
                    <th className="py-2 text-right">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sales.topVehicles.map((v) => (
                    <tr key={`${v.vehicleId}-${v.make}-${v.model}`}>
                      <th scope="row" className="py-3 pr-4 font-semibold text-slate-900">
                        {v.make} {v.model}
                        {v.vehicleId === null && <span className="ml-2 text-xs font-normal text-slate-400">(removed)</span>}
                      </th>
                      <td className="py-3 pr-4 text-right text-slate-700">{v.unitsSold}</td>
                      <td className="py-3 text-right font-semibold text-slate-900">{formatRupees(v.revenue)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
          <h3 className="mb-3 text-lg font-bold text-slate-900">Out of stock</h3>
          {inventory.outOfStockVehicles.length === 0 ? (
            <p className="py-6 text-center text-slate-500">Every vehicle is in stock.</p>
          ) : (
            <ul aria-label="Out-of-stock vehicles" className="divide-y divide-slate-100 text-sm">
              {inventory.outOfStockVehicles.map((v) => (
                <li key={v.id} className="py-2 font-medium text-slate-800">{v.make} {v.model} ({v.category})</li>
              ))}
            </ul>
          )}
          <a href="#manage" className={`${ui.button} ${ui.secondary} mt-4 w-full`}>Restock in Manage inventory</a>
        </div>
      </div>
    </>
  );
}
