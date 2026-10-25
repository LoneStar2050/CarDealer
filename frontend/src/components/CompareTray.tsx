import { useState } from 'react';
import type { Vehicle } from '../api';
import { formatRupees } from '../format';
import { MAX_COMPARE } from '../hooks/useCompare';
import { Dialog, ui } from './ui';

/** Sticky bar listing the vehicles chosen for comparison, plus the comparison dialog. */
export function CompareTray({ vehicles, onRemove, onClear }: {
  vehicles: Vehicle[];
  onRemove: (id: string) => void;
  onClear: () => void;
}) {
  const [open, setOpen] = useState(false);
  if (vehicles.length === 0) return null;
  const nameOf = (v: Vehicle) => `${v.make} ${v.model}`;
  const rows: [string, (v: Vehicle) => string][] = [
    ['Make', (v) => v.make],
    ['Model', (v) => v.model],
    ['Category', (v) => v.category],
    ['Price', (v) => formatRupees(v.price)],
    ['Stock', (v) => (v.quantity === 0 ? 'Out of stock' : `${v.quantity} in stock`)],
  ];

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
                {rows.map(([label, value]) => (
                  <tr key={label}>
                    <th scope="row" className="py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</th>
                    {vehicles.map((v) => <td key={v.id} className="px-4 py-3 font-medium text-slate-800">{value(v)}</td>)}
                  </tr>
                ))}
              </tbody>
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
