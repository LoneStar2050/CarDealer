import { useState } from 'react';
import car from '../assets/car.svg';
import hatchback from '../assets/hatchback.svg';
import sedan from '../assets/sedan.svg';
import suv from '../assets/suv.svg';

/** Picks a local illustration for a vehicle category (there is no image field in the data). */
function imageFor(category: string): string {
  const c = category.toLowerCase();
  if (c.includes('suv')) return suv;
  if (c.includes('hatch')) return hatchback;
  if (c.includes('sedan')) return sedan;
  return car;
}

/** Vehicle illustration with a text fallback if the image fails to load. */
export function VehicleImage({ name, category }: { name: string; category: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <div role="img" aria-label={name} className="flex aspect-[5/3] w-full items-center justify-center bg-slate-800 text-3xl font-bold text-slate-400">
        {name.split(' ').map((word) => word[0]).join('').slice(0, 3)}
      </div>
    );
  }
  return (
    <img
      src={imageFor(category)}
      alt={name}
      loading="lazy"
      onError={() => setFailed(true)}
      className="aspect-[5/3] w-full object-cover transition duration-300 group-hover:scale-105"
    />
  );
}
