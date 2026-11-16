import { useCallback, useEffect, useState } from 'react';
import { api } from './api.js';

/** Loads `path` from the API. Returns { data, error, loading, reload, setData }. */
export function useApi(path) {
  const [state, setState] = useState({ data: null, error: '', loading: true });

  const load = useCallback(() => {
    if (!path) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: '' }));
    api
      .get(path)
      .then((data) => !cancelled && setState({ data, error: '', loading: false }))
      .catch((err) => !cancelled && setState({ data: null, error: err.message, loading: false }));
    return () => {
      cancelled = true;
    };
  }, [path]);

  useEffect(() => load(), [load]);

  const setData = useCallback((updater) => {
    setState((s) => ({ ...s, data: typeof updater === 'function' ? updater(s.data) : updater }));
  }, []);

  return { ...state, reload: load, setData };
}
