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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function looksLikeRealtimeEvent(value: Record<string, unknown>): boolean {
  return typeof value['type'] === 'string' && Object.prototype.hasOwnProperty.call(value, 'payload');
}

function extractAppSyncRealtimeEventJsonStrings(rawMessage: unknown): string[] {
  const results: string[] = [];
  const queue: unknown[] = [rawMessage];
  const seen = new WeakSet<object>();

  const parseJsonString = (value: string): unknown | null => {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      return null;
    }
  };

  // The AppSync Events websocket protocol has evolved and can deliver the published payload
  // in a few different shapes (e.g. `{ events: ["{...}"] }`, `{ event: { events: [...] } }`,
  // `{ payload: "{...}" }`, etc.). We robustly walk the message and pull out any JSON strings
  // that parse into our internal realtime event schema.
  let iterations = 0;
  while (queue.length > 0 && iterations < 200) {
    iterations += 1;
    const value = queue.shift();
    if (value == null) continue;

    if (typeof value === 'string') {
      const parsed = parseJsonString(value);
      if (parsed && isRecord(parsed) && looksLikeRealtimeEvent(parsed)) {
        results.push(value);
        continue;
      }
      if (parsed && (isRecord(parsed) || Array.isArray(parsed))) {
        queue.push(parsed);
      }
      continue;
    }

    if (Array.isArray(value)) {
      if (seen.has(value)) continue;
      seen.add(value);
      for (const item of value) {
        queue.push(item);
      }
      continue;
    }

    if (!isRecord(value)) continue;
    if (seen.has(value)) continue;
    seen.add(value);

    if (looksLikeRealtimeEvent(value)) {
      results.push(JSON.stringify(value));
      continue;
    }

    for (const key of ['events', 'event', 'payload', 'data']) {
      const nested = value[key];
      if (nested !== undefined) {
        queue.push(nested);
      }
    }
  }

  return results;
}

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
  staffToken,
  enabled = true,
  reconnectMode = 'default',
}: {
  laneId?: string;
  role: LaneRole;
  kioskToken: string;
  staffToken?: string;
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
  const realtimeDebugRaw = env?.VITE_REALTIME_DEBUG;
  const realtimeDebug =
    realtimeDebugRaw === true ||
    realtimeDebugRaw === 'true' ||
    realtimeDebugRaw === '1' ||
    realtimeDebugRaw === 'yes';
  const effectiveEnabled = enabled && !realtimeDisabled;
  const channelNamespace = getChannelNamespace(env);
  const authUrl = getApiUrl('/api/v1/realtime/auth');
  const MAX_CONSECUTIVE_FAILURES =
    reconnectMode === 'aggressive' ? Number.MAX_SAFE_INTEGER : 3;
  const COOLDOWN_MS = reconnectMode === 'aggressive' ? 0 : 60_000;
  const [connected, setConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<MessageEvent | null>(null);
  const [lastError, setLastError] = useState<Event | null>(null);

  const logRealtime = (...args: unknown[]) => {
    if (!realtimeDebug) return;
    console.warn('[realtime]', ...args);
  };

  const pendingMessagesRef = useRef<MessageEvent[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleFlush = () => {
    if (flushTimerRef.current) return;
    flushTimerRef.current = setTimeout(() => {
      flushTimerRef.current = null;
      const next = pendingMessagesRef.current.shift();
      if (next) {
        setLastMessage(next);
      }
      if (pendingMessagesRef.current.length > 0) {
        scheduleFlush();
      }
    }, 0);
  };

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
    pendingMessagesRef.current = [];
    if (flushTimerRef.current) {
      clearTimeout(flushTimerRef.current);
      flushTimerRef.current = null;
    }
    if (cooldownTimerRef.current) {
      clearTimeout(cooldownTimerRef.current);
      cooldownTimerRef.current = null;
    }
  }, [laneId, role, kioskToken, staffToken]);

  // Ensure we don't keep background sockets alive when this hook is not mounted anymore,
  // or when the lane/role changes.
  useEffect(() => {
    return () => {
      if (laneId === undefined) return;
      appSyncSocketRef.current?.close();
      appSyncSocketRef.current = null;
      pendingMessagesRef.current = [];
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
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

    if (!kioskToken) {
      if (!staffToken) {
        setConnected(false);
        setLastError(new Event('missing_kiosk_token'));
        return;
      }
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
            ...(staffToken ? { Authorization: `Bearer ${staffToken}` } : {}),
            ...(kioskToken ? { 'x-kiosk-token': kioskToken } : {}),
          },
          body: JSON.stringify({ channels }),
        });
        if (res.status === 501 || res.status === 404) {
          logRealtime('auth endpoint not configured', {
            status: res.status,
            authUrl,
            laneId,
            role,
          });
          setConnected(false);
          setLastError(new Event('realtime_not_configured'));
          return;
        }
        if (!res.ok) {
          const responseBody = await res.text().catch(() => '');
          logRealtime('auth failed', {
            status: res.status,
            statusText: res.statusText,
            body: responseBody.slice(0, 500),
            authUrl,
            laneId,
            role,
          });
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
          logRealtime('socket closed', {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            laneId,
            role,
            reconnectMode,
            retryCount: retryCountRef.current,
            hasEverConnected: hasEverConnectedRef.current,
          });
          setConnected(false);
          if (!hasEverConnectedRef.current) {
            consecutiveFailureRef.current += 1;
          } else {
            consecutiveFailureRef.current = 0;
          }
          scheduleReconnect();
        };

        const onError = (event: Event) => {
          logRealtime('socket error event', {
            type: event.type,
            laneId,
            role,
            reconnectMode,
          });
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
            logRealtime('connection_error message', {
              laneId,
              role,
              reconnectMode,
            });
            setLastError(new Event('connection_error'));
            try {
              socket.close();
            } catch {
              // ignore
            }
            return;
          }

          if (message.type === 'subscribe_error') {
            logRealtime('subscribe_error message', {
              laneId,
              role,
              reconnectMode,
              details: message.error,
            });
            setLastError(new Event('subscribe_error'));
            return;
          }

          if (message.type === 'data') {
            const events = extractAppSyncRealtimeEventJsonStrings(message);
            if (events.length === 0) return;
            for (const data of events) {
              pendingMessagesRef.current.push({ data } as MessageEvent);
            }
            scheduleFlush();
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
        logRealtime('auth/connect exception', {
          laneId,
          role,
          reconnectMode,
          error: error instanceof Error ? error.message : String(error),
        });
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
  }, [
    authUrl,
    channelNamespace,
    connectNonce,
    effectiveEnabled,
    laneId,
    kioskToken,
    role,
    staffToken,
  ]);

  return { connected, lastMessage, lastError };
}
