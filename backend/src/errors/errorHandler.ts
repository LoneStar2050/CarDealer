import type { ErrorRequestHandler } from 'express';
import { HttpError } from './httpErrors.js';

/**
 * Converts known application errors into the API's JSON error shape:
 * `{ "error": "<message>" }`. Unknown errors are passed on unchanged.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  next(err);
};
