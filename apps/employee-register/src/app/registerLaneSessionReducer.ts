import type { CustomerIdType, SessionUpdatedPayload } from '@club-ops/shared';

export type PaymentQuoteViewModel = {
  total: number;
  lineItems: Array<{ description: string; amount: number }>;
  messages: string[];
};

export type RegisterLaneSessionState = {
  currentSessionId: string | null;
  /**
   * Client-side context for which customer this lane session is for.
   * Note: server WS payloads do not currently include customerId, so this is set by the UI when
   * starting/loading a session from a known customerId.
   */
  customerId: string | null;
  customerName: string;
  membershipNumber: string;
  customerMembershipValidUntil: string | null;
  membershipPurchaseIntent: 'PURCHASE' | 'RENEW' | null;
  membershipChoice: 'ONE_TIME' | 'SIX_MONTH' | null;
  allowedRentals: string[];
  mode: 'CHECKIN' | 'RENEWAL' | null;
  renewalHours: 2 | 6 | null;
  ledgerLineItems: Array<{ description: string; amount: number }>;
  ledgerTotal: number | null;

  agreementSigned: boolean;
  agreementBypassPending: boolean;
  agreementSignedMethod: 'DIGITAL' | 'MANUAL' | null;

  proposedRentalType: string | null;
  proposedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  selectionConfirmed: boolean;
  selectionConfirmedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  selectionAcknowledged: boolean;

  customerSelectedType: string | null;
  waitlistDesiredTier: string | null;
  waitlistBackupType: string | null;

  customerPrimaryLanguage: 'EN' | 'ES' | undefined;
  customerDobMonthDay: string | undefined;
  customerLastVisitAt: string | undefined;
  customerNotes: string | undefined;
  customerIdExpirationDate: string | null;
  customerIdType: CustomerIdType | null;
  customerIdTypeOther: string | null;
  customerHasEncryptedLookupMarker: boolean;
  idScanIssue: 'ID_EXPIRED' | 'UNDERAGE' | null;

  assignedResourceType: 'room' | 'locker' | null;
  assignedResourceNumber: string | null;
  checkoutAt: string | null;

  paymentIntentId: string | null;
  paymentStatus: 'DUE' | 'PAID' | null;
  paymentQuote: PaymentQuoteViewModel | null;
  paymentDeclineError: string | null;

  pastDueBlocked: boolean;
  pastDueBalance: number;
};

export const initialRegisterLaneSessionState: RegisterLaneSessionState = {
  currentSessionId: null,
  customerId: null,
  customerName: '',
  membershipNumber: '',
  customerMembershipValidUntil: null,
  membershipPurchaseIntent: null,
  membershipChoice: null,
  allowedRentals: [],
  mode: null,
  renewalHours: null,
  ledgerLineItems: [],
  ledgerTotal: null,

  agreementSigned: false,
  agreementBypassPending: false,
  agreementSignedMethod: null,

  proposedRentalType: null,
  proposedBy: null,
  selectionConfirmed: false,
  selectionConfirmedBy: null,
  selectionAcknowledged: true,

  customerSelectedType: null,
  waitlistDesiredTier: null,
  waitlistBackupType: null,

  customerPrimaryLanguage: undefined,
  customerDobMonthDay: undefined,
  customerLastVisitAt: undefined,
  customerNotes: undefined,
  customerIdExpirationDate: null,
  customerIdType: null,
  customerIdTypeOther: null,
  customerHasEncryptedLookupMarker: false,
  idScanIssue: null,

  assignedResourceType: null,
  assignedResourceNumber: null,
  checkoutAt: null,

  paymentIntentId: null,
  paymentStatus: null,
  paymentQuote: null,
  paymentDeclineError: null,

  pastDueBlocked: false,
  pastDueBalance: 0,
};

