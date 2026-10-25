import { Router, type Request } from 'express';
import type { TokenService } from '../auth/tokenService.js';
import { authenticate, currentUser } from '../middleware/auth.js';
import { validateVehicleId } from '../vehicles/vehicleValidation.js';
import type { ReviewService } from './reviewService.js';
import { validateReview } from './reviewValidation.js';

/** The :id from the parent route (mergeParams does not carry its type). */
const vehicleIdOf = (req: Request) => validateVehicleId((req.params as Record<string, unknown>)['id']);

/**
 * HTTP routes for /api/vehicles/:id/reviews. Every route requires a
 * logged-in user; any logged-in user may review a vehicle once.
 */
export function createReviewRouter(reviews: ReviewService, tokens: TokenService): Router {
  const router = Router({ mergeParams: true });
  router.use(authenticate(tokens));

  router.get('/', async (req, res) => {
    const vehicleId = vehicleIdOf(req);
    res.json(await reviews.list(vehicleId, currentUser(res).id));
  });

  router.post('/', async (req, res) => {
    const vehicleId = vehicleIdOf(req);
    const input = validateReview(req.body);
    res.status(201).json(await reviews.create(vehicleId, currentUser(res).id, input));
  });

  return router;
}
