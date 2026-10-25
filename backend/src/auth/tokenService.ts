import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../errors/httpErrors.js';
import type { Role, User } from './user.js';

/** The identity carried by a verified token. */
export interface AuthenticatedUser {
  id: string;
  role: Role;
}

/** Settings for signing authentication tokens (from JWT_SECRET / JWT_EXPIRES_IN). */
export interface JwtConfig {
  secret: string;
  /** Token lifetime with a unit, e.g. "15m", "1h", "7d". */
  expiresIn: string;
}

/** The string form of a lifetime that jsonwebtoken accepts (e.g. "1h", "2 days"). */
type TokenLifetime = Exclude<NonNullable<jwt.SignOptions['expiresIn']>, number>;

/**
 * A number followed by a time unit understood by jsonwebtoken. A unit is
 * required: jsonwebtoken would read a bare "60" as 60 milliseconds.
 */
const LIFETIME_PATTERN =
  /^\d+(\.\d+)? ?(years?|yrs?|y|weeks?|w|days?|d|hours?|hrs?|h|minutes?|mins?|m|seconds?|secs?|s|milliseconds?|msecs?|ms)$/i;

function isTokenLifetime(value: string): value is TokenLifetime {
  return LIFETIME_PATTERN.test(value);
}

/** Issues signed JWTs that identify a user and their role. */
export class TokenService {
  private readonly secret: string;
  private readonly expiresIn: TokenLifetime;

  /** Checks the lifetime up front so a bad setting fails at startup. */
  constructor({ secret, expiresIn }: JwtConfig) {
    if (!isTokenLifetime(expiresIn)) {
      throw new Error(`Invalid JWT lifetime "${expiresIn}"; use a value such as "1h"`);
    }
    this.secret = secret;
    this.expiresIn = expiresIn;
  }

  /** Returns a token with the user id in `sub` and their `role` claim. */
  sign(user: User): string {
    return jwt.sign({ role: user.role }, this.secret, {
      subject: user.id,
      expiresIn: this.expiresIn,
      algorithm: 'HS256',
    });
  }

  /**
   * Verifies a token's signature and expiry and returns who it belongs to.
   * Throws an UnauthorizedError (401) for any invalid or expired token.
   */
  verify(token: string): AuthenticatedUser {
    let claims: string | jwt.JwtPayload;
    try {
      claims = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
    } catch {
      throw new UnauthorizedError('Invalid or expired token');
    }
    if (
      typeof claims === 'string' ||
      typeof claims.sub !== 'string' ||
      (claims['role'] !== 'user' && claims['role'] !== 'admin')
    ) {
      throw new UnauthorizedError('Invalid or expired token');
    }
    return { id: claims.sub, role: claims['role'] };
  }
}
