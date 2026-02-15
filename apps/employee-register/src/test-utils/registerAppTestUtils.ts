import { beforeEach, afterEach, expect, vi, type Mock } from 'vitest';
import { waitFor } from '@testing-library/react';

if (!global.fetch) {
  global.fetch = vi.fn();
} else if (!(global.fetch instanceof Function)) {
  global.fetch = vi.fn();
}

export type MockRealtimeSocket = {
  url: string;
  readyState: number;
  onopen: ((ev: Event) => unknown) | null;
  onclose: ((ev: CloseEvent) => unknown) | null;
  onmessage: ((ev: { data: string }) => unknown) | null;
  addEventListener: (
    type: 'open' | 'close' | 'message' | 'error',
    handler: (ev: unknown) => void
  ) => void;
  removeEventListener: (
    type: 'open' | 'close' | 'message' | 'error',
    handler: (ev: unknown) => void
  ) => void;
  close: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};

let lastSocket: MockRealtimeSocket | null = null;
export const createdSockets: MockRealtimeSocket[] = [];

const RealtimeSocketMock = vi.fn((url?: string) => {
  const listeners: Record<'open' | 'close' | 'message' | 'error', Array<(ev: unknown) => void>> = {
    open: [],
    close: [],
    message: [],
    error: [],
  };

  let assignedOnMessage: ((ev: { data: string }) => unknown) | null = null;

  const ws: MockRealtimeSocket = {
    url: typeof url === 'string' ? url : 'wss://test/realtime',
    readyState: 0,
    // Always provide dispatchers so tests can locate the instance and trigger events.
    onopen: (ev) => {
      ws.readyState = 1;
      for (const fn of listeners.open) fn(ev);
    },
    onclose: (ev) => {
      ws.readyState = 3;
      for (const fn of listeners.close) fn(ev);
    },
    onmessage: null,
    addEventListener: vi.fn(
      (type: 'open' | 'close' | 'message' | 'error', handler: (ev: unknown) => void) => {
        listeners[type].push(handler);
      }
    ),
    removeEventListener: vi.fn(
      (type: 'open' | 'close' | 'message' | 'error', handler: (ev: unknown) => void) => {
        listeners[type] = listeners[type].filter((h) => h !== handler);
      }
    ),
    close: vi.fn(() => {
      if (ws.readyState === 3) return; // already closed
      ws.readyState = 3;
      // Note: do NOT fire onclose listeners here. In a real WebSocket the 'close'
      // event fires asynchronously, but during test teardown the React component is
      // already unmounted. Firing onclose would trigger scheduleReconnect() in
      // useLaneSession which creates new real timers that keep the process alive.
    }) as ReturnType<typeof vi.fn>,
    send: vi.fn(),
  };

  // Keep `.onmessage` usable by tests even if production code overwrites it:
  // calling `ws.onmessage(...)` should dispatch to both the assigned handler and any addEventListener handlers.
  //
  // Important: when production code does `const original = socket.onmessage` then `socket.onmessage = ...`,
  // our getter must NOT return a wrapper that calls `assignedOnMessage`, otherwise `original` becomes
  // self-referential and we recurse forever.
  Object.defineProperty(ws, 'onmessage', {
    configurable: true,
    get() {
      // If the app assigned an onmessage handler, return it directly.
      if (assignedOnMessage) return assignedOnMessage;
      // Otherwise, provide a dispatcher that only targets addEventListener handlers.
      return (ev: { data: string }) => {
        for (const fn of listeners.message) fn(ev);
      };
    },
    set(fn: ((ev: { data: string }) => unknown) | null) {
      assignedOnMessage = fn;
    },
  });

  lastSocket = ws;
  createdSockets.push(ws);
  return ws;
}) as unknown as typeof WebSocket;

(
  RealtimeSocketMock as unknown as { OPEN: number; CONNECTING: number; CLOSING: number; CLOSED: number }
).OPEN = 1;
(
  RealtimeSocketMock as unknown as { OPEN: number; CONNECTING: number; CLOSING: number; CLOSED: number }
).CONNECTING = 0;
(
  RealtimeSocketMock as unknown as { OPEN: number; CONNECTING: number; CLOSING: number; CLOSED: number }
).CLOSING = 2;
(
  RealtimeSocketMock as unknown as { OPEN: number; CONNECTING: number; CLOSING: number; CLOSED: number }
).CLOSED = 3;

