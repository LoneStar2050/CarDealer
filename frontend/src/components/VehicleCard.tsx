import type { Vehicle } from '../api';
import { formatRupees } from '../format';
import { Spinner, ui } from './ui';
import { VehicleImage } from './VehicleImage';

interface VehicleCardProps {
  vehicle: Vehicle;
  isAdmin: boolean;
  purchasing: boolean;
  onPurchase: () => void;
  onEdit: () => void;
  onRestock: () => void;
  onDelete: () => void;
}

/** One vehicle in the inventory grid, with purchase and (for admins) management actions. */
export function VehicleCard({ vehicle, isAdmin, purchasing, onPurchase, onEdit, onRestock, onDelete }: VehicleCardProps) {
  const name = `${vehicle.make} ${vehicle.model}`;
  const outOfStock = vehicle.quantity === 0;

  return (
    <article aria-label={name} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg">
      <div className="relative overflow-hidden">
        <VehicleImage name={name} category={vehicle.category} />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow">
          {vehicle.category}
        </span>
        {outOfStock && (
          <span className="absolute right-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow">
            Out of stock
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div>
          <p className="text-sm font-medium text-slate-500">{vehicle.make}</p>
          <h3 className="text-lg font-bold text-slate-900">{vehicle.model}</h3>
        </div>
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold text-slate-900">{formatRupees(vehicle.price)}</p>
          {!outOfStock && (
            <p className={`text-sm font-medium ${vehicle.quantity <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {vehicle.quantity} in stock
            </p>
          )}
        </div>

        <button
          type="button"
          className={`${ui.button} ${ui.accent} mt-auto w-full py-2.5`}
          disabled={outOfStock || purchasing}
          onClick={onPurchase}
        >
          {purchasing ? (
            <>
              <Spinner /> Purchasing…
            </>
          ) : (
            'Purchase'
          )}
        </button>

        {isAdmin && (
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
            <button type="button" aria-label={`Edit ${name}`} className={`${ui.button} ${ui.secondary} px-2`} onClick={onEdit}>Edit</button>
            <button type="button" aria-label={`Restock ${name}`} className={`${ui.button} ${ui.secondary} px-2`} onClick={onRestock}>Restock</button>
            <button type="button" aria-label={`Delete ${name}`} className={`${ui.button} border border-red-200 bg-white px-2 text-red-600 hover:bg-red-50`} onClick={onDelete}>Delete</button>
          </div>
        )}
      </div>
    </article>
  );
}
