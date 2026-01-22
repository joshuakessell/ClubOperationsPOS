import { getCustomerMembershipStatus } from './membership.js';
import type { SessionUpdatedPayload } from './types.js';

export type CheckinStageKey = 'LANGUAGE' | 'MEMBERSHIP' | 'RENTAL' | 'APPROVAL' | 'PAYMENT' | 'AGREEMENT' | 'COMPLETE';

export type CheckinStage = { number: number; key: CheckinStageKey };

/**
 * Derives the current check-in stage from a session updated payload.
 * This ensures both kiosk and employee-register use the same logic to determine the stage.
 *
 * @param p - Session updated payload
 * @returns CheckinStage or null if no active session
 */
export function deriveCheckinStage(p: SessionUpdatedPayload): CheckinStage | null {
  // If no sessionId or no customerName => return null (no active session)
  if (!p.sessionId || !p.customerName) {
    return null;
  }

  // If assignedResourceNumber exists => COMPLETE
  if (p.assignedResourceNumber) {
    return { number: 6, key: 'COMPLETE' };
  }

  // Else if status === 'AWAITING_SIGNATURE' => AGREEMENT
  if (p.status === 'AWAITING_SIGNATURE') {
    return { number: 5, key: 'AGREEMENT' };
  }

  // Else if paymentStatus === 'DUE' => PAYMENT
  if (p.paymentStatus === 'DUE') {
    return { number: 4, key: 'PAYMENT' };
  }

  // Else if proposedRentalType exists && !selectionConfirmed => APPROVAL
  if (p.proposedRentalType && !p.selectionConfirmed) {
    return { number: 3, key: 'APPROVAL' };
  }

  // Else if !customerPrimaryLanguage => LANGUAGE
  if (!p.customerPrimaryLanguage) {
    return { number: 1, key: 'LANGUAGE' };
  }

  // Else if membership choice is needed (mirror kiosk's membership needed logic) => MEMBERSHIP
  // Kiosk logic: membershipStatus = getMembershipStatus(session, Date.now())
  // isMember = membershipStatus === 'ACTIVE' || membershipStatus === 'PENDING'
  // membership is needed if: !isMember && !membershipChoice
  const membershipStatus = getCustomerMembershipStatus(
    {
      membershipNumber: p.membershipNumber || null,
      membershipValidUntil: p.customerMembershipValidUntil || null,
    },
    new Date()
  );
  const isMember = p.membershipPurchaseIntent ? true : membershipStatus === 'ACTIVE';
  if (!isMember && !p.membershipChoice) {
    return { number: 2, key: 'MEMBERSHIP' };
  }

  // Else => RENTAL
  return { number: 3, key: 'RENTAL' };
}
