import { useState } from 'react';
import type { Vehicle } from '../api';

export const MAX_COMPARE = 3;

/** Up to MAX_COMPARE vehicles selected for side-by-side comparison. */
export function useCompare(all: Vehicle[]) {
  const [ids, setIds] = useState<string[]>([]);
  // Only vehicles that still exist (one may have been deleted meanwhile).
  const selected = ids.map((id) => all.find((v) => v.id === id)).filter((v): v is Vehicle => Boolean(v));

  return {
    selected,
    isFull: selected.length >= MAX_COMPARE,
    isSelected: (id: string) => ids.includes(id),
    toggle: (id: string) =>
      setIds((current) =>
        current.includes(id) ? current.filter((c) => c !== id) : current.length < MAX_COMPARE ? [...current, id] : current,
      ),
    remove: (id: string) => setIds((current) => current.filter((c) => c !== id)),
    clear: () => setIds([]),
  };
}
