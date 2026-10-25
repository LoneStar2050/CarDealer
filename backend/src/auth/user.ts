/** Roles a user can hold. Only admins may add, update, delete, or restock vehicles. */
export type Role = 'user' | 'admin';

/** A user as exposed by the application. Never includes the password hash. */
export interface User {
  id: string;
  email: string;
  role: Role;
}
