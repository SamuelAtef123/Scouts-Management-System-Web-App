const dayFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
const fullFmt = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: 'numeric', minute: '2-digit', hour12: true });
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

export const formatDay = (d) => dayFmt.format(new Date(d));
export const formatFullDate = (d) => fullFmt.format(new Date(d));
export const formatTime = (d) => timeFmt.format(new Date(d));
export const formatMonth = (d) => monthFmt.format(new Date(d));

/** Whole days from today to the date (negative = in the past). */
export function daysUntil(d) {
  return Math.round((startOfDay(d) - startOfDay(new Date())) / 86400000);
}

export function relativeDay(d) {
  const n = daysUntil(d);
  if (n === 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n === -1) return 'Yesterday';
  if (n > 1 && n < 7) return `In ${n} days`;
  if (n < -1 && n > -7) return `${-n} days ago`;
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
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
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
