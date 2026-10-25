import bcrypt from 'bcryptjs';
import type { TokenService } from './tokenService.js';
import type { User } from './user.js';
import type { UserRepository } from './userRepository.js';

const BCRYPT_SALT_ROUNDS = 10;

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

  /** Checks the credentials and returns a signed token with the user. */
  async login(email: string, password: string): Promise<LoginResult> {
    const found = await this.users.findByEmail(email);
    if (!found || !(await bcrypt.compare(password, found.passwordHash))) {
      throw new Error('Invalid email or password');
    }

    const user: User = { id: found.id, email: found.email, role: found.role };
    return { token: this.tokens.sign(user), user };
  }
}
