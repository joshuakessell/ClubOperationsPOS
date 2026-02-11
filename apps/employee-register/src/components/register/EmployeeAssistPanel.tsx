import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { getCustomerMembershipStatus } from '@club-ops/shared';
import { EmployeeAssistStepContent } from './employee-assist/EmployeeAssistStepContent';
import type { EmployeeAssistStep, PendingState, RentalButton } from './employee-assist/types';
import { CustomerProfileCard } from './CustomerProfileCard';

export interface EmployeeAssistPanelProps {
  sessionId: string;
  customerName: string;
  customerPrimaryLanguage?: 'EN' | 'ES' | null;
  membershipNumber?: string | null;
  customerMembershipValidUntil?: string | null;
  membershipPurchaseIntent?: 'PURCHASE' | 'RENEW' | null;
  membershipChoice?: 'ONE_TIME' | 'SIX_MONTH' | null;

  allowedRentals?: string[];

  proposedRentalType?: string | null;
  proposedBy?: 'CUSTOMER' | 'EMPLOYEE' | null;
  selectionConfirmed?: boolean;

  waitlistDesiredTier?: string | null;
  waitlistBackupType?: string | null;

  inventoryAvailable?: {
    rooms: Record<string, number>;
    lockers: number;
  } | null;

  isSubmitting?: boolean;
  directSelect?: boolean;

  onHighlightLanguage: (lang: 'EN' | 'ES' | null) => void;
  onConfirmLanguage: (lang: 'EN' | 'ES') => Promise<void> | void;

  onHighlightMembership: (choice: 'ONE_TIME' | 'SIX_MONTH' | null) => void;
  onConfirmMembershipOneTime?: () => Promise<void> | void;
  onConfirmMembershipSixMonth: () => Promise<void> | void;

