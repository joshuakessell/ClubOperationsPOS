import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { query, transaction, serializableTransaction } from '../db/index.js';
import { requireAuth } from '../auth/middleware.js';
import type { Broadcaster } from '../websocket/broadcaster.js';
import type { 
  SessionUpdatedPayload,
  CustomerConfirmationRequiredPayload,
  CustomerConfirmedPayload,
  CustomerDeclinedPayload,
  AssignmentCreatedPayload,
  AssignmentFailedPayload,
} from '@club-ops/shared';
import { calculatePriceQuote, type PricingInput } from '../pricing/engine.js';

declare module 'fastify' {
  interface FastifyInstance {
    broadcaster: Broadcaster;
  }
}

interface LaneSessionRow {
  id: string;
  lane_id: string;
  status: string;
  staff_id: string | null;
  customer_id: string | null;
  customer_display_name: string | null;
  membership_number: string | null;
  desired_rental_type: string | null;
  waitlist_desired_type: string | null;
  backup_rental_type: string | null;
  assigned_resource_id: string | null;
  assigned_resource_type: string | null;
  price_quote_json: unknown;
  disclaimers_ack_json: unknown;
  payment_intent_id: string | null;
  created_at: Date;
  updated_at: Date;
}

interface CustomerRow {
  id: string;
  name: string;
  dob: Date | null;
  membership_number: string | null;
  membership_card_type: string | null;
  membership_valid_until: Date | null;
  banned_until: Date | null;
}

interface MemberRow {
  id: string;
  name: string;
  membership_number: string | null;
  dob: Date | null;
  membership_card_type: string | null;
  membership_valid_until: Date | null;
  banned_until: Date | null;
}

interface RoomRow {
  id: string;
  number: string;
  type: string;
  status: string;
  assigned_to: string | null;
}

interface LockerRow {
  id: string;
  number: string;
  status: string;
  assigned_to: string | null;
}

interface PaymentIntentRow {
  id: string;
  lane_session_id: string;
  amount: number;
  status: string;
  quote_json: unknown;
}

/**
 * Check if a membership number is eligible for Gym Locker rental.
 */
function isGymLockerEligible(membershipNumber: string | null | undefined): boolean {
  if (!membershipNumber) {
    return false;
  }

  const rangesEnv = process.env.GYM_LOCKER_ELIGIBLE_RANGES || '';
  if (!rangesEnv.trim()) {
    return false;
  }

  const membershipNum = parseInt(membershipNumber, 10);
  if (isNaN(membershipNum)) {
    return false;
  }

  const ranges = rangesEnv.split(',').map(range => range.trim()).filter(Boolean);
  
  for (const range of ranges) {
    const [startStr, endStr] = range.split('-').map(s => s.trim());
    const start = parseInt(startStr || '', 10);
    const end = parseInt(endStr || '', 10);
    
    if (!isNaN(start) && !isNaN(end) && membershipNum >= start && membershipNum <= end) {
      return true;
    }
  }

  return false;
}

/**
 * Determine allowed rentals based on membership eligibility.
 */
function getAllowedRentals(membershipNumber: string | null | undefined): string[] {
  const allowed: string[] = ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL'];
  
  if (isGymLockerEligible(membershipNumber)) {
    allowed.push('GYM_LOCKER');
  }
  
  return allowed;
}

/**
 * Parse membership number from scan input.
 * Supports configurable regex pattern.
 */
function parseMembershipNumber(scanValue: string): string | null {
  // Default: extract digits only
  const pattern = process.env.MEMBERSHIP_SCAN_PATTERN || '\\d+';
  const regex = new RegExp(pattern);
  const match = scanValue.match(regex);
  return match ? match[0] : null;
}

/**
 * Calculate customer age from date of birth.
 */
function calculateAge(dob: Date | null): number | undefined {
  if (!dob) {
    return undefined;
  }
  const today = new Date();
  let age = today.getFullYear() - dob.getFullYear();
  const monthDiff = today.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
    age--;
  }
  return age;
}

/**
 * Map room number to tier (Special, Double, or Standard).
 */
function getRoomTier(roomNumber: string): 'SPECIAL' | 'DOUBLE' | 'STANDARD' {
  const num = parseInt(roomNumber, 10);
  
  // Special: rooms 201, 232, 256
  if (num === 201 || num === 232 || num === 256) {
    return 'SPECIAL';
  }
  
  // Double: even rooms 216, 218, 232, 252, 256, 262 and odd room 225
  if (num === 216 || num === 218 || num === 232 || num === 252 || num === 256 || num === 262 || num === 225) {
    return 'DOUBLE';
  }
  
  // All else standard
  return 'STANDARD';
}

