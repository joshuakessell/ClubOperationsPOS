import type { FastifyInstance } from 'fastify';

import { transaction } from '../../db/index.js';
import { optionalAuth, requireAuth } from '../../auth/middleware.js';
import type {
  SelectionAcknowledgedPayload,
  SelectionLockedPayload,
  SelectionProposedPayload,
} from '@club-ops/shared';

import type { LaneSessionRow } from '../types.js';
import {
  buildFullSessionUpdatedPayload,
  checkPastDueBlocked,
  computeWaitlistInfo,
  getHttpError,
} from '../service.js';

export async function registerCheckinSelectionRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/checkin/lane/:laneId/select-rental
   *
   * Customer selects rental type (with optional waitlist).
   * Input: { rentalType, waitlistDesiredType?, backupRentalType? }
   */
  fastify.post<{
    Params: { laneId: string };
    Body: {
      rentalType: string;
      waitlistDesiredType?: string;
      backupRentalType?: string;
    };
  }>(
    '/v1/checkin/lane/:laneId/select-rental',
    {
      preHandler: [requireAuth],
    },
    async (request, reply) => {
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

          return {
            sessionId: updateResult.rows[0]!.id,
            desiredRentalType: rentalType,
            waitlistDesiredType: waitlistDesiredType || null,
            backupRentalType: backupRentalType || null,
          };
        });

        // Broadcast full session update (stable payload)
        const { payload } = await transaction((client) =>
          buildFullSessionUpdatedPayload(client, result.sessionId)
        );
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return reply.send(result);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to select rental');
        const httpErr = getHttpError(error);
        if (httpErr) {
          return reply.status(httpErr.statusCode).send({
            error: httpErr.message ?? 'Failed to select rental',
          });
        }
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to select rental',
        });
      }
    }
  );

  /**
   * POST /v1/checkin/lane/:laneId/propose-selection
   *
   * Propose a rental type selection (customer or employee can propose).
   * Does not lock the selection; requires confirmation.
   * Public endpoint (customer kiosk can call without auth).
   */
  fastify.post<{
    Params: { laneId: string };
    Body: {
      rentalType: string;
      proposedBy: 'CUSTOMER' | 'EMPLOYEE';
      waitlistDesiredType?: string;
      backupRentalType?: string;
    };
  }>(
    '/v1/checkin/lane/:laneId/propose-selection',
    {
      preHandler: [optionalAuth],
    },
    async (request, reply) => {
      const { laneId } = request.params;
      const { rentalType, proposedBy, waitlistDesiredType, backupRentalType } = request.body;

      // Validate proposedBy
      if (proposedBy !== 'CUSTOMER' && proposedBy !== 'EMPLOYEE') {
        return reply.status(400).send({ error: 'proposedBy must be CUSTOMER or EMPLOYEE' });
      }

      // If employee, require auth
      if (proposedBy === 'EMPLOYEE' && !request.staff) {
        return reply
          .status(401)
          .send({ error: 'Unauthorized - employee proposals require authentication' });
      }

      try {
        const result = await transaction(async (client) => {
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

          // Check past-due blocking
          const { blocked } = await checkPastDueBlocked(
            client,
            session.customer_id,
            session.past_due_bypassed || false
          );
          if (blocked && proposedBy === 'CUSTOMER') {
            throw { statusCode: 403, message: 'Past due balance must be cleared before selection' };
          }

          // If already locked, cannot propose new selection
          if (session.selection_confirmed) {
            throw { statusCode: 400, message: 'Selection is already locked' };
          }

          const updateResult = await client.query<LaneSessionRow>(
            `UPDATE lane_sessions
           SET proposed_rental_type = $1,
               proposed_by = $2,
               waitlist_desired_type = COALESCE($3, waitlist_desired_type),
               backup_rental_type = COALESCE($4, backup_rental_type),
               updated_at = NOW()
           WHERE id = $5
           RETURNING *`,
            [
              rentalType,
              proposedBy,
              waitlistDesiredType || null,
              backupRentalType || null,
              session.id,
            ]
          );

          const updated = updateResult.rows[0]!;

          // Broadcast selection proposed
          const proposePayload: SelectionProposedPayload = {
            sessionId: updated.id,
            rentalType,
            proposedBy,
          };
          fastify.broadcaster.broadcastToLane(
            {
              type: 'SELECTION_PROPOSED',
              payload: proposePayload,
              timestamp: new Date().toISOString(),
            },
            laneId
          );

          return {
            sessionId: updated.id,
            proposedRentalType: rentalType,
            proposedBy,
          };
        });

        // Broadcast full session update (stable payload)
        const { payload } = await transaction((client) =>
          buildFullSessionUpdatedPayload(client, result.sessionId)
        );
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return reply.send(result);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to propose selection');
        const httpErr = getHttpError(error);
        if (httpErr) {
          return reply.status(httpErr.statusCode).send({
            error: httpErr.message ?? 'Failed to propose selection',
          });
        }
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to propose selection',
        });
      }
    }
  );

  /**
   * POST /v1/checkin/lane/:laneId/confirm-selection
   *
   * Confirm the proposed selection (first confirmation locks it).
   * Public endpoint (customer kiosk can call without auth).
   */
  fastify.post<{
    Params: { laneId: string };
    Body: { confirmedBy: 'CUSTOMER' | 'EMPLOYEE' };
  }>(
    '/v1/checkin/lane/:laneId/confirm-selection',
    {
      preHandler: [optionalAuth],
    },
    async (request, reply) => {
      const { laneId } = request.params;
      const { confirmedBy } = request.body;

      // Validate confirmedBy
      if (confirmedBy !== 'CUSTOMER' && confirmedBy !== 'EMPLOYEE') {
        return reply.status(400).send({ error: 'confirmedBy must be CUSTOMER or EMPLOYEE' });
      }

      // If employee, require auth
      if (confirmedBy === 'EMPLOYEE' && !request.staff) {
        return reply
          .status(401)
          .send({ error: 'Unauthorized - employee confirmations require authentication' });
      }

      try {
        const result = await transaction(async (client) => {
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

          // Check past-due blocking
          const { blocked } = await checkPastDueBlocked(
            client,
            session.customer_id,
            session.past_due_bypassed || false
          );
          if (blocked && confirmedBy === 'CUSTOMER') {
            throw {
              statusCode: 403,
              message: 'Past due balance must be cleared before confirmation',
            };
          }

          if (!session.proposed_rental_type) {
            throw { statusCode: 400, message: 'No selection proposed yet' };
          }

          // If already locked, return current state (idempotent)
          if (session.selection_confirmed) {
            return {
              sessionId: session.id,
              rentalType: session.proposed_rental_type,
              confirmedBy: session.selection_confirmed_by,
              alreadyConfirmed: true,
            };
          }

          // Lock the selection
          const updateResult = await client.query<LaneSessionRow>(
            `UPDATE lane_sessions
           SET selection_confirmed = true,
               selection_confirmed_by = $1,
               selection_locked_at = NOW(),
               desired_rental_type = proposed_rental_type,
               updated_at = NOW()
           WHERE id = $2
           RETURNING *`,
            [confirmedBy, session.id]
          );

          const updated = updateResult.rows[0]!;

          // Broadcast selection locked
          const lockedPayload: SelectionLockedPayload = {
            sessionId: updated.id,
            rentalType: updated.proposed_rental_type!,
            confirmedBy: confirmedBy as 'CUSTOMER' | 'EMPLOYEE',
            lockedAt: updated.selection_locked_at!.toISOString(),
          };
          fastify.broadcaster.broadcastToLane(
            {
              type: 'SELECTION_LOCKED',
              payload: lockedPayload,
              timestamp: new Date().toISOString(),
            },
            laneId
          );

          if (confirmedBy === 'EMPLOYEE') {
            fastify.broadcaster.broadcastSelectionForced(
              {
                sessionId: updated.id,
                rentalType: updated.proposed_rental_type!,
                forcedBy: 'EMPLOYEE',
              },
              laneId
            );
          }

          return {
            sessionId: updated.id,
            rentalType: updated.proposed_rental_type,
            confirmedBy,
          };
        });

        // Broadcast full session update (stable payload)
        const { payload } = await transaction((client) =>
          buildFullSessionUpdatedPayload(client, result.sessionId)
        );
        fastify.broadcaster.broadcastSessionUpdated(payload, laneId);

        return reply.send(result);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to confirm selection');
        const httpErr = getHttpError(error);
        if (httpErr) {
          return reply.status(httpErr.statusCode).send({
            error: httpErr.message ?? 'Failed to confirm selection',
          });
        }
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to confirm selection',
        });
      }
    }
  );

  /**
   * POST /v1/checkin/lane/:laneId/acknowledge-selection
   *
   * Acknowledge a locked selection (required for the other side to proceed).
   * Public endpoint (customer kiosk can call without auth).
   */
  fastify.post<{
    Params: { laneId: string };
    Body: { acknowledgedBy: 'CUSTOMER' | 'EMPLOYEE' };
  }>(
    '/v1/checkin/lane/:laneId/acknowledge-selection',
    {
      preHandler: [optionalAuth],
    },
    async (request, reply) => {
      const { laneId } = request.params;
      const { acknowledgedBy } = request.body;

      // Validate acknowledgedBy
      if (acknowledgedBy !== 'CUSTOMER' && acknowledgedBy !== 'EMPLOYEE') {
        return reply.status(400).send({ error: 'acknowledgedBy must be CUSTOMER or EMPLOYEE' });
      }

      // If employee, require auth
      if (acknowledgedBy === 'EMPLOYEE' && !request.staff) {
        return reply
          .status(401)
          .send({ error: 'Unauthorized - employee acknowledgements require authentication' });
      }

      try {
        const result = await transaction(async (client) => {
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

          if (!session.selection_confirmed) {
            throw { statusCode: 400, message: 'Selection is not locked yet' };
          }

          // Broadcast acknowledgement
          const ackPayload: SelectionAcknowledgedPayload = {
            sessionId: session.id,
            acknowledgedBy,
          };
          fastify.broadcaster.broadcastToLane(
            {
              type: 'SELECTION_ACKNOWLEDGED',
              payload: ackPayload,
              timestamp: new Date().toISOString(),
            },
            laneId
          );

          return {
            sessionId: session.id,
            acknowledgedBy,
          };
        });

        return reply.send(result);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to acknowledge selection');
        const httpErr = getHttpError(error);
        if (httpErr) {
          return reply.status(httpErr.statusCode).send({
            error: httpErr.message ?? 'Failed to acknowledge selection',
          });
        }
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to acknowledge selection',
        });
      }
    }
  );

  /**
   * GET /v1/checkin/lane/:laneId/waitlist-info
   *
   * Get waitlist position, ETA, and upgrade fee for a desired tier.
   * Called when customer selects an unavailable rental type.
   * Public endpoint (customer kiosk can call without auth).
   */
  fastify.get<{
    Params: { laneId: string };
    Querystring: { desiredTier: string; currentTier?: string };
  }>(
    '/v1/checkin/lane/:laneId/waitlist-info',
    {
      preHandler: [optionalAuth],
    },
    async (request, reply) => {
      const { desiredTier, currentTier } = request.query;

      if (!desiredTier) {
        return reply.status(400).send({ error: 'desiredTier query parameter is required' });
      }

      try {
        const result = await transaction(async (client) => {
          const sessionResult = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions
           WHERE lane_id = $1 AND status IN ('ACTIVE', 'AWAITING_ASSIGNMENT')
           ORDER BY created_at DESC
           LIMIT 1`,
            [request.params.laneId]
          );

          if (sessionResult.rows.length === 0) {
            throw { statusCode: 404, message: 'No active session found' };
          }

          const { position, estimatedReadyAt } = await computeWaitlistInfo(client, desiredTier);

          // Compute upgrade fee if currentTier is provided
          let upgradeFee: number | null = null;
          if (currentTier) {
            const { getUpgradeFee } = await import('../../pricing/engine.js');
            upgradeFee = getUpgradeFee(currentTier as any, desiredTier as any) || null;
          }

          return {
            position,
            estimatedReadyAt: estimatedReadyAt ? estimatedReadyAt.toISOString() : null,
            upgradeFee,
          };
        });

        return reply.send(result);
      } catch (error: unknown) {
        request.log.error(error, 'Failed to get waitlist info');
        const httpErr = getHttpError(error);
        if (httpErr) {
          return reply.status(httpErr.statusCode).send({
            error: httpErr.message ?? 'Failed to get waitlist info',
          });
        }
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to get waitlist info',
        });
      }
    }
  );
}

