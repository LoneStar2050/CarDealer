import bcrypt from 'bcryptjs';
import { UnauthorizedError } from '../errors/httpErrors.js';
import type { TokenService } from './tokenService.js';
import type { User } from './user.js';
import type { UserRepository } from './userRepository.js';

const BCRYPT_SALT_ROUNDS = 10;

/** The same message for an unknown email and a wrong password. */
const INVALID_CREDENTIALS = 'Invalid email or password';

/**
 * A valid bcrypt hash (cost 10, matching BCRYPT_SALT_ROUNDS) that matches no
 * real password. Comparing against it when the email is unknown keeps
 * response times similar to a wrong password, so timing does not reveal
 * which emails are registered. Regenerate it if BCRYPT_SALT_ROUNDS changes.
 */
const DUMMY_PASSWORD_HASH = '$2b$10$Z7uehe2Ogd/RBXlnav6zR.vuccmNgta5ihafbKBNya7luZVgWHX82';

export interface LoginResult {
  token: string;
  user: User;
}

/** Business logic for user accounts. */
export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly tokens: TokenService,
  ) {}

  /**
   * Registers a new regular user. The password is stored only as a bcrypt
   * hash, and the role is never taken from the caller.
   */
  async register(email: string, password: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    return this.users.create(email, passwordHash);
  }

  /**
   * Checks the credentials and returns a signed token with the user.
   * Throws an UnauthorizedError (401) with the same message whether the
   * email is unknown or the password is wrong.
   */
  async login(email: string, password: string): Promise<LoginResult> {
    const found = await this.users.findByEmail(email);
    // Always run bcrypt, even for an unknown email, so timing is similar.
    const passwordMatches = await bcrypt.compare(
      password,
      found?.passwordHash ?? DUMMY_PASSWORD_HASH,
    );
    if (!found || !passwordMatches) {
      throw new UnauthorizedError(INVALID_CREDENTIALS);
    }

    const user: User = { id: found.id, email: found.email, role: found.role };
    return { token: this.tokens.sign(user), user };
  }
}
