import { t } from './i18n.jsx';

const TOKEN_KEY = 'scouts_token';

export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* private mode: the session simply won't persist */
    }
  },
};

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Lets the auth provider sign the user out when the server says the session expired.
let onUnauthorized = () => {};
export function setUnauthorizedHandler(fn) {
  onUnauthorized = fn;
}

async function request(method, path, body) {
  const headers = {};
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  let res;
  try {
    res = await fetch(`/api${path}`, { method, headers, body: body !== undefined ? JSON.stringify(body) : undefined });
  } catch {
    throw new ApiError(0, t('No connection. Check your internet and try again.'));
  }

  const data = await res.json().catch(() => null);
  if (data === null && !res.ok) {
    // No JSON at all: the API server itself did not answer (not running, or crashed).
    throw new ApiError(res.status, t('Cannot reach the server. Make sure it is running, then try again.'));
  }
  if (!res.ok) {
    if (res.status === 401 && path !== '/auth/login') onUnauthorized();
    // Server messages are in English; show them in the chosen language when a translation exists.
    throw new ApiError(res.status, t(data.message || 'Something went wrong'));
  }
  return data;
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body ?? {}),
  put: (path, body) => request('PUT', path, body ?? {}),
  del: (path) => request('DELETE', path),

  /** Uploads a file with progress (0-100) reported through onProgress. */
  upload(path, file, onProgress, { method = 'POST', fileName } = {}) {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open(method, `/api${path}`);
      const token = tokenStore.get();
      if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let data = {};
        try {
          data = JSON.parse(xhr.responseText);
        } catch {
          /* ignore */
        }
        if (xhr.status >= 200 && xhr.status < 300) resolve(data);
        else reject(new ApiError(xhr.status, t(data.message || 'Upload failed')));
      };
      xhr.onerror = () => reject(new ApiError(0, t('Upload failed. Check your internet and try again.')));
      const form = new FormData();
      if (fileName) form.append('file', file, fileName);
      else form.append('file', file);
      xhr.send(form);
    });
  },
};

/** Loads a protected image (e.g. a member photo) with the sign-in token and returns an object URL. */
export async function fetchImageUrl(path) {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  if (!res.ok) throw new ApiError(res.status, t('Image not found'));
  return URL.createObjectURL(await res.blob());
}
