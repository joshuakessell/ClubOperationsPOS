import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query } from '../db/index.js';
import { requireAuth, requireAdmin, requireReauthForAdmin } from '../auth/middleware.js';
import type { InternalMessage } from '@club-ops/shared';

const CreateMessageSchema = z.object({
  title: z.string().min(1),
  body: z.string().min(1),
  severity: z.enum(['INFO', 'WARNING', 'URGENT']),
  target_type: z.enum(['ALL', 'ROLE', 'STAFF', 'DEVICE']),
  target_role: z.string().optional(),
  target_staff_id: z.string().uuid().optional(),
  target_device_id: z.string().optional(),
  expires_at: z.string().datetime().optional(),
  pinned: z.boolean().optional(),
});

function mapMessageRow(row: any): InternalMessage {
  return {
    id: row.id,
    title: row.title,
    body: row.body,
    severity: row.severity,
    targetType: row.target_type,
    targetRole: row.target_role ?? null,
    targetStaffId: row.target_staff_id ?? null,
    targetDeviceId: row.target_device_id ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at instanceof Date ? row.created_at.toISOString() : row.created_at,
    expiresAt: row.expires_at ? (row.expires_at instanceof Date ? row.expires_at.toISOString() : row.expires_at) : null,
    pinned: row.pinned ?? false,
  };
}

