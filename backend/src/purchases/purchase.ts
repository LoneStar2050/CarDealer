/** A completed order as returned by the API. */
export interface Purchase {
  id: string;
  /** Human-readable invoice number derived from the order number, e.g. "INV-000042". */
  invoiceNumber: string;
  /** The purchased vehicle, or null if it has since been deleted. */
  vehicleId: string | null;
  /** Vehicle details as they were at purchase time. */
  make: string;
  model: string;
  category: string;
  quantity: number;
  /** Price per unit at purchase time, in rupees. */
  unitPrice: number;
  /** unitPrice × quantity, in rupees. */
  totalAmount: number;
  /** ISO 8601 timestamp. */
  purchasedAt: string;
}

/** The most units a single order may contain. */
export const MAX_PURCHASE_QUANTITY = 100;
