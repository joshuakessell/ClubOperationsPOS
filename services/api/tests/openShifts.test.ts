import crypto from 'crypto';
import { describe, it, expect, beforeAll } from 'vitest';
import Fastify, { type FastifyInstance } from 'fastify';
import { openShiftsRoutes } from '../src/routes/openShifts.js';
import { query } from '../src/db/index.js';

// In-memory mocks
const shifts: any[] = [];
const offers: any[] = [];
const employeeShifts: any[] = [];

vi.mock('../src/auth/middleware.js', () => ({
  requireAuth: vi.fn(async (req) => {
    req.staff = req.staff ?? { staffId: 'admin-1', name: 'Admin', role: 'ADMIN', sessionId: 'sess' };
  }),
  requireAdmin: vi.fn(async (req) => {
    req.staff = req.staff ?? { staffId: 'admin-1', name: 'Admin', role: 'ADMIN', sessionId: 'sess' };
  }),
}));

vi.mock('../src/services/sms.js', () => ({
  sendSms: vi.fn(async () => {}),
}));

vi.mock('../src/db/index.js', () => {
  const runQuery = async (text: string, params: any[] = []) => {
    const sql = text.toLowerCase();
    if (sql.includes('insert into open_shifts')) {
      const row = {
        id: `shift-${shifts.length + 1}`,
        starts_at: params[0],
        ends_at: params[1],
        shift_code: params[2],
        role: params[3],
        status: 'OPEN',
        created_by: params[4],
        created_at: new Date(),
      };
      shifts.push(row);
      return { rows: [row] };
    }
    if (sql.includes('insert into open_shift_offers')) {
      const row = {
        id: `offer-${offers.length + 1}`,
        open_shift_id: params[0],
        staff_id: params[1],
        token_hash: params[2],
        status: 'SENT',
        sent_at: new Date(),
        claimed_at: null,
      };
      offers.push(row);
      return { rows: [row] };
    }
    if (sql.includes('insert into employee_shifts')) {
      const row = {
        id: `emp-${employeeShifts.length + 1}`,
        employee_id: params[0],
        starts_at: params[1],
        ends_at: params[2],
        shift_code: params[3],
        role: params[4],
      };
      employeeShifts.push(row);
      return { rows: [{ id: row.id }] };
    }
    if (sql.includes('update open_shifts') && sql.includes('returning')) {
      const shift = shifts.find((s) => s.id === params[0] && s.status === 'OPEN');
      if (!shift) return { rowCount: 0, rows: [] };
      shift.status = 'CANCELED';
      return { rowCount: 1, rows: [shift] };
    }
    if (sql.includes('update open_shifts')) {
      const shift = shifts.find((s) => s.id === params[1]);
      if (shift) {
        shift.status = 'CLAIMED';
        shift.claimed_by = params[0];
        shift.claimed_at = new Date();
      }
      return { rows: [] };
    }
    if (sql.includes('update open_shift_offers') && sql.includes('set status')) {
      const offer = offers.find((o) => o.id === params[0]);
      if (offer) {
        offer.status = 'CLAIMED';
        offer.claimed_at = new Date();
      }
      return { rows: [] };
    }
    if (sql.includes('from open_shift_offers') && sql.includes('for update')) {
      const offer = offers.find((o) => o.token_hash === params[0]);
      if (!offer) return { rowCount: 0, rows: [] };
      const shift = shifts.find((s) => s.id === offer.open_shift_id)!;
      return {
        rowCount: 1,
        rows: [{
          ...offer,
          shift_status: shift.status,
          starts_at: shift.starts_at,
          ends_at: shift.ends_at,
          shift_code: shift.shift_code,
          role: shift.role,
        }],
      };
    }
    if (sql.includes('from open_shift_offers')) {
      const offer = offers.find((o) => o.token_hash === params[0]);
      if (!offer) return { rowCount: 0, rows: [] };
      const shift = shifts.find((s) => s.id === offer.open_shift_id)!;
      return {
        rowCount: 1,
        rows: [{
          ...offer,
          shift_status: shift.status,
          starts_at: shift.starts_at,
          ends_at: shift.ends_at,
          shift_code: shift.shift_code,
          role: shift.role,
        }],
      };
    }
    if (sql.includes('from open_shifts os')) {
      return {
        rows: shifts.map((s) => ({
          ...s,
          created_by_name: 'Admin',
          claimed_by_name: s.claimed_by ? 'Worker' : null,
          claimed_at: s.claimed_at ?? null,
          offer_count: offers.filter((o) => o.open_shift_id === s.id).length.toString(),
        })),
      };
    }
    if (sql.includes('select status') && sql.includes('from open_shifts')) {
      const idParam = params?.[0];
      const rows = shifts
        .filter((s) => !idParam || s.id === idParam)
        .map((s) => ({
          status: s.claimed_by ? 'CLAIMED' : s.status,
          claimed_by: s.claimed_by,
        }));
      return { rows };
    }
    if (sql.includes('select') && sql.includes('from open_shifts')) {
      return {
        rows: shifts.map((s) => ({ status: s.claimed_by ? 'CLAIMED' : s.status, claimed_by: s.claimed_by })),
      };
    }
    if (sql.includes('from employee_shifts')) {
      const employeeId = params?.[0];
      const rows = employeeShifts.filter((e) => !employeeId || e.employee_id === employeeId);
      return { rows, rowCount: rows.length };
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

describe('Open Shifts', () => {
  let fastify: FastifyInstance;
  beforeAll(async () => {
    fastify = Fastify({ logger: false });
    await fastify.register(openShiftsRoutes);
    await fastify.ready();
  });
  afterAll(async () => {
    await fastify.close();
  });

  it('creates an open shift via admin endpoint', async () => {
    const res = await fastify.inject({
      method: 'POST',
      url: '/v1/admin/open-shifts',
      headers: { Authorization: `Bearer admin-token` },
      payload: {
        starts_at: new Date().toISOString(),
        ends_at: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
        shift_code: 'A',
        role: 'Front Desk',
        notifySms: false,
      },
    });

    expect(res.statusCode).toBe(201);
    const body = JSON.parse(res.body) as { shiftId: string; offerCount: number };
    expect(body.shiftId).toBeDefined();
    expect(body.offerCount).toBe(0);
  });

  it('claims an open shift first-come-first-serve', async () => {
    const starts = new Date();
    const ends = new Date(Date.now() + 60 * 60 * 1000);
    const shiftRes = await query<{ id: string }>(
      `INSERT INTO open_shifts (starts_at, ends_at, shift_code, role, status, created_by)
       VALUES ($1, $2, 'B', 'Cleaner', 'OPEN', $3)
       RETURNING id`,
      [starts, ends, 'admin-1']
    );
    const shiftId = shiftRes.rows[0]!.id;

    const token = 'claim-token-123';
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await query(
      `INSERT INTO open_shift_offers (open_shift_id, staff_id, token_hash, status)
       VALUES ($1, $2, $3, 'SENT')`,
      [shiftId, 'staff-1', tokenHash]
    );

    const getRes = await fastify.inject({
      method: 'GET',
      url: `/v1/open-shifts/offers/${token}`,
    });
    expect(getRes.statusCode).toBe(200);

    const claimRes = await fastify.inject({
      method: 'POST',
      url: `/v1/open-shifts/offers/${token}/claim`,
    });
    expect(claimRes.statusCode).toBe(200);

    // Second claim should fail
    const claimAgain = await fastify.inject({
      method: 'POST',
      url: `/v1/open-shifts/offers/${token}/claim`,
    });
    expect(claimAgain.statusCode).toBe(409);

    const shiftRecord = await query('SELECT status, claimed_by FROM open_shifts WHERE id = $1', [shiftId]);
    expect(shiftRecord.rows[0]?.status).toBe('CLAIMED');
    expect(shiftRecord.rows[0]?.claimed_by).toBe('staff-1');

    const empShift = await query('SELECT * FROM employee_shifts WHERE employee_id = $1', ['staff-1']);
    expect(empShift.rowCount).toBe(1);
  });
});

