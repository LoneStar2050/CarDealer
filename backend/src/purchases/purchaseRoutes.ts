import { Router } from 'express';
import type { TokenService } from '../auth/tokenService.js';
import { authenticate, currentUser } from '../middleware/auth.js';
import type { PurchaseService } from './purchaseService.js';
import { validatePurchaseId } from './purchaseValidation.js';

/** HTTP routes for /api/purchases: the logged-in user's own order history. */
export function createPurchaseRouter(purchases: PurchaseService, tokens: TokenService): Router {
  const router = Router();
  router.use(authenticate(tokens));

  router.get('/', async (_req, res) => {
    res.json({ purchases: await purchases.listForUser(currentUser(res).id) });
  });

  router.get('/:id', async (req, res) => {
    const id = validatePurchaseId(req.params['id']);
    res.json({ purchase: await purchases.findForUser(id, currentUser(res).id) });
  });

  return router;
}
