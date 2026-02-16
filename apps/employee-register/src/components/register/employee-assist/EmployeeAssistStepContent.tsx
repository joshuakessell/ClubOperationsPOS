import { useEffect, useMemo, useState } from 'react';
import type {
  EmployeeAssistStep,
  MembershipOption,
  Pending,
  PendingState,
  RentalButton,
  RentalOption,
  WaitlistUnavailableOptions,
} from './types';
import { remainingCountLabel } from './utils';

type Props = {
  step: EmployeeAssistStep;
  directSelect: boolean;
  isSubmitting: boolean;
  pending: PendingState;
  setPending: (next: PendingState) => void;
  showSixMonthMembershipAdd?: boolean;
  waitlistDesiredTier?: string | null;
  waitlistDesiredTypes?: Array<'STANDARD' | 'DOUBLE' | 'SPECIAL'>;
  waitlistRequestedResourceNumber?: string | null;
  waitlistRequestedResourceType?: 'room' | 'locker' | null;
  waitlistUnavailableOptions?: WaitlistUnavailableOptions;
  rentalButtons: RentalButton[];
  waitlistBackupButtons: RentalButton[];
  // Payment step
  ledgerLineItems?: Array<{ description: string; amount: number }>;
  ledgerTotal?: number | null;
  paymentStatus?: 'DUE' | 'PAID' | null;
  // Agreement step
  agreementBypassPending?: boolean;
  assignedResourceType?: 'room' | 'locker' | null;
  assignedResourceNumber?: string | null;
  inventoryAvailable?: { rooms: Record<string, number>; lockers: number } | null;
  proposedRentalType?: string | null;
  onBypassAgreement?: () => Promise<void> | void;
  // Existing callbacks
  onHighlightMembership: (choice: MembershipOption | null) => void;
  onConfirmMembershipSixMonth: () => Promise<void> | void;
  onHighlightRental: (rental: RentalOption | null) => Promise<void> | void;
  onApproveRental: () => Promise<void> | void;
  onDirectSelectRental?: (rental: RentalOption) => Promise<void> | void;
  onHighlightWaitlistBackup: (rental: RentalOption | null) => void;
  onSelectWaitlistBackupAsCustomer: (
    rental: RentalOption,
    options?: {
      waitlistDesiredTypes?: Array<'STANDARD' | 'DOUBLE' | 'SPECIAL'>;
      waitlistRequestedResourceNumber?: string | null;
      waitlistRequestedResourceType?: 'room' | 'locker' | null;
    }
  ) => Promise<void> | void;
  onSelectRentalAsCustomer: (rental: RentalOption) => Promise<void> | void;
  onDirectSelectWaitlistBackup?: (rental: RentalOption) => Promise<void> | void;
};

