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
  insertLateCheckoutEvent,
  insertLateFeeCharge,
  selectExistingLateFeeChargeId,
  selectManualCheckoutCandidates,
  selectManualResolveByOccupancyId,
  selectManualResolveForUpdateOfVisit,
  selectManualResolveLatestByLockerId,
  selectManualResolveLatestByRoomId,
  selectLockerIdByNumber,
  selectRoomIdByNumber,
  selectVisitStartedAt,
  selectWaitlistActiveForUpdate,
  updateLockerToCleanAndUnassign,
  updateRoomToDirtyAndUnassign,
} from './queries.js';
import type { ManualCheckoutResourceType, ManualResolveRow } from './types.js';
import { looksLikeUuid } from './utils.js';

type Tx = <T>(callback: (client: { query: DbQuery }) => Promise<T>) => Promise<T>;

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

export async function listManualCandidates(deps: { query: DbQuery }) {
  const rows = await selectManualCheckoutCandidates(deps.query);
  return rows.map((r) => ({
    occupancyId: r.occupancy_id,
    resourceType: r.resource_type,
    number: r.number,
    customerName: r.customer_name,
    checkinAt: r.checkin_at,
    scheduledCheckoutAt: r.scheduled_checkout_at,
    isOverdue: r.is_overdue,
  }));
}

export async function manualResolve(
  input: { occupancyId?: string; number?: string },
  deps: { query: DbQuery }
): Promise<{
  occupancyId: string;
  resourceType: ManualCheckoutResourceType;
  number: string;
  customerName: string;
  checkinAt: Date;
  scheduledCheckoutAt: Date;
  lateMinutes: number;
  fee: number;
  banApplied: boolean;
}> {
  let row: ManualResolveRow | null = null;

  if (input.occupancyId) {
    row = await selectManualResolveByOccupancyId(deps.query, input.occupancyId);
  } else if (input.number) {
    const lockerId = await selectLockerIdByNumber(deps.query, input.number);
    if (lockerId) {
      row = await selectManualResolveLatestByLockerId(deps.query, lockerId);
    } else {
      const roomId = await selectRoomIdByNumber(deps.query, input.number);
      if (roomId) {
        row = await selectManualResolveLatestByRoomId(deps.query, roomId);
      }
    }
  }

  if (!row) throw { statusCode: 404, message: 'Active occupancy not found' };

  const now = new Date();
  const scheduledCheckoutAt =
    row.scheduled_checkout_at instanceof Date
      ? row.scheduled_checkout_at
      : new Date(row.scheduled_checkout_at);
  const lateMinutes = computeLateMinutes(now, scheduledCheckoutAt);
  const { feeAmount, banApplied } = calculateLateFee(lateMinutes);

  const resourceType: ManualCheckoutResourceType = row.locker_id ? 'LOCKER' : 'ROOM';
  const number = resourceType === 'LOCKER' ? row.locker_number : row.room_number;
  if (!number) throw { statusCode: 404, message: 'Resource not found for occupancy' };

  return {
    occupancyId: row.occupancy_id,
    resourceType,
    number,
    customerName: row.customer_name,
    checkinAt: row.checkin_at,
    scheduledCheckoutAt,
    lateMinutes,
    fee: feeAmount,
    banApplied,
  };
}

export async function manualComplete(
  input: { occupancyId: string; staffId: string },
  deps: { serializableTransaction: Tx }
): Promise<{
  alreadyCheckedOut: boolean;
  row: ManualResolveRow & { visit_ended_at?: Date | null };
  lateMinutes: number;
  feeAmount: number;
  banApplied: boolean;
  cancelledWaitlistIds: string[];
  visitId: string;
}> {
  return deps.serializableTransaction(async (client) => {
    const dbQuery: DbQuery = (text, params) => client.query(text, params);

    const locked = await selectManualResolveForUpdateOfVisit(dbQuery, input.occupancyId);
    if (!locked) throw { statusCode: 404, message: 'Occupancy not found' };

    if (locked.visit_ended_at) {
      return {
        alreadyCheckedOut: true,
        row: locked,
        lateMinutes: 0,
        feeAmount: 0,
        banApplied: false,
        cancelledWaitlistIds: [],
        visitId: locked.visit_id,
      };
    }

    const now = new Date();
    const scheduledCheckoutAt =
      locked.scheduled_checkout_at instanceof Date
        ? locked.scheduled_checkout_at
        : new Date(locked.scheduled_checkout_at);
    const lateMinutes = computeLateMinutes(now, scheduledCheckoutAt);
    const { feeAmount, banApplied } = calculateLateFee(lateMinutes);

    const cancelledWaitlistIds = await cancelActiveWaitlistForVisit(dbQuery, {
      visitId: locked.visit_id,
      staffId: input.staffId,
    });

    if (locked.room_id) {
      await updateRoomToDirtyAndUnassign(dbQuery, locked.room_id, RoomStatus.DIRTY);
    }
    if (locked.locker_id) {
      await updateLockerToCleanAndUnassign(dbQuery, locked.locker_id, RoomStatus.CLEAN);
    }

    await endVisit(dbQuery, locked.visit_id);

    if (locked.session_id) {
      await completeLegacySessionIfPresent(dbQuery, locked.session_id);
    }

    if (banApplied) {
      const banUntil = new Date();
      banUntil.setDate(banUntil.getDate() + 30);
      await applyCustomerBan(dbQuery, locked.customer_id, banUntil);
    }

    if (feeAmount > 0) {
      await incrementCustomerPastDue(dbQuery, locked.customer_id, feeAmount);

      const existingLate = await selectExistingLateFeeChargeId(dbQuery, locked.occupancy_id);
      if (!existingLate) {
        await insertLateFeeCharge(dbQuery, {
          visitId: locked.visit_id,
          checkinBlockId: locked.occupancy_id,
          amount: feeAmount,
        });
      }

      const startedAt = await selectVisitStartedAt(dbQuery, locked.visit_id);
      const visitDate = (startedAt ?? now).toISOString().slice(0, 10);
      const noteLine = buildSystemLateFeeNote({ lateMinutes, visitDate, feeAmount });
      await appendCustomerNote(dbQuery, locked.customer_id, noteLine);
    }

    if (lateMinutes >= 30) {
      await insertLateCheckoutEvent(dbQuery, {
        customerId: locked.customer_id,
        occupancyId: locked.occupancy_id,
        checkoutRequestId: null,
        lateMinutes,
        feeAmount,
        banApplied,
      });
    }

    return {
      alreadyCheckedOut: false,
      row: locked,
      lateMinutes,
      feeAmount,
      banApplied,
      cancelledWaitlistIds,
      visitId: locked.visit_id,
    };
  });
}

