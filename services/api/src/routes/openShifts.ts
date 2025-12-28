import crypto from 'crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, serializableTransaction, transaction } from '../db/index.js';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import { sendSms } from '../services/sms.js';

const CreateOpenShiftSchema = z.object({
  starts_at: z.string().datetime(),
  ends_at: z.string().datetime(),
  shift_code: z.enum(['A', 'B', 'C']),
  role: z.string().optional(),
  notifySms: z.boolean().optional().default(false),
  targetRole: z.string().optional(),
});

const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

const generateToken = (): string => crypto.randomBytes(16).toString('hex');

function claimLink(token: string): string {
  const base = process.env.PUBLIC_APP_BASE_URL || '';
  if (base) {
    return `${base.replace(/\/$/, '')}/claim-shift/${token}`;
  }
  return `/claim-shift/${token}`;
}

export async function openShiftsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/admin/open-shifts
   * Create an open shift and optionally notify via SMS.
   */
  fastify.post('/v1/admin/open-shifts', { preHandler: [requireAuth, requireAdmin] }, async (
    request: FastifyRequest<{ Body: z.infer<typeof CreateOpenShiftSchema> }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = CreateOpenShiftSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }

    try {
      const { shift, offers } = await transaction(async (client) => {
        const shiftResult = await client.query<{
          id: string;
          starts_at: Date;
          ends_at: Date;
          shift_code: string;
          role: string | null;
          status: string;
          created_at: Date;
        }>(
          `INSERT INTO open_shifts (starts_at, ends_at, shift_code, role, status, created_by)
           VALUES ($1, $2, $3, $4, 'OPEN', $5)
           RETURNING *`,
          [
            new Date(body.starts_at),
            new Date(body.ends_at),
            body.shift_code,
            body.role ?? null,
            request.staff.staffId,
          ]
        );

        const shiftRow = shiftResult.rows[0]!;

        await client.query(
          `INSERT INTO audit_log (staff_id, action, entity_type, entity_id, new_value)
           VALUES ($1, 'OPEN_SHIFT_CREATED', 'open_shift', $2, $3)`,
          [request.staff.staffId, shiftRow.id, JSON.stringify(shiftRow)]
        );

        let createdOffers: Array<{ staffId: string; token: string; phone: string }> = [];

        if (body.notifySms) {
          const recipients = await client.query<{
            id: string;
            phone_e164: string;
          }>(
            `SELECT id, phone_e164
             FROM staff
             WHERE active = true
               AND sms_opt_in = true
               AND phone_e164 IS NOT NULL
               ${body.targetRole ? 'AND role = $1' : ''}
            `,
            body.targetRole ? [body.targetRole] : []
          );

          for (const recipient of recipients.rows) {
            const token = generateToken();
            const tokenHash = hashToken(token);

            await client.query(
              `INSERT INTO open_shift_offers (open_shift_id, staff_id, token_hash, status)
               VALUES ($1, $2, $3, 'SENT')`,
              [shiftRow.id, recipient.id, tokenHash]
            );

            await client.query(
              `INSERT INTO audit_log (staff_id, action, entity_type, entity_id, new_value)
               VALUES ($1, 'OPEN_SHIFT_OFFER_SENT', 'open_shift', $2, $3)`,
              [request.staff.staffId, shiftRow.id, JSON.stringify({ staffId: recipient.id })]
            );

            createdOffers.push({ staffId: recipient.id, token, phone: recipient.phone_e164 });
          }
        }

        return { shift: shiftRow, offers: createdOffers };
      });

      // Send SMS out of transaction
      for (const offer of offers) {
        const bodyText = [
          `Open shift available: ${body.shift_code}`,
          `${new Date(body.starts_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })} - ${new Date(body.ends_at).toLocaleString('en-US', { timeZone: 'America/Chicago' })}`,
          `Claim: ${claimLink(offer.token)}`,
        ].join(' | ');
        // Fire and forget; errors are logged but do not fail the API
        sendSms(offer.phone, bodyText).catch((err) => {
          fastify.log.error(err, 'Failed to send SMS for open shift');
        });
      }

      return reply.status(201).send({
        shiftId: shift.id,
        offerCount: offers.length,
        status: shift.status,
      });
    } catch (error) {
      request.log.error(error, 'Failed to create open shift');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /v1/admin/open-shifts
   */
  fastify.get('/v1/admin/open-shifts', { preHandler: [requireAuth, requireAdmin] }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const result = await query<{
        id: string;
        starts_at: Date;
        ends_at: Date;
        shift_code: string;
        role: string | null;
        status: string;
        created_by: string | null;
        created_at: Date;
        claimed_by: string | null;
        claimed_at: Date | null;
        created_by_name: string | null;
        claimed_by_name: string | null;
        offer_count: string;
      }>(
        `
        SELECT 
          os.*,
          creator.name AS created_by_name,
          claimer.name AS claimed_by_name,
          (SELECT COUNT(*) FROM open_shift_offers o WHERE o.open_shift_id = os.id) AS offer_count
        FROM open_shifts os
        LEFT JOIN staff creator ON creator.id = os.created_by
        LEFT JOIN staff claimer ON claimer.id = os.claimed_by
        ORDER BY os.created_at DESC
        LIMIT 200
        `
      );

      const shifts = result.rows.map((row) => ({
        id: row.id,
        startsAt: row.starts_at.toISOString(),
        endsAt: row.ends_at.toISOString(),
        shiftCode: row.shift_code,
        role: row.role,
        status: row.status,
        createdAt: row.created_at.toISOString(),
        createdBy: row.created_by,
        createdByName: row.created_by_name ?? null,
        claimedBy: row.claimed_by,
        claimedByName: row.claimed_by_name ?? null,
        claimedAt: row.claimed_at ? row.claimed_at.toISOString() : null,
        offerCount: parseInt(row.offer_count || '0', 10),
      }));

      return reply.send({ shifts });
    } catch (error) {
      request.log.error(error, 'Failed to list open shifts');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /v1/admin/open-shifts/:id/cancel
   */
  fastify.post('/v1/admin/open-shifts/:id/cancel', { preHandler: [requireAuth, requireAdmin] }, async (
    request: FastifyRequest<{ Params: { id: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    try {
      const result = await query(
        `UPDATE open_shifts
         SET status = 'CANCELED'
         WHERE id = $1 AND status = 'OPEN'
         RETURNING id`,
        [request.params.id]
      );

      if (result.rowCount === 0) {
        return reply.status(409).send({ error: 'Shift cannot be canceled' });
      }

      await query(
        `INSERT INTO audit_log (staff_id, action, entity_type, entity_id)
         VALUES ($1, 'OPEN_SHIFT_CANCELED', 'open_shift', $2)`,
        [request.staff.staffId, request.params.id]
      );

      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error, 'Failed to cancel open shift');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /v1/open-shifts/offers/:token
   */
  fastify.get('/v1/open-shifts/offers/:token', async (
    request: FastifyRequest<{ Params: { token: string } }>,
    reply: FastifyReply
  ) => {
    const tokenHash = hashToken(request.params.token);

    try {
      const result = await query<{
        id: string;
        open_shift_id: string;
        staff_id: string;
        status: string;
        sent_at: Date;
        claimed_at: Date | null;
        shift_status: string;
        starts_at: Date;
        ends_at: Date;
        shift_code: string;
        role: string | null;
      }>(
        `
        SELECT 
          o.*,
          os.status AS shift_status,
          os.starts_at,
          os.ends_at,
          os.shift_code,
          os.role
        FROM open_shift_offers o
        JOIN open_shifts os ON os.id = o.open_shift_id
        WHERE o.token_hash = $1
        `,
        [tokenHash]
      );

      if (result.rowCount === 0) {
        return reply.status(404).send({ error: 'Offer not found' });
      }

      const row = result.rows[0]!;
      return reply.send({
        offerId: row.id,
        status: row.status,
        shift: {
          id: row.open_shift_id,
          startsAt: row.starts_at.toISOString(),
          endsAt: row.ends_at.toISOString(),
          shiftCode: row.shift_code,
          role: row.role,
          status: row.shift_status,
        },
      });
    } catch (error) {
      request.log.error(error, 'Failed to fetch offer');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /v1/open-shifts/offers/:token/claim
   * First-come-first-serve claim flow.
   */
  fastify.post('/v1/open-shifts/offers/:token/claim', async (
    request: FastifyRequest<{ Params: { token: string } }>,
    reply: FastifyReply
  ) => {
    const tokenHash = hashToken(request.params.token);

    try {
      const result = await serializableTransaction(async (client) => {
        const offerRes = await client.query<{
          id: string;
          open_shift_id: string;
          staff_id: string;
          status: string;
          sent_at: Date;
          claimed_at: Date | null;
          shift_status: string;
          starts_at: Date;
          ends_at: Date;
          shift_code: string;
          role: string | null;
        }>(
          `
          SELECT 
            o.*,
            os.status AS shift_status,
            os.starts_at,
            os.ends_at,
            os.shift_code,
            os.role
          FROM open_shift_offers o
          JOIN open_shifts os ON os.id = o.open_shift_id
          WHERE o.token_hash = $1
          FOR UPDATE
          `,
          [tokenHash]
        );

        if (offerRes.rowCount === 0) {
          throw Object.assign(new Error('Offer not found'), { statusCode: 404 });
        }

        const offer = offerRes.rows[0]!;

        if (offer.shift_status !== 'OPEN' || offer.status !== 'SENT') {
          throw Object.assign(new Error('Shift already claimed'), { statusCode: 409, code: 'ALREADY_CLAIMED' });
        }

        // Mark shift claimed
        await client.query(
          `UPDATE open_shifts
           SET status = 'CLAIMED', claimed_by = $1, claimed_at = NOW()
           WHERE id = $2`,
          [offer.staff_id, offer.open_shift_id]
        );

        await client.query(
          `UPDATE open_shift_offers
           SET status = 'CLAIMED', claimed_at = NOW()
           WHERE id = $1`,
          [offer.id]
        );

        const employeeShift = await client.query<{ id: string }>(
          `INSERT INTO employee_shifts (employee_id, starts_at, ends_at, shift_code, role, status, created_by)
           VALUES ($1, $2, $3, $4, $5, 'SCHEDULED', NULL)
           RETURNING id`,
          [offer.staff_id, offer.starts_at, offer.ends_at, offer.shift_code, offer.role]
        );

        await client.query(
          `INSERT INTO audit_log (staff_id, action, entity_type, entity_id, new_value)
           VALUES ($1, 'OPEN_SHIFT_CLAIMED', 'open_shift', $2, $3)`,
          [offer.staff_id, offer.open_shift_id, JSON.stringify({ offerId: offer.id })]
        );

        return {
          shiftId: offer.open_shift_id,
          employeeShiftId: employeeShift.rows[0]!.id,
          staffId: offer.staff_id,
        };
      });

      return reply.send({ success: true, ...result });
    } catch (error) {
      if ((error as any)?.statusCode === 404) {
        return reply.status(404).send({ error: 'Offer not found' });
      }
      if ((error as any)?.statusCode === 409) {
        return reply.status(409).send({ error: 'Shift already claimed', code: 'ALREADY_CLAIMED' });
      }
      request.log.error(error, 'Failed to claim open shift');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

