import type {
  CheckoutClaimedPayload,
  CheckoutRequestSummary,
  CheckoutRequestedPayload,
  CheckoutUpdatedPayload,
} from '@club-ops/shared';
import { RoomStatus } from '@club-ops/shared';
import { buildSystemLateFeeNote } from '../utils/lateFeeNotes.js';
import { calculateLateFee, computeLateMinutes } from './lateFees.js';
import type { DbQuery } from './queries.js';
import {
  appendCustomerNote,
  applyCustomerBan,
  cancelWaitlistEntries,
  completeLegacySessionIfPresent,
  endVisit,
  incrementCustomerPastDue,
  insertAuditWaitlistCancelled,
  insertCheckoutRequest,
  insertLateCheckoutEvent,
  insertLateFeeCharge,
  markCheckoutRequestVerified,
  selectActiveKeyTagIdForLocker,
  selectActiveKeyTagIdForRoom,
  selectActiveBlockById,
  selectBlockById,
  selectCheckoutRequestForUpdate,
  selectCheckoutRequestOwnership,
  selectCustomerForCheckout,
  selectExistingActiveCheckoutRequestForOccupancy,
  selectExistingLateFeeChargeId,
  selectLockerForCheckout,
  selectRoomForCheckout,
  selectVisitStartedAt,
  selectWaitlistActiveForUpdate,
  updateCheckoutRequestClaim,
  updateCheckoutRequestFeePaid,
  updateCheckoutRequestItemsConfirmed,
  updateLockerToCleanAndUnassign,
  updateRoomToDirtyAndUnassign,
} from './queries.js';
import { looksLikeUuid } from './utils.js';

type Tx = <T>(callback: (client: { query: DbQuery }) => Promise<T>) => Promise<T>;

function toServiceError(err: unknown): { statusCode: number; message: string } | null {
  if (!err || typeof err !== 'object') return null;
  if (!('statusCode' in err) || !('message' in err)) return null;
  const statusCode = (err as any).statusCode;
  const message = (err as any).message;
  if (typeof statusCode !== 'number' || typeof message !== 'string') return null;
  return { statusCode, message };
}

async function cancelActiveWaitlistForVisit(
  dbQuery: DbQuery,
  input: { visitId: string; staffId: string }
): Promise<string[]> {
  const rows = await selectWaitlistActiveForUpdate(dbQuery, input.visitId);
  if (rows.length === 0) return [];

  const waitlistIds = rows.map((r) => r.id);
  await cancelWaitlistEntries(dbQuery, waitlistIds);

  const auditStaffId = looksLikeUuid(input.staffId) ? input.staffId : null;
  for (const wl of rows) {
    await insertAuditWaitlistCancelled(dbQuery, {
      staffId: auditStaffId,
      waitlistId: wl.id,
      oldStatus: wl.status,
    });
  }

  return waitlistIds;
}

export async function createCheckoutRequest(
  input: { occupancyId: string; kioskDeviceId: string; checklist: Record<string, unknown> },
  deps: { query: DbQuery; serializableTransaction: Tx }
): Promise<
  | {
      requestId: string;
      summary: CheckoutRequestSummary;
      websocket: { type: 'CHECKOUT_REQUESTED'; payload: CheckoutRequestedPayload };
    }
> {
  const { requestRow, block } = await deps.serializableTransaction(async (client) => {
    const dbQuery: DbQuery = (text, params) => client.query(text, params);

    const activeBlock = await selectActiveBlockById(dbQuery, input.occupancyId);
    if (!activeBlock) {
      throw { statusCode: 404, message: 'Active occupancy not found' };
    }

    const existingId = await selectExistingActiveCheckoutRequestForOccupancy(dbQuery, input.occupancyId);
    if (existingId) {
      throw { statusCode: 409, message: 'Checkout request already exists for this occupancy' };
    }

    const now = new Date();
    const scheduledCheckoutAt = activeBlock.ends_at;
    const lateMinutes = computeLateMinutes(now, scheduledCheckoutAt);
    const { feeAmount, banApplied } = calculateLateFee(lateMinutes);

    let keyTagId: string | null = null;
    if (activeBlock.room_id) {
      keyTagId = await selectActiveKeyTagIdForRoom(dbQuery, activeBlock.room_id);
    } else if (activeBlock.locker_id) {
      keyTagId = await selectActiveKeyTagIdForLocker(dbQuery, activeBlock.locker_id);
    }

    const created = await insertCheckoutRequest(dbQuery, {
      occupancyId: input.occupancyId,
      customerId: activeBlock.customer_id,
      keyTagId,
      kioskDeviceId: input.kioskDeviceId,
      customerChecklistJson: input.checklist,
      lateMinutes,
      lateFeeAmount: feeAmount,
      banApplied,
    });

    return { requestRow: created, block: activeBlock };
  });

  const customer = await selectCustomerForCheckout(deps.query, block.customer_id);
  if (!customer) {
    throw { statusCode: 404, message: 'Customer not found' };
  }

  let roomNumber: string | undefined;
  let lockerNumber: string | undefined;

  if (block.room_id) {
    const room = await selectRoomForCheckout(deps.query, block.room_id);
    roomNumber = room?.number ?? undefined;
  }
  if (block.locker_id) {
    const locker = await selectLockerForCheckout(deps.query, block.locker_id);
    lockerNumber = locker?.number ?? undefined;
  }

  const summary: CheckoutRequestSummary = {
    requestId: requestRow.id,
    customerName: customer.name,
    membershipNumber: customer.membership_number || undefined,
    rentalType: block.rental_type,
    roomNumber,
    lockerNumber,
    scheduledCheckoutAt: block.ends_at,
    currentTime: new Date(),
    lateMinutes: requestRow.late_minutes,
    lateFeeAmount: requestRow.late_fee_amount,
    banApplied: requestRow.ban_applied,
  };

  const payload: CheckoutRequestedPayload = { request: summary };
  return { requestId: requestRow.id, summary, websocket: { type: 'CHECKOUT_REQUESTED', payload } };
}

