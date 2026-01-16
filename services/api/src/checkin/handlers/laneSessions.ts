import type { FastifyInstance } from 'fastify';
import { query } from '../../db/index.js';
import { requireAuth } from '../../auth/middleware.js';
import type { LaneSessionRow } from '../types.js';

export async function registerCheckinLaneSessionsRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/checkin/lane-sessions
   *
   * Staff-only helper endpoint used by office-dashboard to inspect lane sessions.
   */
  fastify.get(
    '/v1/checkin/lane-sessions',
    { preHandler: [requireAuth] },
    async (request, reply) => {
      if (!request.staff) return reply.status(401).send({ error: 'Unauthorized' });
      const rows = await query<LaneSessionRow>(
        `SELECT * FROM lane_sessions
         ORDER BY created_at DESC
         LIMIT 200`
      );
      return reply.send({ sessions: rows.rows });
    }
  );
}

