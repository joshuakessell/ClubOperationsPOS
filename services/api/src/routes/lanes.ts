import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transaction } from '../db/index.js';
import { requireAuth } from '../auth/middleware.js';
import type { Broadcaster } from '../websocket/broadcaster.js';
import type { SessionUpdatedPayload } from '@club-ops/shared';
import type { LaneSessionRow } from '../checkin/types.js';
import { buildFullSessionUpdatedPayload, getHttpError } from '../checkin/service.js';
import { getAllowedRentals } from '../checkin/allowedRentals.js';

declare module 'fastify' {
  interface FastifyInstance {
    broadcaster: Broadcaster;
  }
}

interface SessionRow {
  id: string;
  customer_id: string;
  lane: string;
  status: string;
}

interface CustomerRow {
  id: string;
  name: string;
  membership_number: string | null;
}

/**
 * Schema for creating or updating a lane session.
 */
const LaneSessionSchema = z.object({
  customerName: z.string().min(1),
  membershipNumber: z.string().nullable().optional(),
});

type LaneSessionInput = z.infer<typeof LaneSessionSchema>;

/**
 * Lane session management routes.
 */
export async function laneRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/lanes/:laneId/session - Create or update lane session
   *
   * Creates or updates a session for a specific lane.
   * Broadcasts SESSION_UPDATED event to the lane.
   * Auth required.
   */
  fastify.post<{ Params: { laneId: string }; Body: LaneSessionInput }>(
    '/v1/lanes/:laneId/session',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) {
        return reply.status(401).send({
          error: 'Unauthorized',
        });
      }

      const { laneId } = request.params;
      let body: LaneSessionInput;

      try {
        body = LaneSessionSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      try {
        const result = await transaction(async (client) => {
          // Check for existing active session in this lane
          const existingSession = await client.query<SessionRow>(
            `SELECT s.id, s.customer_id, s.lane, s.status
           FROM sessions s
           WHERE s.lane = $1 AND s.status = 'ACTIVE'
           ORDER BY s.created_at DESC
           LIMIT 1`,
            [laneId]
          );

          let session: SessionRow;
          let customerName: string;
          let membershipNumber: string | null = body.membershipNumber || null;
          let customerId: string | null = null;

          if (existingSession.rows.length > 0) {
            // Update existing session - get customer info
            const existing = existingSession.rows[0]!;
            if (existing.customer_id) {
              const customerResult = await client.query<CustomerRow>(
                `SELECT id, name, membership_number FROM customers WHERE id = $1`,
                [existing.customer_id]
              );
              if (customerResult.rows.length > 0) {
                const customer = customerResult.rows[0]!;
                customerName = customer.name;
                membershipNumber = customer.membership_number;
                customerId = customer.id;
              } else {
                customerName = body.customerName;
              }
            } else {
              customerName = body.customerName;
            }
            session = existing;
          } else {
            // Create or find customer
            if (membershipNumber) {
              const customerResult = await client.query<CustomerRow>(
                `SELECT id, name, membership_number FROM customers WHERE membership_number = $1 LIMIT 1`,
                [membershipNumber]
              );
              if (customerResult.rows.length > 0) {
                customerId = customerResult.rows[0]!.id;
                customerName = customerResult.rows[0]!.name;
              } else {
                // Create new customer
                const newCustomerResult = await client.query<CustomerRow>(
                  `INSERT INTO customers (name, membership_number) VALUES ($1, $2) RETURNING id, name, membership_number`,
                  [body.customerName, membershipNumber]
                );
                customerId = newCustomerResult.rows[0]!.id;
                customerName = newCustomerResult.rows[0]!.name;
              }
            } else {
              // Create new customer without membership
              const newCustomerResult = await client.query<CustomerRow>(
                `INSERT INTO customers (name) VALUES ($1) RETURNING id, name, membership_number`,
                [body.customerName]
              );
              customerId = newCustomerResult.rows[0]!.id;
              customerName = newCustomerResult.rows[0]!.name;
            }

            // Create new session
            const newSessionResult = await client.query<SessionRow>(
              `INSERT INTO sessions (customer_id, status, lane)
             VALUES ($1, 'ACTIVE', $2)
             RETURNING id, customer_id, lane, status`,
              [customerId, laneId]
            );
            session = newSessionResult.rows[0]!;
          }

          // Determine allowed rentals
          const allowedRentals = getAllowedRentals(membershipNumber);

          // Broadcast SESSION_UPDATED event to the specific lane
          const payload: SessionUpdatedPayload = {
            sessionId: session.id,
            customerName,
            membershipNumber: membershipNumber || undefined,
            allowedRentals,
          };

          fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

          return {
            sessionId: session.id,
            customerName,
            membershipNumber: membershipNumber || undefined,
            allowedRentals,
          };
        });

        return reply.send(result);
      } catch (error) {
        request.log.error(error, 'Failed to create/update lane session');
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to process session',
        });
      }
    }
  );

  /**
   * POST /v1/lanes/:laneId/clear - Clear lane session
   *
   * Clears the lane session for a specific lane (lane_sessions table).
   * Broadcasts a full, contract-consistent SESSION_UPDATED snapshot (status: COMPLETED).
   * Auth required.
   */
  fastify.post<{ Params: { laneId: string } }>(
    '/v1/lanes/:laneId/clear',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) {
        return reply.status(401).send({
          error: 'Unauthorized',
        });
      }

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

        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return reply.send({ success: true });
      } catch (error) {
        request.log.error(error, 'Failed to clear lane session');
        const httpErr = getHttpError(error);
        if (httpErr) {
          return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed' });
        }
        return reply.status(500).send({ error: 'Internal Server Error', message: 'Failed to clear session' });
      }
    }
  );
}
