import { Router } from 'express';
import type { AuthService } from './authService.js';
import { validateRegistration } from './authValidation.js';

/** HTTP routes for /api/auth. */
export function createAuthRouter(authService: AuthService): Router {
  const router = Router();

  router.post('/register', async (req, res) => {
    const { email, password } = validateRegistration(req.body);
    const user = await authService.register(email, password);
    res.status(201).json({ user });
  });

  return router;
}
