import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, transaction } from '../db/index.js';
import { verifyPin } from '../auth/utils.js';
import { requireAuth } from '../auth/middleware.js';

/**
 * Schema for PIN verification request.
 */
const VerifyPinSchema = z.object({
  employeeId: z.string().uuid(),
  pin: z.string().min(1),
});

type VerifyPinInput = z.infer<typeof VerifyPinSchema>;

/**
 * Schema for register assignment request.
 */
const AssignRegisterSchema = z.object({
  employeeId: z.string().uuid(),
  deviceId: z.string().min(1),
  registerNumber: z.number().int().min(1).max(2).optional(),
});

type AssignRegisterInput = z.infer<typeof AssignRegisterSchema>;

/**
 * Schema for register confirmation request.
 */
const ConfirmRegisterSchema = z.object({
  employeeId: z.string().uuid(),
  deviceId: z.string().min(1),
  registerNumber: z.number().int().min(1).max(2),
});

type ConfirmRegisterInput = z.infer<typeof ConfirmRegisterSchema>;

/**
 * Schema for heartbeat request.
 */
const HeartbeatSchema = z.object({
  deviceId: z.string().min(1),
});

type HeartbeatInput = z.infer<typeof HeartbeatSchema>;

interface EmployeeRow {
  id: string;
  name: string;
  role: string;
  pin_hash: string | null;
  active: boolean;
}

interface RegisterSessionRow {
  id: string;
  employee_id: string;
  device_id: string;
  register_number: number;
  last_heartbeat: Date;
  created_at: Date;
  signed_out_at: Date | null;
}

/**
 * Register management routes.
 * Handles employee sign-in, register assignment, heartbeat, and sign-out.
 */
