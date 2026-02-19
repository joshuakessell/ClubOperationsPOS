import { useEffect, useRef, useState } from 'react';
import { isRecord, readJson } from '@club-ops/shared';
import { API_BASE } from '../shared/api';
import type { HealthStatus } from '../shared/types';

const HEALTH_BASE_INTERVAL_MS = 15_000;
const HEALTH_MIN_BACKOFF_MS = 5_000;
const HEALTH_MAX_BACKOFF_MS = 60_000;

export function useHealthStatus(lane: string) {
  const [health, setHealth] = useState<HealthStatus | null>(null);
  const lastHealthErrorLogAtRef = useRef<number>(0);
  const consecutiveFailuresRef = useRef<number>(0);

  useEffect(() => {
    let cancelled = false;
    let timerId: number | null = null;

    const getNextInterval = () => {
      const failures = consecutiveFailuresRef.current;
      if (failures === 0) return HEALTH_BASE_INTERVAL_MS;
      const backoff = Math.min(
        HEALTH_MAX_BACKOFF_MS,
        HEALTH_MIN_BACKOFF_MS * Math.pow(2, failures - 1)
      );
      return backoff;
    };

    const scheduleNext = () => {
      if (cancelled) return;
      timerId = window.setTimeout(() => {
        void checkHealth();
      }, getNextInterval());
    };

    const checkHealth = async () => {
      try {
        const res = await fetch(`${API_BASE}/health`);
        if (!res.ok) {
          throw new Error(`Health check failed (HTTP ${res.status})`);
        }
        const data = await readJson<unknown>(res);
        if (
          !cancelled &&
          isRecord(data) &&
          typeof data.status === 'string' &&
          typeof data.timestamp === 'string' &&
          typeof data.uptime === 'number'
        ) {
          consecutiveFailuresRef.current = 0;
          setHealth({ status: data.status, timestamp: data.timestamp, uptime: data.uptime });
        }
      } catch (err) {
        consecutiveFailuresRef.current += 1;
        if (!cancelled) {
          setHealth({
            status: 'down',
            timestamp: new Date().toISOString(),
            uptime: 0,
          });
        }
        const now = Date.now();
        if (now - lastHealthErrorLogAtRef.current > 10_000) {
          lastHealthErrorLogAtRef.current = now;
          console.error('Health check failed; throttling log output:', err);
        }
      }
      scheduleNext();
    };

    void checkHealth();

    return () => {
      cancelled = true;
      if (timerId !== null) {
        window.clearTimeout(timerId);
      }
    };
  }, [lane]);

  return { health };
}