export async function messagesRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/messages
   * Returns active messages targeted to the current staff/device with ack state.
   */
  fastify.get('/v1/messages', { preHandler: [requireAuth] }, async (
    request: FastifyRequest<{
      Querystring: { deviceId?: string };
    }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const deviceIdHeader = request.headers['x-device-id'];
    const deviceId = (typeof deviceIdHeader === 'string' ? deviceIdHeader : Array.isArray(deviceIdHeader) ? deviceIdHeader[0] : undefined)
      ?? request.query.deviceId;

    const staffId = request.staff.staffId;
    const staffRole = request.staff.role;

    try {
      const result = await query<{
        id: string;
        title: string;
        body: string;
        severity: string;
        target_type: string;
        target_role: string | null;
        target_staff_id: string | null;
        target_device_id: string | null;
        created_by: string | null;
        created_at: Date;
        expires_at: Date | null;
        pinned: boolean;
        acknowledged_at: Date | null;
      }>(
        `
        SELECT m.*, ack.acknowledged_at
        FROM internal_messages m
        LEFT JOIN LATERAL (
          SELECT acknowledged_at
          FROM internal_message_acks a
          WHERE a.message_id = m.id
            AND (
              a.staff_id = $1
              OR ($2 IS NOT NULL AND a.device_id = $2)
            )
          ORDER BY acknowledged_at DESC
          LIMIT 1
        ) ack ON true
        WHERE (m.expires_at IS NULL OR m.expires_at > NOW())
          AND (
            m.target_type = 'ALL'
            OR (m.target_type = 'ROLE' AND m.target_role = $3)
            OR (m.target_type = 'STAFF' AND m.target_staff_id = $1)
            OR (m.target_type = 'DEVICE' AND $2 IS NOT NULL AND m.target_device_id = $2)
          )
        ORDER BY m.pinned DESC, m.created_at DESC
        `,
        [staffId, deviceId ?? null, staffRole]
      );

      const messages = result.rows.map((row) => ({
        message: mapMessageRow(row),
        acknowledged: !!row.acknowledged_at,
        acknowledgedAt: row.acknowledged_at ? row.acknowledged_at.toISOString() : null,
      }));

      return reply.send({ messages });
    } catch (error) {
      request.log.error(error, 'Failed to fetch messages');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /v1/messages/:id/ack
   * Acknowledge a message (idempotent).
   */
  fastify.post('/v1/messages/:id/ack', { preHandler: [requireAuth] }, async (
    request: FastifyRequest<{ Params: { id: string }; Body?: { deviceId?: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;
    const deviceIdHeader = request.headers['x-device-id'];
    const deviceId = (typeof deviceIdHeader === 'string' ? deviceIdHeader : Array.isArray(deviceIdHeader) ? deviceIdHeader[0] : undefined)
      ?? request.body?.deviceId;

    try {
      await query(
        `INSERT INTO internal_message_acks (message_id, staff_id, device_id)
         VALUES ($1, $2, $3)
         ON CONFLICT DO NOTHING`,
        [id, request.staff.staffId, deviceId ?? null]
      );

      await query(
        `INSERT INTO audit_log (staff_id, action, entity_type, entity_id, new_value)
         VALUES ($1, 'MESSAGE_ACKNOWLEDGED', 'internal_message', $2, $3)`,
        [request.staff.staffId, id, JSON.stringify({ deviceId: deviceId ?? null })]
      );

      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error, 'Failed to acknowledge message');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * POST /v1/admin/messages
   * Create a new internal message and broadcast it.
   */
  fastify.post('/v1/admin/messages', { preHandler: [requireAuth, requireAdmin] }, async (
    request: FastifyRequest<{ Body: z.infer<typeof CreateMessageSchema> }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    let body;
    try {
      body = CreateMessageSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }

    // Require re-auth for URGENT severity
    if (body.severity === 'URGENT') {
      await requireReauthForAdmin(request, reply);
      if (reply.statusCode >= 400) {
        return;
      }
    }

    // Validate target field requirements
    if (body.target_type === 'ROLE' && !body.target_role) {
      return reply.status(400).send({ error: 'target_role is required for ROLE target_type' });
    }
    if (body.target_type === 'STAFF' && !body.target_staff_id) {
      return reply.status(400).send({ error: 'target_staff_id is required for STAFF target_type' });
    }
    if (body.target_type === 'DEVICE' && !body.target_device_id) {
      return reply.status(400).send({ error: 'target_device_id is required for DEVICE target_type' });
    }

    try {
      const result = await query<{
        id: string;
        title: string;
        body: string;
        severity: string;
        target_type: string;
        target_role: string | null;
        target_staff_id: string | null;
        target_device_id: string | null;
        created_by: string | null;
        created_at: Date;
        expires_at: Date | null;
        pinned: boolean;
      }>(
        `INSERT INTO internal_messages (
          title, body, severity, target_type, target_role, target_staff_id, target_device_id, created_by, expires_at, pinned
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, COALESCE($10, false))
        RETURNING *`,
        [
          body.title,
          body.body,
          body.severity,
          body.target_type,
          body.target_role ?? null,
          body.target_staff_id ?? null,
          body.target_device_id ?? null,
          request.staff.staffId,
          body.expires_at ? new Date(body.expires_at) : null,
          body.pinned ?? false,
        ]
      );

      const message = mapMessageRow(result.rows[0]!);

      await query(
        `INSERT INTO audit_log (staff_id, action, entity_type, entity_id, new_value)
         VALUES ($1, 'MESSAGE_CREATED', 'internal_message', $2, $3)`,
        [request.staff.staffId, message.id, JSON.stringify(message)]
      );

      fastify.broadcaster.broadcast({
        type: 'INTERNAL_MESSAGE_CREATED',
        payload: { message },
        timestamp: new Date().toISOString(),
      });

      return reply.status(201).send(message);
    } catch (error) {
      request.log.error(error, 'Failed to create message');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });

  /**
   * GET /v1/admin/messages
   * Returns recent messages with acknowledgement counts.
   */
  fastify.get('/v1/admin/messages', { preHandler: [requireAuth, requireAdmin] }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      const result = await query<{
        id: string;
        title: string;
        body: string;
        severity: string;
        target_type: string;
        target_role: string | null;
        target_staff_id: string | null;
        target_device_id: string | null;
        created_by: string | null;
        created_at: Date;
        expires_at: Date | null;
        pinned: boolean;
        ack_count: string;
        created_by_name: string | null;
      }>(
        `
        SELECT 
          m.*,
          (SELECT COUNT(*) FROM internal_message_acks a WHERE a.message_id = m.id) AS ack_count,
          s.name AS created_by_name
        FROM internal_messages m
        LEFT JOIN staff s ON s.id = m.created_by
        ORDER BY m.created_at DESC
        LIMIT 200
        `
      );

      const messages = result.rows.map((row) => ({
        message: mapMessageRow(row),
        ackCount: parseInt(row.ack_count || '0', 10),
        createdByName: row.created_by_name ?? null,
      }));

      return reply.send({ messages });
    } catch (error) {
      request.log.error(error, 'Failed to list messages');
      return reply.status(500).send({ error: 'Internal server error' });
    }
  });
}

