import { badRequest } from './httpError.js';

/** Checks and normalises an email address. Throws a readable error when it is missing or wrong. */
export function normalizeEmail(value, { required = false } = {}) {
  const email = String(value ?? '').trim().toLowerCase();
  if (!email) {
    if (required) throw badRequest('Email is required');
    return undefined;
  }
  if (email.length > 120 || !/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw badRequest('Enter a valid email address');
  return email;
}
