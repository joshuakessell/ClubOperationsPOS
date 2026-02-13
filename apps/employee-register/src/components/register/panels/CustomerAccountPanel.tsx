import type { CheckinStage, CustomerProfileCardProps } from '../CustomerProfileCard';
import { CustomerProfileCard } from '../CustomerProfileCard';
import { EmployeeAssistPanel } from '../EmployeeAssistPanel';
import { CustomerAccountDetailsCard } from './CustomerAccountDetailsCard';
import { useEffect } from 'react';
import { useStartLaneCheckinForCustomerIfNotVisiting } from '../../../app/useStartLaneCheckinForCustomerIfNotVisiting';
import { PanelHeader } from '../../../views/PanelHeader';
import { PanelShell } from '../../../views/PanelShell';
import { ActiveVisitSummary } from './ActiveVisitSummary';
import { useEmployeeRegisterState } from '../../../app/state/useEmployeeRegisterState';
import type { ActiveCheckinDetails } from '../modals/AlreadyCheckedInModal';
import type { WaitlistUnavailableOptions } from '../employee-assist/types';
type CustomerProfile = Pick<
  CustomerProfileCardProps,
  | 'name'
  | 'preferredLanguage'
  | 'dob'
  | 'dobMonthDay'
  | 'idNumber'
  | 'idExpirationDate'
  | 'idType'
  | 'idTypeOther'
  | 'membershipNumber'
  | 'membershipValidUntil'
  | 'lastVisitAt'
  | 'hasEncryptedLookupMarker'
