import type { FastifyInstance } from 'fastify';
import { transaction } from '../../db/index.js';
import { optionalAuth, requireAuth } from '../../auth/middleware.js';
import type { LaneSessionRow } from '../types.js';
import { buildFullSessionUpdatedPayload, getHttpError } from '../service.js';

export async function registerCheckinResetRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/checkin/lane/:laneId/kiosk-ack
   *
   * Public kiosk endpoint. Marks that the kiosk UI acknowledged completion.
   * Must NOT clear/end the lane session.
   */
  fastify.post<{ Params: { laneId: string } }>(
    '/v1/checkin/lane/:laneId/kiosk-ack',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const { laneId } = request.params;
      try {
        const sessionId = await transaction(async (client) => {
          const sessionRes = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions
             WHERE lane_id = $1 AND status IN ('ACTIVE','AWAITING_ASSIGNMENT','AWAITING_PAYMENT','AWAITING_SIGNATURE','COMPLETED')
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [laneId]
          );
          if (sessionRes.rows.length === 0) throw { statusCode: 404, message: 'Lane session not found' };
          const session = sessionRes.rows[0]!;
          await client.query(
            `UPDATE lane_sessions SET kiosk_acknowledged_at = NOW(), updated_at = NOW() WHERE id = $1`,
            [session.id]
          );
          return session.id;
        });

        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);
        return reply.send({ ok: true });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to kiosk-ack');
        const httpErr = getHttpError(error);
        if (httpErr) return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed' });
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  /**
   * POST /v1/checkin/lane/:laneId/reset
   *
   * Staff-only endpoint to clear a lane session so the lane can be reused.
   */
  fastify.post<{ Params: { laneId: string } }>(
    '/v1/checkin/lane/:laneId/reset',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.staff) return reply.status(401).send({ error: 'Unauthorized' });
      const { laneId } = request.params;

      try {
        const sessionId = await transaction(async (client) => {
          const sessionRes = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions
             WHERE lane_id = $1 AND status IN ('IDLE','ACTIVE','AWAITING_CUSTOMER','AWAITING_ASSIGNMENT','AWAITING_PAYMENT','AWAITING_SIGNATURE','COMPLETED')
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [laneId]
          );
          if (sessionRes.rows.length === 0) throw { statusCode: 404, message: 'Lane session not found' };
          const session = sessionRes.rows[0]!;

          await client.query(
            `UPDATE lane_sessions
             SET status = 'COMPLETED',
                 customer_id = NULL,
                 customer_display_name = NULL,
                 membership_number = NULL,
                 desired_rental_type = NULL,
                 proposed_rental_type = NULL,
                 proposed_by = NULL,
                 selection_confirmed = false,
                 selection_confirmed_by = NULL,
                 selection_locked_at = NULL,
                 assigned_resource_id = NULL,
                 assigned_resource_type = NULL,
                 waitlist_desired_type = NULL,
                 backup_rental_type = NULL,
                 payment_intent_id = NULL,
                 price_quote_json = NULL,
                 membership_purchase_intent = NULL,
                 membership_purchase_requested_at = NULL,
                 kiosk_acknowledged_at = NULL,
                 updated_at = NOW()
             WHERE id = $1`,
            [session.id]
          );

          return session.id;
        });

        // Broadcast updated session snapshot to keep clients in sync.
        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);
        return reply.send({ ok: true });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to reset lane session');
        const httpErr = getHttpError(error);
        if (httpErr) return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed' });
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );
}

