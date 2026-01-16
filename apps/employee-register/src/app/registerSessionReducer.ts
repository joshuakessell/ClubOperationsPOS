import type { SessionUpdatedPayload } from '@club-ops/shared';

export type RegisterPaymentQuote = {
  total: number;
  lineItems: Array<{ description: string; amount: number }>;
  messages: string[];
};

export type RegisterSessionState = {
  // Identity / lifecycle
  sessionId: string | null;
  status: string | null;

  // Customer
  customerName: string;
  membershipNumber: string;
  customerMembershipValidUntil: string | null;
  membershipPurchaseIntent: 'PURCHASE' | 'RENEW' | null;
  customerPrimaryLanguage: 'EN' | 'ES' | null;
  customerDobMonthDay: string | null;
  customerLastVisitAt: string | null;
  customerNotes: string | null;

  // Agreement
  agreementSigned: boolean;

  // Selection / waitlist
  proposedRentalType: string | null;
  proposedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  selectionConfirmed: boolean;
  selectionConfirmedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  selectionAcknowledged: boolean;
  customerSelectedType: string | null;
  waitlistDesiredTier: string | null;
  waitlistBackupType: string | null;

  // Assignment
  assignedResourceType: 'room' | 'locker' | null;
  assignedResourceNumber: string | null;
  checkoutAt: string | null;

  // Payment
  paymentIntentId: string | null;
  paymentStatus: 'DUE' | 'PAID' | null;
  paymentQuote: RegisterPaymentQuote | null;
  paymentFailureReason: string | null;

  // Past due
  pastDueBlocked: boolean;
  pastDueBalance: number;

  // Triggers for UI-only effects
  clearEpoch: number;
  pastDueModalEpoch: number;
};

export const initialRegisterSessionState: RegisterSessionState = {
  sessionId: null,
  status: null,

  customerName: '',
  membershipNumber: '',
  customerMembershipValidUntil: null,
  membershipPurchaseIntent: null,
  customerPrimaryLanguage: null,
  customerDobMonthDay: null,
  customerLastVisitAt: null,
  customerNotes: null,

  agreementSigned: false,

  proposedRentalType: null,
  proposedBy: null,
  selectionConfirmed: false,
  selectionConfirmedBy: null,
  selectionAcknowledged: true,
  customerSelectedType: null,
  waitlistDesiredTier: null,
  waitlistBackupType: null,

  assignedResourceType: null,
  assignedResourceNumber: null,
  checkoutAt: null,

  paymentIntentId: null,
  paymentStatus: null,
  paymentQuote: null,
  paymentFailureReason: null,

  pastDueBlocked: false,
  pastDueBalance: 0,

  clearEpoch: 0,
  pastDueModalEpoch: 0,
};

export type RegisterSessionAction =
  | { type: 'PATCH'; patch: Partial<RegisterSessionState> }
  | { type: 'SESSION_UPDATED'; payload: SessionUpdatedPayload };