export function EmployeeAssistStepContent({
  step,
  directSelect,
  isSubmitting,
  pending,
  setPending,
  waitlistDesiredTier,
  waitlistDesiredTypes,
  waitlistRequestedResourceNumber,
  waitlistRequestedResourceType,
  waitlistUnavailableOptions,
  showSixMonthMembershipAdd = true,
  rentalButtons,
  waitlistBackupButtons,
  ledgerLineItems,
  ledgerTotal,
  paymentStatus,
  agreementBypassPending,
  assignedResourceType,
  assignedResourceNumber,
  inventoryAvailable,
  proposedRentalType,
  onBypassAgreement,
  onHighlightMembership,
  onConfirmMembershipSixMonth,
  onHighlightRental,
  onApproveRental,
  onDirectSelectRental,
  onHighlightWaitlistBackup,
  onSelectWaitlistBackupAsCustomer,
  onSelectRentalAsCustomer,
  onDirectSelectWaitlistBackup,
}: Props) {
  const unavailableRoomTypes = useMemo(() => {
    const types: Array<'STANDARD' | 'DOUBLE' | 'SPECIAL'> = [];
    if ((waitlistUnavailableOptions?.rooms.STANDARD.length ?? 0) > 0) types.push('STANDARD');
    if ((waitlistUnavailableOptions?.rooms.DOUBLE.length ?? 0) > 0) types.push('DOUBLE');
    if ((waitlistUnavailableOptions?.rooms.SPECIAL.length ?? 0) > 0) types.push('SPECIAL');
    return types;
  }, [waitlistUnavailableOptions]);

  const [desiredTypes, setDesiredTypes] = useState<Array<'STANDARD' | 'DOUBLE' | 'SPECIAL'>>([]);
  const [requestedResourceType, setRequestedResourceType] = useState<'room' | 'locker' | null>(null);
  const [requestedResourceNumber, setRequestedResourceNumber] = useState<string | null>(null);

  useEffect(() => {
    if (step !== 'UPGRADE') return;
    const seedFromSession = Array.isArray(waitlistDesiredTypes)
      ? waitlistDesiredTypes.filter(
        (value): value is 'STANDARD' | 'DOUBLE' | 'SPECIAL' =>
          value === 'STANDARD' || value === 'DOUBLE' || value === 'SPECIAL'
      )
      : [];
    const seedFromTier: Array<'STANDARD' | 'DOUBLE' | 'SPECIAL'> =
      waitlistDesiredTier === 'STANDARD' || waitlistDesiredTier === 'DOUBLE' || waitlistDesiredTier === 'SPECIAL'
        ? [waitlistDesiredTier]
        : [];
    const seed = seedFromSession.length > 0 ? seedFromSession : seedFromTier;
    setDesiredTypes(seed);
    setRequestedResourceType(waitlistRequestedResourceType ?? null);
    setRequestedResourceNumber(waitlistRequestedResourceNumber ?? null);
  }, [
    step,
    waitlistDesiredTier,
    waitlistDesiredTypes,
    waitlistRequestedResourceNumber,
    waitlistRequestedResourceType,
  ]);

  const specificRoomOptions = useMemo(
    () => [
      ...(waitlistUnavailableOptions?.rooms.SPECIAL ?? []),
      ...(waitlistUnavailableOptions?.rooms.DOUBLE ?? []),
      ...(waitlistUnavailableOptions?.rooms.STANDARD ?? []),
    ],
    [waitlistUnavailableOptions]
  );

  const desiredSummary = useMemo(() => {
    if (unavailableRoomTypes.length > 0 && desiredTypes.length === unavailableRoomTypes.length) {
      return 'Customer elected for the first room available.';
    }
    if (desiredTypes.length > 0) {
      const labels = desiredTypes.map((tier) =>
        tier === 'STANDARD'
          ? 'Private Dressing Room'
          : tier === 'DOUBLE'
            ? 'Double Dressing Room'
            : 'Special Dressing Room'
      );
      return `Customer selected ${labels.join(', ')}. Choose a backup rental.`;
    }
    if (requestedResourceNumber) {
      return `Customer requested specific ${requestedResourceType ?? 'room'} ${requestedResourceNumber}. Choose a backup rental.`;
    }
    return 'Customer selected a waitlist preference. Choose a backup rental.';
  }, [desiredTypes, requestedResourceNumber, requestedResourceType, unavailableRoomTypes.length]);

  const runTwoStep = (
    stepKey: Pending['step'],
    option: Pending['option'],
    isPending: boolean,
    onFirst: () => void,
    onSecond: () => void,
    onCancel?: () => void
  ) => {
    if (isSubmitting) return;
    if (isPending) {
      setPending(null);
      onCancel?.();
      void onSecond();
      return;
    }
    setPending({ step: stepKey, option } as Pending);
    void onFirst();
  };



  if (step === 'UPGRADE') {
    return (
      <div style= {{ display: 'grid', gap: '0.75rem' }
  }>
    <div className="er-text-sm" style = {{ color: '#94a3b8', fontWeight: 800 }
}>
  { directSelect? `Select a backup rental for ${waitlistDesiredTier}.` : desiredSummary}
</div>

{
  !directSelect ? (
    <div style= {{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }
}>
  <div className="cs-liquid-card" style = {{ padding: '0.75rem' }}>
    <div className="er-text-sm" style = {{ color: '#94a3b8', fontWeight: 900, marginBottom: '0.45rem' }}>
      Stand - by room types
        </div>
        < div style = {{ display: 'grid', gap: '0.45rem' }}>
        {
          unavailableRoomTypes.map((tier) => {
            const checked = desiredTypes.includes(tier);
            const label =
              tier === 'STANDARD'
                ? 'Private Dressing Room'
                : tier === 'DOUBLE'
                  ? 'Double Dressing Room'
                  : 'Special Dressing Room';
            return (
              <label key= { tier } style = {{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }
          }>
          <input
                        type="checkbox"
                        checked = { checked }
                        onChange = {(event) => {
            setDesiredTypes((prev) => {
            const next = new Set(prev);
            if(event.target.checked) next.add(tier);
          else next.delete(tier);
          return Array.from(next);
        });
if (event.target.checked && requestedResourceNumber) {
  setRequestedResourceType(null);
  setRequestedResourceNumber(null);
}
                        }}
disabled = { isSubmitting }
  />
  <span>{ label } </span>
  </label>
                  );
                })}
</div>
  </div>

  < div className = "cs-liquid-card" style = {{ padding: '0.75rem' }}>
    <div className="er-text-sm" style = {{ color: '#94a3b8', fontWeight: 900, marginBottom: '0.45rem' }}>
      Specific unavailable room
        </div>
        < select
className = "cs-liquid-input"
value = { requestedResourceNumber? `${requestedResourceType ?? 'room'}:${requestedResourceNumber}` : ''}
onChange = {(event) => {
  const value = event.target.value;
  if (!value) {
    setRequestedResourceType(null);
    setRequestedResourceNumber(null);
    return;
  }
  const [resourceType, resourceNumber] = value.split(':', 2);
  setRequestedResourceType(resourceType === 'locker' ? 'locker' : 'room');
  setRequestedResourceNumber(resourceNumber || null);
  if (resourceNumber) setDesiredTypes([]);
}}
disabled = { isSubmitting }
  >
  <option value="" > Select a specific number(optional) </option>
{
  specificRoomOptions.length > 0 ? (
    <optgroup label= "Rooms" >
    {
      specificRoomOptions.map((room) => (
        <option key= {`room-${room.number}`} value = {`room:${room.number}`
}>
  { room.number }
  </option>
                    ))}
</optgroup>
                ) : null}
{
  (waitlistUnavailableOptions?.lockers.length ?? 0) > 0 ? (
    <optgroup label= "Lockers" >
    {(waitlistUnavailableOptions?.lockers ?? []).map((locker) => (
      <option key= {`locker-${locker.number}`} value = {`locker:${locker.number}`}>
        { locker.number }
        </option>
                    ))}
</optgroup>
                ) : null}
</select>
  </div>
  </div>
        ) : null}

<div style={ { display: 'grid', gap: '0.6rem' } }>
{
  waitlistBackupButtons.filter((btn) => btn.allowed && btn.count > 0).map((btn) => {
    const isPending = pending?.step === 'WAITLIST_BACKUP' && pending.option === btn.id;
    const { label: countLabel, tone } = remainingCountLabel(btn.count);
    const disabled = isSubmitting || !btn.allowed || btn.count <= 0;
    const toneClass =
      tone === 'none'
        ? 'cs-liquid-button--secondary'
        : tone === 'low'
          ? 'cs-liquid-button--warning'
          : 'cs-liquid-button--secondary';

    return (
      <button
                key= { btn.id }
    type = "button"
    className = {
      [
        'cs-liquid-button',
        isPending ? 'cs-liquid-button--selected' : toneClass,
                ].join(' ')
    }
    disabled = { disabled }
    onClick = {() => {
      if (disabled) return;
      if (directSelect && onDirectSelectWaitlistBackup) {
        void onDirectSelectWaitlistBackup(btn.id);
        return;
      }
      runTwoStep(
        'WAITLIST_BACKUP',
        btn.id,
        isPending,
        () => onHighlightWaitlistBackup(btn.id),
        () => {
          void onSelectWaitlistBackupAsCustomer(btn.id, {
            waitlistDesiredTypes: desiredTypes,
            waitlistRequestedResourceNumber: requestedResourceNumber,
            waitlistRequestedResourceType: requestedResourceType,
          });
        },
        () => onHighlightWaitlistBackup(null)
      );
    }
  }
                style = {{
    width: '100%',
    padding: '0.85rem 1rem',
    fontWeight: 950,
    textAlign: 'left',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '0.75rem',
  }}
  >
  <span>{ btn.label } </span>
  < span
className = "er-text-sm"
style = {{
  fontWeight: 900,
    color: tone === 'none' ? '#ef4444' : tone === 'low' ? '#f59e0b' : '#94a3b8',
      whiteSpace: 'nowrap',
                  }}
                >
  { countLabel }
  </span>
  </button>
            );
          })}
</div>
  </div>
    );
  }

if (step === 'RENTAL') {
  const unavailableJoinTarget =
    rentalButtons.find((btn) => btn.allowed && btn.count === 0)?.id ?? null;
  const availableRentalButtons = rentalButtons.filter((btn) => btn.allowed && btn.count > 0);

  return (
    <div style= {{ display: 'grid', gap: '0.75rem' }
}>
  <div className="er-text-sm" style = {{ color: '#94a3b8', fontWeight: 800 }}>
    { directSelect? 'Tap once to select a rental.': 'Tap once to propose on kiosk, tap again to confirm.' }
    </div>

{
  showSixMonthMembershipAdd ? (
    <div style= {{ display: 'grid', gap: '0.6rem' }
}>
  <button
              type="button"
className = {
  [
    'cs-liquid-button',
    pending?.step === 'RENTAL_ADDON' && pending.option === 'SIX_MONTH'
      ? 'cs-liquid-button--selected'
      : 'cs-liquid-button--secondary',
              ].join(' ')
}
disabled = { isSubmitting }
onClick = {() => {
  const isPending = pending?.step === 'RENTAL_ADDON' && pending.option === 'SIX_MONTH';
  if (directSelect) {
    void onConfirmMembershipSixMonth();
    return;
  }
  runTwoStep(
    'RENTAL_ADDON',
    'SIX_MONTH',
    isPending,
    () => onHighlightMembership('SIX_MONTH'),
    () => {
      void onConfirmMembershipSixMonth();
    },
    () => onHighlightMembership(null)
  );
}}
style = {{ width: '100%', padding: '0.75rem 1rem', fontWeight: 900 }}
            >
  Add 6-Month Membership
    </button>
    </div>
        ) : null}

<div style={ { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' } }>
{
  availableRentalButtons.map((btn) => {
    const isPending = pending?.step === 'RENTAL' && pending.option === btn.id;
    const { label: countLabel, tone } = remainingCountLabel(btn.count);
    const disabled = isSubmitting || !btn.allowed || btn.count === 0;
    const spanTwo = btn.id === 'LOCKER' || btn.id === 'GYM_LOCKER' || btn.id === 'STANDARD';
    const toneClass =
      tone === 'none'
        ? 'cs-liquid-button--secondary'
        : tone === 'low'
          ? 'cs-liquid-button--warning'
          : 'cs-liquid-button--secondary';

    return (
      <button
                key= { btn.id }
    type = "button"
    className = {
      [
        'cs-liquid-button',
        isPending ? 'cs-liquid-button--selected' : toneClass,
                ].join(' ')
    }
    disabled = { disabled }
    onClick = {() => {
      if (disabled) return;
      if (directSelect && onDirectSelectRental) {
        void onDirectSelectRental(btn.id);
        return;
      }
      runTwoStep(
        'RENTAL',
        btn.id,
        isPending,
        () => {
          void onHighlightRental(btn.id);
        },
        () => {
          void onApproveRental();
        },
        () => {
          void onHighlightRental(null);
        }
      );
    }
  }
                style = {{
    width: '100%',
    padding: '0.65rem 0.85rem',
    minHeight: '3rem',
    fontWeight: 950,
    textAlign: 'left',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: '0.75rem',
    gridColumn: spanTwo ? '1 / -1' : undefined,
  }}
  >
  <span>{ btn.label } </span>
  < span
className = "er-text-sm"
style = {{
  fontWeight: 900,
    color: tone === 'none' ? '#ef4444' : tone === 'low' ? '#f59e0b' : '#94a3b8',
      whiteSpace: 'nowrap',
                  }}
                >
  { countLabel }
  </span>
  </button>
            );
          })}
</div>

{
  unavailableJoinTarget ? (
    <button
            type= "button"
            className = {
    [
      'cs-liquid-button',
      pending?.step === 'WAITLIST_JOIN' && pending.option === unavailableJoinTarget
        ? 'cs-liquid-button--staff-proposed'
        : 'cs-liquid-button--secondary',
            ].join(' ')
  }
  disabled = { isSubmitting }
  onClick = {() => {
    if (isSubmitting) return;
    if (directSelect && onDirectSelectRental) {
      void onDirectSelectRental(unavailableJoinTarget);
      return;
    }
    const isPending = pending?.step === 'WAITLIST_JOIN' && pending.option === unavailableJoinTarget;
    runTwoStep(
      'WAITLIST_JOIN',
      unavailableJoinTarget,
      isPending,
      () => {
        void onHighlightRental(unavailableJoinTarget);
      },
      () => {
        void onSelectRentalAsCustomer(unavailableJoinTarget);
      }
    );
  }
}
style = {{ width: '100%', padding: '0.65rem 0.85rem', minHeight: '3rem', fontWeight: 900 }}
          >
  Join the Waiting List
    </button>
        ) : null}
</div>
    );
  }

if (step === 'PAYMENT') {
  const items = ledgerLineItems ?? [];
  const total = ledgerTotal ?? 0;
  const paid = paymentStatus === 'PAID';

  return (
    <div style= {{ display: 'grid', gap: '0.75rem' }
}>
  <div className="er-text-sm" style = {{ color: '#94a3b8', fontWeight: 800 }}>
    Customer is reviewing payment.
        </div>

      < div className = "cs-liquid-card" style = {{ padding: '0.75rem' }}>
        <div style={ { fontWeight: 950, marginBottom: '0.5rem' } }> Ledger </div>
{
  items.length > 0 ? (
    <div style= {{ display: 'grid', gap: '0.3rem' }
}>
{
  items.map((item, index) => (
    <div
                  key= { index }
                  style = {{
    display: 'flex',
    justifyContent: 'space-between',
    fontWeight: 800,
    fontSize: '0.88rem',
  }}
  >
  <span>{ item.description } </span>
  < span > ${ (item.amount / 100).toFixed(2) } </span>
    </div>
              ))}
<div
                style={
  {
    display: 'flex',
      justifyContent: 'space-between',
        fontWeight: 950,
          fontSize: '1rem',
            borderTop: '1px solid rgba(148, 163, 184, 0.25)',
              paddingTop: '0.4rem',
                marginTop: '0.2rem',
                }
}
              >
  <span>Total </span>
  < span > ${ (total / 100).toFixed(2) } </span>
    </div>
    </div>
          ) : (
  <div className= "er-text-sm" style = {{ color: '#94a3b8', fontWeight: 700 }}>
    No line items yet.
            </div>
          )}
</div>

  < div
className = "cs-liquid-card"
style = {{
  padding: '0.65rem 0.75rem',
    border: paid
      ? '1px solid rgba(34, 197, 94, 0.35)'
      : '1px solid rgba(251, 191, 36, 0.35)',
      background: paid
        ? 'rgba(34, 197, 94, 0.08)'
        : 'rgba(251, 191, 36, 0.08)',
          }}
        >
  <div style={ { fontWeight: 900 } }>
    { paid? '✅ Payment Received': '⏳ Awaiting Payment' }
    </div>
    </div>
    </div>
    );
  }

if (step === 'AGREEMENT') {
  const resourceLabel =
    assignedResourceType && assignedResourceNumber
      ? `${assignedResourceType === 'room' ? 'Room' : 'Locker'} ${assignedResourceNumber}`
      : null;

  // Build available rooms for manual assignment based on the selected rental type
  const availableRoomsList: Array<{ type: 'room' | 'locker'; tier: string; number: string; count: number }> = [];
  if (inventoryAvailable) {
    const selectedType = proposedRentalType;
    if (selectedType === 'LOCKER' || selectedType === 'GYM_LOCKER') {
      // For lockers, show count but not individual numbers
      if (inventoryAvailable.lockers > 0) {
        availableRoomsList.push({
          type: 'locker',
          tier: 'LOCKER',
          number: '',
          count: inventoryAvailable.lockers,
        });
      }
    } else {
      // For rooms, show by tier matching the selected type
      const tiers = selectedType
        ? [selectedType]
        : ['STANDARD', 'DOUBLE', 'SPECIAL'];
      for (const tier of tiers) {
        const count = Number(inventoryAvailable.rooms[tier] ?? 0);
        if (count > 0) {
          availableRoomsList.push({ type: 'room', tier, number: '', count });
        }
      }
    }
  }

  return (
    <div style= {{ display: 'grid', gap: '0.75rem' }
}>
  <div className="er-text-sm" style = {{ color: '#94a3b8', fontWeight: 800 }}>
    Customer is reading and signing the agreement.
        </div>

{/* Pending Assignment */ }
<div
          className="cs-liquid-card"
style = {{
  padding: '0.75rem',
    border: '1px solid rgba(99, 102, 241, 0.3)',
      background: 'rgba(99, 102, 241, 0.08)',
          }}
        >
  <div className="er-text-sm" style = {{ color: '#94a3b8', fontWeight: 800 }}>
    Pending Assignment
      </div>
      < div style = {{ fontWeight: 950, fontSize: '1.1rem' }}>
        { resourceLabel ?? 'Awaiting assignment…'}
</div>
  </div>

{/* Bypass Agreement */ }
{
  onBypassAgreement ? (
    <button
            type= "button"
            className = {`cs-liquid-button ${agreementBypassPending ? 'cs-liquid-button--selected' : 'cs-liquid-button--secondary'
    }`
}
disabled = { isSubmitting || agreementBypassPending}
onClick = {() => void onBypassAgreement()}
style = {{ width: '100%', padding: '0.75rem', fontWeight: 900 }}
          >
{
  agreementBypassPending
  ? 'Bypass Requested — Awaiting Physical Signature'
    : 'Bypass Digital Agreement'
}
  </button>
        ) : null}

{/* Manual Room Assignment */ }
{
  availableRoomsList.length > 0 ? (
    <div className= "cs-liquid-card" style = {{ padding: '0.75rem' }
}>
  <div style={ { fontWeight: 950, marginBottom: '0.45rem' } }>
    Manual Room / Locker Assignment
      </div>
      < div className = "er-text-sm" style = {{ color: '#94a3b8', fontWeight: 700, marginBottom: '0.5rem' }}>
        Assign a specific available { availableRoomsList[0]?.type ?? 'room' } for this customer.
            </div>
          < div style = {{ display: 'grid', gap: '0.4rem' }}>
          {
            availableRoomsList.map((item) => (
              <div
                  key= {`${item.type}-${item.tier}`}
style = {{
  display: 'flex',
    justifyContent: 'space-between',
      alignItems: 'center',
        padding: '0.4rem 0',
          fontWeight: 800,
                  }}
                >
  <span>
  {
    item.type === 'locker'
      ? 'Lockers'
      : item.tier === 'STANDARD'
        ? 'Private Dressing Room'
        : item.tier === 'DOUBLE'
          ? 'Double Dressing Room'
          : 'Special Dressing Room'
  }
  </span>
  < span
className = "er-text-sm"
style = {{ color: '#94a3b8', fontWeight: 900 }}
                  >
  { item.count } available
    </span>
    </div>
              ))}
</div>
  </div>
        ) : null}
</div>
    );
  }

return (
  <div className= "er-text-sm" style = {{ color: '#94a3b8', fontWeight: 800 }}>
    Waiting for next customer action…
</div>
  );
}
