import type { ErrorRequestHandler } from 'express';
import { HttpError } from './httpErrors.js';

/** Set by Express's JSON body parser when the body cannot be parsed. */
const isMalformedJson = (err: unknown) => (err as { type?: unknown }).type === 'entity.parse.failed';

/**
 * Converts every error into the API's JSON error shape: `{ "error": "<message>" }`.
 * Known application errors keep their status and message. Anything else is
 * logged on the server and answered with a generic 500, so internal details
 * and stack traces never reach clients.
 */
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  if (isMalformedJson(err)) {
    res.status(400).json({ error: 'Request body is not valid JSON' });
    return;
  }
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
};
