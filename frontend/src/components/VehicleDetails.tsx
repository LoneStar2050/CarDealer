import type { ReactNode } from 'react';
import type { Vehicle } from '../api';
import { formatRupees } from '../format';
import { RatingBadge } from './Rating';
import { ui } from './ui';
import { CompareButton, FavoriteButton, PurchaseButton } from './VehicleCard';
import { VehicleImage } from './VehicleImage';

interface VehicleDetailsProps {
  vehicle: Vehicle;
  purchasing: boolean;
  favorite: boolean;
  comparing: boolean;
  compareFull: boolean;
  onPurchase: () => void;
  onToggleFavorite: () => void;
  onToggleCompare: () => void;
  onBack: () => void;
  /** Extra content below the vehicle, such as customer reviews. */
  children?: ReactNode;
}

/** Dedicated view for a single vehicle. */
export function VehicleDetails(props: VehicleDetailsProps) {
  const { vehicle } = props;
  const name = `${vehicle.make} ${vehicle.model}`;
  const outOfStock = vehicle.quantity === 0;

  return (
    <section aria-label="Vehicle details" className="space-y-6">
      <button type="button" className={`${ui.button} ${ui.secondary}`} onClick={props.onBack}>
        <span aria-hidden="true">←</span> Back to inventory
      </button>
      <div className="grid overflow-hidden rounded-3xl bg-white shadow-sm ring-1 ring-slate-200 lg:grid-cols-2">
        <VehicleImage name={name} category={vehicle.category} />
        <div className="flex flex-col gap-6 p-6 sm:p-10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{vehicle.category}</span>
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">{name}</h2>
              <div className="mt-2"><RatingBadge averageRating={vehicle.averageRating} reviewCount={vehicle.reviewCount} /></div>
            </div>
            <FavoriteButton name={name} favorite={props.favorite} onToggle={props.onToggleFavorite} className="h-11 w-11" />
          </div>

          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[['Make', vehicle.make], ['Model', vehicle.model]].map(([label, value]) => (
              <div key={label} className="sm:col-span-2">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
                <dd className="mt-1 font-semibold text-slate-800">{value}</dd>
              </div>
            ))}
          </dl>

          <div className="flex flex-wrap items-end justify-between gap-4 border-t border-slate-100 pt-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Price</p>
              <p className="text-3xl font-bold text-slate-900">{formatRupees(vehicle.price)}</p>
            </div>
            <p className={`rounded-full px-3 py-1 text-sm font-semibold ${
              outOfStock ? 'bg-red-100 text-red-700' : vehicle.quantity <= 3 ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
            }`}>
              {outOfStock ? 'Out of stock' : `${vehicle.quantity} in stock`}
            </p>
          </div>

          <div className="flex gap-3">
            <PurchaseButton vehicle={vehicle} purchasing={props.purchasing} onPurchase={props.onPurchase} className="flex-1 py-3 text-base" />
            <CompareButton name={name} selected={props.comparing} disabled={!props.comparing && props.compareFull} onToggle={props.onToggleCompare} />
          </div>
        </div>
      </div>
      {props.children}
    </section>
  );
}
