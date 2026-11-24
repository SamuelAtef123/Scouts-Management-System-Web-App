/*
 * Detects a file's real type from its first bytes ("magic numbers"), instead of trusting
 * the type the browser claims. This stops, for example, a web page renamed or labelled
 * as a PDF from being stored and served back as a page.
 */

const startsWith = (buf, bytes, offset = 0) => bytes.every((b, i) => buf[offset + i] === b);
const ascii = (buf, start, end) => buf.subarray(start, end).toString('latin1');

/** @returns {{ mime: string, ext: string } | null} */
export function detectFileType(buf) {
  if (!buf || buf.length < 12) return null;
  if (startsWith(buf, [0x25, 0x50, 0x44, 0x46, 0x2d])) return { mime: 'application/pdf', ext: 'pdf' }; // %PDF-
  if (startsWith(buf, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(buf, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return { mime: 'image/png', ext: 'png' };
  if (ascii(buf, 0, 6) === 'GIF87a' || ascii(buf, 0, 6) === 'GIF89a') return { mime: 'image/gif', ext: 'gif' };
  if (ascii(buf, 0, 4) === 'RIFF' && ascii(buf, 8, 12) === 'WEBP') return { mime: 'image/webp', ext: 'webp' };
  if (ascii(buf, 4, 8) === 'ftyp') {
    const brand = ascii(buf, 8, 12);
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return { mime: 'image/heic', ext: 'heic' };
  }
  // Old Word documents (.doc): OLE compound file.
  if (startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1])) return { mime: 'application/msword', ext: 'doc' };
  // .docx is a ZIP that contains word/ entries.
  if (startsWith(buf, [0x50, 0x4b, 0x03, 0x04]) && buf.includes(Buffer.from('word/'))) {
    return { mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', ext: 'docx' };
  }
  return null;
}
