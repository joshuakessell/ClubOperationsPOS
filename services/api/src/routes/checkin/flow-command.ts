import type { FastifyInstance } from 'fastify';
import { optionalAuth } from '../../auth/middleware';
import { requireKioskTokenOrStaff } from '../../auth/kioskToken';
import type { LaneSessionRow } from '../../checkin/types';
import { buildFullSessionUpdatedPayload } from '../../checkin/payload';
import { transaction } from '../../db';

type FlowActor = 'CUSTOMER' | 'EMPLOYEE' | 'SYSTEM';

type FlowStep =
  | 'LANGUAGE'
  | 'RENTAL'
  | 'WAITLIST_PREFERENCES'
  | 'WAITLIST_BACKUP'
  | 'PAYMENT'
  | 'AGREEMENT'
  | 'COMPLETE';

type FlowCommandType = 'SET_STEP' | 'BACK_STEP' | 'CANCEL_STEP';

const FLOW_STEPS: FlowStep[] = [
  'LANGUAGE',
  'RENTAL',
  'WAITLIST_PREFERENCES',
  'WAITLIST_BACKUP',
  'PAYMENT',
  'AGREEMENT',
  'COMPLETE',
];

function isFlowCommandsEnabled(): boolean {
  return process.env.FLOW_COMMANDS === 'true';
}

