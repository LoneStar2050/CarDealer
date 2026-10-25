import type { Vehicle } from '../api';
import { formatRupees } from '../format';
import { inventoryStats } from '../stats';

/** Admin summary cards, calculated from the inventory loaded from the API. */
export function InventoryStats({ vehicles }: { vehicles: Vehicle[] }) {
  const stats = inventoryStats(vehicles);
  const items: [string, string, string][] = [
    ['Vehicle models', String(stats.models), 'text-slate-900'],
    ['Units in stock', String(stats.units), 'text-emerald-700'],
    ['Out-of-stock models', String(stats.outOfStock), stats.outOfStock > 0 ? 'text-red-600' : 'text-slate-900'],
    ['Total inventory value', formatRupees(stats.totalValue), 'text-slate-900'],
  ];
  return (
    <section aria-label="Inventory statistics">
      <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {items.map(([label, value, color]) => (
          <div key={label} role="group" aria-label={label} className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <dt className="text-sm font-medium text-slate-500">{label}</dt>
            <dd className={`mt-2 text-2xl font-bold ${color}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