export async function claimCheckoutRequest(
  input: { requestId: string; staffId: string },
  deps: { serializableTransaction: Tx }
): Promise<{ requestId: string; claimedBy: string; claimedAt: Date; claimExpiresAt: Date; websocket: CheckoutClaimedPayload }> {
  const row = await deps.serializableTransaction(async (client) => {
    const dbQuery: DbQuery = (text, params) => client.query(text, params);
    const checkoutRequest = await selectCheckoutRequestForUpdate(dbQuery, input.requestId);
    if (!checkoutRequest) throw { statusCode: 404, message: 'Checkout request not found' };

    if (checkoutRequest.status !== 'SUBMITTED') {
      if (checkoutRequest.status === 'CLAIMED' && checkoutRequest.claim_expires_at) {
        const now = new Date();
        if (!(now > checkoutRequest.claim_expires_at)) {
          throw { statusCode: 409, message: 'Checkout request already claimed' };
        }
        // else: claim expired -> allow re-claim
      } else {
        throw { statusCode: 409, message: `Checkout request is ${checkoutRequest.status}` };
      }
    }

    const now = new Date();
    const claimExpiresAt = new Date(now.getTime() + 2 * 60 * 1000);
    return updateCheckoutRequestClaim(dbQuery, {
      requestId: input.requestId,
      staffId: input.staffId,
      claimedAt: now,
      claimExpiresAt,
    });
  });

  return {
    requestId: row.id,
    claimedBy: input.staffId,
    claimedAt: row.claimed_at!,
    claimExpiresAt: row.claim_expires_at!,
    websocket: { requestId: row.id, claimedBy: input.staffId },
  };
}

export async function markFeePaid(
  input: { requestId: string; staffId: string },
  deps: { transaction: Tx }
): Promise<{ requestId: string; feePaid: boolean; websocket: CheckoutUpdatedPayload }> {
  const row = await deps.transaction(async (client) => {
    const dbQuery: DbQuery = (text, params) => client.query(text, params);
    const ownership = await selectCheckoutRequestOwnership(dbQuery, input.requestId);
    if (!ownership) throw { statusCode: 404, message: 'Checkout request not found' };
    if (ownership.claimed_by_staff_id !== input.staffId) {
      throw { statusCode: 403, message: 'Not authorized to update this checkout request' };
    }
    if (ownership.status !== 'CLAIMED') {
      throw { statusCode: 409, message: `Checkout request is ${ownership.status}` };
    }
    return updateCheckoutRequestFeePaid(dbQuery, input.requestId);
  });

  const websocket: CheckoutUpdatedPayload = {
    requestId: row.id,
    itemsConfirmed: row.items_confirmed,
    feePaid: row.fee_paid,
  };
  return { requestId: row.id, feePaid: row.fee_paid, websocket };
}

export async function confirmItems(
  input: { requestId: string; staffId: string },
  deps: { transaction: Tx }
): Promise<{ requestId: string; itemsConfirmed: boolean; websocket: CheckoutUpdatedPayload }> {
  const row = await deps.transaction(async (client) => {
    const dbQuery: DbQuery = (text, params) => client.query(text, params);
    const ownership = await selectCheckoutRequestOwnership(dbQuery, input.requestId);
    if (!ownership) throw { statusCode: 404, message: 'Checkout request not found' };
    if (ownership.claimed_by_staff_id !== input.staffId) {
      throw { statusCode: 403, message: 'Not authorized to update this checkout request' };
    }
    if (ownership.status !== 'CLAIMED') {
      throw { statusCode: 409, message: `Checkout request is ${ownership.status}` };
    }
    return updateCheckoutRequestItemsConfirmed(dbQuery, input.requestId);
  });

  const websocket: CheckoutUpdatedPayload = {
    requestId: row.id,
    itemsConfirmed: row.items_confirmed,
    feePaid: row.fee_paid,
  };
  return { requestId: row.id, itemsConfirmed: row.items_confirmed, websocket };
}

