import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { transaction } from '../../db/index.js';
import { requireAuth } from '../../auth/middleware.js';
import type { CustomerRow, LaneSessionRow } from '../types.js';
import {
  buildFullSessionUpdatedPayload,
  getAllowedRentals,
  parseMembershipNumber,
  toDate,
} from '../service.js';

export async function registerCheckinStartRoutes(fastify: FastifyInstance): Promise<void> {
  const StartLaneSessionBodySchema = z
    .object({
      customerId: z.string().uuid().optional(),
      idScanValue: z.string().min(1).optional(),
      membershipScanValue: z.string().optional(),
      visitId: z.string().uuid().optional(),
    })
    .refine((val) => !!val.customerId || !!val.idScanValue, {
      message: 'customerId or idScanValue is required',
    });

  /**
   * POST /v1/checkin/lane/:laneId/start
   *
   * Start a lane session with customer identification.
   * Input: { idScanValue, membershipScanValue? }
   * Output: laneSession + customer display fields
   */
  fastify.post<{
    Params: { laneId: string };
    Body: {
      customerId?: string;
      idScanValue?: string;
      membershipScanValue?: string;
      visitId?: string;
    };
  }>(
    '/v1/checkin/lane/:laneId/start',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      const staffId = request.staff.staffId;

      const { laneId } = request.params;
      let body: z.infer<typeof StartLaneSessionBodySchema>;
      try {
        body = StartLaneSessionBodySchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      const { customerId: requestedCustomerId, idScanValue, membershipScanValue, visitId } = body;

      try {
        const result = await transaction(async (client) => {
          // Parse membership number if provided
          let membershipNumber = membershipScanValue ? parseMembershipNumber(membershipScanValue) : null;

          // Look up or create customer (customers is canonical identity; members is deprecated)
          let customerId: string | null = null;
          let customerName = 'Customer';

          if (requestedCustomerId) {
            const customerResult = await client.query<CustomerRow>(
              `SELECT id, name, dob, membership_number, membership_card_type, membership_valid_until, banned_until
             FROM customers
             WHERE id = $1
             LIMIT 1`,
              [requestedCustomerId]
            );
            if (customerResult.rows.length === 0) {
              throw { statusCode: 404, message: 'Customer not found' };
            }
            const customer = customerResult.rows[0]!;
            customerId = customer.id;
            customerName = customer.name;
            membershipNumber = customer.membership_number || null;

            const bannedUntil = toDate(customer.banned_until);
            if (bannedUntil && new Date() < bannedUntil) {
              throw {
                statusCode: 403,
                message: 'Customer is banned until ' + bannedUntil.toISOString(),
              };
            }
          } else {
            // Try to find existing customer by membership number
            if (membershipNumber) {
              const customerResult = await client.query<CustomerRow>(
                `SELECT id, name, dob, membership_number, membership_card_type, membership_valid_until, banned_until
               FROM customers
               WHERE membership_number = $1
               LIMIT 1`,
                [membershipNumber]
              );

              if (customerResult.rows.length > 0) {
                const customer = customerResult.rows[0]!;
                customerId = customer.id;
                customerName = customer.name;

                // Check if banned
                const bannedUntil = toDate(customer.banned_until);
                if (bannedUntil && new Date() < bannedUntil) {
                  throw {
                    statusCode: 403,
                    message: 'Customer is banned until ' + bannedUntil.toISOString(),
                  };
                }
              }
            }

            // If we couldn't resolve an existing customer, create one for the session.
            // Demo behavior: use a placeholder name derived from the scanned ID value.
            if (!customerId) {
              const newCustomer = await client.query<{ id: string }>(
                `INSERT INTO customers (name, created_at, updated_at)
               VALUES ($1, NOW(), NOW())
               RETURNING id`,
                [idScanValue || 'Customer']
              );
              customerId = newCustomer.rows[0]!.id;
              customerName = idScanValue || 'Customer';
            }
          }

          // Determine mode (explicit renewal only). If an active visit exists and no explicit visitId
          // is provided, treat as \"already checked in\" (lookup-only) and block a new check-in flow.
          let computedMode: 'INITIAL' | 'RENEWAL' = 'INITIAL';
          let visitIdForSession: string | null = null;
          let blockEndsAtDate: Date | null = null;
          let currentTotalHours = 0;
          let activeAssignedResourceType: 'room' | 'locker' | null = null;
          let activeAssignedResourceNumber: string | null = null;
          let activeRentalType: string | null = null;

          const resolveVisitBlocks = async (activeVisitId: string) => {
            const blocksResult = await client.query<{
              ends_at: Date;
              starts_at: Date;
            }>(
              `SELECT starts_at, ends_at FROM checkin_blocks 
             WHERE visit_id = $1 ORDER BY ends_at DESC`,
              [activeVisitId]
            );
            if (blocksResult.rows.length > 0) {
              blockEndsAtDate = blocksResult.rows[0]!.ends_at;
              for (const block of blocksResult.rows) {
                const hours = (block.ends_at.getTime() - block.starts_at.getTime()) / (1000 * 60 * 60);
                currentTotalHours += hours;
              }
            }
          };

          const resolveActiveAssignment = async (activeVisitId: string) => {
            const activeBlock = await client.query<{
              rental_type: string;
              room_number: string | null;
              locker_number: string | null;
            }>(
              `SELECT cb.rental_type, r.number as room_number, l.number as locker_number
               FROM checkin_blocks cb
               LEFT JOIN rooms r ON cb.room_id = r.id
               LEFT JOIN lockers l ON cb.locker_id = l.id
               WHERE cb.visit_id = $1
               ORDER BY cb.ends_at DESC
               LIMIT 1`,
              [activeVisitId]
            );
            const row = activeBlock.rows[0];
            if (!row) return;
            activeRentalType = row.rental_type;
            if (row.room_number) {
              activeAssignedResourceType = 'room';
              activeAssignedResourceNumber = row.room_number;
            } else if (row.locker_number) {
              activeAssignedResourceType = 'locker';
              activeAssignedResourceNumber = row.locker_number;
            }
          };

          if (visitId) {
            // Explicit visit selection forces renewal
            const visitResult = await client.query<{
              id: string;
              customer_id: string;
              started_at: Date;
              ended_at: Date | null;
            }>(`SELECT id, customer_id, started_at, ended_at FROM visits WHERE id = $1`, [visitId]);
            if (visitResult.rows.length === 0) {
              throw { statusCode: 404, message: 'Visit not found' };
            }
            const visit = visitResult.rows[0]!;
            if (customerId && visit.customer_id !== customerId) {
              throw { statusCode: 403, message: 'Visit does not belong to this customer' };
            }
            visitIdForSession = visit.id;
            computedMode = 'RENEWAL';
            await resolveVisitBlocks(visit.id);
            await resolveActiveAssignment(visit.id);
          } else if (customerId) {
            const activeVisit = await client.query<{ id: string }>(
              `SELECT id FROM visits WHERE customer_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1`,
              [customerId]
            );
            if (activeVisit.rows.length > 0) {
              const activeVisitId = activeVisit.rows[0]!.id;

              const activeBlock = await client.query<{
                starts_at: Date;
                ends_at: Date;
                rental_type: string;
                room_number: string | null;
                locker_number: string | null;
              }>(
                `SELECT cb.starts_at, cb.ends_at, cb.rental_type, r.number as room_number, l.number as locker_number
                 FROM checkin_blocks cb
                 LEFT JOIN rooms r ON cb.room_id = r.id
                 LEFT JOIN lockers l ON cb.locker_id = l.id
                 WHERE cb.visit_id = $1
                 ORDER BY cb.ends_at DESC
                 LIMIT 1`,
                [activeVisitId]
              );

              const block = activeBlock.rows[0];
              const assignedResourceType: 'room' | 'locker' | null = block?.room_number
                ? 'room'
                : block?.locker_number
                  ? 'locker'
                  : null;
              const assignedResourceNumber: string | null = block?.room_number ?? block?.locker_number ?? null;

              const waitlistResult = await client.query<{
                id: string;
                desired_tier: string;
                backup_tier: string;
                status: string;
              }>(
                `SELECT id, desired_tier, backup_tier, status
                 FROM waitlist
                 WHERE visit_id = $1 AND status IN ('ACTIVE', 'OFFERED')
                 ORDER BY created_at DESC
                 LIMIT 1`,
                [activeVisitId]
              );
              const wl = waitlistResult.rows[0];

              throw {
                statusCode: 409,
                code: 'ALREADY_CHECKED_IN',
                message: 'Customer is currently checked in',
                activeCheckin: {
                  visitId: activeVisitId,
                  rentalType: block?.rental_type ?? null,
                  assignedResourceType,
                  assignedResourceNumber,
                  checkinAt: block?.starts_at ? block.starts_at.toISOString() : null,
                  checkoutAt: block?.ends_at ? block.ends_at.toISOString() : null,
                  overdue: block?.ends_at ? block.ends_at.getTime() < Date.now() : null,
                  waitlist: wl
                    ? {
                        id: wl.id,
                        desiredTier: wl.desired_tier,
                        backupTier: wl.backup_tier,
                        status: wl.status,
                      }
                    : null,
                },
              };
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
                 checkin_mode = $5,
                 updated_at = NOW()
             WHERE id = $6
             RETURNING *`,
              [customerName, membershipNumber, customerId, staffId, computedMode, existingSession.rows[0]!.id]
            );
            session = updateResult.rows[0]!;
          } else {
            // Create new session
            const newSessionResult = await client.query<LaneSessionRow>(
              `INSERT INTO lane_sessions 
             (lane_id, status, staff_id, customer_id, customer_display_name, membership_number, checkin_mode)
             VALUES ($1, 'ACTIVE', $2, $3, $4, $5, $6)
             RETURNING *`,
              [laneId, staffId, customerId, customerName, membershipNumber, computedMode]
            );
            session = newSessionResult.rows[0]!;
          }

          // Determine allowed rentals
          const allowedRentals = getAllowedRentals(membershipNumber);

          // Get customer past-due balance if customer exists
          let pastDueBalance = 0;
          let pastDueBlocked = false;
          if (session.customer_id) {
            const customerInfo = await client.query<CustomerRow>(
              `SELECT past_due_balance FROM customers WHERE id = $1`,
              [session.customer_id]
            );
            if (customerInfo.rows.length > 0) {
              pastDueBalance = parseFloat(String(customerInfo.rows[0]!.past_due_balance || 0));
              pastDueBlocked = pastDueBalance > 0 && !(session.past_due_bypassed || false);
            }
          }

          return {
            sessionId: session.id,
            customerName: session.customer_display_name,
            membershipNumber: session.membership_number,
            allowedRentals,
            mode: computedMode,
            blockEndsAt: toDate(blockEndsAtDate)?.toISOString(),
            visitId: visitIdForSession || undefined,
            currentTotalHours: computedMode === 'RENEWAL' ? currentTotalHours : undefined,
            pastDueBalance,
            pastDueBlocked,
            activeAssignedResourceType: activeAssignedResourceType || undefined,
            activeAssignedResourceNumber: activeAssignedResourceNumber || undefined,
            activeRentalType: activeRentalType || undefined,
          };
        });

        // Broadcast full session update (stable payload)
        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, result.sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return reply.send(result);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to start lane session');
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as { statusCode: number }).statusCode;
          const message = (error as { message?: string }).message;
          const code = (error as { code?: unknown }).code;
          const activeCheckin = (error as { activeCheckin?: unknown }).activeCheckin;
          return reply.status(statusCode).send({
            error: message ?? 'Failed to start session',
            code: typeof code === 'string' ? code : undefined,
            activeCheckin: activeCheckin && typeof activeCheckin === 'object' ? activeCheckin : undefined,
          });
        }
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to start lane session',
        });
      }
    }
  );
}

