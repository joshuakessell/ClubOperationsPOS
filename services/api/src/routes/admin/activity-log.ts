import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAdmin, requireAuth } from '../../auth/middleware';
import { query } from '../../db';

const ListSchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  q: z.string().optional(),
  customerId: z.string().uuid().optional(),
  actorStaffId: z.string().uuid().optional(),
  actionCategories: z.string().optional(),
  actionTypes: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional().default(50),
  cursor: z.string().optional(),
});

type Cursor = { occurredAt: string; id: string };

function parseCursor(raw: string | undefined): { occurredAt: Date; id: string } | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64').toString('utf8')) as Cursor;
    if (!parsed || typeof parsed !== 'object') return null;
    if (typeof parsed.occurredAt !== 'string' || typeof parsed.id !== 'string') return null;
    const d = new Date(parsed.occurredAt);
    if (!Number.isFinite(d.getTime())) return null;
    return { occurredAt: d, id: parsed.id };
  } catch {
    return null;
  }
}

function buildCursor(value: { occurredAt: Date; id: string }): string {
  return Buffer.from(
    JSON.stringify({ occurredAt: value.occurredAt.toISOString(), id: value.id }),
    'utf8'
  ).toString('base64');
}

function parseCsv(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export function registerAdminActivityLogRoutes(fastify: FastifyInstance): void {
  /**
   * GET /v1/admin/activity-log
   */
  fastify.get<{ Querystring: z.infer<typeof ListSchema> }>(
    '/v1/admin/activity-log',
    { preHandler: [requireAuth, requireAdmin] },
    async (request, reply) => {
      let parsed: z.infer<typeof ListSchema>;
      try {
        parsed = ListSchema.parse(request.query);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      const cursor = parseCursor(parsed.cursor);
      const actionCategories = parseCsv(parsed.actionCategories);
      const actionTypes = parseCsv(parsed.actionTypes);
      const from = parsed.from ? new Date(parsed.from) : null;
      const to = parsed.to ? new Date(parsed.to) : null;
      const q = parsed.q?.trim() ? parsed.q.trim() : null;

      try {
        const rows = await query<{
          id: string;
          occurred_at: Date;
          customer_id: string;
          customer_name: string;
          action_type: string;
          action_category: string;
          source_app: string;
          actor_type: string;
          actor_staff_id: string | null;
          actor_staff_name: string | null;
          summary: string;
          metadata: unknown;
        }>(
          `
          SELECT
            e.id,
            e.occurred_at,
            e.customer_id,
            c.name as customer_name,
            e.action_type,
            e.action_category,
            e.source_app,
            e.actor_type,
            e.actor_staff_id,
            e.actor_staff_name,
            e.summary,
            e.metadata
          FROM customer_activity_events e
          JOIN customers c ON c.id = e.customer_id
          WHERE
            ($1::timestamptz IS NULL OR e.occurred_at >= $1)
            AND ($2::timestamptz IS NULL OR e.occurred_at <= $2)
            AND ($3::uuid IS NULL OR e.customer_id = $3)
            AND ($4::uuid IS NULL OR e.actor_staff_id = $4)
            AND ($5::text[] IS NULL OR e.action_category = ANY($5))
            AND ($6::text[] IS NULL OR e.action_type = ANY($6))
            AND ($7::text IS NULL OR e.search_blob ILIKE '%' || $7 || '%')
            AND (
              $8::timestamptz IS NULL
              OR (
                e.occurred_at < $8
                OR (e.occurred_at = $8 AND e.id < $9::uuid)
              )
            )
          ORDER BY e.occurred_at DESC, e.id DESC
          LIMIT $10
          `,
          [
            from,
            to,
            parsed.customerId ?? null,
            parsed.actorStaffId ?? null,
            actionCategories.length > 0 ? actionCategories : null,
            actionTypes.length > 0 ? actionTypes : null,
            q,
            cursor?.occurredAt ?? null,
            cursor?.id ?? '00000000-0000-0000-0000-000000000000',
            parsed.limit,
          ]
        );

        const events = rows.rows.map((r) => ({
          id: r.id,
          occurredAt: r.occurred_at.toISOString(),
          customerId: r.customer_id,
          customerName: r.customer_name,
          actionType: r.action_type,
          actionCategory: r.action_category,
          sourceApp: r.source_app,
          actorType: r.actor_type,
          actorStaffId: r.actor_staff_id,
          actorStaffName: r.actor_staff_name,
          summary: r.summary,
          metadata: r.metadata,
          cursor: buildCursor({ occurredAt: r.occurred_at, id: r.id }),
        }));

        const nextCursor = events.length === parsed.limit ? events[events.length - 1]!.cursor : null;
        return reply.send({ events, nextCursor });
      } catch (error) {
        request.log.error(error, 'Failed to fetch activity log');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * GET /v1/admin/customers/:customerId/activity-log
   * Supports centering around an event ID.
   */
  fastify.get<{
    Params: { customerId: string };
    Querystring: {
      centerEventId?: string;
      limit?: string;
    };
  }>(
    '/v1/admin/customers/:customerId/activity-log',
    { preHandler: [requireAuth, requireAdmin] },
    async (request, reply) => {
      const limit = Math.min(Math.max(parseInt(request.query.limit || '41', 10) || 41, 5), 201);
      const half = Math.floor(limit / 2);
      const { customerId } = request.params;

      try {
        if (!request.query.centerEventId) {
          const rows = await query<{
            id: string;
            occurred_at: Date;
            action_type: string;
            action_category: string;
            source_app: string;
            actor_type: string;
            actor_staff_id: string | null;
            actor_staff_name: string | null;
            summary: string;
            metadata: unknown;
          }>(
            `
            SELECT id, occurred_at, action_type, action_category, source_app, actor_type,
                   actor_staff_id, actor_staff_name, summary, metadata
            FROM customer_activity_events
            WHERE customer_id = $1
            ORDER BY occurred_at DESC, id DESC
            LIMIT $2
            `,
            [customerId, limit]
          );

          const events = rows.rows.map((r) => ({
            id: r.id,
            occurredAt: r.occurred_at.toISOString(),
            actionType: r.action_type,
            actionCategory: r.action_category,
            sourceApp: r.source_app,
            actorType: r.actor_type,
            actorStaffId: r.actor_staff_id,
            actorStaffName: r.actor_staff_name,
            summary: r.summary,
            metadata: r.metadata,
          }));

          return reply.send({ events, centerEventId: null });
        }

        const center = await query<{ id: string; occurred_at: Date }>(
          `SELECT id, occurred_at FROM customer_activity_events WHERE id = $1 AND customer_id = $2`,
          [request.query.centerEventId, customerId]
        );
        if (center.rows.length === 0) {
          return reply.status(404).send({ error: 'Center event not found' });
        }
        const centerRow = center.rows[0]!;

        const before = await query<{
          id: string;
          occurred_at: Date;
          action_type: string;
          action_category: string;
          source_app: string;
          actor_type: string;
          actor_staff_id: string | null;
          actor_staff_name: string | null;
          summary: string;
          metadata: unknown;
        }>(
          `
          SELECT id, occurred_at, action_type, action_category, source_app, actor_type,
                 actor_staff_id, actor_staff_name, summary, metadata
          FROM customer_activity_events
          WHERE customer_id = $1
            AND (occurred_at > $2 OR (occurred_at = $2 AND id > $3))
          ORDER BY occurred_at ASC, id ASC
          LIMIT $4
          `,
          [customerId, centerRow.occurred_at, centerRow.id, half]
        );

        const after = await query<{
          id: string;
          occurred_at: Date;
          action_type: string;
          action_category: string;
          source_app: string;
          actor_type: string;
          actor_staff_id: string | null;
          actor_staff_name: string | null;
          summary: string;
          metadata: unknown;
        }>(
          `
          SELECT id, occurred_at, action_type, action_category, source_app, actor_type,
                 actor_staff_id, actor_staff_name, summary, metadata
          FROM customer_activity_events
          WHERE customer_id = $1
            AND (occurred_at < $2 OR (occurred_at = $2 AND id < $3))
          ORDER BY occurred_at DESC, id DESC
          LIMIT $4
          `,
          [customerId, centerRow.occurred_at, centerRow.id, half]
        );

        const centerEvent = await query<{
          id: string;
          occurred_at: Date;
          action_type: string;
          action_category: string;
          source_app: string;
          actor_type: string;
          actor_staff_id: string | null;
          actor_staff_name: string | null;
          summary: string;
          metadata: unknown;
        }>(
          `
          SELECT id, occurred_at, action_type, action_category, source_app, actor_type,
                 actor_staff_id, actor_staff_name, summary, metadata
          FROM customer_activity_events
          WHERE id = $1
          `,
          [centerRow.id]
        );

        const serialize = (r: any) => ({
          id: r.id,
          occurredAt: r.occurred_at.toISOString(),
          actionType: r.action_type,
          actionCategory: r.action_category,
          sourceApp: r.source_app,
          actorType: r.actor_type,
          actorStaffId: r.actor_staff_id,
          actorStaffName: r.actor_staff_name,
          summary: r.summary,
          metadata: r.metadata,
        });

        // before is returned ASC; after is returned DESC; normalize to a single chronological list.
        const events = [
          ...after.rows.reverse().map(serialize),
          serialize(centerEvent.rows[0]!),
          ...before.rows.map(serialize),
        ];

        return reply.send({ events, centerEventId: centerRow.id });
      } catch (error) {
        request.log.error(error, 'Failed to fetch customer activity log');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}

