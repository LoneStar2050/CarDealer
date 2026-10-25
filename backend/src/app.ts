import express, { type Express } from 'express';
import type { Pool } from 'pg';
import { createAuthRouter } from './auth/authRoutes.js';
import { AuthService } from './auth/authService.js';
import { TokenService, type JwtConfig } from './auth/tokenService.js';
import { UserRepository } from './auth/userRepository.js';
import { errorHandler } from './errors/errorHandler.js';
import { VehicleRepository } from './vehicles/vehicleRepository.js';
import { createVehicleRouter } from './vehicles/vehicleRoutes.js';

export type { JwtConfig };

/** External resources the application needs, injected for testability. */
export interface AppDependencies {
  pool: Pool;
  jwt: JwtConfig;
}

/** Builds the Express application without starting an HTTP server. */
export function createApp({ pool, jwt }: AppDependencies): Express {
  const app = express();
  app.use(express.json());

  const tokens = new TokenService(jwt);
  const authService = new AuthService(new UserRepository(pool), tokens);
  app.use('/api/auth', createAuthRouter(authService));
  app.use('/api/vehicles', createVehicleRouter(new VehicleRepository(pool), tokens));

  // Must be registered after all routes.
  app.use(errorHandler);

  return app;
}