/**
 * Check-in flow routes.
 */
export async function checkinRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/checkin/lane/:laneId/start
   * 
   * Start a lane session with customer identification.
   * Input: { idScanValue, membershipScanValue? }
   * Output: laneSession + customer display fields
   */
  fastify.post('/v1/checkin/lane/:laneId/start', {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{
      Params: { laneId: string };
      Body: { idScanValue: string; membershipScanValue?: string };
    }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { laneId } = request.params;
    const { idScanValue, membershipScanValue } = request.body;

    try {
      const result = await transaction(async (client) => {
        // Parse membership number if provided
        const membershipNumber = membershipScanValue 
          ? parseMembershipNumber(membershipScanValue) 
          : null;

        // Look up or create customer
        let customerId: string | null = null;
        let customerName = 'Customer'; // Default, will be updated from ID scan
        
        // For Phase 2: Store ID scan hash and value
        // For now, use ID scan value as display name (simplified)
        customerName = idScanValue;

        // Try to find existing customer by membership number
        if (membershipNumber) {
          const memberResult = await client.query<MemberRow>(
            `SELECT id, name, dob, membership_number, membership_card_type, membership_valid_until, banned_until
             FROM members
             WHERE membership_number = $1
             LIMIT 1`,
            [membershipNumber]
          );

          if (memberResult.rows.length > 0) {
            const member = memberResult.rows[0]!;
            customerId = member.id;
            customerName = member.name;
            
            // Check if banned
            if (member.banned_until && new Date() < member.banned_until) {
              throw { statusCode: 403, message: 'Customer is banned until ' + member.banned_until.toISOString() };
            }
          }
        }

        // Create or update lane session
        const existingSession = await client.query<LaneSessionRow>(
          `SELECT id, status FROM lane_sessions
           WHERE lane_id = $1 AND status IN ('IDLE', 'ACTIVE', 'AWAITING_CUSTOMER')
           ORDER BY created_at DESC
           LIMIT 1`,
          [laneId]
        );

        let session: LaneSessionRow;

        if (existingSession.rows.length > 0 && existingSession.rows[0]!.status !== 'COMPLETED') {
          // Update existing session
          const updateResult = await client.query<LaneSessionRow>(
            `UPDATE lane_sessions
             SET customer_display_name = $1,
                 membership_number = $2,
                 customer_id = $3,
                 status = 'ACTIVE',
                 staff_id = $4,
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
            [customerName, membershipNumber, customerId, request.staff.staffId, existingSession.rows[0]!.id]
          );
          session = updateResult.rows[0]!;
        } else {
          // Create new session
          const newSessionResult = await client.query<LaneSessionRow>(
            `INSERT INTO lane_sessions 
             (lane_id, status, staff_id, customer_id, customer_display_name, membership_number)
             VALUES ($1, 'ACTIVE', $2, $3, $4, $5)
             RETURNING *`,
            [laneId, request.staff.staffId, customerId, customerName, membershipNumber]
          );
          session = newSessionResult.rows[0]!;
        }

        // Determine allowed rentals
        const allowedRentals = getAllowedRentals(membershipNumber);

        // Broadcast SESSION_UPDATED event
        const payload: SessionUpdatedPayload = {
          sessionId: session.id,
          customerName: session.customer_display_name || '',
          membershipNumber: session.membership_number || undefined,
          allowedRentals,
        };

        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return {
          sessionId: session.id,
          customerName: session.customer_display_name,
          membershipNumber: session.membership_number,
          allowedRentals,
        };
      });

      return reply.send(result);
    } catch (error: unknown) {
      request.log.error(error, 'Failed to start lane session');
      if (error && typeof error === 'object' && 'statusCode' in error) {
        return reply.status((error as { statusCode: number }).statusCode).send({
          error: (error as { message: string }).message || 'Failed to start session',
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to start lane session',
      });
    }
  });

  /**
   * POST /v1/checkin/lane/:laneId/select-rental
   * 
   * Customer selects rental type (with optional waitlist).
   * Input: { rentalType, waitlistDesiredType?, backupRentalType? }
   */
  fastify.post('/v1/checkin/lane/:laneId/select-rental', {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{
      Params: { laneId: string };
      Body: { 
        rentalType: string;
        waitlistDesiredType?: string;
        backupRentalType?: string;
      };
    }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { laneId } = request.params;
    const { rentalType, waitlistDesiredType, backupRentalType } = request.body;

    try {
      const result = await transaction(async (client) => {
        // Get active session
        const sessionResult = await client.query<LaneSessionRow>(
          `SELECT * FROM lane_sessions
           WHERE lane_id = $1 AND status = 'ACTIVE'
           ORDER BY created_at DESC
           LIMIT 1`,
          [laneId]
        );

        if (sessionResult.rows.length === 0) {
          throw { statusCode: 404, message: 'No active session found' };
        }

        const session = sessionResult.rows[0]!;

        // Update session with rental selection
        const updateResult = await client.query<LaneSessionRow>(
          `UPDATE lane_sessions
           SET desired_rental_type = $1,
               waitlist_desired_type = $2,
               backup_rental_type = $3,
               status = 'AWAITING_ASSIGNMENT',
               updated_at = NOW()
           WHERE id = $4
           RETURNING *`,
          [rentalType, waitlistDesiredType || null, backupRentalType || null, session.id]
        );

        // Broadcast update
        const payload: SessionUpdatedPayload = {
          sessionId: updateResult.rows[0]!.id,
          customerName: updateResult.rows[0]!.customer_display_name || '',
          membershipNumber: updateResult.rows[0]!.membership_number || undefined,
          allowedRentals: getAllowedRentals(updateResult.rows[0]!.membership_number),
        };

        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return {
          sessionId: updateResult.rows[0]!.id,
          desiredRentalType: rentalType,
          waitlistDesiredType: waitlistDesiredType || null,
          backupRentalType: backupRentalType || null,
        };
      });

      return reply.send(result);
    } catch (error: unknown) {
      request.log.error(error, 'Failed to select rental');
      if (error && typeof error === 'object' && 'statusCode' in error) {
        return reply.status((error as { statusCode: number }).statusCode).send({
          error: (error as { message: string }).message || 'Failed to select rental',
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to select rental',
      });
    }
  });

  /**
   * POST /v1/checkin/lane/:laneId/assign
   * 
   * Assign a resource (room or locker) to the lane session.
   * Uses transactional locking to prevent double-booking.
   */
  fastify.post('/v1/checkin/lane/:laneId/assign', {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{
      Params: { laneId: string };
      Body: { resourceType: 'room' | 'locker'; resourceId: string };
    }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { laneId } = request.params;
    const { resourceType, resourceId } = request.body;

    try {
      const result = await serializableTransaction(async (client) => {
        // Get active session
        const sessionResult = await client.query<LaneSessionRow>(
          `SELECT * FROM lane_sessions
           WHERE lane_id = $1 AND status IN ('ACTIVE', 'AWAITING_ASSIGNMENT')
           ORDER BY created_at DESC
           LIMIT 1`,
          [laneId]
        );

        if (sessionResult.rows.length === 0) {
          throw { statusCode: 404, message: 'No active session found' };
        }

        const session = sessionResult.rows[0]!;

        // Lock and validate resource availability
        if (resourceType === 'room') {
          const roomResult = await client.query<RoomRow>(
            `SELECT id, number, type, status, assigned_to FROM rooms
             WHERE id = $1 FOR UPDATE`,
            [resourceId]
          );

          if (roomResult.rows.length === 0) {
            throw { statusCode: 404, message: 'Room not found' };
          }

          const room = roomResult.rows[0]!;

          if (room.status !== 'CLEAN') {
            throw { statusCode: 400, message: `Room ${room.number} is not available (status: ${room.status})` };
          }

          if (room.assigned_to) {
            throw { statusCode: 409, message: `Room ${room.number} is already assigned (race condition)` };
          }

          // Verify tier matches desired rental type
          const roomTier = getRoomTier(room.number);
          const desiredType = session.desired_rental_type || session.backup_rental_type;
          const needsConfirmation = desiredType && roomTier !== desiredType;

          // Assign room
          await client.query(
            `UPDATE rooms SET assigned_to = $1, updated_at = NOW() WHERE id = $2`,
            [session.customer_id || session.id, resourceId]
          );

          // Update session
          await client.query(
            `UPDATE lane_sessions
             SET assigned_resource_id = $1,
                 assigned_resource_type = 'room',
                 updated_at = NOW()
             WHERE id = $2`,
            [resourceId, session.id]
          );

          // Log audit
          await client.query(
            `INSERT INTO audit_log 
             (staff_id, user_id, user_role, action, entity_type, entity_id, previous_value, new_value)
             VALUES ($1, $2, 'staff', 'ASSIGN', 'room', $3, $4, $5)`,
            [
              request.staff.staffId,
              request.staff.staffId,
              resourceId,
              JSON.stringify({ assigned_to: null }),
              JSON.stringify({ assigned_to: session.customer_id || session.id, lane_session_id: session.id }),
            ]
          );

          // Broadcast assignment created
          const assignmentPayload: AssignmentCreatedPayload = {
            sessionId: session.id,
            roomId: resourceId,
            roomNumber: room.number,
            rentalType: roomTier,
          };
          fastify.broadcaster.broadcastAssignmentCreated(assignmentPayload, laneId);

          // If cross-type assignment, require customer confirmation
          if (needsConfirmation && desiredType) {
            const confirmationPayload: CustomerConfirmationRequiredPayload = {
              sessionId: session.id,
              requestedType: desiredType,
              selectedType: roomTier,
              selectedNumber: room.number,
            };
            fastify.broadcaster.broadcastCustomerConfirmationRequired(confirmationPayload, laneId);
          }

          return {
            success: true,
            resourceType: 'room',
            resourceId,
            roomNumber: room.number,
            needsConfirmation,
          };
        } else {
          // Locker assignment
          const lockerResult = await client.query<LockerRow>(
            `SELECT id, number, status, assigned_to FROM lockers
             WHERE id = $1 FOR UPDATE`,
            [resourceId]
          );

          if (lockerResult.rows.length === 0) {
            throw { statusCode: 404, message: 'Locker not found' };
          }

          const locker = lockerResult.rows[0]!;

          if (locker.assigned_to) {
            throw { statusCode: 409, message: `Locker ${locker.number} is already assigned (race condition)` };
          }

          // Assign locker
          await client.query(
            `UPDATE lockers SET assigned_to = $1, updated_at = NOW() WHERE id = $2`,
            [session.customer_id || session.id, resourceId]
          );

          // Update session
          await client.query(
            `UPDATE lane_sessions
             SET assigned_resource_id = $1,
                 assigned_resource_type = 'locker',
             updated_at = NOW()
             WHERE id = $2`,
            [resourceId, session.id]
          );

          // Log audit
          await client.query(
            `INSERT INTO audit_log 
             (staff_id, user_id, user_role, action, entity_type, entity_id, previous_value, new_value)
             VALUES ($1, $2, 'staff', 'ASSIGN', 'locker', $3, $4, $5)`,
            [
              request.staff.staffId,
              request.staff.staffId,
              resourceId,
              JSON.stringify({ assigned_to: null }),
              JSON.stringify({ assigned_to: session.customer_id || session.id, lane_session_id: session.id }),
            ]
          );

          // Broadcast assignment created
          const assignmentPayload: AssignmentCreatedPayload = {
            sessionId: session.id,
            lockerId: resourceId,
            lockerNumber: locker.number,
            rentalType: 'LOCKER',
          };
          fastify.broadcaster.broadcastAssignmentCreated(assignmentPayload, laneId);

          return {
            success: true,
            resourceType: 'locker',
            resourceId,
            lockerNumber: locker.number,
          };
        }
      });

      return reply.send(result);
    } catch (error: unknown) {
      request.log.error(error, 'Failed to assign resource');
      
      // Broadcast assignment failed if we have session info
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const statusCode = (error as { statusCode: number }).statusCode;
        if (statusCode === 409) {
          // Race condition - try to get session to broadcast failure
          try {
            const sessionResult = await query<LaneSessionRow>(
              `SELECT id FROM lane_sessions WHERE lane_id = $1 AND status IN ('ACTIVE', 'AWAITING_ASSIGNMENT') ORDER BY created_at DESC LIMIT 1`,
              [laneId]
            );
            if (sessionResult.rows.length > 0) {
              const failedPayload: AssignmentFailedPayload = {
                sessionId: sessionResult.rows[0]!.id,
                reason: (error as { message: string }).message || 'Resource already assigned',
                requestedRoomId: request.body.resourceType === 'room' ? request.body.resourceId : undefined,
                requestedLockerId: request.body.resourceType === 'locker' ? request.body.resourceId : undefined,
              };
              fastify.broadcaster.broadcastAssignmentFailed(failedPayload, laneId);
            }
          } catch {
            // Ignore broadcast errors
          }
        }
        
        return reply.status(statusCode).send({
          error: (error as { message: string }).message || 'Failed to assign resource',
          raceLost: statusCode === 409,
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to assign resource',
      });
    }
  });

  /**
   * POST /v1/checkin/lane/:laneId/create-payment-intent
   * 
   * Create a payment intent with DUE status from the price quote.
   */
  fastify.post('/v1/checkin/lane/:laneId/create-payment-intent', {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{
      Params: { laneId: string };
    }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { laneId } = request.params;

    try {
      const result = await transaction(async (client) => {
        // Get active session
        const sessionResult = await client.query<LaneSessionRow>(
          `SELECT * FROM lane_sessions
           WHERE lane_id = $1 AND status IN ('ACTIVE', 'AWAITING_ASSIGNMENT', 'AWAITING_PAYMENT')
           ORDER BY created_at DESC
           LIMIT 1`,
          [laneId]
        );

        if (sessionResult.rows.length === 0) {
          throw { statusCode: 404, message: 'No active session found' };
        }

        const session = sessionResult.rows[0]!;

        if (!session.assigned_resource_id || !session.assigned_resource_type) {
          throw { statusCode: 400, message: 'Resource must be assigned before creating payment intent' };
        }

        // Get customer info for pricing
        let customerAge: number | undefined;
        let membershipCardType: 'NONE' | 'SIX_MONTH' | undefined;
        let membershipValidUntil: Date | undefined;

        if (session.customer_id) {
          const memberResult = await client.query<MemberRow>(
            `SELECT dob, membership_card_type, membership_valid_until FROM members WHERE id = $1`,
            [session.customer_id]
          );
          if (memberResult.rows.length > 0) {
            const member = memberResult.rows[0]!;
            customerAge = calculateAge(member.dob);
            membershipCardType = (member.membership_card_type as 'NONE' | 'SIX_MONTH') || undefined;
            membershipValidUntil = member.membership_valid_until || undefined;
          }
        }

        // Determine rental type
        const rentalType = (session.desired_rental_type || session.backup_rental_type || 'LOCKER') as 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | 'GYM_LOCKER';

        // Calculate price quote
        const pricingInput: PricingInput = {
          rentalType,
          customerAge,
          checkInTime: new Date(),
          membershipCardType,
          membershipValidUntil,
        };

        const quote = calculatePriceQuote(pricingInput);

        // Create payment intent
        const intentResult = await client.query<PaymentIntentRow>(
          `INSERT INTO payment_intents 
           (lane_session_id, amount, status, quote_json)
           VALUES ($1, $2, 'DUE', $3)
           RETURNING *`,
          [session.id, quote.total, JSON.stringify(quote)]
        );

        const intent = intentResult.rows[0]!;

        // Update session with payment intent and quote
        await client.query(
          `UPDATE lane_sessions
           SET payment_intent_id = $1,
               price_quote_json = $2,
               status = 'AWAITING_PAYMENT',
               updated_at = NOW()
           WHERE id = $3`,
          [intent.id, JSON.stringify(quote), session.id]
        );

        return {
          paymentIntentId: intent.id,
          amount: typeof intent.amount === 'string' ? parseFloat(intent.amount) : intent.amount,
          quote,
        };
      });

      return reply.send(result);
    } catch (error: unknown) {
      request.log.error(error, 'Failed to create payment intent');
      if (error && typeof error === 'object' && 'statusCode' in error) {
        return reply.status((error as { statusCode: number }).statusCode).send({
          error: (error as { message: string }).message || 'Failed to create payment intent',
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to create payment intent',
      });
    }
  });

  /**
   * POST /v1/payments/:id/mark-paid
   * 
   * Mark a payment intent as PAID (called after Square payment).
   */
  fastify.post('/v1/payments/:id/mark-paid', {
    preHandler: [requireAuth],
  }, async (
    request: FastifyRequest<{
      Params: { id: string };
      Body: { squareTransactionId?: string };
    }>,
    reply: FastifyReply
  ) => {
    if (!request.staff) {
      return reply.status(401).send({ error: 'Unauthorized' });
    }

    const { id } = request.params;
    const { squareTransactionId } = request.body;

    try {
      const result = await transaction(async (client) => {
        // Get payment intent
        const intentResult = await client.query<PaymentIntentRow>(
          `SELECT * FROM payment_intents WHERE id = $1`,
          [id]
        );

        if (intentResult.rows.length === 0) {
          throw { statusCode: 404, message: 'Payment intent not found' };
        }

        const intent = intentResult.rows[0]!;

        if (intent.status === 'PAID') {
          return { paymentIntentId: intent.id, status: 'PAID', alreadyPaid: true };
        }

        // Mark as paid
        await client.query(
          `UPDATE payment_intents
           SET status = 'PAID',
               paid_at = NOW(),
               square_transaction_id = $1,
               updated_at = NOW()
           WHERE id = $2`,
          [squareTransactionId || null, id]
        );

        // Update lane session status
        const sessionResult = await client.query<LaneSessionRow>(
          `SELECT * FROM lane_sessions WHERE payment_intent_id = $1`,
          [id]
        );

        if (sessionResult.rows.length > 0) {
          const session = sessionResult.rows[0]!;
          // If signature already done, move to completion; otherwise await signature
          const newStatus = session.disclaimers_ack_json ? 'AWAITING_SIGNATURE' : 'AWAITING_SIGNATURE';
          await client.query(
            `UPDATE lane_sessions SET status = $1, updated_at = NOW() WHERE id = $2`,
            [newStatus, session.id]
          );

          // Broadcast update
          const payload: SessionUpdatedPayload = {
            sessionId: session.id,
            customerName: session.customer_display_name || '',
            membershipNumber: session.membership_number || undefined,
            allowedRentals: getAllowedRentals(session.membership_number),
          };
          fastify.broadcaster.broadcastSessionUpdated(payload, session.lane_id);
        }

        return {
          paymentIntentId: intent.id,
          status: 'PAID',
        };
      });

      return reply.send(result);
    } catch (error: unknown) {
      request.log.error(error, 'Failed to mark payment as paid');
      if (error && typeof error === 'object' && 'statusCode' in error) {
        return reply.status((error as { statusCode: number }).statusCode).send({
          error: (error as { message: string }).message || 'Failed to mark payment as paid',
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to mark payment as paid',
      });
    }
  });

  /**
   * POST /v1/checkin/lane/:laneId/sign-agreement
   * 
   * Store agreement signature and link to check-in block.
   * Public endpoint (customer kiosk can call without auth).
   */
  fastify.post('/v1/checkin/lane/:laneId/sign-agreement', async (
    request: FastifyRequest<{
      Params: { laneId: string };
      Body: { signaturePayload: string; sessionId?: string }; // PNG data URL or vector points JSON
    }>,
    reply: FastifyReply
  ) => {

    const { laneId } = request.params;
    const { signaturePayload } = request.body;

    try {
      const result = await transaction(async (client) => {
        // Get active session (by sessionId if provided, otherwise latest for lane)
        let sessionResult;
        if (request.body.sessionId) {
          sessionResult = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions
             WHERE id = $1 AND lane_id = $2 AND status IN ('AWAITING_SIGNATURE', 'AWAITING_PAYMENT')
             LIMIT 1`,
            [request.body.sessionId, laneId]
          );
        } else {
          sessionResult = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions
             WHERE lane_id = $1 AND status IN ('AWAITING_SIGNATURE', 'AWAITING_PAYMENT')
             ORDER BY created_at DESC
             LIMIT 1`,
            [laneId]
          );
        }

        if (sessionResult.rows.length === 0) {
          throw { statusCode: 404, message: 'No active session found' };
        }

        const session = sessionResult.rows[0]!;

        // Check payment is paid
        if (session.payment_intent_id) {
          const intentResult = await client.query<PaymentIntentRow>(
            `SELECT status FROM payment_intents WHERE id = $1`,
            [session.payment_intent_id]
          );
          if (intentResult.rows.length > 0 && intentResult.rows[0]!.status !== 'PAID') {
            throw { statusCode: 400, message: 'Payment must be marked as paid before signing agreement' };
          }
        }

        // Store signature (simplified - convert PNG data URL to binary if needed)
        // For now, store as text/JSON
        const signatureData = signaturePayload.startsWith('data:') 
          ? signaturePayload.split(',')[1] // Extract base64
          : signaturePayload;

        // Update session with signature
        await client.query(
          `UPDATE lane_sessions
           SET disclaimers_ack_json = $1,
               status = CASE 
                 WHEN payment_intent_id IS NOT NULL AND 
                      (SELECT status FROM payment_intents WHERE id = lane_sessions.payment_intent_id) = 'PAID'
                 THEN 'COMPLETED'
                 ELSE status
               END,
               updated_at = NOW()
           WHERE id = $2`,
          [JSON.stringify({ signature: signatureData, signedAt: new Date().toISOString() }), session.id]
        );

        // If payment is paid and signature is done, complete the check-in
        if (session.payment_intent_id) {
          const intentResult = await client.query<PaymentIntentRow>(
            `SELECT status FROM payment_intents WHERE id = $1`,
            [session.payment_intent_id]
          );
          if (intentResult.rows.length > 0 && intentResult.rows[0]!.status === 'PAID') {
            // Complete check-in: create visit and check-in block, transition room/locker to OCCUPIED
            // Use a default staff ID if not available (for public endpoint)
            const staffId = request.staff?.staffId || 'system';
            await completeCheckIn(client, session, staffId);
          }
        }

        return { success: true, sessionId: session.id };
      });

      return reply.send(result);
    } catch (error: unknown) {
      request.log.error(error, 'Failed to sign agreement');
      if (error && typeof error === 'object' && 'statusCode' in error) {
        return reply.status((error as { statusCode: number }).statusCode).send({
          error: (error as { message: string }).message || 'Failed to sign agreement',
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to sign agreement',
      });
    }
  });

  /**
   * POST /v1/checkin/lane/:laneId/customer-confirm
   * 
   * Customer confirms or declines cross-type assignment.
   */
  fastify.post('/v1/checkin/lane/:laneId/customer-confirm', async (
    request: FastifyRequest<{
      Params: { laneId: string };
      Body: { sessionId: string; confirmed: boolean };
    }>,
    reply: FastifyReply
  ) => {
    const { laneId } = request.params;
    const { sessionId, confirmed } = request.body;

    try {
      const result = await transaction(async (client) => {
        const sessionResult = await client.query<LaneSessionRow>(
          `SELECT * FROM lane_sessions WHERE id = $1 AND lane_id = $2`,
          [sessionId, laneId]
        );

        if (sessionResult.rows.length === 0) {
          throw { statusCode: 404, message: 'Session not found' };
        }

        const session = sessionResult.rows[0]!;

        if (confirmed) {
          // Customer confirmed - broadcast confirmation
          const confirmedPayload: CustomerConfirmedPayload = {
            sessionId: session.id,
            confirmedType: session.assigned_resource_type === 'room' ? getRoomTier(session.assigned_resource_id || '') : 'LOCKER',
            confirmedNumber: session.assigned_resource_id || '',
          };
          fastify.broadcaster.broadcastCustomerConfirmed(confirmedPayload, laneId);
        } else {
          // Customer declined - unassign resource and broadcast decline
          if (session.assigned_resource_id) {
            if (session.assigned_resource_type === 'room') {
              await client.query(
                `UPDATE rooms SET assigned_to = NULL, updated_at = NOW() WHERE id = $1`,
                [session.assigned_resource_id]
              );
            } else if (session.assigned_resource_type === 'locker') {
              await client.query(
                `UPDATE lockers SET assigned_to = NULL, updated_at = NOW() WHERE id = $1`,
                [session.assigned_resource_id]
              );
            }

            await client.query(
              `UPDATE lane_sessions SET assigned_resource_id = NULL, assigned_resource_type = NULL, updated_at = NOW() WHERE id = $1`,
              [session.id]
            );
          }

          const declinedPayload: CustomerDeclinedPayload = {
            sessionId: session.id,
            requestedType: session.desired_rental_type || '',
          };
          fastify.broadcaster.broadcastCustomerDeclined(declinedPayload, laneId);
        }

        return { success: true, confirmed };
      });

      return reply.send(result);
    } catch (error: unknown) {
      request.log.error(error, 'Failed to process customer confirmation');
      if (error && typeof error === 'object' && 'statusCode' in error) {
        return reply.status((error as { statusCode: number }).statusCode).send({
          error: (error as { message: string }).message || 'Failed to process confirmation',
        });
      }
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to process customer confirmation',
      });
    }
  });

  /**
   * Complete check-in: create visit, check-in block, and transition resources.
   */
  async function completeCheckIn(
    client: Parameters<Parameters<typeof transaction>[0]>[0],
    session: LaneSessionRow,
    staffId: string
  ): Promise<void> {
    if (!session.customer_id || !session.assigned_resource_id || !session.assigned_resource_type) {
      throw new Error('Cannot complete check-in without customer and resource assignment');
    }

    // Create visit
    const visitResult = await client.query<{ id: string }>(
      `INSERT INTO visits (customer_id, started_at)
       VALUES ($1, NOW())
       RETURNING id`,
      [session.customer_id]
    );

    const visitId = visitResult.rows[0]!.id;

    // Create check-in block (6 hours)
    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + 6 * 60 * 60 * 1000);

    const rentalType = (session.desired_rental_type || session.backup_rental_type || 'LOCKER') as string;

    const blockResult = await client.query<{ id: string }>(
      `INSERT INTO checkin_blocks 
       (visit_id, block_type, starts_at, ends_at, rental_type, room_id, locker_id, agreement_signed)
       VALUES ($1, 'INITIAL', $2, $3, $4, $5, $6, true)
       RETURNING id`,
      [
        visitId,
        startsAt,
        endsAt,
        rentalType,
        session.assigned_resource_type === 'room' ? session.assigned_resource_id : null,
        session.assigned_resource_type === 'locker' ? session.assigned_resource_id : null,
      ]
    );

    const blockId = blockResult.rows[0]!.id;

    // Transition room/locker to OCCUPIED status
    if (session.assigned_resource_type === 'room') {
      await client.query(
        `UPDATE rooms 
         SET status = 'OCCUPIED', last_status_change = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [session.assigned_resource_id]
      );
    } else if (session.assigned_resource_type === 'locker') {
      await client.query(
        `UPDATE lockers 
         SET status = 'OCCUPIED', updated_at = NOW()
         WHERE id = $1`,
        [session.assigned_resource_id]
      );
    }

    // Update session status
    await client.query(
      `UPDATE lane_sessions SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`,
      [session.id]
    );

    // Log audit (only if staffId is a valid UUID)
    if (staffId && staffId !== 'system' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(staffId)) {
      await client.query(
        `INSERT INTO audit_log 
         (staff_id, user_id, user_role, action, entity_type, entity_id, previous_value, new_value)
         VALUES ($1, $2, 'staff', 'CHECK_IN', 'visit', $3, $4, $5)`,
        [
          staffId,
          staffId,
          visitId,
          JSON.stringify({}),
          JSON.stringify({ visit_id: visitId, block_id: blockId, resource_type: session.assigned_resource_type }),
        ]
      );
    }
  }

  /**
   * GET /v1/checkin/lane-sessions
   * 
   * Get all active lane sessions for office dashboard.
   * Auth required.
   */
  fastify.get('/v1/checkin/lane-sessions', {
    preHandler: [requireAuth],
  }, async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      const result = await query<LaneSessionRow>(
        `SELECT 
          ls.*,
          s.name as staff_name,
          c.name as customer_name,
          c.membership_number,
          r.number as room_number,
          l.number as locker_number
         FROM lane_sessions ls
         LEFT JOIN staff s ON ls.staff_id = s.id
         LEFT JOIN customers c ON ls.customer_id = c.id
         LEFT JOIN rooms r ON ls.assigned_resource_id = r.id AND ls.desired_rental_type NOT IN ('LOCKER', 'GYM_LOCKER')
         LEFT JOIN lockers l ON ls.assigned_resource_id = l.id AND ls.desired_rental_type IN ('LOCKER', 'GYM_LOCKER')
         WHERE ls.status != 'COMPLETED' AND ls.status != 'CANCELLED'
         ORDER BY ls.created_at DESC`
      );

      const sessions = result.rows.map(session => ({
        id: session.id,
        laneId: session.lane_id,
        status: session.status,
        staffName: (session as any).staff_name,
        customerName: session.customer_display_name || (session as any).customer_name,
        membershipNumber: session.membership_number,
        desiredRentalType: session.desired_rental_type,
        waitlistDesiredType: session.waitlist_desired_type,
        backupRentalType: session.backup_rental_type,
        assignedResource: session.assigned_resource_id ? {
          id: session.assigned_resource_id,
          number: (session as any).room_number || (session as any).locker_number,
          type: session.desired_rental_type,
        } : null,
        priceQuote: session.price_quote_json,
        paymentIntentId: session.payment_intent_id,
        createdAt: session.created_at,
        updatedAt: session.updated_at,
      }));

      return reply.send({ sessions });
    } catch (error: unknown) {
      request.log.error(error, 'Failed to fetch lane sessions');
      return reply.status(500).send({
        error: 'Internal Server Error',
        message: 'Failed to fetch lane sessions',
      });
    }
  });
}

