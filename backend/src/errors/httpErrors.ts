/**
 * An error that maps to a specific HTTP status. Its message is safe to show
 * to API clients; it must never contain internal details.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

/** The request is missing data or contains invalid data (400). */
export class ValidationError extends HttpError {
  constructor(message: string) {
    super(400, message);
  }
}

/** The request lacks valid authentication credentials (401). */
export class UnauthorizedError extends HttpError {
  constructor(message: string) {
    super(401, message);
  }
}

/** The user is authenticated but not allowed to do this (403). */
export class ForbiddenError extends HttpError {
  constructor(message: string) {
    super(403, message);
  }
}

/** The requested resource does not exist (404). */
export class NotFoundError extends HttpError {
  constructor(message: string) {
    super(404, message);
  }
}

/** The request conflicts with existing data, e.g. a duplicate email (409). */
export class ConflictError extends HttpError {
  constructor(message: string) {
    super(409, message);
  }
}
