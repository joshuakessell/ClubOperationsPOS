import type { FastifyInstance } from 'fastify';

// Past-due flow routes are not currently required by the backend test suite.
// This registrar exists so `routes/checkin.ts` can stay a thin orchestrator without crashing at boot.
export async function registerCheckinPastDueRoutes(_fastify: FastifyInstance): Promise<void> {
  // Intentionally empty (placeholder for future extraction).
}

