import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transaction } from '../../db/index.js';
import { optionalAuth, requireAuth } from '../../auth/middleware.js';
import type { LaneSessionRow } from '../types.js';
import { buildFullSessionUpdatedPayload, calculateAge, getHttpError, toDate } from '../service.js';
import { calculatePriceQuote } from '../../pricing/engine.js';

const MembershipIntentSchema = z.object({
  intent: z.enum(['PURCHASE', 'RENEW', 'NONE']),
  sessionId: z.string().uuid(),
});

const CompleteMembershipSchema = z.object({
  sessionId: z.string().uuid(),
  membershipNumber: z.string().min(1),
});

export async function registerCheckinMembershipRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/checkin/lane/:laneId/membership-purchase-intent
   *
   * Public kiosk endpoint to request including a 6-month membership purchase/renewal in the quote.
   */
  fastify.post<{ Params: { laneId: string }; Body: z.infer<typeof MembershipIntentSchema> }>(
    '/v1/checkin/lane/:laneId/membership-purchase-intent',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const { laneId } = request.params;
      let body: z.infer<typeof MembershipIntentSchema>;
      try {
        body = MembershipIntentSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      try {
        const result = await transaction(async (client) => {
          const session = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions WHERE id = $1 AND lane_id = $2 LIMIT 1 FOR UPDATE`,
            [body.sessionId, laneId]
          );
          if (session.rows.length === 0) throw { statusCode: 404, message: 'Lane session not found' };
          const row = session.rows[0]!;

          const nextIntent = body.intent === 'NONE' ? null : body.intent;
          const nextRequestedAt = body.intent === 'NONE' ? null : new Date();

          await client.query(
            `UPDATE lane_sessions
             SET membership_purchase_intent = $1,
                 membership_purchase_requested_at = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [nextIntent, nextRequestedAt, row.id]
          );

          // If a DUE payment intent exists, recompute quote immediately.
          if (row.payment_intent_id) {
            const intentRes = await client.query<{ id: string; status: string }>(
              `SELECT id, status::text as status FROM payment_intents WHERE id = $1 LIMIT 1 FOR UPDATE`,
              [row.payment_intent_id]
            );
            const intent = intentRes.rows[0];
            if (intent && intent.status === 'DUE' && row.desired_rental_type) {
              const customer = row.customer_id
                ? (
                    await client.query<{
                      dob: Date | null;
                      membership_card_type: string | null;
                      membership_valid_until: Date | null;
                    }>(
                      `SELECT dob, membership_card_type, membership_valid_until
                       FROM customers WHERE id = $1 LIMIT 1`,
                      [row.customer_id]
                    )
                  ).rows[0]
                : undefined;

              const quote = calculatePriceQuote({
                rentalType: row.desired_rental_type as any,
                customerAge: calculateAge(customer?.dob ?? null),
                checkInTime: new Date(),
                membershipCardType: (customer?.membership_card_type as any) ?? 'NONE',
                membershipValidUntil: toDate(customer?.membership_valid_until),
                includeSixMonthMembershipPurchase: nextIntent ? true : false,
              });

              await client.query(
                `UPDATE payment_intents
                 SET amount = $1, quote_json = $2, updated_at = NOW()
                 WHERE id = $3`,
                [quote.total, JSON.stringify(quote), row.payment_intent_id]
              );
              await client.query(
                `UPDATE lane_sessions
                 SET price_quote_json = $1, updated_at = NOW()
                 WHERE id = $2`,
                [JSON.stringify(quote), row.id]
              );
            }
          }

          return { ok: true, sessionId: row.id };
        });

        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, result.sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return reply.send({ ok: true });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to set membership purchase intent');
        const httpErr = getHttpError(error);
        if (httpErr) return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed' });
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  /**
   * POST /v1/checkin/lane/:laneId/complete-membership-purchase
   *
   * Staff-only endpoint to finalize membership purchase/renewal by entering the physical membership number.
   */
  fastify.post<{ Params: { laneId: string }; Body: z.infer<typeof CompleteMembershipSchema> }>(
    '/v1/checkin/lane/:laneId/complete-membership-purchase',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.staff) return reply.status(401).send({ error: 'Unauthorized' });
      const { laneId } = request.params;
      let body: z.infer<typeof CompleteMembershipSchema>;
      try {
        body = CompleteMembershipSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      try {
        await transaction(async (client) => {
          const sessionRes = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions WHERE id = $1 AND lane_id = $2 LIMIT 1 FOR UPDATE`,
            [body.sessionId, laneId]
          );
          if (sessionRes.rows.length === 0) throw { statusCode: 404, message: 'Lane session not found' };
          const session = sessionRes.rows[0]!;
          if (!session.customer_id) throw { statusCode: 400, message: 'Lane session has no customer' };

          if (!session.membership_purchase_intent) {
            throw { statusCode: 400, message: 'No pending membership purchase intent on this session' };
          }

          if (!session.payment_intent_id) {
            throw { statusCode: 400, message: 'No payment intent for membership purchase' };
          }

          const pi = await client.query<{ status: string }>(
            `SELECT status::text as status FROM payment_intents WHERE id = $1 LIMIT 1`,
            [session.payment_intent_id]
          );
          if (pi.rows[0]?.status !== 'PAID') {
            throw { statusCode: 400, message: 'Membership purchase requires a PAID payment intent' };
          }

          await client.query(
            `UPDATE customers
             SET membership_number = $1,
                 membership_card_type = 'SIX_MONTH',
                 membership_valid_until = (CURRENT_DATE + INTERVAL '6 months')::date,
                 updated_at = NOW()
             WHERE id = $2`,
            [body.membershipNumber, session.customer_id]
          );

          await client.query(
            `UPDATE lane_sessions
             SET membership_purchase_intent = NULL,
                 membership_purchase_requested_at = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [session.id]
          );
        });

        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, body.sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return reply.send({ ok: true });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to complete membership purchase');
        const httpErr = getHttpError(error);
        if (httpErr) return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed' });
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );
}

