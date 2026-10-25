import { describe, expect, it } from 'vitest';
import jwt from 'jsonwebtoken';
import { TokenService } from '../../src/auth/tokenService.js';
import type { User } from '../../src/auth/user.js';

describe('TokenService token lifetime', () => {
  const secret = 'unit-test-secret';
  const user: User = { id: 'user-1', email: 'buyer@example.com', role: 'user' };

  it.each([
    ['15m', 15 * 60],
    ['1h', 60 * 60],
    ['2 days', 2 * 24 * 60 * 60],
  ])('issues tokens that expire after the configured lifetime "%s"', (expiresIn, seconds) => {
    const token = new TokenService({ secret, expiresIn }).sign(user);

    const claims = jwt.verify(token, secret) as jwt.JwtPayload;
    expect(claims.exp! - claims.iat!).toBe(seconds);
  });

  it.each(['60', '', 'forever', '1 fortnight'])(
    'rejects the lifetime "%s" because it is not a number with a time unit',
    (expiresIn) => {
      expect(() => new TokenService({ secret, expiresIn })).toThrow(/Invalid JWT lifetime/);
    },
  );
});