export function registerCheckinFlowCommandRoutes(fastify: FastifyInstance): void {
  fastify.post<{
    Params: { laneId: string };
    Body: {
      sessionId: string;
      commandId: string;
      actor: FlowActor;
      expectedFlowVersion?: number;
      type: FlowCommandType;
      payload?: Record<string, unknown>;
    };
    Reply:
      | {
          applied: true;
          deduped: false;
          flowVersion: number;
          session: LaneSessionRow;
        }
      | {
          applied: true;
          deduped: true;
          flowVersion: number;
          session: LaneSessionRow;
        }
      | {
          applied: false;
          error: string;
          message?: string;
        };
  }>(
    '/v1/checkin/lane/:laneId/flow-command',
    {
      preHandler: [optionalAuth, requireKioskTokenOrStaff],
    },
    async (request, reply) => {
      if (!isFlowCommandsEnabled()) {
        return reply.status(404).send({ error: 'Not Found' });
      }

      const { laneId } = request.params;
      const { sessionId, commandId, actor, expectedFlowVersion, type, payload } = request.body;

      if (!sessionId || !commandId || !actor || !type) {
        return reply.status(400).send({ error: 'sessionId, commandId, actor, and type are required' });
      }

      if (type !== 'SET_STEP' && type !== 'BACK_STEP' && type !== 'CANCEL_STEP') {
        return reply.status(400).send({ applied: false, error: 'InvalidCommandType' });
      }

      const parseStep = (value: unknown): FlowStep | null => {
        if (typeof value !== 'string') return null;
        return (FLOW_STEPS as string[]).includes(value) ? (value as FlowStep) : null;
      };

      const stepFromPayload = (): FlowStep | null => parseStep(payload?.['step']);

      try {
        const result = await transaction(async (client) => {
          const locked = await client.query<LaneSessionRow>(
            `SELECT *
             FROM lane_sessions
             WHERE id = $1 AND lane_id = $2
             FOR UPDATE`,
            [sessionId, laneId]
          );

          if (locked.rows.length === 0) {
            throw { statusCode: 404, message: 'Session not found' };
          }

          const session = locked.rows[0]!;
          const currentVersion = session.flow_version ?? 0;

          if (typeof expectedFlowVersion === 'number' && expectedFlowVersion !== currentVersion) {
            throw {
              statusCode: 409,
              error: 'VersionMismatch',
              message: `expectedFlowVersion ${expectedFlowVersion} does not match current ${currentVersion}`,
            };
          }

          const dedupe = await client.query<{ session_id: string; command_id: string }>(
            `SELECT session_id, command_id
             FROM lane_session_commands
             WHERE session_id = $1 AND command_id = $2
             LIMIT 1`,
            [sessionId, commandId]
          );

          if (dedupe.rows.length > 0) {
            return { applied: true as const, deduped: true as const, session };
          }

          await client.query(
            `INSERT INTO lane_session_commands (session_id, command_id, actor, type, payload_json)
             VALUES ($1, $2, $3, $4, $5)`,
            [sessionId, commandId, actor, type, payload ?? null]
          );

          const currentStep = parseStep(session.flow_step) ?? 'LANGUAGE';

          const computeNextStep = (): FlowStep => {
            if (type === 'SET_STEP') {
              const next = stepFromPayload();
              if (!next) {
                throw { statusCode: 400, error: 'InvalidPayload', message: 'payload.step is required' };
              }
              return next;
            }

            const currentIndex = FLOW_STEPS.indexOf(currentStep);
            if (currentIndex < 0) {
              return 'LANGUAGE';
            }

            if (type === 'BACK_STEP') {
              return currentIndex <= 0 ? FLOW_STEPS[0]! : FLOW_STEPS[currentIndex - 1]!;
            }

            return currentStep;
          };

          const nextStep = computeNextStep();
          const nextVersion = currentVersion + 1;

          // Minimal clearing rules for v1 of the engine.
          // More granular clearing will be added as we harden lock-step invariants.
          const shouldClearRentalSelection =
            (type === 'CANCEL_STEP' && currentStep === 'RENTAL') ||
            (type === 'BACK_STEP' && currentStep === 'WAITLIST_PREFERENCES');

          const shouldClearWaitlist =
            type === 'CANCEL_STEP' ||
            (type === 'BACK_STEP' &&
              (currentStep === 'WAITLIST_PREFERENCES' || currentStep === 'WAITLIST_BACKUP'));

          await client.query(
            `UPDATE lane_sessions
             SET flow_step = $1,
                 flow_version = $2,
                 flow_last_command_id = $3,
                 flow_last_actor = $4,
                 desired_rental_type = CASE WHEN $5 THEN NULL ELSE desired_rental_type END,
                 proposed_rental_type = CASE WHEN $5 THEN NULL ELSE proposed_rental_type END,
                 proposed_by = CASE WHEN $5 THEN NULL ELSE proposed_by END,
                 selection_confirmed = CASE WHEN $5 THEN false ELSE selection_confirmed END,
                 selection_confirmed_by = CASE WHEN $5 THEN NULL ELSE selection_confirmed_by END,
                 selection_locked_at = CASE WHEN $5 THEN NULL ELSE selection_locked_at END,
                 waitlist_desired_type = CASE WHEN $6 THEN NULL ELSE waitlist_desired_type END,
                 waitlist_desired_types_json = CASE WHEN $6 THEN NULL ELSE waitlist_desired_types_json END,
                 backup_rental_type = CASE WHEN $6 THEN NULL ELSE backup_rental_type END,
                 waitlist_requested_resource_number = CASE WHEN $6 THEN NULL ELSE waitlist_requested_resource_number END,
                 waitlist_requested_resource_type = CASE WHEN $6 THEN NULL ELSE waitlist_requested_resource_type END,
                 updated_at = NOW()
             WHERE id = $7`,
            [
              nextStep,
              nextVersion,
              commandId,
              actor,
              shouldClearRentalSelection,
              shouldClearWaitlist,
              sessionId,
            ]
          );

          const updated = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions WHERE id = $1 LIMIT 1`,
            [sessionId]
          );

          const updatedSession = updated.rows[0]!;

          return { applied: true as const, deduped: false as const, session: updatedSession };
        });

        const { laneId: sessionLaneId, payload: sessionPayload } = await transaction((client) =>
          buildFullSessionUpdatedPayload(client, sessionId)
        );
        fastify.broadcaster.broadcastSessionUpdated(sessionPayload, sessionLaneId);

        return reply.send({
          applied: true,
          deduped: result.deduped,
          flowVersion: result.session.flow_version ?? 0,
          session: result.session,
        });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to apply flow command');
        if (error && typeof error === 'object' && 'statusCode' in error) {
          const err = error as { statusCode: number; error?: string; message?: string };
          return reply.status(err.statusCode).send({
            applied: false,
            error: err.error || 'FlowCommandFailed',
            message: err.message,
          });
        }

        return reply.status(500).send({
          applied: false,
          error: 'InternalServerError',
          message: 'Failed to apply flow command',
        });
      }
    }
  );
}
