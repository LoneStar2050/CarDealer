import { Router } from 'express';
import type { TokenService } from '../auth/tokenService.js';
import { authenticate, requireAdmin } from '../middleware/auth.js';
import type { AnalyticsRepository } from './analyticsRepository.js';
import { validateDateRange } from './analyticsValidation.js';

/** HTTP routes for /api/admin. Every route requires an admin (401 / 403 otherwise). */
export function createAdminRouter(analytics: AnalyticsRepository, tokens: TokenService): Router {
  const router = Router();
  router.use(authenticate(tokens), requireAdmin);

  router.get('/analytics', async (req, res) => {
    const range = validateDateRange(req.query as Record<string, unknown>);
    const [inventory, sales] = await Promise.all([analytics.inventory(), analytics.sales(range)]);
    res.json({ range, inventory, sales });
  });

  return router;
}
