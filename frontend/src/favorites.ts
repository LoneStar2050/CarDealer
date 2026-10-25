/**
 * Favorites are kept in this browser's local storage, separately for each
 * user. Only vehicle ids are stored: never credentials or tokens.
 */
const keyFor = (userId: string) => `dealership-favorites:${userId}`;

export function loadFavorites(userId: string): string[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(keyFor(userId)) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveFavorites(userId: string, vehicleIds: string[]): void {
  localStorage.setItem(keyFor(userId), JSON.stringify(vehicleIds));
}
