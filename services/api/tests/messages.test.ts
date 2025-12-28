import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { messagesRoutes } from '../src/routes/messages.js';

// In-memory mocks
const messages: any[] = [];
const acks: any[] = [];

vi.mock('../src/auth/middleware.js', () => ({
  requireAuth: vi.fn(async (req) => {
    req.staff = { staffId: 'staff-1', name: 'Employee', role: 'STAFF', sessionId: 'sess' };
  }),
  requireAdmin: vi.fn(async (req) => {
    req.staff = req.staff ?? { staffId: 'admin-1', name: 'Admin', role: 'ADMIN', sessionId: 'sess' };
  }),
  requireReauthForAdmin: vi.fn(async () => {}),
}));

vi.mock('../src/db/index.js', () => {
  const runQuery = async (text: string, params: any[] = []) => {
    // simplistic router
    if (text.includes('INSERT INTO internal_messages')) {
      const row = {
        id: `msg-${messages.length + 1}`,
        title: params[0],
        body: params[1],
        severity: params[2],
        target_type: params[3],
        target_role: params[4],
        target_staff_id: params[5],
        target_device_id: params[6],
        created_by: params[7],
        expires_at: params[8],
        pinned: params[9] ?? false,
        created_at: new Date(),
      };
      messages.push(row);
      return { rows: [row] };
    }
    if (text.includes('INSERT INTO internal_message_acks')) {
      const row = {
        id: `ack-${acks.length + 1}`,
        message_id: params[0],
        staff_id: params[1],
        device_id: params[2],
        acknowledged_at: new Date(),
      };
      // idempotent
      const exists = acks.find((a) => a.message_id === row.message_id && (a.staff_id === row.staff_id || a.device_id === row.device_id));
      if (!exists) acks.push(row);
      return { rows: [row] };
    }
    if (text.includes('INSERT INTO audit_log')) {
      return { rows: [] };
    }
    if (text.includes('SELECT m.*, ack.acknowledged_at')) {
      const now = new Date();
      const rows = messages
        .filter((m) => !m.expires_at || m.expires_at > now)
        .map((m) => {
          const ack = acks.find((a) => a.message_id === m.id && (a.staff_id === params[0] || (params[1] && a.device_id === params[1])));
          return { ...m, acknowledged_at: ack?.acknowledged_at ?? null };
        });
      return { rows };
    }
    if (text.includes('SELECT') && text.includes('FROM internal_messages m')) {
      return {
        rows: messages.map((m) => ({
          ...m,
          ack_count: acks.filter((a) => a.message_id === m.id).length.toString(),
          created_by_name: 'Admin',
        })),
      };
    }
    return { rows: [] };
  };

  const client = { query: runQuery };

  return {
    query: runQuery,
    transaction: async (cb: any) => cb(client),
    serializableTransaction: async (cb: any) => cb(client),
    initializeDatabase: vi.fn(),
    closeDatabase: vi.fn(),
  };
});

describe('Internal Messages', () => {
  let fastify: FastifyInstance;
  beforeAll(async () => {
    fastify = Fastify({ logger: false });
    fastify.decorate('broadcaster', {
      broadcast: () => {},
      broadcastToLane: () => {},
    } as any);
    await fastify.register(messagesRoutes);
    await fastify.ready();
  });
  afterAll(async () => {
    await fastify.close();
  });

  it('should deliver and acknowledge messages', async () => {
    // Admin creates message
    const createRes = await fastify.inject({
      method: 'POST',
      url: '/v1/admin/messages',
      headers: { Authorization: `Bearer admin-token` },
      payload: {
        title: 'Test Message',
        body: 'Hello team',
        severity: 'INFO',
        target_type: 'ALL',
      },
    });
    expect(createRes.statusCode).toBe(201);
    const created = JSON.parse(createRes.body) as { id: string };

    // Staff fetches messages
    const listRes = await fastify.inject({
      method: 'GET',
      url: '/v1/messages',
      headers: { Authorization: `Bearer staff-token`, 'x-device-id': 'device-staff' },
    });
    expect(listRes.statusCode).toBe(200);
    const listBody = JSON.parse(listRes.body) as { messages: Array<{ message: { id: string }; acknowledged: boolean }> };
    expect(listBody.messages.length).toBeGreaterThan(0);
    const messageEntry = listBody.messages.find((m) => m.message.id === created.id);
    expect(messageEntry?.acknowledged).toBe(false);

    // Acknowledge (idempotent)
    const ackRes1 = await fastify.inject({
      method: 'POST',
      url: `/v1/messages/${created.id}/ack`,
      headers: { Authorization: `Bearer staff-token`, 'x-device-id': 'device-staff' },
    });
    expect(ackRes1.statusCode).toBe(200);

    const ackRes2 = await fastify.inject({
      method: 'POST',
      url: `/v1/messages/${created.id}/ack`,
      headers: { Authorization: `Bearer staff-token`, 'x-device-id': 'device-staff' },
    });
    expect(ackRes2.statusCode).toBe(200);

    const listResAfter = await fastify.inject({
      method: 'GET',
      url: '/v1/messages',
      headers: { Authorization: `Bearer staff-token`, 'x-device-id': 'device-staff' },
    });
    const listBodyAfter = JSON.parse(listResAfter.body) as { messages: Array<{ message: { id: string }; acknowledged: boolean }> };
    const entryAfter = listBodyAfter.messages.find((m) => m.message.id === created.id);
    expect(entryAfter?.acknowledged).toBe(true);
  });
});

