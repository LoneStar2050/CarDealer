import { describe, expect, it } from 'vitest';
import { inventoryStats } from './stats';
import { vehicle } from './test/fakeApi';

describe('inventoryStats', () => {
  it('counts models, units, out-of-stock models and total value from the vehicles given', () => {
    const stats = inventoryStats([
      vehicle({ price: 1500000, quantity: 6 }),
      vehicle({ price: 800000, quantity: 10 }),
      vehicle({ price: 1500000, quantity: 0 }),
    ]);
    expect(stats).toEqual({ models: 3, units: 16, outOfStock: 1, totalValue: 17000000 });
  });

  it('returns zeros for an empty inventory', () => {
    expect(inventoryStats([])).toEqual({ models: 0, units: 0, outOfStock: 0, totalValue: 0 });
  });
});
