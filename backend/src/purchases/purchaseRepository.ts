import type { Queryable } from '../db/transaction.js';
import type { Purchase } from './purchase.js';

const COLUMNS = `id, order_number, vehicle_id, make, model, category, quantity,
  unit_price, total_amount, purchased_at`;

interface PurchaseRow {
  id: string;
  order_number: string; // BIGINT arrives as a string
  vehicle_id: string | null;
  make: string;
  model: string;
  category: string;
  quantity: number;
  unit_price: string; // NUMERIC arrives as a string
  total_amount: string;
  purchased_at: Date;
}

/** "42" → "INV-000042". */
export function invoiceNumberFor(orderNumber: string): string {
  return `INV-${orderNumber.padStart(6, '0')}`;
}

function toPurchase(row: PurchaseRow): Purchase {
  return {
    id: row.id,
    invoiceNumber: invoiceNumberFor(row.order_number),
    vehicleId: row.vehicle_id,
    make: row.make,
    model: row.model,
    category: row.category,
    quantity: row.quantity,
    unitPrice: Number(row.unit_price),
    totalAmount: Number(row.total_amount),
    purchasedAt: row.purchased_at.toISOString(),
  };
}

/** Data access for the purchases table. All queries are parameterized. */
export class PurchaseRepository {
  constructor(private readonly db: Queryable) {}

  /**
   * Records an order, copying the vehicle's details and current price from
   * the database: prices and totals are never taken from the client. Call it
   * in the same transaction that reserved the stock.
   */
  async create(userId: string, vehicleId: string, quantity: number): Promise<Purchase> {
    const result = await this.db.query<PurchaseRow>(
      `INSERT INTO purchases (user_id, vehicle_id, make, model, category, quantity, unit_price, total_amount)
       SELECT $1, id, make, model, category, $3::int, price, price * $3::int
       FROM vehicles WHERE id = $2
       RETURNING ${COLUMNS}`,
      [userId, vehicleId, quantity],
    );
    return toPurchase(result.rows[0]!);
  }

  /** The user's orders, newest first. */
  async listForUser(userId: string): Promise<Purchase[]> {
    const result = await this.db.query<PurchaseRow>(
      `SELECT ${COLUMNS} FROM purchases WHERE user_id = $1
       ORDER BY purchased_at DESC, order_number DESC`,
      [userId],
    );
    return result.rows.map(toPurchase);
  }

  /** Like findForUser, plus the buyer's email for the invoice. */
  async findForUserWithBuyerEmail(id: string, userId: string): Promise<{ purchase: Purchase; buyerEmail: string } | null> {
    const result = await this.db.query<PurchaseRow & { buyer_email: string }>(
      `SELECT ${COLUMNS}, (SELECT email FROM users WHERE users.id = purchases.user_id) AS buyer_email
       FROM purchases WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    const row = result.rows[0];
    return row ? { purchase: toPurchase(row), buyerEmail: row.buyer_email } : null;
  }

  /** One order, only if it belongs to the user; otherwise null. */
  async findForUser(id: string, userId: string): Promise<Purchase | null> {
    const result = await this.db.query<PurchaseRow>(
      `SELECT ${COLUMNS} FROM purchases WHERE id = $1 AND user_id = $2`,
      [id, userId],
    );
    return result.rows[0] ? toPurchase(result.rows[0]) : null;
  }
}
