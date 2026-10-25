import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { createAuthRouter } from './auth/authRoutes.js';
import { AuthService } from './auth/authService.js';
import { UserRepository } from './auth/userRepository.js';
import { errorHandler } from './errors/errorHandler.js';

/** Settings for signing authentication tokens (from JWT_SECRET / JWT_EXPIRES_IN). */
export interface JwtConfig {
  secret: string;
  /** Token lifetime, e.g. "1h". */
  expiresIn: string;
}

/** External resources the application needs, injected for testability. */
export interface AppDependencies {
  pool: Pool;
  jwt: JwtConfig;
}

/** Builds the Express application without starting an HTTP server. */
export function createApp({ pool }: AppDependencies): Express {
  const app = express();
  app.use(express.json());

  const authService = new AuthService(new UserRepository(pool));
  app.use('/api/auth', createAuthRouter(authService));

  // Must be registered after all routes.
  app.use(errorHandler);

  return app;
}
