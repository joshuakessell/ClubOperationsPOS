import type { FastifyInstance } from 'fastify';
import { optionalAuth } from '../../auth/middleware';
import { requireKioskTokenOrStaff } from '../../auth/kioskToken';

function isFlowCommandsEnabled(): boolean {
  return process.env.FLOW_COMMANDS === 'true';
}

export function registerCheckinFlowCommandRoutes(fastify: FastifyInstance): void {
  fastify.post<{
    Params: { laneId: string };
    Body: {
      sessionId: string;
      commandId: string;
      actor: 'CUSTOMER' | 'EMPLOYEE' | 'SYSTEM';
      expectedFlowVersion?: number;
      type: string;
      payload?: Record<string, unknown>;
    };
  }>(
    '/v1/checkin/lane/:laneId/flow-command',
    {
      preHandler: [optionalAuth, requireKioskTokenOrStaff],
    },
    async (request, reply) => {
      if (!isFlowCommandsEnabled()) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const { laneId } = request.params;
      const { sessionId, commandId, actor, expectedFlowVersion, type, payload } = request.body;

      if (!sessionId || !commandId || !actor || !type) {
        return reply.status(400).send({ error: 'sessionId, commandId, actor, and type are required' });
      }

      return reply.status(501).send({
        error: 'Not Implemented',
        message: 'FLOW_COMMANDS enabled, but command engine is not implemented yet',
        laneId,
        sessionId,
        commandId,
        actor,
        expectedFlowVersion,
        type,
        payload: payload ?? null,
      });
    }
  );
}
