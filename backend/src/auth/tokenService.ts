import jwt from 'jsonwebtoken';
import type { User } from './user.js';

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
}
