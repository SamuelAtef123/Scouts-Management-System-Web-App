/**
 * Browsers send file names as UTF-8, but the upload library reads them as Latin-1,
 * so Arabic names arrive scrambled (e.g. "Ø§Ù„..."). This turns them back into the original text.
 * A name that is already correct (plain English, or already fixed) is returned unchanged.
 */
export function fixFileName(name) {
  if (!name || !/[\u0080-ÿ]/.test(name) || /[^\u0000-ÿ]/.test(name)) return name;
  const decoded = Buffer.from(name, 'latin1').toString('utf8');
  return decoded.includes('�') ? name : decoded;
}
