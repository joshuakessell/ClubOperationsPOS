import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transaction } from '../../db/index.js';
import { requireAuth } from '../../auth/middleware.js';
import type { LaneSessionRow } from '../types.js';
import { buildFullSessionUpdatedPayload, calculateAge, getHttpError, toDate, toNumber } from '../service.js';
import { calculatePriceQuote } from '../../pricing/engine.js';

function parseQuote(raw: unknown): any {
  if (raw === null || raw === undefined) return undefined;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return undefined;
    }
  }
  return raw;
}

export async function registerCheckinPaymentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/checkin/lane/:laneId/create-payment-intent
   *
   * Creates (or reuses) a DUE payment intent for the current lane session.
   * Enforces <= 1 DUE intent per session.
   */
  fastify.post<{ Params: { laneId: string } }>(
    '/v1/checkin/lane/:laneId/create-payment-intent',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.staff) return reply.status(401).send({ error: 'Unauthorized' });
      const { laneId } = request.params;

      try {
        const result = await transaction(async (client) => {
          const sessionRes = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions
             WHERE lane_id = $1 AND status IN ('ACTIVE','AWAITING_ASSIGNMENT','AWAITING_PAYMENT','AWAITING_SIGNATURE')
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [laneId]
          );
          if (sessionRes.rows.length === 0) throw { statusCode: 404, message: 'No active session found' };
          const session = sessionRes.rows[0]!;

          if (!session.selection_confirmed || !session.desired_rental_type) {
            throw { statusCode: 400, message: 'Selection must be confirmed before creating payment intent' };
          }

          // If there are multiple DUE intents, keep the newest and cancel the rest.
          const due = await client.query<{ id: string; amount: unknown; quote_json: unknown }>(
            `SELECT id, amount, quote_json
             FROM payment_intents
             WHERE lane_session_id = $1 AND status = 'DUE'
             ORDER BY created_at DESC`,
            [session.id]
          );

          if (due.rows.length > 0) {
            const keep = due.rows[0]!;
            const extras = due.rows.slice(1).map((r) => r.id);
            if (extras.length > 0) {
              await client.query(
                `UPDATE payment_intents SET status = 'CANCELLED', updated_at = NOW()
                 WHERE id = ANY($1::uuid[])`,
                [extras]
              );
            }
            if (session.payment_intent_id !== keep.id) {
              await client.query(`UPDATE lane_sessions SET payment_intent_id = $1, updated_at = NOW() WHERE id = $2`, [
                keep.id,
                session.id,
              ]);
            }
            return {
              sessionId: session.id,
              paymentIntentId: keep.id,
              amount: keep.amount,
              quote: parseQuote(keep.quote_json),
            };
          }

          // Build quote from customer profile + membership intent
          const customer = session.customer_id
            ? (
                await client.query<{
                  dob: Date | null;
                  membership_card_type: string | null;
                  membership_valid_until: Date | null;
                }>(
                  `SELECT dob, membership_card_type, membership_valid_until
                   FROM customers WHERE id = $1 LIMIT 1`,
                  [session.customer_id]
                )
              ).rows[0]
            : undefined;

          const quote = calculatePriceQuote({
            rentalType: session.desired_rental_type as any,
            customerAge: calculateAge(customer?.dob ?? null),
            checkInTime: new Date(),
            membershipCardType: (customer?.membership_card_type as any) ?? 'NONE',
            membershipValidUntil: toDate(customer?.membership_valid_until),
            includeSixMonthMembershipPurchase: session.membership_purchase_intent ? true : false,
          });

          const insert = await client.query<{ id: string; amount: unknown; quote_json: unknown }>(
            `INSERT INTO payment_intents (lane_session_id, amount, status, quote_json)
             VALUES ($1, $2, 'DUE', $3)
             RETURNING id, amount, quote_json`,
            [session.id, quote.total, JSON.stringify(quote)]
          );
          const intent = insert.rows[0]!;

          await client.query(
            `UPDATE lane_sessions
             SET payment_intent_id = $1,
                 price_quote_json = $2,
                 status = 'AWAITING_PAYMENT',
                 updated_at = NOW()
             WHERE id = $3`,
            [intent.id, JSON.stringify(quote), session.id]
          );

          return { sessionId: session.id, paymentIntentId: intent.id, amount: intent.amount, quote };
        });

        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, result.sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return reply.send(result);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to create payment intent');
        const httpErr = getHttpError(error);
        if (httpErr) return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed' });
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  /**
   * POST /v1/payments/:id/mark-paid
   *
   * Staff-only endpoint to record manual payment confirmation.
   */
  fastify.post<{ Params: { id: string } }>(
    '/v1/payments/:id/mark-paid',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.staff) return reply.status(401).send({ error: 'Unauthorized' });
      const { id } = request.params;

      try {
        const result = await transaction(async (client) => {
          const intent = await client.query<{ id: string; lane_session_id: string | null; status: string }>(
            `SELECT id, lane_session_id, status::text as status
             FROM payment_intents WHERE id = $1 LIMIT 1 FOR UPDATE`,
            [id]
          );
          if (intent.rows.length === 0) throw { statusCode: 404, message: 'Payment intent not found' };

          await client.query(
            `UPDATE payment_intents
             SET status = 'PAID', payment_method = 'CASH', updated_at = NOW()
             WHERE id = $1`,
            [id]
          );

          if (intent.rows[0]!.lane_session_id) {
            await client.query(
              `UPDATE lane_sessions
               SET status = 'AWAITING_SIGNATURE', updated_at = NOW()
               WHERE id = $1`,
              [intent.rows[0]!.lane_session_id]
            );
          }

          return { paymentIntentId: id, laneSessionId: intent.rows[0]!.lane_session_id, status: 'PAID' as const };
        });

        if (result.laneSessionId) {
          const { laneId, payload } = await transaction((client) =>
            buildFullSessionUpdatedPayload(client, result.laneSessionId!)
          );
          fastify.broadcaster.broadcastSessionUpdated(payload, laneId);
        }

        return reply.send({ id: result.paymentIntentId, status: result.status });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to mark payment paid');
        const httpErr = getHttpError(error);
        if (httpErr) return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed' });
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  const DemoTakePaymentSchema = z.object({
    outcome: z.enum(['CASH_SUCCESS', 'CASH_DECLINE', 'CARD_SUCCESS', 'CARD_DECLINE']).default('CASH_SUCCESS'),
  });

  /**
   * POST /v1/checkin/lane/:laneId/demo-take-payment
   *
   * Demo/staff-only helper to simulate collecting payment.
   */
  fastify.post<{ Params: { laneId: string }; Body: z.infer<typeof DemoTakePaymentSchema> }>(
    '/v1/checkin/lane/:laneId/demo-take-payment',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.staff) return reply.status(401).send({ error: 'Unauthorized' });
      const { laneId } = request.params;
      const body = DemoTakePaymentSchema.parse(request.body ?? {});

      try {
        const result = await transaction(async (client) => {
          const sessionRes = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions
             WHERE lane_id = $1 AND status IN ('ACTIVE','AWAITING_ASSIGNMENT','AWAITING_PAYMENT','AWAITING_SIGNATURE')
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [laneId]
          );
          if (sessionRes.rows.length === 0) throw { statusCode: 404, message: 'No active session found' };
          const session = sessionRes.rows[0]!;

          if (!session.payment_intent_id) throw { statusCode: 400, message: 'No payment intent to take payment for' };

          if (body.outcome === 'CASH_SUCCESS' || body.outcome === 'CARD_SUCCESS') {
            await client.query(
              `UPDATE payment_intents
               SET status = 'PAID',
                   payment_method = $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [body.outcome.startsWith('CARD') ? 'CREDIT' : 'CASH', session.payment_intent_id]
            );
            await client.query(
              `UPDATE lane_sessions
               SET status = 'AWAITING_SIGNATURE', updated_at = NOW()
               WHERE id = $1`,
              [session.id]
            );
            return { sessionId: session.id, ok: true };
          }

          await client.query(
            `UPDATE lane_sessions
             SET last_payment_decline_reason = $1, last_payment_decline_at = NOW(), updated_at = NOW()
             WHERE id = $2`,
            [body.outcome, session.id]
          );
          return { sessionId: session.id, ok: false };
        });

        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, result.sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);
        return reply.send({ ok: result.ok });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to demo take payment');
        const httpErr = getHttpError(error);
        if (httpErr) return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed' });
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );
}

