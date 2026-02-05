import { useEffect, useRef, useState } from 'react';
import { getApiUrl } from '../src/apiBase.js';

export type LaneRole = 'customer' | 'employee';

type AppSyncAuthResponse = {
  realtimeEndpoint: string;
  connectionHeaders: Record<string, string>;
  subscriptions: Record<string, Record<string, string>>;
};

type AppSyncMessage =
  | { type: 'connection_ack' | 'ka' }
  | { type: 'connection_error'; errors?: unknown[] }
  | { type: 'subscribe_success' | 'unsubscribe_success'; id?: string }
  | { type: 'subscribe_error' | 'unsubscribe_error'; id?: string; error?: unknown }
  | { type: 'data'; id?: string; event?: unknown; events?: unknown[] };

function base64UrlEncode(input: string): string {
  const base64 = btoa(unescape(encodeURIComponent(input)));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function getEnvString(env: Record<string, unknown> | undefined, key: string): string | null {
  const value = env?.[key];
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function getChannelNamespace(env: Record<string, unknown> | undefined): string {
  return getEnvString(env, 'VITE_REALTIME_CHANNEL_NAMESPACE') ?? 'club-ops';
}

function buildChannel(namespace: string, ...segments: string[]): string {
  const cleaned = [namespace, ...segments].map((segment) => segment.trim()).filter(Boolean);
  return `/${cleaned.join('/')}`;
}

function createSubscriptionId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `sub-${Math.random().toString(36).slice(2, 10)}`;
}

export function useLaneSession({
  laneId,
  role,
  kioskToken,
  enabled = true,
  reconnectMode = 'default',
}: {
  laneId?: string;
  role: LaneRole;
  kioskToken: string;
  enabled?: boolean;
  reconnectMode?: 'default' | 'aggressive';
}): {
  connected: boolean;
  lastMessage: MessageEvent | null;
  lastError: Event | null;
} {
  const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
  const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
    .process?.env ?? {};
  const env = { ...metaEnv, ...processEnv };
  const disableRealtimeRaw = env?.VITE_DISABLE_REALTIME;
  const realtimeDisabled =
    disableRealtimeRaw === true || disableRealtimeRaw === 'true' || disableRealtimeRaw === '1';
  const effectiveEnabled = enabled && !realtimeDisabled;
  const realtimeProvider = getEnvString(env, 'VITE_REALTIME_PROVIDER') ?? 'appsync-events';
  const useAppSyncEvents = realtimeProvider === 'appsync-events';
  const channelNamespace = getChannelNamespace(env);
  const authUrl = getApiUrl('/api/v1/realtime/auth');
  const MAX_CONSECUTIVE_FAILURES =
    reconnectMode === 'aggressive' ? Number.MAX_SAFE_INTEGER : 3;
  const COOLDOWN_MS = reconnectMode === 'aggressive' ? 0 : 60_000;
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [lastError, setLastError] = useState<Event | null>(null);

  // Force a re-connect effect when we need to build a fresh socket and re-attach listeners.
  const [connectNonce, setConnectNonce] = useState(0);
  const retryCountRef = useRef(0);
  const consecutiveFailureRef = useRef(0);
  const hasEverConnectedRef = useRef(false);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cooldownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closedIntentionallyRef = useRef(false);
  const appSyncSocketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    consecutiveFailureRef.current = 0;
    hasEverConnectedRef.current = false;
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, [laneId, role, kioskToken]);

  // Ensure we don't keep background sockets alive when this hook is not mounted anymore,
  // or when the lane/role changes.
  useEffect(() => {
    return () => {
      if (laneId === undefined) return;
      appSyncSocketRef.current?.close();
      appSyncSocketRef.current = null;
    };
  }, [laneId, role]);

  useEffect(() => {
    if (!effectiveEnabled || laneId === undefined) {
      closedIntentionallyRef.current = true;
      setConnected(false);
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
      if (cooldownTimerRef.current) {
        clearTimeout(cooldownTimerRef.current);
        cooldownTimerRef.current = null;
      }
      if (laneId !== undefined) {
        appSyncSocketRef.current?.close();
        appSyncSocketRef.current = null;
      }
      return;
    }

    closedIntentionallyRef.current = false;

    if (!useAppSyncEvents) {
      setConnected(false);
      setLastError(new Event('realtime_provider_disabled'));
      return;
    }

    if (!kioskToken) {
      setConnected(false);
      setLastError(new Event('missing_kiosk_token'));
      return;
    }

    const scheduleReconnect = () => {
      if (!effectiveEnabled) return;
      if (closedIntentionallyRef.current) return;
      if (
        !hasEverConnectedRef.current &&
        consecutiveFailureRef.current >= MAX_CONSECUTIVE_FAILURES
      ) {
        if (cooldownTimerRef.current) return;
        cooldownTimerRef.current = setTimeout(() => {
          cooldownTimerRef.current = null;
          consecutiveFailureRef.current = 0;
          setConnectNonce((n) => n + 1);
        }, COOLDOWN_MS);
        return;
      }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);

      const attempt = retryCountRef.current + 1;
      retryCountRef.current = attempt;

      const baseDelay = Math.min(30000, 500 * Math.pow(2, attempt - 1));
      const jitter = baseDelay * 0.2 * Math.random();
      const delayMs = Math.round(baseDelay + jitter);

      reconnectTimerRef.current = setTimeout(() => {
        setConnectNonce((n) => n + 1);
      }, delayMs);
    };

    const laneSegment = laneId && laneId.trim() ? laneId.trim() : null;
    const channels = [buildChannel(channelNamespace, 'global')];
    if (laneSegment) {
      channels.push(buildChannel(channelNamespace, 'lane', laneSegment));
    }

    const connectAppSync = async () => {
      try {
        const res = await fetch(authUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(kioskToken ? { 'x-kiosk-token': kioskToken } : {}),
          },
          body: JSON.stringify({ channels }),
        });
        if (res.status === 501 || res.status === 404) {
          setConnected(false);
          setLastError(new Event('realtime_not_configured'));
          return;
        }
        if (!res.ok) {
          throw new Error(`Auth failed (${res.status})`);
        }
        const auth = (await res.json()) as AppSyncAuthResponse;
        const protocols = [
          'aws-appsync-event-ws',
          `header-${base64UrlEncode(JSON.stringify(auth.connectionHeaders))}`,
        ];
        const socket = new WebSocket(auth.realtimeEndpoint, protocols);
        appSyncSocketRef.current = socket;

        let didSubscribe = false;

        const onOpen = () => {
          socket.send(JSON.stringify({ type: 'connection_init' }));
        };

        const onClose = (event: CloseEvent) => {
          void event;
          setConnected(false);
          if (!hasEverConnectedRef.current) {
            consecutiveFailureRef.current += 1;
          } else {
            consecutiveFailureRef.current = 0;
          }
          scheduleReconnect();
        };

        const onError = (event: Event) => {
          setLastError(event);
        };

        const onMessage = (event: MessageEvent) => {
          let message: AppSyncMessage | null = null;
          try {
            message = JSON.parse(String(event.data)) as AppSyncMessage;
          } catch {
            return;
          }

          if (!message || typeof message !== 'object') return;

          if (message.type === 'connection_ack') {
            if (reconnectTimerRef.current) {
              clearTimeout(reconnectTimerRef.current);
              reconnectTimerRef.current = null;
            }
            if (cooldownTimerRef.current) {
              clearTimeout(cooldownTimerRef.current);
              cooldownTimerRef.current = null;
            }
            retryCountRef.current = 0;
            consecutiveFailureRef.current = 0;
            hasEverConnectedRef.current = true;
            setConnected(true);

            if (!didSubscribe) {
              didSubscribe = true;
              for (const channel of channels) {
                const authHeaders = auth.subscriptions[channel];
                if (!authHeaders) continue;
                const id = createSubscriptionId();
                socket.send(
                  JSON.stringify({
                    id,
                    type: 'subscribe',
                    channel,
                    authorization: authHeaders,
                  })
                );
              }
            }
            return;
          }

          if (message.type === 'connection_error') {
            setLastError(new Event('connection_error'));
            try {
              socket.close();
            } catch {
              // ignore
            }
            return;
          }

          if (message.type === 'subscribe_error') {
            setLastError(new Event('subscribe_error'));
            return;
          }

          if (message.type === 'data') {
            const rawEvents = message.events ?? message.event;
            if (!rawEvents) return;
            const events = Array.isArray(rawEvents) ? rawEvents : [rawEvents];
            for (const payload of events) {
              const data = typeof payload === 'string' ? payload : JSON.stringify(payload ?? {});
              setLastMessage({ data } as MessageEvent);
            }
          }
        };

        socket.addEventListener('open', onOpen);
        socket.addEventListener('close', onClose);
        socket.addEventListener('error', onError);
        socket.addEventListener('message', onMessage);

        if (socket.readyState === WebSocket.OPEN) {
          onOpen();
        }
      } catch (error) {
        setLastError(new Event('auth_error'));
        scheduleReconnect();
      }
    };

    void connectAppSync();

    return () => {
      const socket = appSyncSocketRef.current;
      if (socket) {
        try {
          socket.close();
        } catch {
          // ignore
        }
        appSyncSocketRef.current = null;
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
        reconnectTimerRef.current = null;
      }
    };
  }, [authUrl, channelNamespace, connectNonce, effectiveEnabled, laneId, kioskToken, role]);

  return { connected, lastMessage, lastError };
}
