import type { Vehicle } from '../api';
import { formatRupees } from '../format';
import { ui } from './ui';

/** Admin overview of every vehicle's stock level. */
export function StockTable({ vehicles, onAdd, onRestock, onEdit }: {
  vehicles: Vehicle[];
  onAdd: () => void;
  onRestock: (vehicle: Vehicle) => void;
  onEdit: (vehicle: Vehicle) => void;
}) {
  const totalUnits = vehicles.reduce((sum, v) => sum + v.quantity, 0);
  const outOfStock = vehicles.filter((v) => v.quantity === 0).length;

  return (
    <section id="manage" className="scroll-mt-24 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Manage inventory</h2>
          <p className="text-sm text-slate-500">
            {vehicles.length} models · {totalUnits} units in stock · {outOfStock} out of stock
          </p>
        </div>
        <button type="button" className={`${ui.button} ${ui.primary}`} onClick={onAdd}><span aria-hidden="true">+</span> Add vehicle</button>
      </div>
      <div className="overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <table aria-label="Stock management" className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Vehicle</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th>
              <th className="px-4 py-3">Stock</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {vehicles.map((v) => {
              const name = `${v.make} ${v.model}`;
              return (
                <tr key={v.id} className="hover:bg-slate-50">
                  <th scope="row" className="px-4 py-3 font-semibold text-slate-900">{name}</th>
                  <td className="px-4 py-3 text-slate-600">{v.category}</td>
                  <td className="px-4 py-3 text-slate-900">{formatRupees(v.price)}</td>
                  <td className="px-4 py-3">
                    {v.quantity === 0 ? (
                      <span className="rounded-full bg-red-100 px-2.5 py-1 text-xs font-semibold text-red-700">Out of stock</span>
                    ) : (
                      <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${v.quantity <= 3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {v.quantity} units
                      </span>
                    )}
                  </td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    <button type="button" aria-label={`Restock ${name}`} className="font-semibold text-slate-700 hover:text-amber-600" onClick={() => onRestock(v)}>Restock</button>
                    <button type="button" aria-label={`Edit ${name}`} className="font-semibold text-slate-700 hover:text-amber-600" onClick={() => onEdit(v)}>Edit</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
