import { describe, expect, it } from 'vitest';
import { formatRupees } from './format';

describe('formatRupees', () => {
  it.each([
    [1500000, '₹15,00,000'],
    [800000, '₹8,00,000'],
    [999, '₹999'],
    [0, '₹0'],
  ])('formats %d as %s using Indian digit grouping', (amount, expected) => {
    expect(formatRupees(amount)).toBe(expected);
  });
});
