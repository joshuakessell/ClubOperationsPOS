import type { FastifyInstance } from 'fastify';
import { z } from 'zod';

import { transaction } from '../../db/index.js';
import { requireAuth } from '../../auth/middleware.js';
import { IdScanPayloadSchema, type IdScanPayload } from '@club-ops/shared';

import type { CustomerRow, LaneSessionRow } from '../types.js';
import {
  buildFullSessionUpdatedPayload,
  computeSha256Hex,
  getAllowedRentals,
  normalizeScanText,
  toDate,
} from '../service.js';

export async function registerCheckinScanIdRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/checkin/lane/:laneId/scan-id
   *
   * Scan ID (PDF417 barcode) to identify customer and start/update lane session.
   * Server-authoritative: upserts customer based on id_scan_hash, updates lane session.
   *
   * Input: IdScanPayload (raw barcode + parsed fields)
   * Output: lane session state with customer info
   */
  fastify.post<{
    Params: { laneId: string };
    Body: IdScanPayload;
  }>(
    '/v1/checkin/lane/:laneId/scan-id',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      const staffId = request.staff.staffId;

      const { laneId } = request.params;
      let body: IdScanPayload;

      try {
        body = IdScanPayloadSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      try {
        const result = await transaction(async (client) => {
          // Compute id_scan_hash from raw barcode (SHA-256 of normalized string)
          let idScanHash: string | null = null;
          let idScanValue: string | null = null;
          if (body.raw) {
            idScanValue = normalizeScanText(body.raw);
            idScanHash = computeSha256Hex(idScanValue);
          } else if (body.idNumber && (body.issuer || body.jurisdiction)) {
            // Fallback: derive hash from issuer + idNumber
            const issuer = body.issuer || body.jurisdiction || '';
            const combined = `${issuer}:${body.idNumber}`;
            idScanHash = computeSha256Hex(combined);
          }

          // Determine customer name from parsed fields
          let customerName = body.fullName || '';
          if (!customerName && body.firstName && body.lastName) {
            customerName = `${body.firstName} ${body.lastName}`.trim();
          }
          if (!customerName && body.idNumber) {
            customerName = `Customer ${body.idNumber}`; // Fallback
          }
          if (!customerName) {
            throw { statusCode: 400, message: 'Unable to determine customer name from ID scan' };
          }

          // Parse DOB if provided
          let dob: Date | null = null;
          if (body.dob) {
            const parsedDob = new Date(body.dob);
            if (!isNaN(parsedDob.getTime())) {
              dob = parsedDob;
            }
          }

          // Upsert customer based on id_scan_hash
          let customerId: string | null = null;

          if (idScanHash) {
            // Look for existing customer by hash
            const existingCustomer = await client.query<{
              id: string;
              name: string;
              dob: Date | null;
            }>(
              `SELECT id, name, dob FROM customers WHERE id_scan_hash = $1 OR id_scan_value = $2 LIMIT 1`,
              [idScanHash, idScanValue]
            );

            if (existingCustomer.rows.length > 0) {
              customerId = existingCustomer.rows[0]!.id;
              // Update name/dob if missing in existing record
              const existing = existingCustomer.rows[0]!;
              if ((!existing.name || existing.name === 'Customer') && customerName) {
                await client.query(`UPDATE customers SET name = $1, updated_at = NOW() WHERE id = $2`, [
                  customerName,
                  customerId,
                ]);
              }
              if (!existing.dob && dob) {
                await client.query(`UPDATE customers SET dob = $1, updated_at = NOW() WHERE id = $2`, [
                  dob,
                  customerId,
                ]);
              }

              // Ensure scan identifiers are persisted for future matches.
              if (idScanValue) {
                await client.query(
                  `UPDATE customers
                 SET id_scan_hash = COALESCE(id_scan_hash, $1),
                     id_scan_value = COALESCE(id_scan_value, $2),
                     updated_at = NOW()
                 WHERE id = $3`,
                  [idScanHash, idScanValue, customerId]
                );
              }
            } else {
              // Create new customer
              const newCustomer = await client.query<{ id: string }>(
                `INSERT INTO customers (name, dob, id_scan_hash, id_scan_value, created_at, updated_at)
               VALUES ($1, $2, $3, $4, NOW(), NOW())
               RETURNING id`,
                [customerName, dob, idScanHash, idScanValue]
              );
              customerId = newCustomer.rows[0]!.id;
            }
          } else {
            // No hash available - create new customer (manual entry fallback)
            // This should be rare but allowed for manual entry
            const newCustomer = await client.query<{ id: string }>(
              `INSERT INTO customers (name, dob, id_scan_value, created_at, updated_at)
             VALUES ($1, $2, $3, NOW(), NOW())
             RETURNING id`,
              [customerName, dob, idScanValue]
            );
            customerId = newCustomer.rows[0]!.id;
          }

          // Check if customer is banned
          const customerCheck = await client.query<{ banned_until: unknown }>(
            `SELECT banned_until FROM customers WHERE id = $1`,
            [customerId]
          );
          const bannedUntil = toDate(customerCheck.rows[0]?.banned_until);
          if (bannedUntil && bannedUntil > new Date()) {
            throw {
              statusCode: 403,
              message: `Customer is banned until ${bannedUntil.toISOString()}`,
            };
          }

          // If customer already has an active (not-ended) visit, block a new lane check-in session.
          // Renewal/extension must be started explicitly via /start with visitId.
          if (customerId) {
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

          const computedMode: 'INITIAL' | 'RENEWAL' = 'INITIAL';

          // Determine allowed rentals (no membership yet, so just basic options)
          const allowedRentals = getAllowedRentals(null);

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
             SET customer_id = $1,
                 customer_display_name = $2,
                 status = 'ACTIVE',
                 staff_id = $3,
                 checkin_mode = $4,
                 updated_at = NOW()
             WHERE id = $5
             RETURNING *`,
              [customerId, customerName, staffId, computedMode, existingSession.rows[0]!.id]
            );
            session = updateResult.rows[0]!;
          } else {
            // Create new session
            const newSessionResult = await client.query<LaneSessionRow>(
              `INSERT INTO lane_sessions 
             (lane_id, status, staff_id, customer_id, customer_display_name, checkin_mode)
             VALUES ($1, 'ACTIVE', $2, $3, $4, $5)
             RETURNING *`,
              [laneId, staffId, customerId, customerName, computedMode]
            );
            session = newSessionResult.rows[0]!;
          }

          // Get customer info if customer exists
          let pastDueBalance = 0;
          let pastDueBlocked = false;
          let customerNotes: string | undefined;
          let customerPrimaryLanguage: 'EN' | 'ES' | undefined;
          let customerDobMonthDay: string | undefined;
          // last visit is derived from visits + checkin_blocks (broadcast uses DB-join helper)

          if (session.customer_id) {
            const customerInfo = await client.query<CustomerRow>(
              `SELECT past_due_balance, notes, primary_language, dob FROM customers WHERE id = $1`,
              [session.customer_id]
            );
            if (customerInfo.rows.length > 0) {
              const customer = customerInfo.rows[0]!;
              pastDueBalance = parseFloat(String(customer.past_due_balance || 0));
              pastDueBlocked = pastDueBalance > 0 && !(session.past_due_bypassed || false);
              customerNotes = customer.notes || undefined;
              customerPrimaryLanguage = customer.primary_language as 'EN' | 'ES' | undefined;

              if (customer.dob) {
                customerDobMonthDay = `${String(customer.dob.getMonth() + 1).padStart(2, '0')}/${String(customer.dob.getDate()).padStart(2, '0')}`;
              }
            }
          }

          return {
            sessionId: session.id,
            customerId: session.customer_id,
            customerName: session.customer_display_name,
            allowedRentals,
            mode: computedMode,
            pastDueBalance,
            pastDueBlocked,
            customerNotes,
            customerPrimaryLanguage,
            customerDobMonthDay,
          };
        });

        // Broadcast full session update (stable payload)
        const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, result.sessionId));
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return reply.send(result);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to scan ID');
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const statusCode = (error as { statusCode: number }).statusCode;
          const message = (error as { message?: string }).message;
          const code = (error as { code?: unknown }).code;
          const activeCheckin = (error as { activeCheckin?: unknown }).activeCheckin;
          return reply.status(statusCode).send({
            error: message ?? 'Failed to scan ID',
            code: typeof code === 'string' ? code : undefined,
            activeCheckin: activeCheckin && typeof activeCheckin === 'object' ? activeCheckin : undefined,
          });
        }
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}