  onHighlightRental: (rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL') => Promise<void> | void;
  onSelectRentalAsCustomer: (
    rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL'
  ) => Promise<void> | void;
  onDirectSelectRental?: (
    rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL'
  ) => Promise<void> | void;
  onHighlightWaitlistBackup: (rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null) => void;
  onSelectWaitlistBackupAsCustomer: (
    rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL'
  ) => Promise<void> | void;
  onDirectSelectWaitlistBackup?: (
    rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL'
  ) => Promise<void> | void;
  onApproveRental: () => Promise<void> | void;

  profile?: {
    name: string;
    preferredLanguage?: 'EN' | 'ES' | null;
    dob?: string | null;
    dobMonthDay?: string | null;
    idNumber?: string | null;
    idExpirationDate?: string | null;
    idType?: 'STATE_ID' | 'DRIVERS_LICENSE' | 'PASSPORT' | 'OTHER' | null;
    idTypeOther?: string | null;
    membershipNumber?: string | null;
    membershipValidUntil?: string | null;
    lastVisitAt?: string | null;
    hasEncryptedLookupMarker?: boolean;
    checkinStage?: { number: 1 | 2 | 3 | 4 | 5 | 6; label: string } | null;
  };
  clearSessionButton?: ReactNode;
}

export function EmployeeAssistPanel(props: EmployeeAssistPanelProps) {
  const {
    sessionId,
    customerName,
    customerPrimaryLanguage,
    allowedRentals,
    proposedRentalType,
    proposedBy,
    selectionConfirmed,
    waitlistDesiredTier,
    waitlistBackupType,
    inventoryAvailable,
    isSubmitting = false,
    directSelect = false,
    onHighlightLanguage,
    onConfirmLanguage,
    onHighlightMembership,
    onConfirmMembershipSixMonth,
    onHighlightRental,
    onHighlightWaitlistBackup,
    onSelectWaitlistBackupAsCustomer,
    onDirectSelectWaitlistBackup,
    onApproveRental,
    onDirectSelectRental,
    profile,
    clearSessionButton,
  } = props;

  const [pending, setPending] = useState<PendingState>(null);

  const isLanguageNeeded = !customerPrimaryLanguage;
  const membershipStatus = getCustomerMembershipStatus(
    {
      membershipNumber: props.membershipNumber || null,
      membershipValidUntil: props.customerMembershipValidUntil || null,
    },
    new Date()
  );
  const isMembershipPending =
    props.membershipPurchaseIntent === 'PURCHASE' || props.membershipChoice === 'SIX_MONTH';
  const showSixMonthMembershipAdd = membershipStatus !== 'ACTIVE' && !isMembershipPending;
  const step: EmployeeAssistStep = useMemo(() => {
    if (!sessionId || !customerName) return 'DONE';
    if (isLanguageNeeded) return 'LANGUAGE';
    if (waitlistDesiredTier && !waitlistBackupType) return 'UPGRADE';
    if (selectionConfirmed) return 'DONE';
    if (proposedBy === 'CUSTOMER' && proposedRentalType) return 'DONE';
    return 'RENTAL';
  }, [
    customerName,
    isLanguageNeeded,
    proposedBy,
    proposedRentalType,
    selectionConfirmed,
    sessionId,
    waitlistBackupType,
    waitlistDesiredTier,
  ]);

  // Clear pending state when the session or step changes.
  useEffect(() => {
    setPending(null);
    // Clear kiosk highlights for step-driven (language/membership) highlights.
    onHighlightLanguage(null);
    onHighlightMembership(null);
    onHighlightWaitlistBackup(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, step]);

  const rentalButtons: RentalButton[] = useMemo(() => {
    const lockers = Number(inventoryAvailable?.lockers ?? 0);
    const standard = Number(inventoryAvailable?.rooms?.STANDARD ?? 0);
    const deluxe = Number(inventoryAvailable?.rooms?.DOUBLE ?? 0);
    const special = Number(inventoryAvailable?.rooms?.SPECIAL ?? 0);

    const allowed = new Set(
      Array.isArray(allowedRentals) ? allowedRentals : ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL']
    );

    return [
      {
        id: 'LOCKER' as const,
        label: directSelect ? 'Select Locker' : 'Propose Locker',
        count: lockers,
        allowed: allowed.has('LOCKER'),
      },
      {
        id: 'STANDARD' as const,
        label: directSelect ? 'Select Standard' : 'Propose Standard',
        count: standard,
        allowed: allowed.has('STANDARD'),
      },
      {
        id: 'DOUBLE' as const,
        label: directSelect ? 'Select Double' : 'Propose Double',
        count: deluxe,
        allowed: allowed.has('DOUBLE'),
      },
      {
        id: 'SPECIAL' as const,
        label: directSelect ? 'Select Special' : 'Propose Special',
        count: special,
        allowed: allowed.has('SPECIAL'),
      },
    ];
  }, [allowedRentals, directSelect, inventoryAvailable]);

  const waitlistBackupButtons: RentalButton[] = useMemo(() => {
    if (!waitlistDesiredTier) return [];
    const lockers = Number(inventoryAvailable?.lockers ?? 0);
    const standard = Number(inventoryAvailable?.rooms?.STANDARD ?? 0);
    const deluxe = Number(inventoryAvailable?.rooms?.DOUBLE ?? 0);
    const special = Number(inventoryAvailable?.rooms?.SPECIAL ?? 0);

    const allowed = new Set(
      Array.isArray(allowedRentals) ? allowedRentals : ['LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL']
    );
    const candidates = [
      {
        id: 'LOCKER' as const,
        label: 'Backup Locker',
        count: lockers,
        allowed: allowed.has('LOCKER'),
      },
      {
        id: 'STANDARD' as const,
        label: 'Backup Standard',
        count: standard,
        allowed: allowed.has('STANDARD'),
      },
      {
        id: 'DOUBLE' as const,
        label: 'Backup Double',
        count: deluxe,
        allowed: allowed.has('DOUBLE'),
      },
      {
        id: 'SPECIAL' as const,
        label: 'Backup Special',
        count: special,
        allowed: allowed.has('SPECIAL'),
      },
    ];

    return candidates.filter((c) => c.id !== waitlistDesiredTier);
  }, [allowedRentals, inventoryAvailable, waitlistDesiredTier]);

  return (
    <div
      className="cs-liquid-card"
      style={{
        padding: '0.9rem',
        flex: 1,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          alignItems: 'baseline',
        }}
      >
        <div style={{ fontWeight: 950, fontSize: '1rem' }}>Employee Assist</div>
        <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
          Step: {step}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          marginTop: '0.75rem',
          overflowY: 'auto',
          paddingRight: '0.25rem',
          display: 'grid',
          gap: '0.7rem',
          alignContent: 'start',
        }}
      >
        {profile ? (
          <div
            className="cs-liquid-card"
            style={{
              padding: '0.65rem 0.75rem',
              border: '1px solid rgba(148, 163, 184, 0.28)',
              background: 'rgba(15, 23, 42, 0.45)',
            }}
          >
            <CustomerProfileCard
              compact
              name={profile.name}
              preferredLanguage={profile.preferredLanguage}
              dob={profile.dob}
              dobMonthDay={profile.dobMonthDay}
              idNumber={profile.idNumber}
              idExpirationDate={profile.idExpirationDate}
              idType={profile.idType}
              idTypeOther={profile.idTypeOther}
              membershipNumber={profile.membershipNumber}
              membershipValidUntil={profile.membershipValidUntil}
              lastVisitAt={profile.lastVisitAt}
              hasEncryptedLookupMarker={profile.hasEncryptedLookupMarker}
              checkinStage={profile.checkinStage}
              waitlistDesiredTier={waitlistDesiredTier}
              waitlistBackupType={waitlistBackupType}
              footer={clearSessionButton}
            />
          </div>
        ) : null}
        <EmployeeAssistStepContent
          step={step}
          directSelect={directSelect}
          isSubmitting={isSubmitting}
          pending={pending}
          setPending={setPending}
          showSixMonthMembershipAdd={showSixMonthMembershipAdd}
          waitlistDesiredTier={waitlistDesiredTier}
          rentalButtons={rentalButtons}
          waitlistBackupButtons={waitlistBackupButtons}
          onHighlightLanguage={onHighlightLanguage}
          onConfirmLanguage={onConfirmLanguage}
          onHighlightMembership={onHighlightMembership}
          onConfirmMembershipSixMonth={onConfirmMembershipSixMonth}
          onHighlightRental={onHighlightRental}
          onApproveRental={onApproveRental}
          onDirectSelectRental={onDirectSelectRental}
          onHighlightWaitlistBackup={onHighlightWaitlistBackup}
          onSelectWaitlistBackupAsCustomer={onSelectWaitlistBackupAsCustomer}
          onDirectSelectWaitlistBackup={onDirectSelectWaitlistBackup}
        />
      </div>
    </div>
  );
}