export async function completeCheckout(
  input: { requestId: string; staffId: string },
  deps: { serializableTransaction: Tx }
): Promise<{
  requestId: string;
  kioskDeviceId: string;
  roomId: string | null;
  lockerId: string | null;
  visitId: string;
  cancelledWaitlistIds: string[];
}> {
  try {
    return await deps.serializableTransaction(async (client) => {
      const dbQuery: DbQuery = (text, params) => client.query(text, params);

      const checkoutRequest = await selectCheckoutRequestForUpdate(dbQuery, input.requestId);
      if (!checkoutRequest) throw { statusCode: 404, message: 'Checkout request not found' };

      if (checkoutRequest.claimed_by_staff_id !== input.staffId) {
        throw { statusCode: 403, message: 'Not authorized to complete this checkout request' };
      }
      if (checkoutRequest.status !== 'CLAIMED') {
        throw { statusCode: 409, message: `Checkout request is ${checkoutRequest.status}` };
      }
      if (!checkoutRequest.items_confirmed) {
        throw { statusCode: 400, message: 'Items must be confirmed before completing checkout' };
      }
      if (checkoutRequest.late_fee_amount > 0 && !checkoutRequest.fee_paid) {
        throw { statusCode: 400, message: 'Late fee must be paid before completing checkout' };
      }

      const block = await selectBlockById(dbQuery, checkoutRequest.occupancy_id);
      if (!block) throw { statusCode: 404, message: 'Occupancy not found' };

      const cancelledWaitlistIds = await cancelActiveWaitlistForVisit(dbQuery, {
        visitId: block.visit_id,
        staffId: input.staffId,
      });

      if (block.room_id) {
        await updateRoomToDirtyAndUnassign(dbQuery, block.room_id, RoomStatus.DIRTY);
      }
      if (block.locker_id) {
        await updateLockerToCleanAndUnassign(dbQuery, block.locker_id, RoomStatus.CLEAN);
      }

      await endVisit(dbQuery, block.visit_id);

      if (block.session_id) {
        await completeLegacySessionIfPresent(dbQuery, block.session_id);
      }

      if (checkoutRequest.ban_applied) {
        const banUntil = new Date();
        banUntil.setDate(banUntil.getDate() + 30);
        await applyCustomerBan(dbQuery, checkoutRequest.customer_id, banUntil);
      }

      const feeAmount = Number(checkoutRequest.late_fee_amount) || 0;
      if (feeAmount > 0) {
        await incrementCustomerPastDue(dbQuery, checkoutRequest.customer_id, feeAmount);

        const existingLate = await selectExistingLateFeeChargeId(dbQuery, block.id);
        if (!existingLate) {
          await insertLateFeeCharge(dbQuery, {
            visitId: block.visit_id,
            checkinBlockId: block.id,
            amount: feeAmount,
          });
        }

        const now = new Date();
        const scheduledCheckoutAt = block.ends_at instanceof Date ? block.ends_at : new Date(block.ends_at);
        const lateMinutesActual = computeLateMinutes(now, scheduledCheckoutAt);
        const startedAt = await selectVisitStartedAt(dbQuery, block.visit_id);
        const visitDate = (startedAt ?? now).toISOString().slice(0, 10);
        const noteLine = buildSystemLateFeeNote({ lateMinutes: lateMinutesActual, visitDate, feeAmount });
        await appendCustomerNote(dbQuery, checkoutRequest.customer_id, noteLine);
      }

      if (checkoutRequest.late_minutes >= 30) {
        await insertLateCheckoutEvent(dbQuery, {
          customerId: checkoutRequest.customer_id,
          occupancyId: checkoutRequest.occupancy_id,
          checkoutRequestId: checkoutRequest.id,
          lateMinutes: checkoutRequest.late_minutes,
          feeAmount: Number(checkoutRequest.late_fee_amount) || 0,
          banApplied: checkoutRequest.ban_applied,
        });
      }

      await markCheckoutRequestVerified(dbQuery, checkoutRequest.id, new Date());

      return {
        requestId: checkoutRequest.id,
        kioskDeviceId: checkoutRequest.kiosk_device_id,
        roomId: block.room_id,
        lockerId: block.locker_id,
        visitId: block.visit_id,
        cancelledWaitlistIds,
      };
    });
  } catch (err) {
    const e = toServiceError(err);
    if (e) throw e;
    throw err;
  }
}