>;
export function CustomerAccountPanel(props: {
  lane: string;
  sessionToken: string | null | undefined;
  customerId: string;
  customerLabel?: string | null;
  customerSummary?: {
    name?: string;
    dobMonthDay?: string;
    membershipNumber?: string;
  } | null;
  customerProfile?: CustomerProfile | null;
  autoStartCheckin?: boolean;
  onStartCheckout: (prefill?: { number?: string | null }) => void;
  onClearSession: () => void;
  // lane session state (server-authoritative via WS)
  currentSessionId: string | null;
  currentSessionCustomerId: string | null;
  customerName: string;
  membershipNumber: string;
  customerMembershipValidUntil: string | null;
  membershipPurchaseIntent: 'PURCHASE' | 'RENEW' | null;
  membershipChoice: 'ONE_TIME' | 'SIX_MONTH' | null;
  allowedRentals: string[];
  proposedRentalType: string | null;
  proposedBy: 'CUSTOMER' | 'EMPLOYEE' | null;
  selectionConfirmed: boolean;
  customerPrimaryLanguage: 'EN' | 'ES' | undefined;
  customerDob: string | null;
  customerDobMonthDay: string | undefined;
  customerIdNumber: string | null;
  customerLastVisitAt: string | undefined;
  customerIdExpirationDate: string | null;
  customerIdType: 'STATE_ID' | 'DRIVERS_LICENSE' | 'PASSPORT' | 'OTHER' | null;
  customerIdTypeOther: string | null;
  hasEncryptedLookupMarker: boolean;
  waitlistDesiredTier: string | null;
  waitlistDesiredTypes?: Array<'STANDARD' | 'DOUBLE' | 'SPECIAL'>;
  waitlistBackupType: string | null;
  waitlistRequestedResourceNumber?: string | null;
  waitlistRequestedResourceType?: 'room' | 'locker' | null;
  inventoryAvailable: null | { rooms: Record<string, number>; lockers: number };
  waitlistUnavailableOptions?: WaitlistUnavailableOptions;
  isSubmitting: boolean;
  checkinStage: CheckinStage | null;
  sessionMode?: 'CHECKIN' | 'RENEWAL';
  renewalHours?: 2 | 6 | null;
  directSelect?: boolean;
  onDirectSelectRental?: (rental: 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL') => void;
  onDirectSelectWaitlistBackup?: (
    rental: 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL'
  ) => void;
  onStartRenewal?: (activeCheckin: ActiveCheckinDetails) => void;
  onGoBack?: () => void;
  onRefetchAccountState?: () => void;

  // callbacks to apply immediate REST response (WS will still be source-of-truth)
  onStartedSession: (payload: {
    sessionId?: string;
    customerName?: string;
    membershipNumber?: string;
    mode?: 'CHECKIN' | 'RENEWAL';
    blockEndsAt?: string;
    renewalHours?: 2 | 6;
    activeAssignedResourceType?: 'room' | 'locker';
    activeAssignedResourceNumber?: string;
    customerHasEncryptedLookupMarker?: boolean;
  }) => void;

  // employee-side lane actions
  onHighlightLanguage: (lang: 'EN' | 'ES' | null) => void;
  onConfirmLanguage: (lang: 'EN' | 'ES') => void;
  onHighlightMembership: (choice: 'ONE_TIME' | 'SIX_MONTH' | null) => void;
  onConfirmMembershipOneTime: () => void;
  onConfirmMembershipSixMonth: () => void;
  onHighlightRental: (
    rental: 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null
  ) => void;
  onSelectRentalAsCustomer: (rental: 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL') => void;
  onHighlightWaitlistBackup: (
    rental: 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null
  ) => void;
  onSelectWaitlistBackupAsCustomer: (
    rental: 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL',
    options?: {
      waitlistDesiredTypes?: Array<'STANDARD' | 'DOUBLE' | 'SPECIAL'>;
      waitlistRequestedResourceNumber?: string | null;
      waitlistRequestedResourceType?: 'room' | 'locker' | null;
    }
  ) => void;
  onApproveRental: () => void;
}) {
  const registerState = useEmployeeRegisterState();
  const customerNotesState = registerState.customerNotesState;
  const customerSpendLedgerState = registerState.customerSpendLedgerState;

  // Load notes + spend ledger when customer changes.
  // Guarded to avoid repeated retries/spam when requests fail.
  useEffect(() => {
    if (!props.customerId) return;
    if (!props.sessionToken) return;
    if (customerNotesState.isLoading(props.customerId)) return;
    if (customerSpendLedgerState.isLoading(props.customerId)) return;
    if (customerNotesState.getNotes(props.customerId).length > 0) return;
    if (customerNotesState.getError(props.customerId)) return;
    if (customerSpendLedgerState.getGroups(props.customerId).length > 0) return;
    if (customerSpendLedgerState.getError(props.customerId)) return;

    void customerNotesState.loadNotes(props.customerId);
    void customerSpendLedgerState.loadSpendLedger(props.customerId);
  }, [
    props.customerId,
    props.sessionToken,
    customerNotesState,
    customerSpendLedgerState,
  ]);

  const { state, retry, start, hasAttemptedStart } = useStartLaneCheckinForCustomerIfNotVisiting({
    lane: props.lane,
    sessionToken: props.sessionToken,
    customerId: props.customerId,
    currentLaneSession: {
      currentSessionId: props.currentSessionId,
      customerId: props.currentSessionCustomerId,
    },
    autoStart: props.autoStartCheckin,
    onStarted: props.onStartedSession,
  });
  const hasActiveSession =
    Boolean(props.currentSessionId) &&
    (!props.currentSessionCustomerId || props.currentSessionCustomerId === props.customerId);
  const hasSelectedCustomerProfile = Boolean(props.customerId);
  const profile = props.customerProfile;
  const fallbackName = profile?.name || props.customerSummary?.name || props.customerLabel || '—';
  const fallbackDob = profile?.dobMonthDay ?? props.customerSummary?.dobMonthDay ?? null;
  const fallbackMembership = profile?.membershipNumber ?? props.customerSummary?.membershipNumber ?? null;
  const displayName = props.customerName || fallbackName;
  const displayDob = props.customerDobMonthDay || fallbackDob;
  const displayMembership = props.membershipNumber || fallbackMembership;
  const showManualStart = !hasActiveSession && props.autoStartCheckin === false;
  const manualStartPending = showManualStart && state.isStarting;
  const showGoBack =
    state.mode === 'ERROR' &&
    (state.errorCode === 'UNDERAGE' || state.errorCode === 'ID_EXPIRED');
  const renderProfileCard = (footer: JSX.Element | null) => (
    <CustomerProfileCard
      name={displayName}
      preferredLanguage={props.customerPrimaryLanguage || profile?.preferredLanguage || null}
      dob={props.customerDob || profile?.dob || null}
      dobMonthDay={displayDob}
      idNumber={props.customerIdNumber || profile?.idNumber || null}
      idExpirationDate={props.customerIdExpirationDate || profile?.idExpirationDate || null}
      idType={props.customerIdType || profile?.idType || null}
      idTypeOther={props.customerIdTypeOther || profile?.idTypeOther || null}
      membershipNumber={displayMembership}
      membershipValidUntil={props.customerMembershipValidUntil || profile?.membershipValidUntil || null}
      lastVisitAt={props.customerLastVisitAt || profile?.lastVisitAt || null}
      hasEncryptedLookupMarker={Boolean(props.hasEncryptedLookupMarker || profile?.hasEncryptedLookupMarker)}
      checkinStage={hasActiveSession ? props.checkinStage : null}
      waitlistDesiredTier={hasActiveSession ? props.waitlistDesiredTier : null}
      waitlistBackupType={hasActiveSession ? props.waitlistBackupType : null}
      footer={footer ?? undefined}
    />
  );
  const beginCheckinButton = (
    <button
      type="button"
      className="cs-liquid-button"
      onClick={start}
      disabled={manualStartPending}
      style={{ width: '100%', maxWidth: 320, padding: '0.7rem', fontWeight: 900 }}
    >
      {manualStartPending ? 'Starting Check-in…' : 'Start Checkin'}
    </button>
  );
  const headerAction = props.customerLabel ? (
    <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
      {props.customerLabel}
    </div>
  ) : null;
  return (
    <PanelShell align="top" scroll="hidden">
      <PanelHeader title="Customer Account" spacing="none" action={headerAction} />
      {state.mode === 'ALREADY_VISITING' ? (
        <div
          className="er-account-already-visiting"
          style={{ marginTop: '0.75rem', display: 'grid', gap: '0.75rem' }}
        >
          <div
            className="cs-liquid-card"
            style={{
              padding: '0.85rem',
              border: '1px solid rgba(34, 197, 94, 0.35)',
              background: 'rgba(34, 197, 94, 0.10)',
            }}
          >
            <div style={{ fontWeight: 950, marginBottom: '0.35rem' }}>Currently Checked In</div>
            <div
              className="er-text-sm"
              style={{ color: '#cbd5e1', fontWeight: 700, lineHeight: 1.45 }}
            >
              This customer already has an active visit.
            </div>
          </div>
          <div className="cs-liquid-card" style={{ padding: '0.85rem' }}>
            <ActiveVisitSummary
              activeCheckin={state.activeCheckin}
              sessionToken={props.sessionToken}
              onStartCheckout={props.onStartCheckout}
              onStartRenewal={props.onStartRenewal}
              onRefetch={props.onRefetchAccountState ?? (() => retry())}
            />
          </div>
        </div>
      ) : state.mode === 'ERROR' ? (
        <div style={{ marginTop: '0.75rem' }}>
          <div
            className="cs-liquid-card"
            style={{
              padding: '0.85rem',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#fecaca',
              fontWeight: 800,
            }}
          >
            {state.errorMessage}
          </div>
          <button
            type="button"
            onClick={() => {
              if (showGoBack && props.onGoBack) {
                props.onGoBack();
                return;
              }
              retry();
            }}
            className="cs-liquid-button"
            style={{ marginTop: '0.75rem', width: '100%', padding: '0.75rem', fontWeight: 900 }}
          >
            {showGoBack ? 'Go Back' : 'Retry'}
          </button>
        </div>
      ) : (
        <div
          style={{
            marginTop: '0.75rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            minHeight: 0,
          }}
        >
          {hasActiveSession ? (
            <>
              <CustomerAccountDetailsCard
                customerId={props.customerId}
                profileCard={renderProfileCard(null)}
                customerNotesState={customerNotesState}
                customerSpendLedgerState={customerSpendLedgerState}
              />

              <div className="cs-liquid-card" style={{ padding: '0.85rem', maxHeight: '12rem', overflow: 'auto' }}>
                <EmployeeAssistPanel
                  sessionId={props.currentSessionId!}
                  customerName={props.customerName}
                  customerPrimaryLanguage={props.customerPrimaryLanguage}
                  membershipNumber={props.membershipNumber || null}
                  customerMembershipValidUntil={props.customerMembershipValidUntil}
                  membershipPurchaseIntent={props.membershipPurchaseIntent}
                  membershipChoice={props.membershipChoice}
                  allowedRentals={props.allowedRentals}
                  proposedRentalType={props.proposedRentalType}
                  proposedBy={props.proposedBy}
                  selectionConfirmed={props.selectionConfirmed}
                  waitlistDesiredTier={props.waitlistDesiredTier}
                  waitlistDesiredTypes={props.waitlistDesiredTypes}
                  waitlistBackupType={props.waitlistBackupType}
                  waitlistRequestedResourceNumber={props.waitlistRequestedResourceNumber}
                  waitlistRequestedResourceType={props.waitlistRequestedResourceType}
                  inventoryAvailable={props.inventoryAvailable}
                  waitlistUnavailableOptions={props.waitlistUnavailableOptions}
                  isSubmitting={props.isSubmitting}
                  directSelect={props.directSelect}
                  onHighlightLanguage={props.onHighlightLanguage}
                  onConfirmLanguage={props.onConfirmLanguage}
                  onHighlightMembership={props.onHighlightMembership}
                  onConfirmMembershipOneTime={props.onConfirmMembershipOneTime}
                  onConfirmMembershipSixMonth={props.onConfirmMembershipSixMonth}
                  onHighlightRental={props.onHighlightRental}
                  onSelectRentalAsCustomer={props.onSelectRentalAsCustomer}
                  onDirectSelectRental={props.onDirectSelectRental}
                  onHighlightWaitlistBackup={props.onHighlightWaitlistBackup}
                  onSelectWaitlistBackupAsCustomer={props.onSelectWaitlistBackupAsCustomer}
                  onClearSession={props.onClearSession}
                  onDirectSelectWaitlistBackup={props.onDirectSelectWaitlistBackup}
                  onApproveRental={props.onApproveRental}
                />
              </div>
            </>
          ) : showManualStart ? (
            <>
              {renderProfileCard(beginCheckinButton)}
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
                {hasAttemptedStart
                  ? 'Waiting for the customer kiosk to begin check-in…'
                  : 'Review the customer details, then start the check-in.'}
              </div>
            </>
          ) : hasSelectedCustomerProfile ? (
            <>
              {renderProfileCard(beginCheckinButton)}
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
                {state.isStarting
                  ? 'Starting check-in…'
                  : 'Syncing lane session… customer account is loaded.'}
              </div>
            </>
          ) : (
            <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
              {state.isStarting ? 'Starting check-in…' : 'Waiting for lane session…'}
            </div>
          )}
        </div>
      )}
    </PanelShell>
  );
}
