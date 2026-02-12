import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { optionalAuth } from '../../auth/middleware';
import { requireKioskTokenOrStaff } from '../../auth/kioskToken';
import type { LaneSessionRow } from '../../checkin/types';
import { buildFullSessionUpdatedPayload } from '../../checkin/payload';
import { transaction } from '../../db';
import { assertCustomerLanguageSelected } from '../../checkin/session';
import { getLaneFeatureFlags } from '../../checkin/laneFeatureFlags';
import { writeOfflineOutboxRecord } from '../../checkin/offlineOutbox';

type FlowActor = 'CUSTOMER' | 'EMPLOYEE' | 'SYSTEM';

type FlowStep =
  | 'LANGUAGE'
  | 'RENTAL'
  | 'WAITLIST_PREFERENCES'
  | 'WAITLIST_BACKUP'
  | 'PAYMENT'
  | 'AGREEMENT'
  | 'COMPLETE';

type FlowCommandType =
  | 'SET_STEP'
  | 'BACK_STEP'
  | 'CANCEL_STEP'
  | 'PROPOSE_SELECTION'
  | 'CONFIRM_SELECTION'
  | 'WAITLIST_UPDATE';

const FlowActorSchema = z.union([z.literal('CUSTOMER'), z.literal('EMPLOYEE'), z.literal('SYSTEM')]);

const FlowCommandTypeSchema = z.union([
  z.literal('SET_STEP'),
  z.literal('BACK_STEP'),
  z.literal('CANCEL_STEP'),
  z.literal('PROPOSE_SELECTION'),
  z.literal('CONFIRM_SELECTION'),
  z.literal('WAITLIST_UPDATE'),
]);

const FlowCommandRequestSchema = z.object({
  sessionId: z.string().min(1),
  commandId: z.string().uuid(),
  actor: FlowActorSchema,
  expectedFlowVersion: z.number().int().nonnegative().optional(),
  type: FlowCommandTypeSchema,
  payload: z.record(z.unknown()).optional(),
});

const SetStepCommandSchema = FlowCommandRequestSchema.extend({
  type: z.literal('SET_STEP'),
  payload: z.object({ step: z.string().min(1) }),
});

const BackStepCommandSchema = FlowCommandRequestSchema.extend({
  type: z.literal('BACK_STEP'),
  payload: z.undefined().optional(),
});

const CancelStepCommandSchema = FlowCommandRequestSchema.extend({
  type: z.literal('CANCEL_STEP'),
  payload: z.undefined().optional(),
});

const ProposeSelectionCommandSchema = FlowCommandRequestSchema.extend({
  type: z.literal('PROPOSE_SELECTION'),
  payload: z.object({ rentalType: z.string().min(1) }),
});

const ConfirmSelectionCommandSchema = FlowCommandRequestSchema.extend({
  type: z.literal('CONFIRM_SELECTION'),
  payload: z.undefined().optional(),
});

const WaitlistUpdateCommandSchema = FlowCommandRequestSchema.extend({
  type: z.literal('WAITLIST_UPDATE'),
  payload: z
    .object({
      waitlistDesiredType: z.string().min(1).optional(),
      waitlistDesiredTypes: z.array(z.string().min(1)).optional(),
      backupRentalType: z.string().min(1).optional(),
      waitlistRequestedResourceNumber: z.string().min(1).optional(),
      waitlistRequestedResourceType: z.union([z.literal('room'), z.literal('locker')]).optional(),
    })
    .refine(
      (p) => Object.keys(p).length > 0,
      'WAITLIST_UPDATE payload must include at least one field'
    ),
});

const FlowCommandRequestByTypeSchema = z.discriminatedUnion('type', [
  SetStepCommandSchema,
  BackStepCommandSchema,
  CancelStepCommandSchema,
  ProposeSelectionCommandSchema,
  ConfirmSelectionCommandSchema,
  WaitlistUpdateCommandSchema,
]);

const FLOW_STEPS: FlowStep[] = [
  'LANGUAGE',
  'RENTAL',
  'WAITLIST_PREFERENCES',
  'WAITLIST_BACKUP',
  'PAYMENT',
  'AGREEMENT',
  'COMPLETE',
];

