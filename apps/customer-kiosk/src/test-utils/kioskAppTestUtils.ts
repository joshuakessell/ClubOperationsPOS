import { beforeEach, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

const globalWithAct = globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean };
globalWithAct.IS_REACT_ACT_ENVIRONMENT = true;

// Mock fetch and realtime socket (shared per test module).
if (!global.fetch || !(global.fetch instanceof Function)) {
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
const createdSockets: MockRealtimeSocket[] = [];
let mockSessionSnapshot: unknown = null;

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
    close: vi.fn(),
    send: vi.fn(),
  };

  Object.defineProperty(ws, 'onmessage', {
    configurable: true,
    get() {
      return (ev: { data: string }) => {
        assignedOnMessage?.(ev);
        for (const fn of listeners.message) fn(ev);
      };
    },
    set(fn: ((ev: { data: string }) => unknown) | null) {
      assignedOnMessage = fn;
    },
  });

  lastSocket = ws;
  createdSockets.push(ws);
  void Promise.resolve().then(() => {
    ws.onopen?.(new Event('open'));
    ws.onmessage?.({ data: JSON.stringify({ type: 'connection_ack' }) });
  });
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

Object.defineProperty(globalThis, 'WebSocket', { value: RealtimeSocketMock, configurable: true });
Object.defineProperty(window, 'WebSocket', { value: RealtimeSocketMock, configurable: true });
Object.defineProperty(global, 'WebSocket', { value: RealtimeSocketMock, configurable: true });

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
  if (
    event &&
    typeof event === 'object' &&
    'type' in event &&
    (event as { type?: unknown }).type === 'SESSION_UPDATED' &&
    'payload' in event
  ) {
    mockSessionSnapshot = (event as { payload?: unknown }).payload ?? null;
  }
  const testBus = globalThis as { __kioskRealtimeTest__?: (event: unknown) => void };
  if (!testBus.__kioskRealtimeTest__) {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  if (!testBus.__kioskRealtimeTest__) {
    throw new Error('Realtime test hook not initialized.');
  }
  testBus.__kioskRealtimeTest__(event);
}

export function setupKioskAppTest() {
  let App: (typeof import('../App'))['default'];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useRealTimers();
    lastSocket = null;
    createdSockets.length = 0;
    mockSessionSnapshot = null;
    const fetchMock = vi.fn();
    Object.defineProperty(globalThis, 'fetch', { value: fetchMock, writable: true, configurable: true });
    Object.defineProperty(window, 'fetch', { value: fetchMock, writable: true, configurable: true });
    Object.defineProperty(global, 'fetch', { value: fetchMock, writable: true, configurable: true });
    // Tests run in jsdom, which often defaults to a "landscape" viewport.
    // The kiosk UI hard-blocks landscape with an orientation overlay, which would hide all controls.
    // Force a portrait-like viewport so tests can exercise the flow.
    Object.defineProperty(window, 'innerWidth', { value: 800, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: 1200, writable: true });
    window.dispatchEvent(new Event('resize'));
    window.history.replaceState({}, '', '/register-1');
    const storage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', { value: storage, writable: true });
    // Some environments expose localStorage only on window; App reads the global name.
    Object.defineProperty(globalThis, 'localStorage', { value: storage, writable: true });

    // Tests rely on realtime handlers; ensure kiosk token exists for guarded realtime init.
    const processEnv = (globalThis as { process?: { env?: Record<string, string | undefined> } })
      .process?.env;
    if (processEnv) {
      processEnv.VITE_KIOSK_TOKEN = 'test-kiosk-token';
      processEnv.VITE_DISABLE_REALTIME = 'false';
    }

    App = (await import('../App')).default;
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(
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
          return Promise.resolve(
            makeJsonResponse({ status: 'ok', timestamp: new Date().toISOString(), uptime: 0 })
          );
        }
        if (u.includes('/v1/inventory/available')) {
          return Promise.resolve(
            makeJsonResponse({
              rooms: { SPECIAL: 0, DOUBLE: 0, STANDARD: 0 },
              rawRooms: { SPECIAL: 0, DOUBLE: 0, STANDARD: 0 },
              waitlistDemand: { SPECIAL: 0, DOUBLE: 0, STANDARD: 0 },
              lockers: 0,
              total: 0,
            })
          );
        }
        if (u.includes('/v1/checkin/lane/') && u.includes('/membership-purchase-intent')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as unknown as Response);
        }
        if (u.includes('/v1/checkin/lane/') && u.includes('/propose-selection')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as unknown as Response);
        }
        if (u.includes('/v1/checkin/lane/') && u.includes('/confirm-selection')) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve({ success: true }),
          } as unknown as Response);
        }
        if (u.includes('/v1/checkin/lane/') && u.includes('/session-snapshot')) {
          return Promise.resolve(makeJsonResponse({ session: mockSessionSnapshot }));
        }
        return Promise.resolve(makeJsonResponse({}));
      }
    );
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  return {
    getApp: () => App,
    createdSockets,
    getLastSocket: () => lastSocket,
  };
}
