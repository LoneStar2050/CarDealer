import { useMemo, useState } from 'react';
import { loadFavorites, saveFavorites } from '../favorites';

/** The signed-in user's favorite vehicle ids, persisted per user in local storage. */
export function useFavorites(userId: string) {
  const [ids, setIds] = useState<string[]>(() => loadFavorites(userId));
  const set = useMemo(() => new Set(ids), [ids]);

  function toggle(vehicleId: string) {
    const next = set.has(vehicleId) ? ids.filter((id) => id !== vehicleId) : [...ids, vehicleId];
    setIds(next);
    saveFavorites(userId, next);
  }

  return { isFavorite: (vehicleId: string) => set.has(vehicleId), toggle };
}
