import { useEffect, useMemo, useState } from 'react';
import { getCustomerMembershipStatus } from '@club-ops/shared';
import { Button } from '@club-ops/ui/tailadmin';
import { EmployeeAssistStepContent } from './employee-assist/EmployeeAssistStepContent';
import type {
  EmployeeAssistStep,
  PendingState,
  RentalButton,
  WaitlistUnavailableOptions,
} from './employee-assist/types';

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
  waitlistDesiredTypes?: Array<'STANDARD' | 'DOUBLE' | 'SPECIAL'>;
  waitlistBackupType?: string | null;
  waitlistRequestedResourceNumber?: string | null;
  waitlistRequestedResourceType?: 'room' | 'locker' | null;

  inventoryAvailable?: {
    rooms: Record<string, number>;
    lockers: number;
  } | null;
  waitlistUnavailableOptions?: WaitlistUnavailableOptions;

  isSubmitting?: boolean;
  directSelect?: boolean;

  // Flow-step driven state (server-authoritative)
  flowStep?:
    | 'RENTAL'
    | 'WAITLIST_PREFERENCES'
    | 'WAITLIST_BACKUP'
    | 'PAYMENT'
    | 'AGREEMENT'
    | 'COMPLETE'
    | null;
  ledgerLineItems?: Array<{ description: string; amount: number }>;
  ledgerTotal?: number | null;
  paymentStatus?: 'DUE' | 'PAID' | null;
  agreementBypassPending?: boolean;
  assignedResourceType?: 'room' | 'locker' | null;
  assignedResourceNumber?: string | null;

  onHighlightMembership: (choice: 'ONE_TIME' | 'SIX_MONTH' | null) => void;
  onConfirmMembershipOneTime?: () => Promise<void> | void;
  onConfirmMembershipSixMonth: () => Promise<void> | void;

  onHighlightRental: (
    rental: 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null
  ) => Promise<void> | void;
  onSelectRentalAsCustomer: (
    rental: 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL'
  ) => Promise<void> | void;
  onDirectSelectRental?: (
    rental: 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL'
  ) => Promise<void> | void;
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
  ) => Promise<void> | void;
  onDirectSelectWaitlistBackup?: (
    rental: 'LOCKER' | 'GYM_LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL'
  ) => Promise<void> | void;
  onApproveRental: () => Promise<void> | void;
  onClearSession?: () => void;
  onBypassAgreement?: () => Promise<void> | void;

  onBack?: () => Promise<void> | void;
  onCancel?: () => Promise<void> | void;
}

