const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Formats an amount in Indian rupees with Indian digit grouping, e.g. ₹15,00,000. */
export function formatRupees(amount: number): string {
  return rupees.format(amount);
}
