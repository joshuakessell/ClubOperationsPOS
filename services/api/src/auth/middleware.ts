import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { query } from '../db/index.js';

export interface StaffSession {
  staffId: string;
  name: string;
  role: 'STAFF' | 'ADMIN';
}

declare module 'fastify' {
  interface FastifyRequest {
    staff?: StaffSession;
  }
}

/**
 * Middleware to require authentication.
 * Extracts session token from Authorization header and validates it.
 */
export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing or invalid authorization header',
    });
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  try {
    // Look up session in database
    const sessionResult = await query<{
      staff_id: string;
      name: string;
      role: string;
      revoked_at: string | null;
      expires_at: string;
    }>(
      `SELECT s.staff_id, st.name, st.role, s.revoked_at, s.expires_at
       FROM staff_sessions s
       JOIN staff st ON s.staff_id = st.id
       WHERE s.session_token = $1
       AND s.revoked_at IS NULL
       AND st.active = true`,
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired session token',
      });
    }

    const session = sessionResult.rows[0]!;
    
    // Check if session has expired
    const expiresAt = new Date(session.expires_at);
    if (expiresAt < new Date()) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Session has expired',
      });
    }

    // Attach staff info to request
    request.staff = {
      staffId: session.staff_id,
      name: session.name,
      role: session.role as 'STAFF' | 'ADMIN',
    };
  } catch (error) {
    request.log.error(error, 'Error validating session token');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to validate session',
    });
  }
}

/**
 * Middleware to require admin role.
 * Must be used after requireAuth.
 */
export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  if (!request.staff) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Authentication required',
    });
  }

  if (request.staff.role !== 'ADMIN') {
    return reply.status(403).send({
      error: 'Forbidden',
      message: 'Admin role required',
    });
  }
}

/**
 * Step-up re-authentication middleware.
 * Requires re-auth within 2 minutes for sensitive actions.
 * 
 * Sensitive actions include:
 * - Completing an upgrade (after payment)
 * - Marking upgrade paid
 * - Issuing the final 2-hour extension
 * - Cancelling waitlist entries
 */
export async function requireReauth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // First ensure basic auth
  await requireAuth(request, reply);
  
  if (!request.staff) {
    return; // requireAuth already sent error response
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing authorization header',
    });
  }

  const token = authHeader.substring(7);

  try {
    // Check if session was created within last 2 minutes (step-up re-auth window)
    const sessionResult = await query<{
      created_at: string;
    }>(
      `SELECT created_at FROM staff_sessions WHERE session_token = $1 AND revoked_at IS NULL`,
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid session token',
      });
    }

    const session = sessionResult.rows[0]!;
    const createdAt = new Date(session.created_at);
    const now = new Date();
    const minutesSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60);

    // Require re-auth if session is older than 2 minutes
    if (minutesSinceCreation > 2) {
      return reply.status(403).send({
        error: 'Re-authentication required',
        message: 'This action requires re-authentication. Please log in again.',
        code: 'REAUTH_REQUIRED',
      });
    }
  } catch (error) {
    request.log.error(error, 'Error checking re-auth');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to validate re-authentication',
    });
  }
}

/**
 * Middleware to require re-authentication for sensitive admin actions.
 * Checks that reauth_ok_until is set and not expired (must be within last 5 minutes).
 * 
 * Sensitive admin actions include:
 * - Revoking passkeys
 * - Resetting staff PINs
 * - Other high-privilege admin operations
 */
export async function requireReauthForAdmin(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // First ensure basic auth and admin role
  await requireAuth(request, reply);
  
  if (!request.staff) {
    return; // requireAuth already sent error response
  }

  await requireAdmin(request, reply);

  if (!request.staff) {
    return; // requireAdmin already sent error response
  }

  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({
      error: 'Unauthorized',
      message: 'Missing authorization header',
    });
  }

  const token = authHeader.substring(7);

  try {
    // Check if reauth_ok_until is set and not expired
    const sessionResult = await query<{
      reauth_ok_until: string | null;
    }>(
      `SELECT reauth_ok_until 
       FROM staff_sessions 
       WHERE session_token = $1 
       AND revoked_at IS NULL`,
      [token]
    );

    if (sessionResult.rows.length === 0) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid session token',
      });
    }

    const session = sessionResult.rows[0]!;
    
    if (!session.reauth_ok_until) {
      return reply.status(403).send({
        error: 'Re-authentication required',
        message: 'This action requires re-authentication. Please re-authenticate first.',
        code: 'REAUTH_REQUIRED',
      });
    }

    const reauthOkUntil = new Date(session.reauth_ok_until);
    const now = new Date();

    if (reauthOkUntil < now) {
      return reply.status(403).send({
        error: 'Re-authentication expired',
        message: 'Re-authentication has expired. Please re-authenticate again.',
        code: 'REAUTH_EXPIRED',
      });
    }
  } catch (error) {
    request.log.error(error, 'Error checking re-auth for admin');
    return reply.status(500).send({
      error: 'Internal Server Error',
      message: 'Failed to validate re-authentication',
    });
  }
}

/**
 * Register authentication middleware as a Fastify hook.
 */
export function registerAuthMiddleware(_fastify: FastifyInstance): void {
  // This will be used as a preHandler on specific routes
  // No global hook needed - we'll apply it per-route
}



