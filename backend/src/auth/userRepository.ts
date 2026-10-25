import type { Pool } from 'pg';
import { isUniqueViolation } from '../db/postgresErrors.js';
import { ConflictError } from '../errors/httpErrors.js';
import type { User } from './user.js';

/** A user together with their password hash. For credential checks only; never send to clients. */
export interface UserWithPasswordHash extends User {
  passwordHash: string;
}

/** Data access for the users table. */
export class UserRepository {
  constructor(private readonly pool: Pool) {}

  /**
   * Inserts a user with the database default role ("user").
   * Throws a ConflictError if the email is already registered.
   */
  async create(email: string, passwordHash: string): Promise<User> {
    try {
      const result = await this.pool.query<User>(
        `INSERT INTO users (email, password_hash)
         VALUES ($1, $2)
         RETURNING id, email, role`,
        [email, passwordHash],
      );
      return result.rows[0]!;
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError('Email is already registered');
      }
      throw error;
    }
  }

  /** Finds a user by exact email match, including the password hash. */
  async findByEmail(email: string): Promise<UserWithPasswordHash | null> {
    const result = await this.pool.query<UserWithPasswordHash>(
      `SELECT id, email, role, password_hash AS "passwordHash"
       FROM users
       WHERE email = $1`,
      [email],
    );
    return result.rows[0] ?? null;
  }
}
