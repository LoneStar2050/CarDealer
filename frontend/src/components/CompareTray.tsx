import { useState, type ReactNode } from 'react';
import type { Vehicle } from '../api';
import { formatDate, formatRupees, plural } from '../format';
import { MAX_COMPARE } from '../hooks/useCompare';
import { Dialog, ui } from './ui';

const nameOf = (v: Vehicle) => `${v.make} ${v.model}`;
/** Shown wherever a value is missing. */
const MISSING = '—';

interface CompareRow {
  label: string;
  value: (v: Vehicle) => ReactNode;
  /** Which vehicles win this row, if the row has a "best" value. */
  best?: (vehicles: Vehicle[]) => Set<string>;
  /** Visible note added to the winning cells. */
  bestNote?: string;
}

/** Ids of the vehicles with the extreme value, only when not all values are equal. */
function extremes(vehicles: Vehicle[], valueOf: (v: Vehicle) => number | null, pick: 'min' | 'max'): Set<string> {
  const known = vehicles.filter((v) => valueOf(v) !== null);
  const values = known.map((v) => valueOf(v)!);
  if (values.length === 0 || (values.length === vehicles.length && Math.min(...values) === Math.max(...values))) return new Set();
  const target = pick === 'min' ? Math.min(...values) : Math.max(...values);
  return new Set(known.filter((v) => valueOf(v) === target).map((v) => v.id));
}

const ROWS: CompareRow[] = [
  { label: 'Make', value: (v) => v.make || MISSING },
  { label: 'Model', value: (v) => v.model || MISSING },
  { label: 'Category', value: (v) => v.category || MISSING },
  { label: 'Price', value: (v) => formatRupees(v.price), best: (vs) => extremes(vs, (v) => v.price, 'min'), bestNote: 'Lowest price' },
  { label: 'Stock', value: (v) => (v.quantity === 0 ? 'Out of stock' : `${v.quantity} in stock`) },
  { label: 'Availability', value: (v) => (v.quantity > 0 ? 'In stock' : 'Out of stock') },
  {
    label: 'Rating',
    value: (v) => (v.averageRating === null ? 'No reviews yet' : `${v.averageRating} / 5 (${plural(v.reviewCount, 'review')})`),
    best: (vs) => extremes(vs, (v) => v.averageRating, 'max'),
  },
  { label: 'Listed', value: (v) => (v.createdAt ? formatDate(v.createdAt) : MISSING) },
];

/** Sticky bar listing the vehicles chosen for comparison, plus the comparison dialog. */
export function CompareTray({ vehicles, onRemove, onClear }: {
  vehicles: Vehicle[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (vehicles.length === 0) return null;

  /** Removing from the dialog closes it once there is nothing left to compare. */
  function removeFromDialog(id: string) {
    if (vehicles.length - 1 < 2) setOpen(false);
    onRemove(id);
  }

  return (
    <>
      <section aria-label="Compare tray" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
          <p className="text-sm font-semibold text-slate-900">{vehicles.length} of {MAX_COMPARE} selected</p>
          <ul className="flex flex-1 flex-wrap gap-2">
            {vehicles.map((v) => (
              <li key={v.id} className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-sm text-slate-700">
                {nameOf(v)}
                <button type="button" aria-label={`Remove ${nameOf(v)} from comparison`} className="rounded-full px-2 text-slate-400 hover:text-slate-800" onClick={() => onRemove(v.id)}>×</button>
              </li>
            ))}
          </ul>
          <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={onClear}>Clear comparison</button>
          <button type="button" className={`${ui.button} ${ui.primary}`} disabled={vehicles.length < 2} title={vehicles.length < 2 ? 'Select at least 2 vehicles' : undefined} onClick={() => setOpen(true)}>
            Compare vehicles
          </button>
        </div>
      </section>

      {open && (
        <Dialog title="Compare vehicles" wide onClose={() => setOpen(false)}>
          <div className="overflow-x-auto">
            <table aria-label="Vehicle comparison" className="w-full min-w-[480px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="py-3 pr-4" />
                  {vehicles.map((v) => <th key={v.id} className="px-4 py-3 text-base font-bold text-slate-900">{nameOf(v)}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ROWS.map((row) => {
                  const winners = row.best?.(vehicles) ?? new Set<string>();
                  return (
                    <tr key={row.label}>
                      <th scope="row" className="py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{row.label}</th>
                      {vehicles.map((v) => {
                        const best = winners.has(v.id);
                        return (
                          <td
                            key={v.id}
                            data-best={best ? 'true' : undefined}
                            title={best ? (row.bestNote ?? `Best ${row.label.toLowerCase()}`) : undefined}
                            className={`px-4 py-3 font-medium ${best ? 'bg-emerald-50 text-emerald-800' : 'text-slate-800'}`}
                          >
                            {row.value(v)}
                            {best && row.bestNote && (
                              <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-semibold">{row.bestNote}</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200">
                  <th scope="row" className="py-3 pr-4"><span className="sr-only">Actions</span></th>
                  {vehicles.map((v) => (
                    <td key={v.id} className="px-4 py-3">
                      <button type="button" aria-label={`Remove ${nameOf(v)} from comparison`} className={`${ui.button} ${ui.secondary} px-3`} onClick={() => removeFromDialog(v.id)}>
                        Remove
                      </button>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={() => setOpen(false)}>Close</button>
          </div>
        </Dialog>
      )}
    </>
  );
}