Object.defineProperty(globalThis, 'WebSocket', {
  value: RealtimeSocketMock,
  configurable: true,
  writable: true,
});
Object.defineProperty(window, 'WebSocket', {
  value: RealtimeSocketMock,
  configurable: true,
  writable: true,
});
Object.defineProperty(global, 'WebSocket', {
  value: RealtimeSocketMock,
  configurable: true,
  writable: true,
});

export function buildRealtimeAuthResponse(init?: RequestInit): Response {
  let channels: string[] = [];
  if (typeof init?.body === 'string') {
    try {
      const parsed = JSON.parse(init.body) as { channels?: unknown };
      if (Array.isArray(parsed.channels)) {
        channels = parsed.channels.filter(
          (channel): channel is string => typeof channel === 'string'
        );
      }
    } catch {
      // ignore parse errors
    }
  }

  const subscriptions = Object.fromEntries(channels.map((channel) => [channel, {}]));
  return {
    ok: true,
    json: () =>
      Promise.resolve({
        realtimeEndpoint: 'wss://test/realtime',
        connectionHeaders: {},
        subscriptions,
      }),
  } as unknown as Response;
}

export function makeJsonResponse<T>(data: T, ok = true): Response {
  return {
    ok,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

export function emitRealtime(socket: MockRealtimeSocket | null, event: unknown) {
  socket?.onmessage?.({
    data: JSON.stringify({
      type: 'data',
      events: [JSON.stringify(event ?? {})],
    }),
  });
}

export async function emitRealtimeEvent(event: unknown) {
  await waitFor(() => expect(lastSocket).not.toBeNull());
  emitRealtime(lastSocket, event);
}

export function setupRegisterAppTest() {
  let App: (typeof import('../App'))['default'];

  beforeEach(async () => {
    // Clear all mocks and state between tests, but DON'T call vi.resetModules().
    // resetModules() causes re-imports that can trigger module-level initialization
    // code creating timers that don't always get cleaned up properly.
    vi.clearAllMocks();
    vi.clearAllTimers();
    vi.useRealTimers();
    createdSockets.length = 0;
    lastSocket = null;

    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, writable: true, configurable: true });
    Object.defineProperty(window, 'fetch', { value: fetchMock, writable: true, configurable: true });
    Object.defineProperty(global, 'fetch', { value: fetchMock, writable: true, configurable: true });
    const store: Record<string, string> = {};
    const storage = {
      getItem: vi.fn((key: string) => (key in store ? store[key] : null)),
      setItem: vi.fn((key: string, value: string) => {
        store[key] = String(value);
      }),
      removeItem: vi.fn((key: string) => {
        delete store[key];
      }),
      clear: vi.fn(() => {
        Object.keys(store).forEach((k) => delete store[k]);
      }),
    };
    Object.defineProperty(window, 'localStorage', { value: storage, writable: true });
    Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true });
    localStorage.clear();

    (global.fetch as Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>).mockImplementation(
      (url: RequestInfo | URL, init?: RequestInit) => {
        const u =
          typeof url === 'string'
            ? url
            : url instanceof URL
              ? url.toString()
              : url instanceof Request
                ? url.url
                : '';
        if (u.includes('/v1/realtime/auth')) {
          return Promise.resolve(buildRealtimeAuthResponse(init));
        }
        if (u.includes('/health')) {
          return Promise.resolve({
            ok: true,
            headers: new Headers({ 'content-type': 'application/json' }),
            json: () =>
              Promise.resolve({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 }),
          } as unknown as Response);
        }
        return Promise.resolve({
          ok: true,
          headers: new Headers({ 'content-type': 'application/json' }),
          json: () => Promise.resolve({}),
        } as unknown as Response);
      }
    );

    // Tests rely on realtime handlers; the app now fail-fast disables realtime init without a kiosk token.
    const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env;
    if (processEnv) {
      processEnv.VITE_KIOSK_TOKEN = 'test-kiosk-token';
      processEnv.VITE_DISABLE_REALTIME = 'false';
    }

    // Import App module. With isolate: true in vitest config, each test gets a fresh module context anyway.
    if (!App) {
      App = (await import('../App')).default;
    }
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.clearAllTimers();
    createdSockets.length = 0;
    lastSocket = null;
  });

  return {
    getApp: () => App,
    getLastSocket: () => lastSocket,
  };
}
