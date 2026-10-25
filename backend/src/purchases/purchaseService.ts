import type { Pool } from 'pg';
import { withTransaction } from '../db/transaction.js';
import { NotFoundError } from '../errors/httpErrors.js';
import type { Vehicle } from '../vehicles/vehicle.js';
import { VehicleRepository } from '../vehicles/vehicleRepository.js';
import { renderInvoice, type InvoiceFile } from './invoice.js';
import type { Purchase } from './purchase.js';
import { PurchaseRepository } from './purchaseRepository.js';

export interface PurchaseResult {
  vehicle: Vehicle;
  purchase: Purchase;
}

/** Buying vehicles and reading the buyer's own orders. */
export class PurchaseService {
  constructor(private readonly pool: Pool) {}

  /**
   * Reserves the stock and records the order in one transaction, so either
   * both happen or neither does. The conditional UPDATE row-locks the
   * vehicle, so concurrent orders cannot oversell it.
   */
  async purchase(userId: string, vehicleId: string, quantity: number): Promise<PurchaseResult> {
    return withTransaction(this.pool, async (tx) => {
      const vehicle = await new VehicleRepository(tx).purchase(vehicleId, quantity);
      const purchase = await new PurchaseRepository(tx).create(userId, vehicleId, quantity);
      return { vehicle, purchase };
    });
  }

  async listForUser(userId: string): Promise<Purchase[]> {
    return new PurchaseRepository(this.pool).listForUser(userId);
  }

  /** Throws NotFoundError for unknown orders and for other users' orders alike. */
  async findForUser(id: string, userId: string): Promise<Purchase> {
    const purchase = await new PurchaseRepository(this.pool).findForUser(id, userId);
    if (!purchase) throw new NotFoundError('Order not found');
    return purchase;
  }

  /** The invoice of one of the user's own orders; NotFoundError otherwise. */
  async invoiceFor(id: string, userId: string): Promise<InvoiceFile> {
    const found = await new PurchaseRepository(this.pool).findForUserWithBuyerEmail(id, userId);
    if (!found) throw new NotFoundError('Order not found');
    return renderInvoice(found.purchase, found.buyerEmail);
  }
}
