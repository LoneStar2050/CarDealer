import type { Pool } from 'pg';

export type Role = 'user' | 'admin';

/** A user as exposed by the application. Never includes the password hash. */
export interface User {
  id: string;
  email: string;
  role: Role;
}

/** Data access for the users table. */
export class UserRepository {
  constructor(private readonly pool: Pool) {}

  /** Inserts a user with the database default role ("user"). */
  async create(email: string, passwordHash: string): Promise<User> {
    const result = await this.pool.query<User>(
      `INSERT INTO users (email, password_hash)
       VALUES ($1, $2)
       RETURNING id, email, role`,
      [email, passwordHash],
    );
    return result.rows[0]!;
  }
}
