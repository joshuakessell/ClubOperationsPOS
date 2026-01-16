import { describe, expect, it } from 'vitest';
import {
  safeParseWebSocketEvent,
  safeParseWebSocketEventJson,
  safeParseWebSocketClientMessageJson,
} from '../src/wsSchemas';

describe('wsSchemas', () => {
  it('rejects invalid server->client events (bad payload shape)', () => {
    const bad = safeParseWebSocketEvent({
      type: 'SESSION_UPDATED',
      payload: { customerName: 'Missing sessionId', allowedRentals: [] },
      timestamp: new Date().toISOString(),
    });
    expect(bad).toBeNull();
  });

  it('accepts valid server->client events', () => {
    const ok = safeParseWebSocketEvent({
      type: 'SESSION_UPDATED',
      payload: { sessionId: 's1', customerName: 'Test', allowedRentals: ['STANDARD'] },
      timestamp: new Date().toISOString(),
    });
    expect(ok?.type).toBe('SESSION_UPDATED');
    expect(ok?.payload.customerName).toBe('Test');
  });

  it('accepts SESSION_UPDATED reset events (COMPLETED allows empty customerName)', () => {
    const msg = safeParseWebSocketEventJson(
      JSON.stringify({
        type: 'SESSION_UPDATED',
        timestamp: new Date().toISOString(),
        payload: {
          sessionId: '11111111-1111-1111-1111-111111111111',
          status: 'COMPLETED',
          customerName: '',
          allowedRentals: ['STANDARD', 'DOUBLE'],
        },
      })
    );
    expect(msg).not.toBeNull();
    expect(msg?.type).toBe('SESSION_UPDATED');
    expect(msg?.payload.customerName).toBe('');
  });

  it('rejects invalid JSON and unknown event types (server->client)', () => {
    expect(safeParseWebSocketEventJson('{')).toBeNull();
    expect(
      safeParseWebSocketEventJson(
        JSON.stringify({ type: 'NOT_A_REAL_EVENT', payload: {}, timestamp: new Date().toISOString() })
      )
    ).toBeNull();
  });

  it('validates client->server subscribe messages', () => {
    const ok = safeParseWebSocketClientMessageJson(
      JSON.stringify({ type: 'subscribe', events: ['INVENTORY_UPDATED', 'SESSION_UPDATED'] })
    );
    expect(ok?.type).toBe('subscribe');

    const bad = safeParseWebSocketClientMessageJson(
      JSON.stringify({ type: 'subscribe', events: ['NOT_A_REAL_EVENT'] })
    );
    expect(bad).toBeNull();
  });
});

