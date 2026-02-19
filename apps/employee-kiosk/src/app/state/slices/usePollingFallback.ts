import { useCallback, useEffect, useRef } from 'react';
import { SessionUpdatedPayloadSchema, type SessionUpdatedPayload } from '@club-ops/shared';
import { isRecord, readJson } from '@club-ops/shared';
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

  const pollOnce = useCallback(async (): Promise<boolean> => {
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
        return false;
      }
      const data = await readJson<unknown>(res);
      if (!isRecord(data)) return true;

      // Defensive: only act on snapshots that explicitly include the `session` key.
      // Some edge responses may return `{}` on transient failures; treating that as
      // "no active session" can cause UI flicker (and close important modals).
      if (!Object.prototype.hasOwnProperty.call(data, 'session')) return true;

      const sessionPayload = data['session'];
      if (sessionPayload == null) {
        laneSessionActions.resetCleared();
        return true;
      }
      if (isRecord(sessionPayload)) {
        const parsed = SessionUpdatedPayloadSchema.safeParse(sessionPayload);
        if (parsed.success) {
          laneSessionActions.applySessionUpdated(parsed.data);
        }
      }
      return true;
    } catch (error) {
      const now = Date.now();
      if (now - lastServerErrorLogAtRef.current > 10_000) {
        lastServerErrorLogAtRef.current = now;
        console.error('Polling fallback failed; throttling log output.', error);
      }
      return false;
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

    // Session-gate: only poll when realtime is disconnected AND there's an active session.
    // When idle (no session), there's nothing to sync.
    if (realtimeConnected || !currentSessionId) return;

    const POLL_BASE_MS = 2000;
    const POLL_MAX_MS = 30_000;
    let consecutiveErrors = 0;
    // Mutable container so cleanup can always cancel the latest in-flight timer,
    // even if the effect re-runs while pollWithBackoff is mid-await.
    const chain = { timerId: null as number | null, cancelled: false };

    const getNextInterval = () => {
      if (consecutiveErrors === 0) return POLL_BASE_MS;
      return Math.min(POLL_MAX_MS, POLL_BASE_MS * Math.pow(2, consecutiveErrors));
    };

    const pollWithBackoff = async () => {
      if (chain.cancelled) return;
      const success = await pollOnce();
      if (chain.cancelled) return;
      if (success) {
        consecutiveErrors = 0;
      } else {
        consecutiveErrors += 1;
      }
      chain.timerId = window.setTimeout(() => {
        void pollWithBackoff();
      }, getNextInterval());
    };

    pollingDelayTimerRef.current = window.setTimeout(() => {
      void pollWithBackoff();
    }, 1200);

    return () => {
      chain.cancelled = true;
      if (pollingDelayTimerRef.current !== null) {
        window.clearTimeout(pollingDelayTimerRef.current);
        pollingDelayTimerRef.current = null;
      }
      if (chain.timerId !== null) {
        window.clearTimeout(chain.timerId);
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
  }, [pollOnce, realtimeConnected, currentSessionId]);

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
