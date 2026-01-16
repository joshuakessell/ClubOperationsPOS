import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import pg from 'pg';
import { laneRoutes } from '../src/routes/lanes.js';
import { createBroadcaster } from '../src/websocket/broadcaster.js';
import { safeParseWebSocketEventJson } from '@club-ops/shared';
import { truncateAllTables } from './testDb.js';

const testStaffId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
vi.mock('../src/auth/middleware.js', () => ({
  requireAuth: async (request: any, _reply: any) => {
    request.staff = { staffId: testStaffId, role: 'STAFF' };
  },
  optionalAuth: async (request: any, _reply: any) => {
    request.staff = request.staff;
  },
  requireAdmin: async (_request: any, _reply: any) => {},
  requireReauth: async (request: any, _reply: any) => {
    request.staff = { staffId: testStaffId, role: 'STAFF' };
  },
  requireReauthForAdmin: async (request: any, _reply: any) => {
    request.staff = { staffId: testStaffId, role: 'ADMIN' };
  },
}));

describe('Lane clear broadcasts contract-consistent SESSION_UPDATED', () => {
  let fastify: FastifyInstance;
  let pool: pg.Pool;
  let dbAvailable = false;
  let sessionUpdatedEvents: Array<{ lane: string; payload: unknown }> = [];

  beforeAll(async () => {
    const dbConfig = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5433', 10),
      database: process.env.DB_NAME || 'club_operations',
      user: process.env.DB_USER || 'clubops',
      password: process.env.DB_PASSWORD || 'clubops_dev',
      connectionTimeoutMillis: 3000,
    };

    pool = new pg.Pool(dbConfig);
    try {
      await pool.query('SELECT 1');
      dbAvailable = true;
    } catch {
      console.warn('\n⚠️  Database not available. Integration tests will be skipped.\n');
      return;
    }

    fastify = Fastify({ logger: false });
    const broadcaster = createBroadcaster();
    const original = broadcaster.broadcastSessionUpdated.bind(broadcaster);
    broadcaster.broadcastSessionUpdated = (payload, lane) => {
      sessionUpdatedEvents.push({ lane, payload });
      return original(payload, lane);
    };
    fastify.decorate('broadcaster', broadcaster);

    await fastify.register(laneRoutes);
    await fastify.ready();
  });

  afterAll(async () => {
    if (dbAvailable && fastify) await fastify.close();
    if (pool) await pool.end();
  });

  beforeEach(async () => {
    if (!dbAvailable) return;
    sessionUpdatedEvents = [];
    await truncateAllTables(pool.query.bind(pool));
    await pool.query(
      `INSERT INTO staff (id, name, role, pin_hash, active)
       VALUES ($1, 'Test Staff', 'STAFF', 'test-hash', true)
       ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, active = EXCLUDED.active`,
      [testStaffId]
    );
  });

  const runIfDbAvailable = (testFn: () => Promise<void>) => async () => {
    if (!dbAvailable) {
      console.log('    ↳ Skipped (database not available)');
      return;
    }
    await testFn();
  };

  it(
    'POST /v1/lanes/:laneId/clear emits SESSION_UPDATED with non-empty sessionId and status COMPLETED',
    runIfDbAvailable(async () => {
      const sessionId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';

      await pool.query(
        `INSERT INTO lane_sessions (id, lane_id, status, staff_id, customer_display_name)
         VALUES ($1, 'lane-1', 'ACTIVE', $2, 'Temp Customer')`,
        [sessionId, testStaffId]
      );

      const res = await fastify.inject({
        method: 'POST',
        url: `/v1/lanes/lane-1/clear`,
        headers: { Authorization: 'Bearer test' },
      });
      expect(res.statusCode).toBe(200);

      expect(sessionUpdatedEvents.length).toBeGreaterThan(0);
      const last = sessionUpdatedEvents[sessionUpdatedEvents.length - 1]!;
      expect(last.lane).toBe('lane-1');

      const parsed = safeParseWebSocketEventJson(
        JSON.stringify({ type: 'SESSION_UPDATED', payload: last.payload, timestamp: new Date().toISOString() })
      );
      expect(parsed).not.toBeNull();
      expect(parsed?.type).toBe('SESSION_UPDATED');
      expect(parsed?.payload.sessionId).toBe(sessionId);
      expect(parsed?.payload.status).toBe('COMPLETED');
    })
  );
});

