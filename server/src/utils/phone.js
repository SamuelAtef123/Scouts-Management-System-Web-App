import { badRequest } from './httpError.js';

/**
 * Egyptian mobile numbers only (+20). The member types the usual 11 digits,
 * e.g. 01001234567 (010, 011, 012 or 015 then 8 digits); +201001234567,
 * 00201001234567 and spaces or dashes are accepted too.
 * Stored in international form: +201001234567.
 */
export function normalizePhone(value, { required = false } = {}) {
  const raw = String(value ?? '').trim();
  if (!raw) {
    if (required) throw badRequest('Enter your mobile number');
    return '';
  }
  let digits = raw.replace(/[\s\-()]/g, '');
  if (digits.startsWith('+20')) digits = `0${digits.slice(3)}`;
  else if (digits.startsWith('0020')) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith('20') && digits.length === 12) digits = `0${digits.slice(2)}`;

  if (!/^01[0125]\d{8}$/.test(digits)) {
    throw badRequest('Enter an Egyptian mobile number of 11 digits, e.g. 01001234567');
  }
  return `+20${digits.slice(1)}`;
}
