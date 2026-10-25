import { describe, expect, it } from 'vitest';
import { loadFavorites, saveFavorites } from './favorites';

describe('favorites storage', () => {
  it('stores only vehicle ids, separately for each user', () => {
    saveFavorites('user-1', ['v1', 'v2']);
    saveFavorites('user-2', ['v3']);

    expect(loadFavorites('user-1')).toEqual(['v1', 'v2']);
    expect(loadFavorites('user-2')).toEqual(['v3']);
    expect(JSON.parse(localStorage.getItem('dealership-favorites:user-1')!)).toEqual(['v1', 'v2']);
  });

  it('returns an empty list when nothing is stored or the stored value is corrupt', () => {
    expect(loadFavorites('nobody')).toEqual([]);
    localStorage.setItem('dealership-favorites:broken', '{not json');
    expect(loadFavorites('broken')).toEqual([]);
    localStorage.setItem('dealership-favorites:wrong-shape', '{"a":1}');
    expect(loadFavorites('wrong-shape')).toEqual([]);
  });
});
