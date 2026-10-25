import bcrypt from 'bcryptjs';
import type { User } from './user.js';
import type { UserRepository } from './userRepository.js';

const BCRYPT_SALT_ROUNDS = 10;

/** Business logic for user accounts. */
export class AuthService {
  constructor(private readonly users: UserRepository) {}

  /**
   * Registers a new regular user. The password is stored only as a bcrypt
   * hash, and the role is never taken from the caller.
   */
  async register(email: string, password: string): Promise<User> {
    const passwordHash = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
    return this.users.create(email, passwordHash);
  }
}
