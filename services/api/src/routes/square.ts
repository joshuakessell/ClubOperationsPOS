import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { requireAuth, requireAdmin } from '../auth/middleware.js';
import { fetchSquareSummary, SquareNotConfiguredError } from '../services/square.js';

function defaultChicagoRange(): { from: string; to: string } {
  const now = new Date();
  const nowChicago = new Date(now.toLocaleString('en-US', { timeZone: 'America/Chicago' }));
  const startChicago = new Date(nowChicago);
  startChicago.setHours(0, 0, 0, 0);

  // Convert back to UTC ISO strings
  const from = new Date(startChicago.toLocaleString('en-US', { timeZone: 'UTC' })).toISOString();
  const to = new Date(nowChicago.toLocaleString('en-US', { timeZone: 'UTC' })).toISOString();
  return { from, to };
}

export async function squareRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/v1/admin/square/summary', { preHandler: [requireAuth, requireAdmin] }, async (
    request: FastifyRequest<{ Querystring: { from?: string; to?: string } }>,
    reply: FastifyReply
  ) => {
    const range = request.query.from && request.query.to
      ? { from: request.query.from, to: request.query.to }
      : defaultChicagoRange();

    try {
      const summary = await fetchSquareSummary(range.from, range.to);
      return reply.send(summary);
    } catch (error) {
      if (error instanceof SquareNotConfiguredError || (error as any)?.code === 'SQUARE_NOT_CONFIGURED') {
        return reply.status(501).send({ error: 'Square integration not configured', code: 'SQUARE_NOT_CONFIGURED' });
      }

      request.log.error(error, 'Failed to fetch Square summary');
      return reply.status(502).send({ error: 'Failed to fetch Square summary' });
    }
  });
}

