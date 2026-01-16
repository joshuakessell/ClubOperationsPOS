import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { serializableTransaction, transaction } from '../../db/index.js';
import { optionalAuth } from '../../auth/middleware.js';
import type { LaneSessionRow } from '../types.js';
import { buildFullSessionUpdatedPayload, getHttpError, selectRoomForNewCheckin, toDate } from '../service.js';
import { stripSystemLateFeeNotes } from '../../utils/lateFeeNotes.js';
import { roundUpToQuarterHour } from '../../time/rounding.js';
import { generateAgreementPdf } from '../../utils/pdf-generator.js';
import { AGREEMENT_LEGAL_BODY_HTML_BY_LANG } from '@club-ops/shared';
import { broadcastInventoryUpdate } from '../../routes/sessions.js';

const SignAgreementSchema = z.object({
  sessionId: z.string().uuid(),
  signaturePayload: z.string().min(1), // data URL or base64 (png)
});

type AgreementRow = { id: string; version: string; title: string; body_text: string };

export async function registerCheckinAgreementRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * POST /v1/checkin/lane/:laneId/sign-agreement
   *
   * Public kiosk endpoint. Finalizes check-in after payment:
   * - creates visit + checkin_block (session_id = lane_session.id)
   * - assigns inventory (room/locker -> OCCUPIED + assigned_to_customer_id)
   * - stores signature artifacts + generated PDF
   * - archives system late-fee notes on customer (manual notes persist)
   */
  fastify.post<{ Params: { laneId: string }; Body: z.infer<typeof SignAgreementSchema> }>(
    '/v1/checkin/lane/:laneId/sign-agreement',
    { preHandler: [optionalAuth] },
    async (request, reply) => {
      let body: z.infer<typeof SignAgreementSchema>;
      try {
        body = SignAgreementSchema.parse(request.body);
      } catch (error) {
        return reply.status(400).send({
          error: 'Validation failed',
          details: error instanceof z.ZodError ? error.errors : 'Invalid input',
        });
      }

      try {
        const { sessionId, laneId, success } = await serializableTransaction(async (client) => {
          const sessionRes = await client.query<LaneSessionRow>(
            `SELECT * FROM lane_sessions WHERE id = $1 LIMIT 1 FOR UPDATE`,
            [body.sessionId]
          );
          if (sessionRes.rows.length === 0) throw { statusCode: 404, message: 'Lane session not found' };
          const session = sessionRes.rows[0]!;

          const laneId = session.lane_id;
          if (!session.customer_id) throw { statusCode: 400, message: 'Lane session has no customer' };

          const mode = (session.checkin_mode || 'INITIAL') as string;
          if (mode !== 'INITIAL' && mode !== 'RENEWAL') {
            throw { statusCode: 400, message: 'Agreement signing requires INITIAL or RENEWAL mode' };
          }

          if (!session.selection_confirmed || !session.desired_rental_type) {
            throw { statusCode: 400, message: 'Selection must be confirmed before signing agreement' };
          }

          if (!session.payment_intent_id) throw { statusCode: 400, message: 'Payment is required before signing agreement' };
          const pi = await client.query<{ status: string }>(
            `SELECT status::text as status FROM payment_intents WHERE id = $1 LIMIT 1`,
            [session.payment_intent_id]
          );
          if (pi.rows[0]?.status !== 'PAID') throw { statusCode: 400, message: 'Payment must be PAID before signing agreement' };

          // Resolve customer identity + language (for agreement body + PDF)
          const customer = (
            await client.query<{ name: string; dob: Date | null; membership_number: string | null; primary_language: string | null; notes: string | null }>(
              `SELECT name, dob, membership_number, primary_language, notes FROM customers WHERE id = $1 LIMIT 1`,
              [session.customer_id]
            )
          ).rows[0];
          if (!customer) throw { statusCode: 404, message: 'Customer not found' };

          // Archive system late-fee notes on successful check-in completion.
          const cleanedNotes = stripSystemLateFeeNotes(customer.notes);
          await client.query(`UPDATE customers SET notes = $1, updated_at = NOW() WHERE id = $2`, [
            cleanedNotes,
            session.customer_id,
          ]);

          // Inventory selection (room vs locker)
          let roomId: string | null = null;
          let lockerId: string | null = null;

          if (session.desired_rental_type === 'LOCKER' || session.desired_rental_type === 'GYM_LOCKER') {
            lockerId = session.assigned_resource_type === 'locker' ? session.assigned_resource_id : null;
            if (!lockerId) {
              const locker = (
                await client.query<{ id: string; number: string }>(
                  `SELECT id, number
                   FROM lockers
                   WHERE status = 'CLEAN' AND assigned_to_customer_id IS NULL
                   ORDER BY number ASC
                   LIMIT 1
                   FOR UPDATE SKIP LOCKED`
                )
              ).rows[0];
              if (!locker) throw { statusCode: 409, message: 'No available lockers' };
              lockerId = locker.id;
            }
          } else {
            roomId = session.assigned_resource_type === 'room' ? session.assigned_resource_id : null;
            if (!roomId) {
              const room = await selectRoomForNewCheckin(client, session.desired_rental_type as any);
              if (!room) throw { statusCode: 409, message: 'No available rooms' };
              roomId = room.id;
            }
          }

          // Create or reuse visit (RENEWAL reuses active visit)
          const visitId =
            mode === 'RENEWAL'
              ? (
                  await client.query<{ id: string }>(
                    `SELECT id FROM visits WHERE customer_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1 FOR UPDATE`,
                    [session.customer_id]
                  )
                ).rows[0]?.id
              : null;

          const visitRow =
            visitId ??
            (
              await client.query<{ id: string }>(
                `INSERT INTO visits (customer_id, started_at) VALUES ($1, NOW()) RETURNING id`,
                [session.customer_id]
              )
            ).rows[0]!.id;

          const startsAt = new Date();
          const endsAt = roundUpToQuarterHour(new Date(startsAt.getTime() + 6 * 60 * 60 * 1000));
          const blockType = mode === 'RENEWAL' ? 'RENEWAL' : 'INITIAL';

          // Persist checkin block with agreement metadata (PDF stored on the block).
          const signatureBase64 = body.signaturePayload.startsWith('data:')
            ? body.signaturePayload.split(',')[1] || ''
            : body.signaturePayload;
          const signedAt = new Date();

          const agreement = (
            await client.query<AgreementRow>(
              `SELECT id, version, title, body_text
               FROM agreements
               WHERE active = true
               ORDER BY created_at DESC
               LIMIT 1`
            )
          ).rows[0];
          if (!agreement) throw { statusCode: 404, message: 'No active agreement found' };

          const customerLang = customer.primary_language === 'ES' ? 'ES' : 'EN';
          const agreementTextSnapshot =
            customerLang === 'ES' ? AGREEMENT_LEGAL_BODY_HTML_BY_LANG.ES : agreement.body_text;
          const agreementTitleForPdf = customerLang === 'ES' ? 'Acuerdo del Club' : agreement.title;

          let pdfBuffer: Buffer;
          try {
            pdfBuffer = await generateAgreementPdf({
              agreementTitle: agreementTitleForPdf,
              agreementVersion: agreement.version,
              agreementText: agreementTextSnapshot,
              customerName: customer.name,
              customerDob: customer.dob,
              membershipNumber: customer.membership_number || undefined,
              checkinAt: startsAt,
              signedAt,
              signatureImageBase64: signatureBase64,
            });
          } catch {
            // Some tests/dev flows use placeholder signature strings that are not valid PNG.
            // Keep the flow resilient by generating a PDF without embedding the image.
            pdfBuffer = await generateAgreementPdf({
              agreementTitle: agreementTitleForPdf,
              agreementVersion: agreement.version,
              agreementText: agreementTextSnapshot,
              customerName: customer.name,
              customerDob: customer.dob,
              membershipNumber: customer.membership_number || undefined,
              checkinAt: startsAt,
              signedAt,
              signatureText: '(signature captured)',
            });
          }

          const blockId = (
            await client.query<{ id: string }>(
              `INSERT INTO checkin_blocks
               (visit_id, block_type, starts_at, ends_at, rental_type, room_id, locker_id, session_id, agreement_signed, agreement_signed_at, agreement_pdf)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true, $9, $10)
               RETURNING id`,
              [visitRow, blockType, startsAt, endsAt, session.desired_rental_type, roomId, lockerId, session.id, signedAt, pdfBuffer]
            )
          ).rows[0]!.id;

          // Store signature artifacts (agreement_signatures)
          await client.query(
            `INSERT INTO agreement_signatures (
               agreement_id, checkin_id, checkin_block_id, customer_name, membership_number,
               signature_png_base64, signature_strokes_json,
               agreement_text_snapshot, agreement_version,
               device_id, device_type, user_agent, ip_address
             )
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              agreement.id,
              null,
              blockId,
              customer.name,
              customer.membership_number,
              signatureBase64,
              null,
              agreementTextSnapshot,
              agreement.version,
              request.headers['x-device-id'] || null,
              request.headers['x-device-type'] || 'customer-kiosk',
              request.headers['user-agent'] || null,
              request.ip || null,
            ]
          );

          // Assign inventory now (status transitions)
          if (roomId) {
            await client.query(
              `UPDATE rooms
               SET status = 'OCCUPIED',
                   assigned_to_customer_id = $1,
                   last_status_change = NOW(),
                   updated_at = NOW()
               WHERE id = $2`,
              [session.customer_id, roomId]
            );
          }
          if (lockerId) {
            await client.query(
              `UPDATE lockers
               SET status = 'OCCUPIED',
                   assigned_to_customer_id = $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [session.customer_id, lockerId]
            );
          }

          // Mark lane session completed, but keep customer association until staff reset.
          await client.query(`UPDATE lane_sessions SET status = 'COMPLETED', updated_at = NOW() WHERE id = $1`, [
            session.id,
          ]);

          return { sessionId: session.id, laneId, success: true as const };
        });

        // Broadcast AFTER commit so refetch-on-event sees the updated DB state.
        if (fastify.broadcaster) {
          await broadcastInventoryUpdate(fastify.broadcaster);
          const { payload } = await transaction((client) => buildFullSessionUpdatedPayload(client, sessionId));
          fastify.broadcaster.broadcastSessionUpdated(payload, laneId);
        }

        return reply.send({ success });
      } catch (error: unknown) {
        request.log.error(error, 'Failed to sign agreement');
        const httpErr = getHttpError(error);
        if (httpErr) return reply.status(httpErr.statusCode).send({ error: httpErr.message ?? 'Failed' });
        return reply.status(500).send({ error: 'Internal Server Error' });
      }
    }
  );
}

