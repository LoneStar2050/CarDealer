import type { Vehicle } from '../api';
import { formatRupees } from '../format';
import { Spinner, ui } from './ui';
import { VehicleImage } from './VehicleImage';

/** Purchase button shared by the card and the details view. */
export function PurchaseButton({ vehicle, purchasing, onPurchase, className = '' }: {
  vehicle: Vehicle;
  purchasing: boolean;
  onPurchase: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`${ui.button} ${ui.accent} py-2.5 ${className}`}
      disabled={vehicle.quantity === 0 || purchasing}
      onClick={onPurchase}
    >
      {purchasing ? (<><Spinner /> Purchasing…</>) : 'Purchase'}
    </button>
  );
}

/** Heart toggle for adding/removing a vehicle from the user's favorites. */
export function FavoriteButton({ name, favorite, onToggle, className = '' }: {
  name: string;
  favorite: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={favorite ? `Remove ${name} from favorites` : `Add ${name} to favorites`}
      aria-pressed={favorite}
      title={favorite ? 'Remove from favorites' : 'Add to favorites'}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border transition ${
        favorite ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 text-slate-400 hover:text-rose-500'
      } ${className}`}
      onClick={onToggle}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill={favorite ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
        <path d="M12 21s-7.5-4.6-9.5-9.3C1 8 3.4 4.5 7 4.5c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.6 0 6 3.5 4.5 7.2C19.5 16.4 12 21 12 21z" />
      </svg>
    </button>
  );
}

/** "Compare" toggle; disabled once three other vehicles are selected. */
export function CompareButton({ name, selected, disabled, onToggle }: {
  name: string;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={`Compare ${name}`}
      aria-pressed={selected}
      title={disabled ? 'You can compare up to 3 vehicles' : undefined}
      disabled={disabled}
      className={`${ui.button} px-3 ${selected ? 'border border-slate-900 bg-slate-900 text-white' : ui.secondary}`}
      onClick={onToggle}
    >
      {selected ? '✓ Comparing' : 'Compare'}
    </button>
  );
}

interface VehicleCardProps {
  vehicle: Vehicle;
  isAdmin: boolean;
  purchasing: boolean;
  favorite: boolean;
  comparing: boolean;
  compareFull: boolean;
  onPurchase: () => void;
  onToggleFavorite: () => void;
  onToggleCompare: () => void;
  onDetails: () => void;
  onEdit: () => void;
  onRestock: () => void;
  onDelete: () => void;
}

/** One vehicle in the inventory grid, with purchase, favorite, compare and (for admins) management actions. */
export function VehicleCard(props: VehicleCardProps) {
  const { vehicle, isAdmin, purchasing, favorite, comparing, compareFull } = props;
  const name = `${vehicle.make} ${vehicle.model}`;
  const outOfStock = vehicle.quantity === 0;

  return (
    <article aria-label={name} className="group flex flex-col overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 transition hover:-translate-y-0.5 hover:shadow-lg">
      <button type="button" aria-label={`View details for ${name}`} className="relative block overflow-hidden text-left" onClick={props.onDetails}>
        <VehicleImage name={name} category={vehicle.category} />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-slate-800 shadow">
          {vehicle.category}
        </span>
        {outOfStock && (
          <span className="absolute right-3 top-3 rounded-full bg-red-600 px-3 py-1 text-xs font-semibold text-white shadow">
            Out of stock
          </span>
        )}
        <span aria-hidden="true" className="absolute bottom-3 right-3 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-white opacity-0 transition group-hover:opacity-100">
          View details →
        </span>
      </button>

      <div className="flex flex-1 flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{vehicle.make}</p>
            <h3 className="text-lg font-bold text-slate-900">{vehicle.model}</h3>
          </div>
          <FavoriteButton name={name} favorite={favorite} onToggle={props.onToggleFavorite} />
        </div>
        <div className="flex items-end justify-between">
          <p className="text-2xl font-bold text-slate-900">{formatRupees(vehicle.price)}</p>
          {!outOfStock && (
            <p className={`text-sm font-medium ${vehicle.quantity <= 3 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {vehicle.quantity} in stock
            </p>
          )}
        </div>

        <div className="mt-auto flex gap-2">
          <PurchaseButton vehicle={vehicle} purchasing={purchasing} onPurchase={props.onPurchase} className="flex-1" />
          <CompareButton name={name} selected={comparing} disabled={!comparing && compareFull} onToggle={props.onToggleCompare} />
        </div>

        {isAdmin && (
          <div className="grid grid-cols-3 gap-2 border-t border-slate-100 pt-3">
            <button type="button" aria-label={`Edit ${name}`} className={`${ui.button} ${ui.secondary} px-2`} onClick={props.onEdit}>Edit</button>
            <button type="button" aria-label={`Restock ${name}`} className={`${ui.button} ${ui.secondary} px-2`} onClick={props.onRestock}>Restock</button>
            <button type="button" aria-label={`Delete ${name}`} className={`${ui.button} border border-red-200 bg-white px-2 text-red-600 hover:bg-red-50`} onClick={props.onDelete}>Delete</button>
          </div>
        )}
      </div>
    </article>
  );
}
