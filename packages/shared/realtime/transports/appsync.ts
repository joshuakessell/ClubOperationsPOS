import { getApiUrl } from '../../src/apiBase.js';
import type {
  RealtimeTransport,
  RealtimeTransportOptions,
  RealtimeTransportStatus,
} from './types.js';

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

export class AppSyncTransport implements RealtimeTransport {
  private status: RealtimeTransportStatus = 'disconnected';
  private socket: WebSocket | null = null;
  private readonly options: RealtimeTransportOptions;
  private readonly authUrl: string;
  private readonly channelNamespace: string;

  constructor(params: {
    laneId: string;
    role: 'customer' | 'employee';
    kioskToken: string;
    staffToken?: string;
    options: RealtimeTransportOptions;
  }) {
    const metaEnv = (import.meta as unknown as { env?: Record<string, unknown> }).env ?? {};
    const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env ?? {};
    const env = { ...metaEnv, ...processEnv };

    this.options = params.options;
    this.authUrl = getApiUrl('/api/v1/realtime/auth');
    this.channelNamespace = getChannelNamespace(env);

    // Keep these for possible future enhancements (reconnect, etc).
    void params;
  }

  getStatus(): RealtimeTransportStatus {
    return this.status;
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
    this.setStatus('disconnected');
  }

  async connect(): Promise<void> {
    if (this.socket) return;
    this.setStatus('connecting');

    // NOTE: This is a scaffold for transport abstraction. The existing useLaneSession
    // already fully implements auth + subscribe flows. We'll port it over incrementally.
    const namespace = this.channelNamespace;
    const laneChannel = buildChannel(namespace, 'lane', 'todo');
    void laneChannel;

    const response = await fetch(this.authUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      this.setStatus('disconnected');
      throw new Error(`Realtime auth failed: ${response.status}`);
    }

    const auth = (await response.json()) as AppSyncAuthResponse;
    if (!auth?.realtimeEndpoint) {
      this.setStatus('disconnected');
      throw new Error('Realtime auth returned invalid payload');
    }

    const connectionPayload = base64UrlEncode(JSON.stringify(auth.connectionHeaders ?? {}));
    const socketUrl = `${auth.realtimeEndpoint}?header=${connectionPayload}&payload=e30=`;
    const socket = new WebSocket(socketUrl, ['graphql-ws']);
    this.socket = socket;

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: 'connection_init' }));
    };

    socket.onmessage = (event) => {
      let parsed: AppSyncMessage | null = null;
      try {
        parsed = JSON.parse(event.data as string) as AppSyncMessage;
      } catch {
        parsed = null;
      }

      if (parsed && parsed.type === 'connection_ack') {
        this.setStatus('connected');
        return;
      }

      if (parsed && parsed.type === 'data') {
        const events = extractAppSyncRealtimeEventJsonStrings(parsed);
        for (const jsonString of events) {
          try {
            this.options.onEvent({ type: 'message', data: JSON.parse(jsonString) });
          } catch {
            // ignore
          }
        }
      }
    };

    socket.onerror = () => {
      this.setStatus('disconnected');
    };

    socket.onclose = () => {
      this.socket = null;
      this.setStatus('disconnected');
    };
  }

  private setStatus(next: RealtimeTransportStatus): void {
    if (this.status === next) return;
    this.status = next;
    this.options.onStatus?.(next);
  }
}
