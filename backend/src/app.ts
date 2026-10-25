import express, { type Express } from 'express';
import type { Pool } from 'pg';

/** External resources the application needs, injected for testability. */
export interface AppDependencies {
  pool: Pool;
}

/** Builds the Express application without starting an HTTP server. */
export function createApp(_dependencies: AppDependencies): Express {
  return express();
}