type RegisterLaneSessionAction =
  | {
      type: 'start_or_replace';
      payload: {
        sessionId?: string | null;
        customerId?: string | null;
        customerName?: string;
        membershipNumber?: string;
      };
    }
  | { type: 'patch'; payload: Partial<RegisterLaneSessionState> }
  | { type: 'apply_session_updated'; payload: SessionUpdatedPayload }
  | {
      type: 'apply_selection_proposed';
      payload: { rentalType: string; proposedBy: 'CUSTOMER' | 'EMPLOYEE' };
    }
  | {
      type: 'apply_selection_locked';
      payload: { rentalType: string; confirmedBy: 'CUSTOMER' | 'EMPLOYEE' };
    }
  | { type: 'apply_selection_forced'; payload: { rentalType: string } }
  | { type: 'selection_acknowledged' }
  | { type: 'reset_cleared' }
  | { type: 'set_payment_decline_error'; payload: string | null };

type SessionUpdatedPayloadExtras = SessionUpdatedPayload & {
  selectionAcknowledged?: boolean;
  customerSelectedType?: string | null;
};

export function registerLaneSessionReducer(
  state: RegisterLaneSessionState,
  action: RegisterLaneSessionAction
): RegisterLaneSessionState {
  switch (action.type) {
    case 'start_or_replace': {
      const next = { ...state };
      if (action.payload.sessionId !== undefined)
        next.currentSessionId = action.payload.sessionId || null;
      if (action.payload.customerId !== undefined)
        next.customerId = action.payload.customerId || null;
      if (action.payload.customerName !== undefined)
        next.customerName = action.payload.customerName || '';
      if (action.payload.membershipNumber !== undefined)
        next.membershipNumber = action.payload.membershipNumber || '';
      return next;
    }
    case 'patch':
      return { ...state, ...action.payload };
    case 'apply_session_updated': {
      const p = action.payload as SessionUpdatedPayloadExtras;
      const hasKey = (key: keyof SessionUpdatedPayloadExtras) =>
        Object.prototype.hasOwnProperty.call(p, key);

      if (p.status === 'COMPLETED' && (!p.customerName || p.customerName === '')) {
        return { ...initialRegisterLaneSessionState };
      }

      const sessionIdChanged =
        typeof p.sessionId === 'string' && p.sessionId && p.sessionId !== state.currentSessionId;

      const next: RegisterLaneSessionState = sessionIdChanged
        ? { ...initialRegisterLaneSessionState }
        : { ...state };

      if (p.sessionId !== undefined) next.currentSessionId = p.sessionId || null;
      if (p.customerName !== undefined) next.customerName = p.customerName || '';
      if (p.membershipNumber !== undefined) next.membershipNumber = p.membershipNumber || '';
      if (p.customerMembershipValidUntil !== undefined) {
        next.customerMembershipValidUntil = p.customerMembershipValidUntil || null;
      }
      if (Array.isArray(p.allowedRentals)) next.allowedRentals = p.allowedRentals;

      if (p.agreementSigned !== undefined) next.agreementSigned = Boolean(p.agreementSigned);
      if (p.agreementBypassPending !== undefined) {
        next.agreementBypassPending = Boolean(p.agreementBypassPending);
      }
      if (p.agreementSignedMethod !== undefined) {
        next.agreementSignedMethod = p.agreementSignedMethod ?? null;
      }

      if (hasKey('proposedRentalType')) next.proposedRentalType = p.proposedRentalType ?? null;
      if (hasKey('proposedBy')) next.proposedBy = p.proposedBy ?? null;
      if (hasKey('selectionConfirmed')) next.selectionConfirmed = Boolean(p.selectionConfirmed);
      if (hasKey('selectionConfirmedBy')) {
        next.selectionConfirmedBy = p.selectionConfirmedBy ?? null;
      }

      if (hasKey('paymentIntentId')) next.paymentIntentId = p.paymentIntentId ?? null;
      if (hasKey('paymentStatus')) next.paymentStatus = p.paymentStatus ?? null;

      if (p.paymentLineItems !== undefined || p.paymentTotal !== undefined) {
        const lineItems = Array.isArray(p.paymentLineItems)
          ? p.paymentLineItems
          : (next.paymentQuote?.lineItems ?? []);
        const total =
          typeof p.paymentTotal === 'number' ? p.paymentTotal : (next.paymentQuote?.total ?? 0);
        if (lineItems.length > 0 || typeof p.paymentTotal === 'number') {
          next.paymentQuote = {
            total,
            lineItems,
            messages: next.paymentQuote?.messages ?? [],
          };
        }
      }

      if (hasKey('assignedResourceType')) {
        next.assignedResourceType = p.assignedResourceType ?? null;
      }
      if (hasKey('assignedResourceNumber')) {
        next.assignedResourceNumber = p.assignedResourceNumber ?? null;
      }
      if (hasKey('checkoutAt')) next.checkoutAt = p.checkoutAt ?? null;

      if (hasKey('customerPrimaryLanguage')) {
        next.customerPrimaryLanguage = p.customerPrimaryLanguage;
      }

      if (hasKey('waitlistDesiredType')) {
        next.waitlistDesiredTier = p.waitlistDesiredType ?? null;
      }
      if (hasKey('backupRentalType')) {
        next.waitlistBackupType = p.backupRentalType ?? null;
      }

      if (hasKey('membershipChoice')) next.membershipChoice = p.membershipChoice ?? null;
      if (hasKey('membershipPurchaseIntent')) {
        next.membershipPurchaseIntent = p.membershipPurchaseIntent ?? null;
      }

      if (sessionIdChanged) {
        next.selectionAcknowledged = false;
      } else if (p.selectionAcknowledged !== undefined) {
        next.selectionAcknowledged = Boolean(p.selectionAcknowledged);
      }

      if (p.customerSelectedType !== undefined) {
        next.customerSelectedType = p.customerSelectedType || null;
      }
      if (p.customerDobMonthDay !== undefined) {
        next.customerDobMonthDay = p.customerDobMonthDay || undefined;
      }
      if (p.customerLastVisitAt !== undefined) {
        next.customerLastVisitAt = p.customerLastVisitAt || undefined;
      }
      if (p.customerNotes !== undefined) {
        next.customerNotes = p.customerNotes || undefined;
      }
      if (p.customerIdExpirationDate !== undefined) {
        next.customerIdExpirationDate = p.customerIdExpirationDate || null;
      }
      if (p.customerIdType !== undefined) {
        next.customerIdType = p.customerIdType ?? null;
      }
      if (p.customerIdTypeOther !== undefined) {
        next.customerIdTypeOther = p.customerIdTypeOther || null;
      }
      if (p.customerHasEncryptedLookupMarker !== undefined) {
        next.customerHasEncryptedLookupMarker = Boolean(p.customerHasEncryptedLookupMarker);
      }
      if (p.idScanIssue !== undefined) {
        next.idScanIssue = p.idScanIssue ?? null;
      }

      if (p.pastDueBlocked !== undefined) next.pastDueBlocked = Boolean(p.pastDueBlocked);
      if (p.pastDueBalance !== undefined) {
        const balance = Number(p.pastDueBalance);
        next.pastDueBalance = Number.isFinite(balance) ? balance : 0;
      }

      if (p.mode !== undefined) next.mode = p.mode ?? null;
      if (p.renewalHours !== undefined) {
        next.renewalHours = p.renewalHours === 2 || p.renewalHours === 6 ? p.renewalHours : null;
      }
      if (p.ledgerLineItems !== undefined) {
        next.ledgerLineItems = Array.isArray(p.ledgerLineItems) ? p.ledgerLineItems : [];
      }
      if (p.ledgerTotal !== undefined) {
        next.ledgerTotal =
          typeof p.ledgerTotal === 'number' && Number.isFinite(p.ledgerTotal)
            ? p.ledgerTotal
            : null;
      }

      return next;
    }
    case 'apply_selection_proposed':
      return {
        ...state,
        proposedRentalType: action.payload.rentalType,
        proposedBy: action.payload.proposedBy,
      };
    case 'apply_selection_locked':
      return {
        ...state,
        selectionConfirmed: true,
        selectionConfirmedBy: action.payload.confirmedBy,
        customerSelectedType: action.payload.rentalType,
        selectionAcknowledged: true,
      };
    case 'apply_selection_forced':
      return {
        ...state,
        selectionConfirmed: true,
        selectionConfirmedBy: 'EMPLOYEE',
        customerSelectedType: action.payload.rentalType,
        selectionAcknowledged: true,
      };
    case 'selection_acknowledged':
      return { ...state, selectionAcknowledged: true };
    case 'reset_cleared':
      return { ...initialRegisterLaneSessionState };
    case 'set_payment_decline_error':
      return { ...state, paymentDeclineError: action.payload };
    default:
      return state;
  }
}
