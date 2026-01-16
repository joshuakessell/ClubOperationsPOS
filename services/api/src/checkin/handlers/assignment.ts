import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transaction } from '../../db/index.js';
import { requireAuth } from '../../auth/middleware.js';
import type { LaneSessionRow } from '../types.js';
import { buildFullSessionUpdatedPayload, getHttpError } from '../service.js';

const AssignSchema = z.object({
  resourceType: z.enum(['room', 'locker']),
  resourceId: z.string().uuid(),
});

export async function registerCheckinAssignmentRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/checkin/lane/:laneId/assign
   *
   * Records the chosen resource on the lane session only.
   * Inventory assignment/status transitions happen after signing the agreement.
   */
  fastify.post<{
    Params: { laneId: string };
    Body: z.infer<typeof AssignSchema>;
  }>(
    '/v1/checkin/lane/:laneId/assign',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.staff) return reply.status(401).send({ error: 'Unauthorized' });

      const { laneId } = request.params;
      let body: z.infer<typeof AssignSchema>;
      try {
        body = AssignSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      try {
        const result = await transaction(async (client) => {
          const sessionResult = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions
             WHERE lane_id = $1 AND status IN ('ACTIVE','AWAITING_ASSIGNMENT','AWAITING_PAYMENT','AWAITING_SIGNATURE','COMPLETED')
             ORDER BY created_at DESC
             LIMIT 1
             FOR UPDATE`,
            [laneId]
          );
          if (sessionResult.rows.length === 0) throw { statusCode: 404, message: 'No active session found' };
          const session = sessionResult.rows[0]!;

          if (!session.selection_confirmed || !session.desired_rental_type) {
            throw { statusCode: 400, message: 'Selection must be confirmed before assignment' };
          }

          let number: string | null = null;
          if (body.resourceType === 'room') {
            const room = await client.query<{ number: string; status: string; assigned_to_customer_id: string | null }>(
              `SELECT number, status, assigned_to_customer_id FROM rooms WHERE id = $1 LIMIT 1`,
              [body.resourceId]
            );
            if (room.rows.length === 0) throw { statusCode: 404, message: 'Room not found' };
            number = room.rows[0]!.number;
            if (room.rows[0]!.status !== 'CLEAN' || room.rows[0]!.assigned_to_customer_id) {
              throw { statusCode: 409, message: 'Room is not available' };
            }
          } else {
            const locker = await client.query<{ number: string; status: string; assigned_to_customer_id: string | null }>(
              `SELECT number, status, assigned_to_customer_id FROM lockers WHERE id = $1 LIMIT 1`,
              [body.resourceId]
            );
            if (locker.rows.length === 0) throw { statusCode: 404, message: 'Locker not found' };
            number = locker.rows[0]!.number;
            if (locker.rows[0]!.status !== 'CLEAN' || locker.rows[0]!.assigned_to_customer_id) {
              throw { statusCode: 409, message: 'Locker is not available' };
            }
          }

          await client.query(
            `UPDATE lane_sessions
             SET assigned_resource_type = $1,
                 assigned_resource_id = $2,
                 updated_at = NOW()
             WHERE id = $3`,
            [body.resourceType, body.resourceId, session.id]
          );

          return {
            success: true,
            sessionId: session.id,
            resourceType: body.resourceType,
            resourceId: body.resourceId,
            roomNumber: body.resourceType === 'room' ? number : undefined,
            lockerNumber: body.resourceType === 'locker' ? number : undefined,
          };
        });

        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, result.sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return reply.send(result);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to assign resource');
        const httpErr = getHttpError(error);
        if (httpErr) return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed to assign' });
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );
}

