import { badRequest } from './httpError.js';

/**
 * Validates and tidies a mobile number: digits with an optional leading +,
 * spaces and dashes removed, 8 to 15 digits (e.g. 01001234567 or +201001234567).
 */
export function normalizePhone(value, { required = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    if (required) throw badRequest('Enter your mobile number');
    return '';
  }
  const phone = raw.replace(/[\s-]/g, '');
  if (!/^\+?\d{8,15}$/.test(phone)) throw badRequest('Enter a valid mobile number, e.g. 01001234567');
  return phone;
}
