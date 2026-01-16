import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { query, serializableTransaction, transaction } from '../db/index.js';
import { requireAuth } from '../auth/middleware.js';
import type { Broadcaster } from '../websocket/broadcaster.js';
import type {
  CheckoutClaimedPayload,
  CheckoutCompletedPayload,
  CheckoutRequestedPayload,
  CheckoutUpdatedPayload,
} from '@club-ops/shared';
import { RoomStatus } from '@club-ops/shared';
import { resolveCheckoutKey } from '../checkout/resolveKey.js';
import {
  claimCheckoutRequest,
  completeCheckout,
  confirmItems,
  createCheckoutRequest,
  markFeePaid,
} from '../checkout/requests.js';
import { listManualCandidates, manualComplete, manualResolve } from '../checkout/manualCheckout.js';
import { calculateLateFee, computeLateMinutes } from '../checkout/lateFees.js';

declare module 'fastify' {
  interface FastifyInstance {
    broadcaster: Broadcaster;
  }
}

const ResolveKeySchema = z.object({
  token: z.string().min(1),
  kioskDeviceId: z.string().min(1),
});

type ResolveKeyInput = z.infer<typeof ResolveKeySchema>;

const CreateCheckoutRequestSchema = z.object({
  occupancyId: z.string().uuid(), // checkin_block.id
  kioskDeviceId: z.string().min(1),
  checklist: z.object({
    key: z.boolean().optional(),
    towel: z.boolean().optional(),
    sheets: z.boolean().optional(),
    remote: z.boolean().optional(),
  }),
});

type CreateCheckoutRequestInput = z.infer<typeof CreateCheckoutRequestSchema>;

const MarkFeePaidSchema = z.object({
  note: z.string().optional(),
});

type MarkFeePaidInput = z.infer<typeof MarkFeePaidSchema>;

/**
 * Checkout routes for customer-operated checkout kiosk and employee verification.
 */
