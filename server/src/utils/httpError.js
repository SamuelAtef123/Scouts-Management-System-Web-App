export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export const badRequest = (msg) => new HttpError(400, msg);
export const forbidden = (msg = 'You do not have access to this') => new HttpError(403, msg);
export const notFound = (msg = 'Not found') => new HttpError(404, msg);

/** Wraps async route handlers so errors reach the error middleware (Express 4). */
export const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
