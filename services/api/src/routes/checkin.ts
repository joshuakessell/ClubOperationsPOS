import type { FastifyInstance } from 'fastify';
import type { Broadcaster } from '../websocket/broadcaster.js';
import {
  registerCheckinAgreementRoutes,
  registerCheckinAssignmentRoutes,
  registerCheckinLanguageRoutes,
  registerCheckinLaneSessionsRoutes,
  registerCheckinMembershipRoutes,
  registerCheckinNotesRoutes,
  registerCheckinPastDueRoutes,
  registerCheckinPaymentRoutes,
  registerCheckinResetRoutes,
  registerCheckinScanIdRoutes,
  registerCheckinScanRoutes,
  registerCheckinSelectionRoutes,
  registerCheckinStartRoutes,
} from '../checkin/handlers/index.js';

declare module 'fastify' {
  interface FastifyInstance {
    broadcaster: Broadcaster;
  }
}

/**
 * Check-in flow routes.
 */
export async function checkinRoutes(fastify: FastifyInstance): Promise<void> {
  await registerCheckinStartRoutes(fastify);
  await registerCheckinScanRoutes(fastify);
  await registerCheckinScanIdRoutes(fastify);
  await registerCheckinSelectionRoutes(fastify);
  await registerCheckinAssignmentRoutes(fastify);
  await registerCheckinPaymentRoutes(fastify);
  await registerCheckinPastDueRoutes(fastify);
  await registerCheckinLanguageRoutes(fastify);
  await registerCheckinMembershipRoutes(fastify);
  await registerCheckinNotesRoutes(fastify);
  await registerCheckinResetRoutes(fastify);
  await registerCheckinLaneSessionsRoutes(fastify);
  await registerCheckinAgreementRoutes(fastify);
}
