import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, transaction } from '../db/index.js';
import {
  hashQrToken,
  verifyPin,
  generateSessionToken,
  getSessionExpiry,
} from '../auth/utils.js';
import { requireAuth } from '../auth/middleware.js';

/**
 * Schema for PIN login request.
 */
const LoginPinSchema = z.object({
  staffLookup: z.string().min(1), // staff ID or name
  deviceId: z.string().min(1),
  pin: z.string().min(1),
});

type LoginPinInput = z.infer<typeof LoginPinSchema>;

interface StaffRow {
  id: string;
  name: string;
  role: string;
  qr_token_hash: string | null;
  pin_hash: string | null;
  active: boolean;
}

/**
 * Authentication routes.
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/auth/login-pin - Staff login with PIN
   * 
   * Accepts staff ID or name and PIN for authentication.
   * Creates a session and returns session token.
   */
  fastify.post('/v1/auth/login-pin', async (
    request: FastifyRequest<{ Body: LoginPinInput }>,
    reply: FastifyReply
  ) => {
    let body: LoginPinInput;

    try {
      body = LoginPinSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }

    try {
      const result = await transaction(async (client) => {
        // Find staff by ID or name (must be active)
        const staffResult = await client.query<StaffRow>(
          `SELECT id, name, role, pin_hash, active
           FROM staff
           WHERE (id = $1 OR name ILIKE $1)
           AND pin_hash IS NOT NULL
           AND active = true
           LIMIT 1`,
          [body.staffLookup]
        );

        if (staffResult.rows.length === 0) {
          return null;
        }

        const staff = staffResult.rows[0]!;

        // Enforce active status
        if (!staff.active) {
          return null;
        }

        // Verify PIN
        if (!staff.pin_hash || !(await verifyPin(body.pin, staff.pin_hash))) {
          return null;
        }

        // Generate session token
        const sessionToken = generateSessionToken();
        const expiresAt = getSessionExpiry();

        // Create session
        await client.query(
          `INSERT INTO staff_sessions (staff_id, device_id, device_type, session_token, expires_at)
           VALUES ($1, $2, 'tablet', $3, $4)`,
          [staff.id, body.deviceId, sessionToken, expiresAt]
        );

        // Log audit action
        await client.query(
          `INSERT INTO audit_log (staff_id, action, entity_type, entity_id)
           VALUES ($1, 'STAFF_LOGIN_PIN', 'staff_session', $2)`,
          [staff.id, sessionToken]
        );

        return {
          staffId: staff.id,
          name: staff.name,
          role: staff.role,
          sessionToken,
        };
      });

      if (!result) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
      }

      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Login error');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process login',
      });
    }
  });

  /**
   * POST /v1/auth/logout - Staff logout
   * 
   * Revokes the current session token.
   */
  fastify.post('/v1/auth/logout', {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
      });
    }

    const token = authHeader.substring(7);

    try {
      // Get staff ID before revoking
      const sessionResult = await query<{ staff_id: string }>(
        `SELECT staff_id FROM staff_sessions WHERE session_token = $1 AND revoked_at IS NULL`,
        [token]
      );

      if (sessionResult.rows.length > 0) {
        const staffId = sessionResult.rows[0]!.staff_id;

        await query(
          `UPDATE staff_sessions
           SET revoked_at = NOW()
           WHERE session_token = $1
           AND revoked_at IS NULL`,
          [token]
        );

        // Log audit action
        await query(
          `INSERT INTO audit_log (staff_id, action, entity_type, entity_id)
           VALUES ($1, 'STAFF_LOGOUT', 'staff_session', $2)`,
          [staffId, token]
        );
      }

      return reply.send({ success: true });
    } catch (error) {
      request.log.error(error, 'Logout error');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to logout',
      });
    }
  });

  /**
   * GET /v1/auth/me - Get current staff identity
   * 
   * Returns the authenticated staff member's information.
   */
  fastify.get('/v1/auth/me', {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({
        error: 'Unauthorized',
      });
    }

    return reply.send({
      staffId: request.staff.staffId,
      name: request.staff.name,
      role: request.staff.role,
    });
  });

  /**
   * POST /v1/auth/reauth-pin - Re-authenticate with PIN for sensitive admin actions
   * 
   * Requires existing session. Verifies PIN and sets reauth_ok_until timestamp
   * (valid for 5 minutes).
   */
  const ReauthPinSchema = z.object({
    pin: z.string().min(1),
  });

  fastify.post('/v1/auth/reauth-pin', {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{ Body: z.infer<typeof ReauthPinSchema> }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({
        error: 'Unauthorized',
      });
    }

    let body: z.infer<typeof ReauthPinSchema>;
    try {
      body = ReauthPinSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
      });
    }

    const token = authHeader.substring(7);

    try {
      // Get staff PIN hash
      const staffResult = await query<{ pin_hash: string | null }>(
        `SELECT pin_hash FROM staff WHERE id = $1 AND active = true`,
        [request.staff.staffId]
      );

      if (staffResult.rows.length === 0 || !staffResult.rows[0]!.pin_hash) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid credentials',
        });
      }

      // Verify PIN
      if (!(await verifyPin(body.pin, staffResult.rows[0]!.pin_hash))) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid PIN',
        });
      }

      // Set reauth_ok_until to 5 minutes from now
      const reauthOkUntil = new Date(Date.now() + 5 * 60 * 1000);

      await query(
        `UPDATE staff_sessions
         SET reauth_ok_until = $1
         WHERE session_token = $2
         AND revoked_at IS NULL`,
        [reauthOkUntil, token]
      );

      // Log audit action
      await query(
        `INSERT INTO audit_log (staff_id, action, entity_type, entity_id)
         VALUES ($1, 'STAFF_REAUTH_PIN', 'staff_session', $2)`,
        [request.staff.staffId, token]
      );

      return reply.send({
        success: true,
        reauthOkUntil: reauthOkUntil.toISOString(),
      });
    } catch (error) {
      request.log.error(error, 'Re-auth error');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process re-authentication',
      });
    }
  });
}


