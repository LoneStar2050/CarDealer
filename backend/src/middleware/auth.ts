import type { RequestHandler, Response } from 'express';
import type { AuthenticatedUser, TokenService } from '../auth/tokenService.js';
import { ForbiddenError, UnauthorizedError } from '../errors/httpErrors.js';

/** Returns the user stored on the response by `authenticate`. */
export function currentUser(res: Response): AuthenticatedUser {
  return res.locals['user'] as AuthenticatedUser;
}

/** Requires a valid `Authorization: Bearer <token>` header (401 otherwise). */
export function authenticate(tokens: TokenService): RequestHandler {
  return (req, res, next) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) {
      throw new UnauthorizedError('Authentication required');
    }
    res.locals['user'] = tokens.verify(token);
    next();
  };
}

/** Allows only admins through (403 otherwise). Use after `authenticate`. */
export const requireAdmin: RequestHandler = (_req, res, next) => {
  if (currentUser(res).role !== 'admin') {
    throw new ForbiddenError('Admin access required');
  }
  next();
};
