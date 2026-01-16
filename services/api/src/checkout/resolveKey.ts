import type { ResolvedCheckoutKey } from '@club-ops/shared';
import { calculateLateFee, computeLateMinutes } from './lateFees.js';
import type { DbQuery } from './queries.js';
import {
  selectCustomerForCheckout,
  selectKeyTagByToken,
  selectLatestActiveBlockByLockerId,
  selectLatestActiveBlockByRoomId,
  selectLockerForCheckout,
  selectRoomForCheckout,
  selectVisitCustomerId,
} from './queries.js';

export async function resolveCheckoutKey(
  input: { token: string; kioskDeviceId: string },
  deps: { query: DbQuery }
): Promise<ResolvedCheckoutKey> {
  void input.kioskDeviceId;

  const tag = await selectKeyTagByToken(deps.query, input.token);
  if (!tag) {
    throw { statusCode: 404, message: 'Key tag not found or inactive' };
  }

  const block = tag.room_id
    ? await selectLatestActiveBlockByRoomId(deps.query, tag.room_id)
    : tag.locker_id
      ? await selectLatestActiveBlockByLockerId(deps.query, tag.locker_id)
      : null;

  if (!tag.room_id && !tag.locker_id) {
    throw { statusCode: 404, message: 'Key tag is not associated with a room or locker' };
  }

  if (!block) {
    throw { statusCode: 404, message: 'No active occupancy found for this key' };
  }

  const customerId = await selectVisitCustomerId(deps.query, block.visit_id);
  if (!customerId) {
    throw { statusCode: 404, message: 'Visit not found' };
  }

  const customer = await selectCustomerForCheckout(deps.query, customerId);
  if (!customer) {
    throw { statusCode: 404, message: 'Customer not found' };
  }

  let roomNumber: string | undefined;
  let lockerNumber: string | undefined;

  if (block.room_id) {
    const room = await selectRoomForCheckout(deps.query, block.room_id);
    if (room) roomNumber = room.number;
  }

  if (block.locker_id) {
    const locker = await selectLockerForCheckout(deps.query, block.locker_id);
    if (locker) lockerNumber = locker.number;
  }

  const now = new Date();
  const scheduledCheckoutAt = block.ends_at instanceof Date ? block.ends_at : new Date(block.ends_at);
  const lateMinutes = computeLateMinutes(now, scheduledCheckoutAt);
  const { feeAmount, banApplied } = calculateLateFee(lateMinutes);

  return {
    keyTagId: tag.id,
    occupancyId: block.id,
    customerId: customer.id,
    customerName: customer.name,
    membershipNumber: customer.membership_number || undefined,
    rentalType: block.rental_type,
    roomId: block.room_id || undefined,
    roomNumber,
    lockerId: block.locker_id || undefined,
    lockerNumber,
    scheduledCheckoutAt,
    hasTvRemote: block.has_tv_remote,
    lateMinutes,
    lateFeeAmount: feeAmount,
    banApplied,
  };
}

