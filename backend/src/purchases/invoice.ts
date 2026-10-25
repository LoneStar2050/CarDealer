import type { Purchase } from './purchase.js';

export const SELLER_NAME = 'Prestige Motors';

/** A downloadable invoice file. */
export interface InvoiceFile {
  filename: string;
  content: string;
}

const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 1500000.5 → "INR 15,00,000.50" (Indian digit grouping). */
export function formatInr(amount: number): string {
  return `INR ${inr.format(amount)}`;
}

/** "2026-10-26T08:05:09.123Z" → "2026-10-26 08:05 UTC". */
function formatUtc(iso: string): string {
  return `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;
}

/** Renders a plain-text invoice for one order. Pure, so it is easy to test and reuse. */
export function renderInvoice(purchase: Purchase, buyerEmail: string): InvoiceFile {
  const sections: [string, string][][] = [
    [
      ['Invoice number', purchase.invoiceNumber],
      ['Order reference', purchase.id],
      ['Purchase date', formatUtc(purchase.purchasedAt)],
      ['Billed to', buyerEmail],
    ],
    [
      ['Vehicle', `${purchase.make} ${purchase.model} (${purchase.category})`],
      ['Quantity', String(purchase.quantity)],
      ['Unit price', formatInr(purchase.unitPrice)],
    ],
    [['Total', formatInr(purchase.totalAmount)]],
  ];
  const width = Math.max(...sections.flat().map(([label]) => label.length)) + 2;
  const rule = '-'.repeat(48);

  const content = [
    SELLER_NAME.toUpperCase(),
    'INVOICE',
    ...sections.flatMap((rows) => [rule, ...rows.map(([label, value]) => `${`${label}:`.padEnd(width)} ${value}`)]),
    rule,
    `Thank you for buying from ${SELLER_NAME}.`,
    '',
  ].join('\n');

  return { filename: `${purchase.invoiceNumber}.txt`, content };
}