const FLOW_STEP_INDEX: Record<FlowStep, number> = {
  LANGUAGE: 0,
  RENTAL: 1,
  WAITLIST_PREFERENCES: 2,
  WAITLIST_BACKUP: 3,
  PAYMENT: 4,
  AGREEMENT: 5,
  COMPLETE: 6,
};

const ALLOWED_STEP_TRANSITIONS: Readonly<Record<FlowStep, ReadonlySet<FlowStep>>> = {
  LANGUAGE: new Set(['LANGUAGE', 'RENTAL']),
  RENTAL: new Set(['LANGUAGE', 'RENTAL', 'WAITLIST_PREFERENCES']),
  WAITLIST_PREFERENCES: new Set(['RENTAL', 'WAITLIST_PREFERENCES', 'WAITLIST_BACKUP']),
  WAITLIST_BACKUP: new Set(['WAITLIST_PREFERENCES', 'WAITLIST_BACKUP', 'PAYMENT']),
  PAYMENT: new Set(['WAITLIST_BACKUP', 'PAYMENT', 'AGREEMENT']),
  AGREEMENT: new Set(['PAYMENT', 'AGREEMENT', 'COMPLETE']),
  COMPLETE: new Set(['AGREEMENT', 'COMPLETE']),
};

function assertAllowedStepTransition(params: {
  currentStep: FlowStep;
  nextStep: FlowStep;
  type: FlowCommandType;
}): void {
  const { currentStep, nextStep, type } = params;
  const currentIndex = FLOW_STEP_INDEX[currentStep];
  const nextIndex = FLOW_STEP_INDEX[nextStep];

  // CANCEL does not change steps.
  if (type === 'CANCEL_STEP') {
    if (nextStep !== currentStep) {
      throw { statusCode: 400, error: 'InvalidTransition', message: 'CANCEL_STEP cannot change step' };
    }
    return;
  }

  // BACK_STEP must move to the previous step (or stay at first).
  if (type === 'BACK_STEP') {
    const expected = getPreviousFlowStep(currentStep);
    if (nextStep !== expected) {
      throw {
        statusCode: 400,
        error: 'InvalidTransition',
        message: `BACK_STEP must move to ${expected}`,
      };
    }
    return;
  }

  // SET_STEP: allow no-op, forward one step, or any backward jump.
  if (nextStep === currentStep) return;
  if (nextIndex < currentIndex) return;
  if (nextIndex === currentIndex + 1) return;

  throw {
    statusCode: 400,
    error: 'InvalidTransition',
    message: `SET_STEP may only advance by one step (or jump backwards). ${currentStep} -> ${nextStep} not allowed`,
  };
}

function assertStepIsValidForFlow(params: { currentStep: FlowStep; nextStep: FlowStep }): void {
  const { currentStep, nextStep } = params;
  const allowed = ALLOWED_STEP_TRANSITIONS[currentStep];
  if (!allowed.has(nextStep)) {
    throw {
      statusCode: 400,
      error: 'InvalidTransition',
      message: `Transition ${currentStep} -> ${nextStep} is not allowed`,
    };
  }
}

function parseFlowStep(value: unknown): FlowStep | null {
  if (typeof value !== 'string') return null;
  return (FLOW_STEPS as string[]).includes(value) ? (value as FlowStep) : null;
}

function getPreviousFlowStep(step: FlowStep): FlowStep {
  const currentIndex = FLOW_STEPS.indexOf(step);
  if (currentIndex <= 0) return FLOW_STEPS[0]!;
  return FLOW_STEPS[currentIndex - 1]!;
}

