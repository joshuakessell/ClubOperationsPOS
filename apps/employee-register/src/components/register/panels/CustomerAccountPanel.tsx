import type { CheckinStage, CustomerProfileCardProps } from '../CustomerProfileCard';
import { CustomerProfileCard } from '../CustomerProfileCard';
import { EmployeeAssistPanel } from '../EmployeeAssistPanel';
import { useEffect, useState } from 'react';
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

  const [showAddCustomerNote, setShowAddCustomerNote] = useState(false);
  const [customerNoteText, setCustomerNoteText] = useState('');
  const [customerNoteImportant, setCustomerNoteImportant] = useState(false);

  // Load notes + spend ledger when customer changes.
  useEffect(() => {
    if (!props.customerId) return;
    void customerNotesState.loadNotes(props.customerId);
    void customerSpendLedgerState.loadSpendLedger(props.customerId);
  }, [props.customerId, customerNotesState, customerSpendLedgerState]);

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
              <div
                style={{
                  minHeight: '14rem',
                  maxHeight: '22rem',
                  overflowY: 'auto',
                  paddingRight: '0.2rem',
                }}
              >
                {renderProfileCard(null)}
              </div>

              <div className="cs-liquid-card" style={{ padding: '0.85rem', overflow: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontWeight: 900 }}>Notes</div>
                  <button
                    type="button"
                    className="cs-liquid-button cs-liquid-button--secondary"
                    onClick={() => setShowAddCustomerNote(true)}
                  >
                    Add Note
                  </button>
                </div>

                {customerNotesState.getError(props.customerId) ? (
                  <div style={{ marginTop: '0.5rem', color: '#fecaca', fontWeight: 800 }}>
                    {customerNotesState.getError(props.customerId)}
                  </div>
                ) : null}

                {customerNotesState.isLoading(props.customerId) ? (
                  <div style={{ marginTop: '0.5rem', color: '#94a3b8', fontWeight: 800 }}>
                    Loading notes…
                  </div>
                ) : customerNotesState.getNotes(props.customerId).length === 0 ? (
                  <div style={{ marginTop: '0.5rem', color: '#94a3b8', fontWeight: 800 }}>
                    No notes.
                  </div>
                ) : (
                  <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.5rem' }}>
                    {[...customerNotesState.getNotes(props.customerId)]
                      .sort((a, b) => Number(b.isImportant) - Number(a.isImportant))
                      .map((n) => (
                        <div
                          key={n.id}
                          style={{
                            border: '1px solid rgba(148, 163, 184, 0.15)',
                            borderRadius: 10,
                            padding: '0.6rem',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '0.75rem',
                              marginBottom: '0.25rem',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                              {n.isImportant ? (
                                <span aria-hidden="true" style={{ color: '#ef4444', fontWeight: 900 }}>
                                  ⚑
                                </span>
                              ) : null}
                              <div style={{ fontWeight: n.isImportant ? 950 : 850 }}>
                                {n.createdByStaffName}
                              </div>
                            </div>
                            <div className="er-text-xs" style={{ color: '#94a3b8', fontWeight: 800 }}>
                              {new Date(n.createdAt).toLocaleString()}
                            </div>
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap', fontWeight: n.isImportant ? 900 : 800 }}>
                            {n.note}
                          </div>
                        </div>
                      ))}
                  </div>
                )}

                {showAddCustomerNote ? (
                  <div
                    style={{
                      marginTop: '0.75rem',
                      borderTop: '1px solid rgba(148, 163, 184, 0.15)',
                      paddingTop: '0.75rem',
                      display: 'grid',
                      gap: '0.5rem',
                    }}
                  >
                    <textarea
                      value={customerNoteText}
                      onChange={(e) => setCustomerNoteText(e.target.value)}
                      placeholder="Add a note…"
                      style={{
                        width: '100%',
                        minHeight: 80,
                        borderRadius: 10,
                        padding: '0.6rem',
                        border: '1px solid rgba(148, 163, 184, 0.25)',
                        background: 'rgba(15, 23, 42, 0.35)',
                        color: '#e2e8f0',
                        fontWeight: 800,
                      }}
                    />
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 900 }}>
                      <input
                        type="checkbox"
                        checked={customerNoteImportant}
                        onChange={(e) => setCustomerNoteImportant(e.target.checked)}
                      />
                      Important
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button
                        type="button"
                        className="cs-liquid-button"
                        onClick={() => {
                          void (async () => {
                            await customerNotesState.createNote(
                              props.customerId,
                              customerNoteText,
                              customerNoteImportant
                            );
                            setCustomerNoteText('');
                            setCustomerNoteImportant(false);
                            setShowAddCustomerNote(false);
                          })();
                        }}
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        className="cs-liquid-button cs-liquid-button--secondary"
                        onClick={() => setShowAddCustomerNote(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="cs-liquid-card" style={{ padding: '0.85rem', overflow: 'auto' }}>
                <div style={{ fontWeight: 900, marginBottom: '0.5rem' }}>Spending</div>
                {customerSpendLedgerState.isLoading(props.customerId) ? (
                  <div style={{ color: '#94a3b8', fontWeight: 800 }}>Loading spend ledger…</div>
                ) : customerSpendLedgerState.getGroups(props.customerId).length === 0 ? (
                  <div style={{ color: '#94a3b8', fontWeight: 800 }}>No spend ledger entries.</div>
                ) : (
                  <div style={{ display: 'grid', gap: '0.5rem' }}>
                    {customerSpendLedgerState.getGroups(props.customerId).map((g) => (
                      <details
                        key={g.visitId ?? 'unassigned'}
                        onToggle={(e) => {
                          const open = (e.target as HTMLDetailsElement).open;
                          if (!open) return;
                          customerSpendLedgerState
                            .loadVisitLedger(props.customerId, g.visitId)
                            .catch(() => undefined);
                        }}
                      >
                        <summary style={{ cursor: 'pointer', fontWeight: 900 }}>
                          {g.visitStartedAt
                            ? new Date(g.visitStartedAt).toLocaleString()
                            : g.visitId
                              ? `Visit ${g.visitId.slice(0, 8)}`
                              : 'Unassigned'}
                          {` — Net $${(g.netCents / 100).toFixed(2)}`}
                        </summary>
                        <div style={{ marginTop: '0.5rem', display: 'grid', gap: '0.35rem' }}>
                          {customerSpendLedgerState
                            .getVisitEntries(props.customerId, g.visitId)
                            .map((e) => (
                              <div
                                key={e.id}
                                style={{
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  gap: '0.75rem',
                                  fontWeight: 850,
                                }}
                              >
                                <div style={{ color: '#cbd5e1' }}>{e.summary}</div>
                                <div style={{ color: e.amountCents < 0 ? '#fca5a5' : '#86efac' }}>
                                  {(e.amountCents < 0 ? '-' : '') + `$${(Math.abs(e.amountCents) / 100).toFixed(2)}`}
                                </div>
                              </div>
                            ))}
                        </div>
                      </details>
                    ))}
                  </div>
                )}
              </div>

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
