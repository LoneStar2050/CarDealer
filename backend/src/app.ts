import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { createAuthRouter } from './auth/authRoutes.js';
import { AuthService } from './auth/authService.js';
import { UserRepository } from './auth/userRepository.js';

/** External resources the application needs, injected for testability. */
export interface AppDependencies {
  pool: Pool;
}

/** Builds the Express application without starting an HTTP server. */
export function createApp({ pool }: AppDependencies): Express {
  const app = express();
  app.use(express.json());

  const authService = new AuthService(new UserRepository(pool));
  app.use('/api/auth', createAuthRouter(authService));

  return app;
}
