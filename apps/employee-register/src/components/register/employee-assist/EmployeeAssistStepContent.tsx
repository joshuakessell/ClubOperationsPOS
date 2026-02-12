import { useEffect, useMemo, useState } from 'react';
import type {
  EmployeeAssistStep,
  LanguageOption,
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
  onHighlightLanguage: (lang: LanguageOption | null) => void;
  onConfirmLanguage: (lang: LanguageOption) => Promise<void> | void;
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
  onHighlightLanguage,
  onConfirmLanguage,
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

  if (step === 'LANGUAGE') {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
          {directSelect
            ? 'Tap once to set the language.'
            : 'Tap once to set the language (it will also highlight on the kiosk).'}
        </div>
        {(
          [
            { id: 'EN' as const, label: 'English' },
            { id: 'ES' as const, label: 'Español' },
          ] as const
        ).map((opt) => {
          const isPending = pending?.step === 'LANGUAGE' && pending.option === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              className={[
                'cs-liquid-button',
                isPending ? 'cs-liquid-button--selected' : 'cs-liquid-button--secondary',
              ].join(' ')}
              disabled={isSubmitting}
              onClick={() => {
                if (isSubmitting) return;
                if (!directSelect) {
                  setPending({ step: 'LANGUAGE', option: opt.id });
                  onHighlightLanguage(opt.id);
                }
                void onConfirmLanguage(opt.id);
              }}
              style={{ width: '100%', padding: '0.9rem 1rem', fontWeight: 900 }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (step === 'UPGRADE') {
    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
          {directSelect ? `Select a backup rental for ${waitlistDesiredTier}.` : desiredSummary}
        </div>

        {!directSelect ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.75rem' }}>
            <div className="cs-liquid-card" style={{ padding: '0.75rem' }}>
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 900, marginBottom: '0.45rem' }}>
                Stand-by room types
              </div>
              <div style={{ display: 'grid', gap: '0.45rem' }}>
                {unavailableRoomTypes.map((tier) => {
                  const checked = desiredTypes.includes(tier);
                  const label =
                    tier === 'STANDARD'
                      ? 'Private Dressing Room'
                      : tier === 'DOUBLE'
                        ? 'Double Dressing Room'
                        : 'Special Dressing Room';
                  return (
                    <label key={tier} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 800 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) => {
                          setDesiredTypes((prev) => {
                            const next = new Set(prev);
                            if (event.target.checked) next.add(tier);
                            else next.delete(tier);
                            return Array.from(next);
                          });
                          if (event.target.checked && requestedResourceNumber) {
                            setRequestedResourceType(null);
                            setRequestedResourceNumber(null);
                          }
                        }}
                        disabled={isSubmitting}
                      />
                      <span>{label}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="cs-liquid-card" style={{ padding: '0.75rem' }}>
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 900, marginBottom: '0.45rem' }}>
                Specific unavailable room
              </div>
              <select
                className="cs-liquid-input"
                value={requestedResourceNumber ? `${requestedResourceType ?? 'room'}:${requestedResourceNumber}` : ''}
                onChange={(event) => {
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
                disabled={isSubmitting}
              >
                <option value="">Select a specific number (optional)</option>
                {specificRoomOptions.length > 0 ? (
                  <optgroup label="Rooms">
                    {specificRoomOptions.map((room) => (
                      <option key={`room-${room.number}`} value={`room:${room.number}`}>
                        {room.number}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
                {(waitlistUnavailableOptions?.lockers.length ?? 0) > 0 ? (
                  <optgroup label="Lockers">
                    {(waitlistUnavailableOptions?.lockers ?? []).map((locker) => (
                      <option key={`locker-${locker.number}`} value={`locker:${locker.number}`}>
                        {locker.number}
                      </option>
                    ))}
                  </optgroup>
                ) : null}
              </select>
            </div>
          </div>
        ) : null}

        <div style={{ display: 'grid', gap: '0.6rem' }}>
          {waitlistBackupButtons.map((btn) => {
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
                key={btn.id}
                type="button"
                className={[
                  'cs-liquid-button',
                  isPending ? 'cs-liquid-button--selected' : toneClass,
                ].join(' ')}
                disabled={disabled}
                onClick={() => {
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
                }}
                style={{
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
                <span>{btn.label}</span>
                <span
                  className="er-text-sm"
                  style={{
                    fontWeight: 900,
                    color: tone === 'none' ? '#ef4444' : tone === 'low' ? '#f59e0b' : '#94a3b8',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {countLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (step === 'RENTAL') {
    const unavailableJoinTarget = rentalButtons.find((btn) => btn.allowed && btn.count === 0)?.id ?? null;
    const availableRentalButtons = rentalButtons.filter((btn) => btn.allowed && btn.count > 0);

    return (
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
          {directSelect ? 'Tap once to select a rental.' : 'Tap once to propose on kiosk, tap again to confirm.'}
        </div>

        {showSixMonthMembershipAdd ? (
          <div style={{ display: 'grid', gap: '0.6rem' }}>
            <button
              type="button"
              className={[
                'cs-liquid-button',
                pending?.step === 'RENTAL_ADDON' && pending.option === 'SIX_MONTH'
                  ? 'cs-liquid-button--selected'
                  : 'cs-liquid-button--secondary',
              ].join(' ')}
              disabled={isSubmitting}
              onClick={() => {
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
              style={{ width: '100%', padding: '0.75rem 1rem', fontWeight: 900 }}
            >
              Add 6-Month Membership
            </button>
          </div>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '0.6rem' }}>
          {availableRentalButtons.map((btn) => {
            const isPending = pending?.step === 'RENTAL' && pending.option === btn.id;
            const { label: countLabel, tone } = remainingCountLabel(btn.count);
            const disabled = isSubmitting || !btn.allowed || btn.count === 0;
            const spanTwo = btn.id === 'LOCKER' || btn.id === 'STANDARD';
            const toneClass =
              tone === 'none'
                ? 'cs-liquid-button--secondary'
                : tone === 'low'
                  ? 'cs-liquid-button--warning'
                  : 'cs-liquid-button--secondary';

            return (
              <button
                key={btn.id}
                type="button"
                className={[
                  'cs-liquid-button',
                  isPending ? 'cs-liquid-button--selected' : toneClass,
                ].join(' ')}
                disabled={disabled}
                onClick={() => {
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
                }}
                style={{
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
                <span>{btn.label}</span>
                <span
                  className="er-text-sm"
                  style={{
                    fontWeight: 900,
                    color: tone === 'none' ? '#ef4444' : tone === 'low' ? '#f59e0b' : '#94a3b8',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {countLabel}
                </span>
              </button>
            );
          })}
        </div>

        {unavailableJoinTarget ? (
          <button
            type="button"
            className={[
              'cs-liquid-button',
              pending?.step === 'WAITLIST_JOIN' && pending.option === unavailableJoinTarget
                ? 'cs-liquid-button--staff-proposed'
                : 'cs-liquid-button--secondary',
            ].join(' ')}
            disabled={isSubmitting}
            onClick={() => {
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
            }}
            style={{ width: '100%', padding: '0.65rem 0.85rem', minHeight: '3rem', fontWeight: 900 }}
          >
            Join the Waiting List
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
      Waiting for next customer action…
    </div>
  );
}
