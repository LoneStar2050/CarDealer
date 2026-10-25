import { Router } from 'express';
import type { TokenService } from '../auth/tokenService.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import type { VehicleRepository } from './vehicleRepository.js';
import {
  validateRestock,
  validateSearch,
  validateVehicle,
  validateVehicleId,
  validateVehicleUpdate,
} from './vehicleValidation.js';

/** HTTP routes for /api/vehicles. Every route requires a logged-in user. */
export function createVehicleRouter(vehicles: VehicleRepository, tokens: TokenService): Router {
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

  router.post('/:id/purchase', async (req, res) => {
    const vehicle = await vehicles.purchase(validateVehicleId(req.params['id']));
    res.json({ vehicle });
  });

  router.post('/:id/restock', requireAdmin, async (req, res) => {
    const id = validateVehicleId(req.params['id']);
    const vehicle = await vehicles.restock(id, validateRestock(req.body));
    res.json({ vehicle });
  });

  return router;
}
