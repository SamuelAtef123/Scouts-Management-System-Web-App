import { locale, t } from './i18n.jsx';

// Formatters follow the chosen language (English or Arabic).
const fmt = (opts) => new Intl.DateTimeFormat(locale(), opts);
const dayOpts = { weekday: 'short', day: 'numeric', month: 'short' };
const fullOpts = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
const timeOpts = { hour: 'numeric', minute: '2-digit', hour12: true };
const monthOpts = { month: 'long', year: 'numeric' };

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const formatDay = (d) => fmt(dayOpts).format(new Date(d));
export const formatFullDate = (d) => fmt(fullOpts).format(new Date(d));
export const formatTime = (d) => fmt(timeOpts).format(new Date(d));
export const formatMonth = (d) => fmt(monthOpts).format(new Date(d));
/** Short month name for date tags, e.g. "Nov" / "نوفمبر". */
export const formatShortMonth = (d) => fmt({ month: 'short' }).format(new Date(d));

/** Whole days from today to the date (negative = in the past). */
export function daysUntil(d) {
  return Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
}

export function relativeDay(d) {
  const n = daysUntil(d);
  if (n === 0) return t('Today');
  if (n === 1) return t('Tomorrow');
  if (n === -1) return t('Yesterday');
  if (n === 2) return t('In 2 days');
  if (n === -2) return t('2 days ago');
  if (n > 1 && n < 7) return t('In {n} days', { n });
  if (n < -1 && n > -7) return t('{n} days ago', { n: -n });
  return formatDay(d);
}

export function dateRange(start, end) {
  if (!end || startOfDay(start).getTime() === startOfDay(end).getTime()) return formatDay(start);
  return `${formatDay(start)} – ${formatDay(end)}`;
}

/** Value for <input type="datetime-local"> in local time. */
export function toLocalInput(d) {
  if (!d) return '';
  const x = new Date(d);
  const pad = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}T${pad(x.getHours())}:${pad(x.getMinutes())}`;
}

/** Value for <input type="date"> in local time. */
export const toDateInput = (d) => (d ? toLocalInput(d).slice(0, 10) : '');

export function fileSize(bytes) {
  if (bytes < 1024) return `${bytes} ${t('B')}`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} ${t('KB')}`;
  return `${(bytes / 1024 / 1024).toFixed(1)} ${t('MB')}`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return t('Good morning');
  if (h < 18) return t('Good afternoon');
  return t('Good evening');
}

export const firstName = (name = '') => name.trim().split(/\s+/)[0];

export function initials(name = '') {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || '') + (parts[1]?.[0] || '')).toUpperCase();
}

/** Stored mobile (+201001234567) -> what members type and see in fields: 01001234567. */
export function localPhone(phone) {
  if (!phone) return '';
  return phone.startsWith('+20') ? `0${phone.slice(3)}` : phone;
}

/** Stored mobile -> readable: +20 100 123 4567. */
export function displayPhone(phone) {
  if (!phone) return '';
  const m = /^\+20(\d{3})(\d{3})(\d{4})$/.exec(phone);
  return m ? `+20 ${m[1]} ${m[2]} ${m[3]}` : phone;
}
