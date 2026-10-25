import { Router } from 'express';
import type { TokenService } from '../auth/tokenService.js';
import { authenticate, currentUser, requireAdmin } from '../middleware/auth.js';
import type { PurchaseService } from '../purchases/purchaseService.js';
import { validatePurchaseQuantity } from '../purchases/purchaseValidation.js';
import type { VehicleRepository } from './vehicleRepository.js';
import {
  validateRestock,
  validateSearch,
  validateVehicle,
  validateVehicleId,
  validateVehicleUpdate,
} from './vehicleValidation.js';

/** HTTP routes for /api/vehicles. Every route requires a logged-in user. */
export function createVehicleRouter(
  vehicles: VehicleRepository,
  purchases: PurchaseService,
  tokens: TokenService,
): Router {
  const router = Router();
  router.use(authenticate(tokens));

  router.post('/', requireAdmin, async (req, res) => {
    const vehicle = await vehicles.create(validateVehicle(req.body));
    res.status(201).json({ vehicle });
  });

  router.get('/', async (_req, res) => {
    res.json({ vehicles: await vehicles.findAll() });
  });

  // Must be declared before any "/:id" route so "search" is not read as an id.
  router.get('/search', async (req, res) => {
    const filters = validateSearch(req.query as Record<string, unknown>);
    res.json({ vehicles: await vehicles.search(filters) });
  });

  router.put('/:id', requireAdmin, async (req, res) => {
    const id = validateVehicleId(req.params['id']);
    const vehicle = await vehicles.update(id, validateVehicleUpdate(req.body));
    res.json({ vehicle });
  });

  router.delete('/:id', requireAdmin, async (req, res) => {
    await vehicles.delete(validateVehicleId(req.params['id']));
    res.status(204).end();
  });

  // The buyer comes from the token and the price from the database.
  router.post('/:id/purchase', async (req, res) => {
    const id = validateVehicleId(req.params['id']);
    const quantity = validatePurchaseQuantity(req.body);
    res.json(await purchases.purchase(currentUser(res).id, id, quantity));
  });

  router.post('/:id/restock', requireAdmin, async (req, res) => {
    const id = validateVehicleId(req.params['id']);
    const vehicle = await vehicles.restock(id, validateRestock(req.body));
    res.json({ vehicle });
  });

  return router;
}