export async function registerRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/employees/available
   * 
   * Returns list of employees available for register sign-in.
   * Excludes employees already signed into any register.
   */
  fastify.get('/v1/employees/available', async (
    request: FastifyRequest,
    reply: FastifyReply
  ) => {
    try {
      // Get all active employees
      const allEmployees = await query<EmployeeRow>(
        `SELECT id, name, role, active
         FROM staff
         WHERE active = true
         ORDER BY name`
      );

      // Get employees currently signed into registers
      const signedInEmployees = await query<{ employee_id: string }>(
        `SELECT DISTINCT employee_id
         FROM register_sessions
         WHERE signed_out_at IS NULL`
      );

      const signedInIds = new Set(signedInEmployees.rows.map(r => r.employee_id));

      // Filter out signed-in employees
      const available = allEmployees.rows
        .filter(emp => !signedInIds.has(emp.id))
        .map(emp => ({
          id: emp.id,
          name: emp.name,
          role: emp.role,
        }));

      return reply.send({ employees: available });
    } catch (error) {
      request.log.error(error, 'Failed to fetch available employees');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch available employees',
      });
    }
  });

  /**
   * POST /v1/auth/verify-pin
   * 
   * Verifies employee PIN without creating a session.
   * Used in the sign-in flow before register assignment.
   */
  fastify.post('/v1/auth/verify-pin', async (
    request: FastifyRequest<{ Body: VerifyPinInput }>,
    reply: FastifyReply
  ) => {
    let body: VerifyPinInput;

    try {
      body = VerifyPinSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }

    try {
      const result = await query<EmployeeRow>(
        `SELECT id, name, role, pin_hash, active
         FROM staff
         WHERE id = $1
         AND pin_hash IS NOT NULL
         AND active = true
         LIMIT 1`,
        [body.employeeId]
      );

      if (result.rows.length === 0) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Employee not found or inactive',
        });
      }

      const employee = result.rows[0]!;

      // Verify PIN
      if (!employee.pin_hash || !(await verifyPin(body.pin, employee.pin_hash))) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Wrong PIN',
        });
      }

      return reply.send({
        verified: true,
        employee: {
          id: employee.id,
          name: employee.name,
          role: employee.role,
        },
      });
    } catch (error) {
      request.log.error(error, 'PIN verification error');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to verify PIN',
      });
    }
  });

  /**
   * POST /v1/registers/assign
   * 
   * Assigns a register to an employee.
   * If registerNumber is not provided, automatically assigns the remaining register.
   * Returns the assigned register number and requires confirmation.
   */
  fastify.post('/v1/registers/assign', async (
    request: FastifyRequest<{ Body: AssignRegisterInput }>,
    reply: FastifyReply
  ) => {
    let body: AssignRegisterInput;

    try {
      body = AssignRegisterSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }

    try {
      const result = await transaction(async (client) => {
        // Check if employee is already signed in
        const existingSession = await client.query<RegisterSessionRow>(
          `SELECT * FROM register_sessions
           WHERE employee_id = $1
           AND signed_out_at IS NULL`,
          [body.employeeId]
        );

        if (existingSession.rows.length > 0) {
          throw new Error('Employee already signed into a register');
        }

        // Check if device is already signed in
        const existingDevice = await client.query<RegisterSessionRow>(
          `SELECT * FROM register_sessions
           WHERE device_id = $1
           AND signed_out_at IS NULL`,
          [body.deviceId]
        );

        if (existingDevice.rows.length > 0) {
          throw new Error('Device already signed into a register');
        }

        // Get currently occupied registers
        const occupiedRegisters = await client.query<{ register_number: number }>(
          `SELECT register_number FROM register_sessions
           WHERE signed_out_at IS NULL`
        );

        const occupiedNumbers = new Set(occupiedRegisters.rows.map(r => r.register_number));

        let registerNumber: number;

        if (body.registerNumber) {
          // Check if requested register is available
          if (occupiedNumbers.has(body.registerNumber)) {
            throw new Error(`Register ${body.registerNumber} is already occupied`);
          }
          registerNumber = body.registerNumber;
        } else {
          // Auto-assign remaining register
          if (occupiedNumbers.size >= 2) {
            throw new Error('All registers are occupied');
          }
          // Assign register 1 if available, otherwise register 2
          registerNumber = occupiedNumbers.has(1) ? 2 : 1;
        }

        return {
          registerNumber,
          requiresConfirmation: true,
        };
      });

      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Register assignment error');
      const message = error instanceof Error ? error.message : 'Failed to assign register';
      return reply.status(400).send({
        error: 'Assignment failed',
        message,
      });
    }
  });

  /**
   * POST /v1/registers/confirm
   * 
   * Confirms and locks register assignment.
   * Creates the register session and enforces uniqueness constraints.
   */
  fastify.post('/v1/registers/confirm', async (
    request: FastifyRequest<{ Body: ConfirmRegisterInput }>,
    reply: FastifyReply
  ) => {
    let body: ConfirmRegisterInput;

    try {
      body = ConfirmRegisterSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }

    try {
      const result = await transaction(async (client) => {
        // Double-check constraints before inserting
        const existingEmployee = await client.query<RegisterSessionRow>(
          `SELECT * FROM register_sessions
           WHERE employee_id = $1
           AND signed_out_at IS NULL`,
          [body.employeeId]
        );

        if (existingEmployee.rows.length > 0) {
          throw new Error('Employee already signed into a register');
        }

        const existingDevice = await client.query<RegisterSessionRow>(
          `SELECT * FROM register_sessions
           WHERE device_id = $1
           AND signed_out_at IS NULL`,
          [body.deviceId]
        );

        if (existingDevice.rows.length > 0) {
          throw new Error('Device already signed into a register');
        }

        const existingRegister = await client.query<RegisterSessionRow>(
          `SELECT * FROM register_sessions
           WHERE register_number = $1
           AND signed_out_at IS NULL`,
          [body.registerNumber]
        );

        if (existingRegister.rows.length > 0) {
          throw new Error(`Register ${body.registerNumber} is already occupied`);
        }

        // Create register session
        const sessionResult = await client.query<RegisterSessionRow>(
          `INSERT INTO register_sessions (employee_id, device_id, register_number, last_heartbeat)
           VALUES ($1, $2, $3, NOW())
           RETURNING *`,
          [body.employeeId, body.deviceId, body.registerNumber]
        );

        const session = sessionResult.rows[0]!;

        // Get employee info
        const employeeResult = await client.query<EmployeeRow>(
          `SELECT id, name, role FROM staff WHERE id = $1`,
          [body.employeeId]
        );

        const employee = employeeResult.rows[0]!;

        // Log audit action
        await client.query(
          `INSERT INTO audit_log (staff_id, action, entity_type, entity_id)
           VALUES ($1, 'REGISTER_SIGN_IN', 'register_session', $2)`,
          [body.employeeId, session.id]
        );

        return {
          sessionId: session.id,
          employee: {
            id: employee.id,
            name: employee.name,
            role: employee.role,
          },
          registerNumber: session.register_number,
          deviceId: session.device_id,
        };
      });

      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Register confirmation error');
      const message = error instanceof Error ? error.message : 'Failed to confirm register assignment';
      return reply.status(400).send({
        error: 'Confirmation failed',
        message,
      });
    }
  });

  /**
   * POST /v1/registers/heartbeat
   * 
   * Updates the last_heartbeat timestamp for a register session.
   * Used to keep sessions alive and detect abandoned sessions.
   */
  fastify.post('/v1/registers/heartbeat', async (
    request: FastifyRequest<{ Body: HeartbeatInput }>,
    reply: FastifyReply
  ) => {
    let body: HeartbeatInput;

    try {
      body = HeartbeatSchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }

    try {
      const result = await query<RegisterSessionRow>(
        `UPDATE register_sessions
         SET last_heartbeat = NOW()
         WHERE device_id = $1
         AND signed_out_at IS NULL
         RETURNING *`,
        [body.deviceId]
      );

      if (result.rows.length === 0) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'No active register session found for this device',
        });
      }

      return reply.send({
        success: true,
        lastHeartbeat: result.rows[0]!.last_heartbeat.toISOString(),
      });
    } catch (error) {
      request.log.error(error, 'Heartbeat error');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to update heartbeat',
      });
    }
  });

  /**
   * POST /v1/registers/signout
   * 
   * Signs out an employee from their register.
   * Requires authentication (session token).
   */
  fastify.post('/v1/registers/signout', {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{ Body: { deviceId: string } }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({
        error: 'Unauthorized',
      });
    }

    const deviceId = request.body.deviceId;

    if (!deviceId) {
      return reply.status(400).send({
        error: 'Validation failed',
        message: 'deviceId is required',
      });
    }

    try {
      const result = await transaction(async (client) => {
        // Find active register session for this device
        const sessionResult = await client.query<RegisterSessionRow>(
          `SELECT * FROM register_sessions
           WHERE device_id = $1
           AND signed_out_at IS NULL`,
          [deviceId]
        );

        if (sessionResult.rows.length === 0) {
          throw new Error('No active register session found');
        }

        const session = sessionResult.rows[0]!;

        // Verify employee matches (security check)
        if (session.employee_id !== request.staff!.staffId) {
          throw new Error('Register session does not belong to authenticated employee');
        }

        // Sign out
        await client.query(
          `UPDATE register_sessions
           SET signed_out_at = NOW()
           WHERE id = $1`,
          [session.id]
        );

        // Log audit action
        await client.query(
          `INSERT INTO audit_log (staff_id, action, entity_type, entity_id)
           VALUES ($1, 'REGISTER_SIGN_OUT', 'register_session', $2)`,
          [request.staff!.staffId, session.id]
        );

        return {
          success: true,
          sessionId: session.id,
        };
      });

      return reply.send(result);
    } catch (error) {
      request.log.error(error, 'Sign out error');
      const message = error instanceof Error ? error.message : 'Failed to sign out';
      return reply.status(400).send({
        error: 'Sign out failed',
        message,
      });
    }
  });

  /**
   * GET /v1/registers/status
   * 
   * Returns the current register session status for a device.
   * Used to check if device is already signed in.
   */
  fastify.get('/v1/registers/status', async (
    request: FastifyRequest<{ Querystring: { deviceId: string } }>,
    reply: FastifyReply
  ) => {
    const deviceId = request.query.deviceId;

    if (!deviceId) {
      return reply.status(400).send({
        error: 'Validation failed',
        message: 'deviceId query parameter is required',
      });
    }

    try {
      const result = await query<RegisterSessionRow & { employee_name: string; employee_role: string }>(
        `SELECT 
           rs.*,
           s.name as employee_name,
           s.role as employee_role
         FROM register_sessions rs
         JOIN staff s ON s.id = rs.employee_id
         WHERE rs.device_id = $1
         AND rs.signed_out_at IS NULL`,
        [deviceId]
      );

      if (result.rows.length === 0) {
        return reply.send({
          signedIn: false,
        });
      }

      const session = result.rows[0]!;

      return reply.send({
        signedIn: true,
        sessionId: session.id,
        employee: {
          id: session.employee_id,
          name: session.employee_name,
          role: session.employee_role,
        },
        registerNumber: session.register_number,
        lastHeartbeat: session.last_heartbeat.toISOString(),
      });
    } catch (error) {
      request.log.error(error, 'Failed to fetch register status');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch register status',
      });
    }
  });
}

/**
 * Clean up abandoned register sessions (no heartbeat for > 90 seconds).
 * Should be called periodically (e.g., every 30 seconds).
 */
export async function cleanupAbandonedRegisterSessions(): Promise<number> {
  try {
    const result = await query(
      `UPDATE register_sessions
       SET signed_out_at = NOW()
       WHERE signed_out_at IS NULL
       AND last_heartbeat < NOW() - INTERVAL '90 seconds'`
    );
    return result.rowCount || 0;
  } catch (error) {
    console.error('Failed to cleanup abandoned register sessions:', error);
    return 0;
  }
}

