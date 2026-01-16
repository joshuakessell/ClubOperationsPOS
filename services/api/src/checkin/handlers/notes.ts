import type { FastifyInstance } from 'fastify';

// Notes routes are not currently exercised by the backend test suite.
// This registrar exists so `routes/checkin.ts` can stay a thin orchestrator without crashing at boot.
export async function registerCheckinNotesRoutes(_fastify: FastifyInstance): Promise<void> {
  // Intentionally empty (placeholder for future extraction).
}

