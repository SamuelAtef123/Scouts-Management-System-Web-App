import { useEffect, useState } from 'react';
import { fetchImageUrl } from './api.js';

// Photos already loaded this session: "userId:version" -> object URL (or a pending promise).
const cache = new Map();

/** The photo of a member as an image URL, or null while loading / when they have none. */
export function useMemberPhoto(userId, version) {
  const key = userId && version ? `${userId}:${new Date(version).getTime()}` : null;
  const cached = key ? cache.get(key) : null;
  const [url, setUrl] = useState(typeof cached === 'string' ? cached : null);

  useEffect(() => {
    if (!key) {
      setUrl(null);
      return;
    }
    let alive = true;
    let entry = cache.get(key);
    if (typeof entry === 'string') {
      setUrl(entry);
      return;
    }
    if (!entry) {
      entry = fetchImageUrl(`/users/${userId}/photo`).then(
        (u) => (cache.set(key, u), u),
        () => (cache.delete(key), null)
      );
      cache.set(key, entry);
    }
    entry.then((u) => alive && setUrl(u));
    return () => {
      alive = false;
    };
  }, [key, userId]);

  return url;
}

/** Shrinks and crops a chosen picture to a square JPEG (default 400x400) before upload. */
export async function squarePhoto(file, size = 400) {
  if (!file.type.startsWith('image/')) throw new Error('Choose an image file');
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('This image could not be read. Try a JPEG or PNG photo.');
  });
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  bitmap.close?.();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not process the photo'))), 'image/jpeg', 0.85)
  );
}