function computeFlowUpdate(input: {
  currentStep: FlowStep;
  type: FlowCommandType;
  payload?: Record<string, unknown>;
}): {
  nextStep: FlowStep;
  clear: {
    rental: boolean;
    waitlistPreferences: boolean;
    waitlistBackup: boolean;
    paymentIntent: boolean;
    agreement: boolean;
  };
} {
  const { currentStep, type, payload } = input;

  if (type === 'PROPOSE_SELECTION' || type === 'CONFIRM_SELECTION' || type === 'WAITLIST_UPDATE') {
    return {
      nextStep: currentStep,
      clear: {
        rental: false,
        waitlistPreferences: false,
        waitlistBackup: false,
        paymentIntent: false,
        agreement: false,
      },
    };
  }

  if (type === 'SET_STEP') {
    const requested = parseFlowStep(payload?.['step']);
    if (!requested) {
      throw { statusCode: 400, error: 'InvalidPayload', message: 'payload.step is required' };
    }

    // When jumping backwards, clear everything after the requested step.
    const currentIndex = FLOW_STEPS.indexOf(currentStep);
    const requestedIndex = FLOW_STEPS.indexOf(requested);

    const movingBackwards = requestedIndex < currentIndex;
    const clear = {
      rental: movingBackwards && requestedIndex < FLOW_STEPS.indexOf('RENTAL'),
      waitlistPreferences:
        movingBackwards && requestedIndex < FLOW_STEPS.indexOf('WAITLIST_PREFERENCES'),
      waitlistBackup: movingBackwards && requestedIndex < FLOW_STEPS.indexOf('WAITLIST_BACKUP'),
      paymentIntent: movingBackwards && requestedIndex < FLOW_STEPS.indexOf('PAYMENT'),
      agreement: movingBackwards && requestedIndex < FLOW_STEPS.indexOf('AGREEMENT'),
    };

    assertAllowedStepTransition({ currentStep, nextStep: requested, type });
    assertStepIsValidForFlow({ currentStep, nextStep: requested });
    return { nextStep: requested, clear };
  }

  if (type === 'BACK_STEP') {
    const nextStep = getPreviousFlowStep(currentStep);

    assertAllowedStepTransition({ currentStep, nextStep, type });
    assertStepIsValidForFlow({ currentStep, nextStep });

    // Back clears the step we are leaving.
    const clear = {
      rental: currentStep === 'RENTAL',
      waitlistPreferences: currentStep === 'WAITLIST_PREFERENCES',
      waitlistBackup: currentStep === 'WAITLIST_BACKUP',
      paymentIntent: currentStep === 'PAYMENT',
      agreement: currentStep === 'AGREEMENT',
    };

    return { nextStep, clear };
  }

  // CANCEL_STEP clears the step we are currently on, without changing step.
  const clear = {
    rental: currentStep === 'RENTAL',
    waitlistPreferences: currentStep === 'WAITLIST_PREFERENCES',
    waitlistBackup: currentStep === 'WAITLIST_BACKUP',
    paymentIntent: currentStep === 'PAYMENT',
    agreement: currentStep === 'AGREEMENT',
  };

  return { nextStep: currentStep, clear };
}

async function isFlowCommandsEnabled(params: {
  client: Parameters<typeof getLaneFeatureFlags>[0];
  laneId: string;
}): Promise<boolean> {
  const flags = await getLaneFeatureFlags(params.client, params.laneId);
  return flags.flowCommandsEnabled;
}

