import { useCallback, useEffect, useRef } from 'react';
import { SessionUpdatedPayloadSchema, type SessionUpdatedPayload } from '@club-ops/shared';
import { isRecord, readJson } from '@club-ops/ui';
import { API_BASE } from '../shared/api';

type LaneSessionActions = {
  applySessionUpdated: (payload: SessionUpdatedPayload) => void;
  resetCleared: () => void;
};

type Params = {
  lane: string;
  realtimeConnected: boolean;
  staffToken?: string | null;
  currentSessionId?: string | null;
  laneSessionActions: LaneSessionActions;
};

export function usePollingFallback({
  lane,
  realtimeConnected,
  staffToken,
  currentSessionId,
  laneSessionActions,
}: Params) {
  const lastServerErrorLogAtRef = useRef<number>(0);
  const rawEnv = import.meta.env as unknown as Record<string, unknown>;
  const kioskToken =
    typeof rawEnv.VITE_KIOSK_TOKEN === 'string' && rawEnv.VITE_KIOSK_TOKEN.trim()
      ? rawEnv.VITE_KIOSK_TOKEN.trim()
      : null;

  const pollOnce = useCallback(async () => {
    try {
      const headers: Record<string, string> = {};
      if (staffToken) {
        headers['Authorization'] = `Bearer ${staffToken}`;
      }
      if (typeof kioskToken === 'string' && kioskToken) {
        headers['x-kiosk-token'] = kioskToken;
      }
      const res = await fetch(
        `${API_BASE}/v1/checkin/lane/${encodeURIComponent(lane)}/session-snapshot`,
        { headers }
      );
      if (!res.ok) {
        if (res.status >= 500) {
          const now = Date.now();
          if (now - lastServerErrorLogAtRef.current > 10_000) {
            lastServerErrorLogAtRef.current = now;
            console.error(
              `Polling fallback received HTTP ${res.status} from session-snapshot; throttling log output.`
            );
          }
        }
        return;
      }
      const data = await readJson<unknown>(res);
      if (!isRecord(data)) return;

      // Defensive: only act on snapshots that explicitly include the `session` key.
      // Some edge responses may return `{}` on transient failures; treating that as
      // "no active session" can cause UI flicker (and close important modals).
      if (!Object.prototype.hasOwnProperty.call(data, 'session')) return;

      const sessionPayload = data['session'];
      if (sessionPayload == null) {
        laneSessionActions.resetCleared();
        return;
      }
      if (isRecord(sessionPayload)) {
        const parsed = SessionUpdatedPayloadSchema.safeParse(sessionPayload);
        if (parsed.success) {
          laneSessionActions.applySessionUpdated(parsed.data);
        }
      }
    } catch (error) {
      const now = Date.now();
      if (now - lastServerErrorLogAtRef.current > 10_000) {
        lastServerErrorLogAtRef.current = now;
        console.error('Polling fallback failed; throttling log output.', error);
      }
    }
  }, [kioskToken, lane, laneSessionActions, staffToken]);

  const pollingDelayTimerRef = useRef<number | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const connectedPollIntervalRef = useRef<number | null>(null);

  const hydrationKeyRef = useRef<string | null>(null);
  useEffect(() => {
    const hydrationKey = `${lane}:${currentSessionId ?? 'none'}`;
    if (hydrationKeyRef.current === hydrationKey) return;
    hydrationKeyRef.current = hydrationKey;
    void pollOnce();
  }, [currentSessionId, lane, pollOnce]);

  useEffect(() => {
    if (pollingDelayTimerRef.current !== null) {
      window.clearTimeout(pollingDelayTimerRef.current);
      pollingDelayTimerRef.current = null;
    }
    if (pollingIntervalRef.current !== null) {
      window.clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (connectedPollIntervalRef.current !== null) {
      window.clearInterval(connectedPollIntervalRef.current);
      connectedPollIntervalRef.current = null;
    }

    if (realtimeConnected) return;

    pollingDelayTimerRef.current = window.setTimeout(() => {
      if (realtimeConnected) return;
      void pollOnce();
      pollingIntervalRef.current = window.setInterval(() => {
        void pollOnce();
      }, 2000);
    }, 1200);

    return () => {
      if (pollingDelayTimerRef.current !== null) {
        window.clearTimeout(pollingDelayTimerRef.current);
        pollingDelayTimerRef.current = null;
      }
      if (pollingIntervalRef.current !== null) {
        window.clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (connectedPollIntervalRef.current !== null) {
        window.clearInterval(connectedPollIntervalRef.current);
        connectedPollIntervalRef.current = null;
      }
    };
  }, [pollOnce, realtimeConnected]);

  useEffect(() => {
    if (connectedPollIntervalRef.current !== null) {
      window.clearInterval(connectedPollIntervalRef.current);
      connectedPollIntervalRef.current = null;
    }

    if (!realtimeConnected || !currentSessionId) return;

    void pollOnce();
    connectedPollIntervalRef.current = window.setInterval(() => {
      void pollOnce();
    }, 5000);

    return () => {
      if (connectedPollIntervalRef.current !== null) {
        window.clearInterval(connectedPollIntervalRef.current);
        connectedPollIntervalRef.current = null;
      }
    };
  }, [currentSessionId, pollOnce, realtimeConnected]);

  return { pollOnce };
}