// eslint-disable-next-line @typescript-eslint/require-await
export async function checkoutRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * GET /v1/checkout/manual-candidates
   *
   * Staff-only endpoint for manual checkout candidates:
   * - overdue (past scheduled checkout time) OR
   * - within 60 minutes of scheduled checkout time
   */
  fastify.get(
    '/v1/checkout/manual-candidates',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) return reply.status(401).send({ error: 'Unauthorized' });

      try {
        const candidates = await listManualCandidates({ query });
        return reply.send({ candidates });
      } catch (error) {
        fastify.log.error(error, 'Failed to list manual checkout candidates');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  const ManualResolveSchema = z
    .object({
      number: z.string().min(1).optional(),
      occupancyId: z.string().uuid().optional(),
    })
    .refine((v) => Boolean(v.number || v.occupancyId), {
      message: 'Either number or occupancyId is required',
    });

  /**
   * POST /v1/checkout/manual-resolve
   *
   * Staff-only endpoint to resolve a room/locker number or occupancyId
   * into checkout timing + computed late fee/ban.
   */
  fastify.post<{ Body: z.infer<typeof ManualResolveSchema> }>(
    '/v1/checkout/manual-resolve',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) return reply.status(401).send({ error: 'Unauthorized' });

      let body: z.infer<typeof ManualResolveSchema>;
      try {
        body = ManualResolveSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      try {
        const resolved = await manualResolve(
          { occupancyId: body.occupancyId, number: body.number },
          { query }
        );
        return reply.send(resolved);
      } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const err = error as { statusCode: number; message: string };
          return reply.status(err.statusCode).send({ error: err.message });
        }
        fastify.log.error(error, 'Failed to resolve manual checkout');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  const ManualCompleteSchema = z.object({
    occupancyId: z.string().uuid(),
  });

  /**
   * POST /v1/checkout/manual-complete
   *
   * Staff-only endpoint to complete checkout manually (no checkout_request_id).
   * Must be idempotent using a serializable transaction + visit row lock.
   */
  fastify.post<{ Body: z.infer<typeof ManualCompleteSchema> }>(
    '/v1/checkout/manual-complete',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) return reply.status(401).send({ error: 'Unauthorized' });
      const staffId = request.staff.staffId;

      let body: z.infer<typeof ManualCompleteSchema>;
      try {
        body = ManualCompleteSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      try {
        const result = await manualComplete({ occupancyId: body.occupancyId, staffId }, { serializableTransaction });

        const row = result.row;
        const alreadyCheckedOut = result.alreadyCheckedOut === true;
        const resourceType = row.locker_id ? 'LOCKER' : 'ROOM';
        const number = resourceType === 'LOCKER' ? row.locker_number : row.room_number;
        const scheduledCheckoutAt =
          row.scheduled_checkout_at instanceof Date
            ? row.scheduled_checkout_at
            : new Date(row.scheduled_checkout_at);
        if (!number) return reply.status(500).send({ error: 'Resource not found for occupancy' });

        if (fastify.broadcaster && !alreadyCheckedOut) {
          const { broadcastInventoryUpdate } = await import('./sessions.js');
          await broadcastInventoryUpdate(fastify.broadcaster);
          if (row.room_id) {
            fastify.broadcaster.broadcastRoomStatusChanged({
              roomId: row.room_id,
              previousStatus: RoomStatus.CLEAN,
              newStatus: RoomStatus.DIRTY,
              changedBy: staffId,
              override: false,
            });
          }
        }

        if (fastify.broadcaster && !alreadyCheckedOut && result.cancelledWaitlistIds.length > 0) {
          for (const waitlistId of result.cancelledWaitlistIds) {
            fastify.broadcaster.broadcast({
              type: 'WAITLIST_UPDATED',
              payload: { waitlistId, status: 'CANCELLED', visitId: result.visitId },
              timestamp: new Date().toISOString(),
            });
          }
        }

        const now = new Date();
        const lateMinutes = alreadyCheckedOut
          ? computeLateMinutes(now, scheduledCheckoutAt)
          : result.lateMinutes;
        const computed = calculateLateFee(lateMinutes);
        const fee = alreadyCheckedOut ? computed.feeAmount : result.feeAmount;
        const banApplied = alreadyCheckedOut ? computed.banApplied : result.banApplied;

        return reply.send({
          occupancyId: row.occupancy_id,
          resourceType,
          number,
          customerName: row.customer_name,
          checkinAt: row.checkin_at,
          scheduledCheckoutAt,
          lateMinutes,
          fee,
          banApplied,
          alreadyCheckedOut,
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const err = error as { statusCode: number; message: string };
          return reply.status(err.statusCode).send({ error: err.message });
        }
        fastify.log.error(error, 'Failed to complete manual checkout');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /v1/checkout/resolve-key - Resolve a key tag to checkout information
   *
   * Public endpoint for checkout kiosk to resolve a scanned key QR code.
   * Returns customer info, scheduled checkout time, and computed late fees.
   */
  fastify.post<{ Body: ResolveKeyInput }>('/v1/checkout/resolve-key', async (request, reply) => {
    let body: ResolveKeyInput;

    try {
      body = ResolveKeySchema.parse(request.body);
    } catch (error) {
      return reply.status(400).send({
        error: 'Validation failed',
        details: error instanceof z.ZodError ? error.errors : 'Invalid input',
      });
    }

    try {
      const result = await resolveCheckoutKey(body, { query });
      return reply.send(result);
    } catch (error) {
      if (error && typeof error === 'object' && 'statusCode' in error) {
        const err = error as { statusCode: number; message: string };
        return reply.status(err.statusCode).send({ error: err.message });
      }
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      fastify.log.error(
        { error: errorMessage, stack: errorStack },
        'Failed to resolve checkout key'
      );
      return reply.status(500).send({
        error: 'Internal server error',
        details: process.env.NODE_ENV === 'test' ? errorMessage : undefined,
      });
    }
  });

  /**
   * POST /v1/checkout/request - Create a checkout request
   *
   * Public endpoint for checkout kiosk to submit a checkout request.
   * Triggers CHECKOUT_REQUESTED WebSocket event.
   */
  fastify.post<{ Body: CreateCheckoutRequestInput }>(
    '/v1/checkout/request',
    async (request, reply) => {
      let body: CreateCheckoutRequestInput;

      try {
        body = CreateCheckoutRequestSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      try {
        const created = await createCheckoutRequest(
          { occupancyId: body.occupancyId, kioskDeviceId: body.kioskDeviceId, checklist: body.checklist as any },
          { query, serializableTransaction }
        );

        if (fastify.broadcaster) {
          const payload: CheckoutRequestedPayload = created.websocket.payload;
          fastify.broadcaster.broadcast({
            type: 'CHECKOUT_REQUESTED',
            payload,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.status(201).send({ requestId: created.requestId });
      } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const err = error as { statusCode: number; message: string };
          return reply.status(err.statusCode).send({ error: err.message });
        }
        fastify.log.error(error, 'Failed to create checkout request');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /v1/checkout/:requestId/claim - Claim a checkout request
   *
   * Employee endpoint to claim ownership of a checkout request.
   * Only employees not "mid-checkin" can claim.
   * Sets a 2-minute TTL lock.
   */
  fastify.post<{ Params: { requestId: string } }>(
    '/v1/checkout/:requestId/claim',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      const staffId = request.staff.staffId;

      try {
        const result = await claimCheckoutRequest(
          { requestId: request.params.requestId, staffId },
          { serializableTransaction }
        );

        if (fastify.broadcaster) {
          const payload: CheckoutClaimedPayload = result.websocket;

          fastify.broadcaster.broadcast({
            type: 'CHECKOUT_CLAIMED',
            payload,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.send({
          requestId: result.requestId,
          claimedBy: result.claimedBy,
          claimedAt: result.claimedAt,
          claimExpiresAt: result.claimExpiresAt,
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const err = error as { statusCode: number; message: string };
          return reply.status(err.statusCode).send({ error: err.message });
        }
        fastify.log.error(error, 'Failed to claim checkout request');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /v1/checkout/:requestId/mark-fee-paid - Mark late fee as paid
   *
   * Employee endpoint to record manual payment confirmation.
   */
  fastify.post<{ Params: { requestId: string }; Body: MarkFeePaidInput }>(
    '/v1/checkout/:requestId/mark-fee-paid',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      const staffId = request.staff.staffId;

      let body: MarkFeePaidInput;
      try {
        body = MarkFeePaidSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }
      void body;

      try {
        const result = await markFeePaid({ requestId: request.params.requestId, staffId }, { transaction });
        if (fastify.broadcaster) {
          const payload: CheckoutUpdatedPayload = result.websocket;

          fastify.broadcaster.broadcast({
            type: 'CHECKOUT_UPDATED',
            payload,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.send({
          requestId: result.requestId,
          feePaid: result.feePaid,
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const err = error as { statusCode: number; message: string };
          return reply.status(err.statusCode).send({ error: err.message });
        }
        fastify.log.error(error, 'Failed to mark fee as paid');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /v1/checkout/:requestId/confirm-items - Confirm items returned
   *
   * Employee endpoint to mark items as verified.
   */
  fastify.post<{ Params: { requestId: string } }>(
    '/v1/checkout/:requestId/confirm-items',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      const staffId = request.staff.staffId;

      try {
        const result = await confirmItems({ requestId: request.params.requestId, staffId }, { transaction });
        if (fastify.broadcaster) {
          const payload: CheckoutUpdatedPayload = result.websocket;

          fastify.broadcaster.broadcast({
            type: 'CHECKOUT_UPDATED',
            payload,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.send({
          requestId: result.requestId,
          itemsConfirmed: result.itemsConfirmed,
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const err = error as { statusCode: number; message: string };
          return reply.status(err.statusCode).send({ error: err.message });
        }
        fastify.log.error(error, 'Failed to confirm items');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );

  /**
   * POST /v1/checkout/:requestId/complete - Complete checkout
   *
   * Employee endpoint to finalize checkout.
   * Updates room/locker status, logs events, applies bans, and emits WebSocket updates.
   */
  fastify.post<{ Params: { requestId: string } }>(
    '/v1/checkout/:requestId/complete',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
      if (!request.staff) {
        return reply.status(401).send({ error: 'Unauthorized' });
      }
      const staffId = request.staff.staffId;

      try {
        const result = await completeCheckout(
          { requestId: request.params.requestId, staffId },
          { serializableTransaction }
        );

        // 9. Broadcast inventory updates
        if (fastify.broadcaster) {
          // Import inventory broadcast function
          const { broadcastInventoryUpdate } = await import('./sessions.js');
          await broadcastInventoryUpdate(fastify.broadcaster);

          // Broadcast room status changes if applicable
          if (result.roomId) {
            fastify.broadcaster.broadcastRoomStatusChanged({
              roomId: result.roomId,
              previousStatus: RoomStatus.CLEAN,
              newStatus: RoomStatus.DIRTY,
              changedBy: staffId,
              override: false,
            });
          }
        }

        // 9b. Broadcast WAITLIST_UPDATED for system-cancelled waitlist entries (after commit)
        if (fastify.broadcaster && result.cancelledWaitlistIds.length > 0) {
          for (const waitlistId of result.cancelledWaitlistIds) {
            fastify.broadcaster.broadcast({
              type: 'WAITLIST_UPDATED',
              payload: {
                waitlistId,
                status: 'CANCELLED',
                visitId: result.visitId,
              },
              timestamp: new Date().toISOString(),
            });
          }
        }

        // 10. Broadcast CHECKOUT_COMPLETED event (for kiosk)
        if (fastify.broadcaster) {
          const payload: CheckoutCompletedPayload = {
            requestId: result.requestId,
            kioskDeviceId: result.kioskDeviceId,
            success: true,
          };

          fastify.broadcaster.broadcast({
            type: 'CHECKOUT_COMPLETED',
            payload,
            timestamp: new Date().toISOString(),
          });
        }

        return reply.send({
          requestId: result.requestId,
          completed: true,
        });
      } catch (error) {
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const err = error as { statusCode: number; message: string };
          return reply.status(err.statusCode).send({ error: err.message });
        }
        fastify.log.error(error, 'Failed to complete checkout');
        return reply.status(500).send({ error: 'Internal server error' });
      }
    }
  );
}
