import { useCallback, useEffect, useRef, useState } from 'react';
import { call, type Policy, type State } from './api';

/** Loads /api/state and re-fetches it on every SSE event (debounced). */
export function useGuard() {
  const [state, setState] = useState<State | null>(null);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [online, setOnline] = useState(false);
  const timer = useRef<number>(0);

  const refresh = useCallback(() => {
    clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      call<State>('GET', '/state').then((s) => { setState(s); setOnline(true); }).catch(() => setOnline(false));
    }, 60);
  }, []);

  useEffect(() => {
    call<Policy>('GET', '/policy').then(setPolicy).catch(() => {});
    refresh();
    const es = new EventSource('/api/stream');
    es.onmessage = refresh;
    es.onopen = () => { setOnline(true); refresh(); };
    es.onerror = () => setOnline(false);
    return () => es.close();
  }, [refresh]);

  return { state, policy, online, refresh };
}
