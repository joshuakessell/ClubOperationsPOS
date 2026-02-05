import { useCallback, useEffect, useRef, useState } from 'react';
import type { KioskNotice } from '../notice';

const DEFAULT_TTL_MS = 4500;

export function useKioskNotice(defaultTtlMs = DEFAULT_TTL_MS) {
  const [notice, setNotice] = useState<KioskNotice | null>(null);
  const timerRef = useRef<number | null>(null);

  const clearNotice = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setNotice(null);
  }, []);

  const showNotice = useCallback(
    (next: KioskNotice, ttlMs = defaultTtlMs) => {
      setNotice(next);
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (ttlMs > 0) {
        timerRef.current = window.setTimeout(() => {
          setNotice(null);
          timerRef.current = null;
        }, ttlMs);
      }
    },
    [defaultTtlMs]
  );

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  return { notice, showNotice, clearNotice, setNotice };
}
