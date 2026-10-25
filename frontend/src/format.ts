const rupees = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

/** Formats an amount in Indian rupees with Indian digit grouping, e.g. ₹15,00,000. */
export function formatRupees(amount: number): string {
  return rupees.format(amount);
}

const shortDate = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Formats an ISO timestamp as a short local date, e.g. "21 Oct 2026". */
export function formatDate(iso: string): string {
  return shortDate.format(new Date(iso));
}

/** "1 review", "2 reviews". */
export function plural(count: number, word: string): string {
  return `${count} ${count === 1 ? word : `${word}s`}`;
}