async function isLanFallbackEnabledForLane(params: {
  client: Parameters<typeof getLaneFeatureFlags>[0];
  laneId: string;
}): Promise<boolean> {
  if (process.env.LAN_FALLBACK !== 'true') return false;
  const flags = await getLaneFeatureFlags(params.client, params.laneId);
  return flags.lanFallbackEnabled;
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
      const { laneId } = request.params;
      const parsed = FlowCommandRequestByTypeSchema.safeParse(request.body);
      if (!parsed.success) {
        return reply.status(400).send({
          applied: false,
          error: 'ValidationFailed',
          message: parsed.error.errors.map((e) => e.message).join(', '),
        });
      }

      const { sessionId, commandId, actor, expectedFlowVersion, type, payload } = parsed.data;

      try {
        const result = await transaction(async (client) => {
          if (!(await isFlowCommandsEnabled({ client, laneId }))) {
            throw { statusCode: 404, message: 'Not Found' };
          }

          const lanMode = await isLanFallbackEnabledForLane({ client, laneId });
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

          if (lanMode) {
            await writeOfflineOutboxRecord(client, {
              laneId,
              sessionId,
              commandId,
              actor,
              type,
              payload: payload ?? null,
            });
          }

          // Domain-specific command mutations.
          if (type === 'PROPOSE_SELECTION') {
            const rentalType = typeof payload?.['rentalType'] === 'string' ? payload['rentalType'] : null;
            if (!rentalType) {
              throw { statusCode: 400, error: 'InvalidPayload', message: 'payload.rentalType is required' };
            }

            await assertCustomerLanguageSelected(client, session);

            if (session.selection_confirmed) {
              throw { statusCode: 400, error: 'SelectionLocked', message: 'Selection is already locked' };
            }

            await client.query(
              `UPDATE lane_sessions
               SET proposed_rental_type = $1,
                   proposed_by = $2,
                   updated_at = NOW()
               WHERE id = $3`,
              [rentalType, actor === 'CUSTOMER' ? 'CUSTOMER' : 'EMPLOYEE', sessionId]
            );
          }

          if (type === 'CONFIRM_SELECTION') {
            await assertCustomerLanguageSelected(client, session);

            if (!session.proposed_rental_type) {
              throw { statusCode: 400, error: 'NoProposal', message: 'No selection proposed yet' };
            }

            if (!session.selection_confirmed) {
              await client.query(
                `UPDATE lane_sessions
                 SET selection_confirmed = true,
                     selection_confirmed_by = $1,
                     selection_locked_at = NOW(),
                     status = CASE
                       WHEN status = 'ACTIVE' THEN 'AWAITING_PAYMENT'
                       ELSE status
                     END,
                     updated_at = NOW()
                 WHERE id = $2`,
                [actor === 'CUSTOMER' ? 'CUSTOMER' : 'EMPLOYEE', sessionId]
              );
            }
          }

          if (type === 'WAITLIST_UPDATE') {
            const normalizeString = (value: unknown): string | null => {
              if (value === null || value === undefined) return null;
              if (typeof value !== 'string') return null;
              const trimmed = value.trim();
              return trimmed.length > 0 ? trimmed : null;
            };

            const desired = normalizeString(payload?.['waitlistDesiredType']);
            const backup = normalizeString(payload?.['backupRentalType']);
            const requestedNumber = normalizeString(payload?.['waitlistRequestedResourceNumber']);
            const requestedTypeRaw = payload?.['waitlistRequestedResourceType'];
            const requestedType =
              requestedTypeRaw === 'room' || requestedTypeRaw === 'locker' ? requestedTypeRaw : null;

            const desiredTypesRaw = payload?.['waitlistDesiredTypes'];
            const desiredTypes = Array.isArray(desiredTypesRaw)
              ? desiredTypesRaw
                  .filter((entry): entry is string => typeof entry === 'string')
                  .map((entry) => entry.trim())
                  .filter((entry) => entry.length > 0)
              : [];
            const desiredTypesJson = desiredTypes.length > 0 ? JSON.stringify(desiredTypes) : null;

            await client.query(
              `UPDATE lane_sessions
               SET waitlist_desired_type = $1,
                   waitlist_desired_types_json = $2,
                   backup_rental_type = $3,
                   waitlist_requested_resource_number = $4,
                   waitlist_requested_resource_type = $5,
                   updated_at = NOW()
               WHERE id = $6`,
              [desired, desiredTypesJson, backup, requestedNumber, requestedType, sessionId]
            );
          }

          const currentStep = parseFlowStep(session.flow_step) ?? 'LANGUAGE';
          const { nextStep, clear } = computeFlowUpdate({ currentStep, type, payload });
          const nextVersion = currentVersion + 1;

          const shouldClearRentalSelection = clear.rental;
          const shouldClearWaitlist = clear.waitlistPreferences || clear.waitlistBackup;
          const shouldClearPaymentIntent = clear.paymentIntent;
          const shouldClearAgreement = clear.agreement;

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
                 payment_intent_id = CASE WHEN $7 THEN NULL ELSE payment_intent_id END,
                 price_quote_json = CASE WHEN $7 THEN NULL ELSE price_quote_json END,
                 disclaimers_ack_json = CASE WHEN $7 THEN NULL ELSE disclaimers_ack_json END,
                 agreement_bypass_pending = CASE WHEN $8 THEN false ELSE agreement_bypass_pending END,
                 updated_at = NOW()
             WHERE id = $9`,
            [
              nextStep,
              nextVersion,
              commandId,
              actor,
              shouldClearRentalSelection,
              shouldClearWaitlist,
              shouldClearPaymentIntent,
              shouldClearAgreement,
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