function hasOwn(obj: object, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

export function registerSessionReducer(
  state: RegisterSessionState,
  action: RegisterSessionAction
): RegisterSessionState {
  if (action.type === 'PATCH') {
    return { ...state, ...action.patch };
  }

  const payload = action.payload as unknown as Record<string, unknown>;
  let next: RegisterSessionState = state;

  // If server cleared the lane session (COMPLETED with empty customer name), reset view-model state.
  const status = typeof payload['status'] === 'string' ? (payload['status'] as string) : null;
  const customerNameRaw = payload['customerName'];
  const customerName =
    customerNameRaw === undefined ? undefined : typeof customerNameRaw === 'string' ? customerNameRaw : '';

  if (status === 'COMPLETED' && (!customerName || customerName === '')) {
    return {
      ...initialRegisterSessionState,
      clearEpoch: state.clearEpoch + 1,
      // Preserve modal epoch counters monotonicity.
      pastDueModalEpoch: state.pastDueModalEpoch,
    };
  }

  // Start with a shallow clone only if we need to change something.
  const apply = (patch: Partial<RegisterSessionState>) => {
    next = next === state ? { ...state, ...patch } : { ...next, ...patch };
  };

  // Core identity/session fields
  if (hasOwn(payload, 'sessionId')) {
    apply({ sessionId: (payload['sessionId'] as string) || null });
  }
  if (hasOwn(payload, 'status')) {
    apply({ status: typeof payload['status'] === 'string' ? (payload['status'] as string) : null });
  }
  if (hasOwn(payload, 'customerName')) {
    apply({ customerName: (payload['customerName'] as string) || '' });
  }
  if (hasOwn(payload, 'membershipNumber')) {
    apply({ membershipNumber: (payload['membershipNumber'] as string) || '' });
  }
  if (hasOwn(payload, 'customerMembershipValidUntil')) {
    apply({ customerMembershipValidUntil: (payload['customerMembershipValidUntil'] as string) || null });
  }
  if (hasOwn(payload, 'membershipPurchaseIntent')) {
    apply({
      membershipPurchaseIntent:
        (payload['membershipPurchaseIntent'] as 'PURCHASE' | 'RENEW' | null) || null,
    });
  }

  // Agreement completion
  if (hasOwn(payload, 'agreementSigned')) {
    apply({ agreementSigned: Boolean(payload['agreementSigned']) });
  }

  // Selection state (keep existing behavior: only set when proposedRentalType is truthy)
  if (typeof payload['proposedRentalType'] === 'string' && payload['proposedRentalType']) {
    apply({
      proposedRentalType: payload['proposedRentalType'] as string,
      proposedBy: (payload['proposedBy'] as 'CUSTOMER' | 'EMPLOYEE' | null) || null,
    });
  }
  if (hasOwn(payload, 'selectionConfirmed')) {
    const confirmed = Boolean(payload['selectionConfirmed']);
    const selectionConfirmedBy =
      (payload['selectionConfirmedBy'] as 'CUSTOMER' | 'EMPLOYEE' | null) || null;
    const customerSelectedType =
      confirmed ? ((payload['proposedRentalType'] as string) || null) : next.customerSelectedType;
    apply({ selectionConfirmed: confirmed, selectionConfirmedBy, customerSelectedType });
  }

  // Waitlist intent
  if (hasOwn(payload, 'waitlistDesiredType')) {
    apply({ waitlistDesiredTier: (payload['waitlistDesiredType'] as string) || null });
  }
  if (hasOwn(payload, 'backupRentalType')) {
    apply({ waitlistBackupType: (payload['backupRentalType'] as string) || null });
  }

  // Customer info
  if (hasOwn(payload, 'customerPrimaryLanguage')) {
    const v = payload['customerPrimaryLanguage'];
    apply({ customerPrimaryLanguage: v === 'EN' || v === 'ES' ? (v as 'EN' | 'ES') : null });
  }
  if (hasOwn(payload, 'customerDobMonthDay')) {
    apply({ customerDobMonthDay: (payload['customerDobMonthDay'] as string) || null });
  }
  if (hasOwn(payload, 'customerLastVisitAt')) {
    apply({ customerLastVisitAt: (payload['customerLastVisitAt'] as string) || null });
  }
  if (hasOwn(payload, 'customerNotes')) {
    apply({ customerNotes: (payload['customerNotes'] as string) || null });
  }

  // Assignment
  if (hasOwn(payload, 'assignedResourceType')) {
    const t = payload['assignedResourceType'];
    apply({ assignedResourceType: t === 'room' || t === 'locker' ? (t as 'room' | 'locker') : null });
  }
  if (hasOwn(payload, 'assignedResourceNumber')) {
    apply({ assignedResourceNumber: (payload['assignedResourceNumber'] as string) || null });
  }
  if (hasOwn(payload, 'checkoutAt')) {
    apply({ checkoutAt: (payload['checkoutAt'] as string) || null });
  }

  // Payment status
  if (hasOwn(payload, 'paymentIntentId')) {
    apply({ paymentIntentId: (payload['paymentIntentId'] as string) || null });
  }
  if (hasOwn(payload, 'paymentStatus')) {
    const ps = payload['paymentStatus'];
    apply({ paymentStatus: ps === 'DUE' || ps === 'PAID' ? (ps as 'DUE' | 'PAID') : null });
  }
  if (hasOwn(payload, 'paymentTotal') || hasOwn(payload, 'paymentLineItems')) {
    const total = (payload['paymentTotal'] as number | undefined) ?? next.paymentQuote?.total ?? 0;
    const lineItems =
      (payload['paymentLineItems'] as RegisterPaymentQuote['lineItems'] | undefined) ??
      next.paymentQuote?.lineItems ??
      [];
    const messages = next.paymentQuote?.messages ?? [];
    apply({ paymentQuote: { total, lineItems, messages } });
  }
  if (typeof payload['paymentFailureReason'] === 'string' && payload['paymentFailureReason']) {
    apply({ paymentFailureReason: payload['paymentFailureReason'] as string });
  }

  // Past-due blocking (preserve existing behavior: only update balance inside pastDueBlocked block)
  if (hasOwn(payload, 'pastDueBlocked')) {
    const blocked = Boolean(payload['pastDueBlocked']);
    const patch: Partial<RegisterSessionState> = { pastDueBlocked: blocked };
    if (hasOwn(payload, 'pastDueBalance')) {
      const bal = Number(payload['pastDueBalance'] ?? 0);
      patch.pastDueBalance = Number.isFinite(bal) ? bal : 0;
      if (blocked && patch.pastDueBalance > 0) {
        patch.pastDueModalEpoch = state.pastDueModalEpoch + 1;
      }
    }
    apply(patch);
  }

  return next;
}

