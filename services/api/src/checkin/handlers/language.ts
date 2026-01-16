import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { transaction } from '../../db/index.js';
import { optionalAuth } from '../../auth/middleware.js';
import type { LaneSessionRow } from '../types.js';
import { buildFullSessionUpdatedPayload, getHttpError } from '../service.js';

const SetLanguageSchema = z.object({
  language: z.enum(['EN', 'ES']),
  sessionId: z.string().uuid().optional(),
});

export async function registerCheckinLanguageRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/checkin/lane/:laneId/set-language
   *
   * Public kiosk endpoint to set the customer's primary language for this lane session.
   */
  fastify.post<{ Params: { laneId: string }; Body: z.infer<typeof SetLanguageSchema> }>(
    '/v1/checkin/lane/:laneId/set-language',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const { laneId } = request.params;
      let body: z.infer<typeof SetLanguageSchema>;
      try {
        body = SetLanguageSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      try {
        const { sessionId } = await transaction(async (client) => {
          const sessionRes = body.sessionId
            ? await client.query<LaneSessionRow>(`SELECT * FROM lane_sessions WHERE id = $1 LIMIT 1 FOR UPDATE`, [
                body.sessionId,
              ])
            : await client.query<LaneSessionRow>(
                `SELECT * FROM lane_sessions
                 WHERE lane_id = $1 AND status IN ('ACTIVE','AWAITING_ASSIGNMENT','AWAITING_PAYMENT','AWAITING_SIGNATURE','COMPLETED')
                 ORDER BY created_at DESC
                 LIMIT 1
                 FOR UPDATE`,
                [laneId]
              );

          if (sessionRes.rows.length === 0) throw { statusCode: 404, message: 'Lane session not found' };
          const session = sessionRes.rows[0]!;
          if (!session.customer_id) throw { statusCode: 400, message: 'No customer on lane session' };

          await client.query(
            `UPDATE customers SET primary_language = $1, updated_at = NOW() WHERE id = $2`,
            [body.language, session.customer_id]
          );
          return { sessionId: session.id };
        });

        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);
        return reply.send({ ok: true });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to set language');
        const httpErr = getHttpError(error);
        if (httpErr) return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed' });
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );

  // Compatibility helper (some clients use GET)
  fastify.get<{ Params: { laneId: string }; Querystring: { language?: 'EN' | 'ES' } }>(
    '/v1/checkin/lane/:laneId/set-language',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      const language = request.query.language;
      if (!language) return reply.status(400).send({ error: 'language query parameter is required' });
      const res = await fastify.inject({
        method: 'POST',
        url: `/v1/checkin/lane/${request.params.laneId}/set-language`,
        payload: { language },
      });
      reply.status(res.statusCode);
      return reply.send(res.body ? JSON.parse(res.body) : {});
    }
  );
}