export function EmployeeAssistPanel(props: EmployeeAssistPanelProps) {
  const {
    sessionId,
    customerName,
    allowedRentals,
    proposedRentalType,
    proposedBy,
    selectionConfirmed,
    waitlistDesiredTier,
    waitlistDesiredTypes,
    waitlistBackupType,
    waitlistRequestedResourceNumber,
    waitlistRequestedResourceType,
    inventoryAvailable,
    waitlistUnavailableOptions,
    isSubmitting = false,
    directSelect = false,
    flowStep,
    ledgerLineItems,
    ledgerTotal,
    paymentStatus,
    agreementBypassPending,
    assignedResourceType,
    assignedResourceNumber,
    onHighlightMembership,
    onConfirmMembershipSixMonth,
    onHighlightRental,
    onHighlightWaitlistBackup,
    onSelectWaitlistBackupAsCustomer,
    onDirectSelectWaitlistBackup,
    onApproveRental,
    onClearSession,
    onDirectSelectRental,
    onBypassAgreement,
    onBack,
    onCancel,
  } = props;

  const [pending, setPending] = useState<PendingState>(null);

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
    // Server-authoritative flow step takes priority when available
    if (flowStep === 'PAYMENT') return 'PAYMENT';
    if (flowStep === 'AGREEMENT') return 'AGREEMENT';
    if (flowStep === 'COMPLETE') return 'DONE';
    if (waitlistDesiredTier && !waitlistBackupType) return 'UPGRADE';
    if (selectionConfirmed) return 'DONE';
    if (proposedBy === 'CUSTOMER' && proposedRentalType) return 'DONE';
    return 'RENTAL';
  }, [
    customerName,
    flowStep,
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
    // Clear kiosk highlights for step-driven (membership) highlights.
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
        id: 'GYM_LOCKER' as const,
        label: directSelect ? 'Select Gym Locker' : 'Propose Gym Locker',
        count: lockers,
        allowed: allowed.has('GYM_LOCKER'),
      },
      {
        id: 'STANDARD' as const,
        label: directSelect ? 'Select Private Dressing Room' : 'Propose Private Dressing Room',
        count: standard,
        allowed: allowed.has('STANDARD'),
      },
      {
        id: 'DOUBLE' as const,
        label: directSelect ? 'Select Double Dressing Room' : 'Propose Double Dressing Room',
        count: deluxe,
        allowed: allowed.has('DOUBLE'),
      },
      {
        id: 'SPECIAL' as const,
        label: directSelect ? 'Select Special Dressing Room' : 'Propose Special Dressing Room',
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
      Array.isArray(allowedRentals)
        ? allowedRentals
        : ['LOCKER', 'GYM_LOCKER', 'STANDARD', 'DOUBLE', 'SPECIAL']
    );
    const candidates = [
      {
        id: 'LOCKER' as const,
        label: 'Backup Locker',
        count: lockers,
        allowed: allowed.has('LOCKER'),
      },
      {
        id: 'GYM_LOCKER' as const,
        label: 'Backup Gym Locker',
        count: lockers,
        allowed: allowed.has('GYM_LOCKER'),
      },
      {
        id: 'STANDARD' as const,
        label: 'Backup Private Dressing Room',
        count: standard,
        allowed: allowed.has('STANDARD'),
      },
      {
        id: 'DOUBLE' as const,
        label: 'Backup Double Dressing Room',
        count: deluxe,
        allowed: allowed.has('DOUBLE'),
      },
      {
        id: 'SPECIAL' as const,
        label: 'Backup Special Dressing Room',
        count: special,
        allowed: allowed.has('SPECIAL'),
      },
    ];

    return candidates.filter((c) => c.id !== waitlistDesiredTier && c.allowed && c.count > 0);
  }, [allowedRentals, inventoryAvailable, waitlistDesiredTier]);

  return (
    <div
      className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
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
        <div style={{ fontWeight: 950, fontSize: '1rem' }}> Employee Assist </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {onBack ? (
            <Button variant="outline" size="sm" onClick={() => void onBack()}>
              Back
            </Button>
          ) : null}
          {onCancel ? (
            <Button variant="outline" size="sm" onClick={() => void onCancel()}>
              Cancel
            </Button>
          ) : null}
          {onClearSession ? (
            <Button variant="danger" size="sm" onClick={onClearSession}>
              Clear Session
            </Button>
          ) : (
            <div className="text-xs text-gray-400 font-extrabold dark:text-gray-500">
              Step: {step}
            </div>
          )}
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
        <EmployeeAssistStepContent
          step={step}
          directSelect={directSelect}
          isSubmitting={isSubmitting}
          pending={pending}
          setPending={setPending}
          showSixMonthMembershipAdd={showSixMonthMembershipAdd}
          waitlistDesiredTier={waitlistDesiredTier}
          waitlistDesiredTypes={waitlistDesiredTypes}
          waitlistRequestedResourceNumber={waitlistRequestedResourceNumber}
          waitlistRequestedResourceType={waitlistRequestedResourceType}
          waitlistUnavailableOptions={waitlistUnavailableOptions}
          rentalButtons={rentalButtons}
          waitlistBackupButtons={waitlistBackupButtons}
          ledgerLineItems={ledgerLineItems}
          ledgerTotal={ledgerTotal}
          paymentStatus={paymentStatus}
          agreementBypassPending={agreementBypassPending}
          assignedResourceType={assignedResourceType}
          assignedResourceNumber={assignedResourceNumber}
          inventoryAvailable={inventoryAvailable}
          proposedRentalType={proposedRentalType}
          onHighlightMembership={onHighlightMembership}
          onConfirmMembershipSixMonth={onConfirmMembershipSixMonth}
          onHighlightRental={onHighlightRental}
          onApproveRental={onApproveRental}
          onDirectSelectRental={onDirectSelectRental}
          onHighlightWaitlistBackup={onHighlightWaitlistBackup}
          onSelectWaitlistBackupAsCustomer={onSelectWaitlistBackupAsCustomer}
          onSelectRentalAsCustomer={props.onSelectRentalAsCustomer}
          onDirectSelectWaitlistBackup={onDirectSelectWaitlistBackup}
          onBypassAgreement={onBypassAgreement}
        />
      </div>
    </div>
  );
}
