import { useCallback, useEffect, useRef, useState } from 'react';
import { CustomerProfileCard } from '../../components/register/CustomerProfileCard';
import { EmployeeAssistPanel } from '../../components/register/EmployeeAssistPanel';
import { CustomerAccountPanel } from '../../components/register/panels/CustomerAccountPanel';
import { useEmployeeRegisterState } from '../../app/state/useEmployeeRegisterState';
import { PanelHeader } from '../../views/PanelHeader';
import { PanelShell } from '../../views/PanelShell';
import { getApiUrl } from '@club-ops/shared';
import { isRecord, readJson } from '@club-ops/ui';
import type { CustomerProfile, LaneSessionPatch } from './accountTypes';
import type { RegisterLaneSessionState } from '../../app/useRegisterLaneSessionState';
import type { WaitlistUnavailableOptions } from '../../components/register/employee-assist/types';
const isCustomerIdType = (
  value: unknown
): value is CustomerProfile['idType'] =>
  value === 'STATE_ID' ||
  value === 'DRIVERS_LICENSE' ||
  value === 'PASSPORT' ||
  value === 'OTHER';

const isLaneSessionMode = (value: unknown): value is LaneSessionPatch['mode'] =>
  value === 'CHECKIN' || value === 'RENEWAL';

const isAssignedResourceType = (
  value: unknown
): value is NonNullable<LaneSessionPatch['assignedResourceType']> =>
  value === 'room' || value === 'locker';
export function AccountPanel() {
  const {
    accountCustomerId,
    accountCustomerLabel,
    accountCustomerSummary,
    accountAutoStartCheckin,
    lane,
    session,
    openRenewalSelection,
    startCheckoutFromCustomerAccount,
    handleClearSession,
    selectNavTab,
	    returnToPreviousTab,
	    handleBackStep,
	    handleCancelStep,
	    currentSessionId,
    laneSession,
    customerName,
    membershipNumber,
    customerMembershipValidUntil,
    membershipPurchaseIntent,
    membershipChoice,
    allowedRentals,
    proposedRentalType,
    proposedBy,
    selectionConfirmed,
    customerPrimaryLanguage,
    customerDob,
    customerDobMonthDay,
    customerIdNumber,
    customerLastVisitAt,
    customerIdExpirationDate,
    customerIdType,
    customerIdTypeOther,
    waitlistDesiredTier,
    waitlistDesiredTypes,
    waitlistBackupType,
    waitlistRequestedResourceNumber,
    waitlistRequestedResourceType,
    inventoryAvailable,
    isSubmitting,
    checkinStage,
    laneSessionMode,
    renewalHours,
    highlightKioskOption,
    handleConfirmLanguage,
    handleConfirmMembershipOneTime,
    handleConfirmMembershipSixMonth,
    handleProposeSelection,
    handleCustomerSelectRental,
    handleDirectSelectRental,
    handleSelectWaitlistBackupAsCustomer,
    handleDirectSelectWaitlistBackup,
    handleConfirmSelection,
    laneSessionActions,
  } = useEmployeeRegisterState();

  const patchLaneSession = useCallback(
    (patch: LaneSessionPatch) => {
      laneSessionActions.patch(patch as Partial<RegisterLaneSessionState>);
    },
    [laneSessionActions]
  );
  const profileAbortRef = useRef<AbortController | null>(null);
  const [customerProfile, setCustomerProfile] = useState<CustomerProfile | null>(null);
  const [waitlistUnavailableOptions, setWaitlistUnavailableOptions] =
    useState<WaitlistUnavailableOptions>(null);
  useEffect(() => {
    if (!accountCustomerId || !session?.sessionToken || currentSessionId) return;

    let cancelled = false;
    const controller = new AbortController();

    void (async () => {
      try {
        const response = await fetch(
          getApiUrl(`/api/v1/checkin/lane/${encodeURIComponent(lane)}/session-snapshot`),
          {
            headers: { Authorization: `Bearer ${session.sessionToken}` },
            signal: controller.signal,
          }
        );
        if (!response.ok) return;
        const payload = await readJson<unknown>(response);
        if (!isRecord(payload)) return;
        const sessionPayload = payload['session'];
        if (!isRecord(sessionPayload)) return;

        const snapshotCustomerId =
          typeof sessionPayload['customerId'] === 'string' ? sessionPayload['customerId'] : null;
        if (snapshotCustomerId !== accountCustomerId) return;

        if (cancelled) return;
        const patch: LaneSessionPatch = {
          currentSessionId:
            typeof sessionPayload['sessionId'] === 'string' ? sessionPayload['sessionId'] : null,
          customerId: snapshotCustomerId,
          customerName:
            typeof sessionPayload['customerName'] === 'string' ? sessionPayload['customerName'] : '',
          membershipNumber:
            typeof sessionPayload['membershipNumber'] === 'string'
              ? sessionPayload['membershipNumber']
              : '',
        };
        if (isLaneSessionMode(sessionPayload['mode'])) {
          patch.mode = sessionPayload['mode'];
        }
        patchLaneSession(patch);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          console.warn('Failed to hydrate account panel from lane snapshot', error);
        }
      }
    })();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [accountCustomerId, currentSessionId, lane, patchLaneSession, session?.sessionToken]);

  useEffect(() => {
    if (profileAbortRef.current) {
      profileAbortRef.current.abort();
    }

    if (!accountCustomerId || !session?.sessionToken) {
      setCustomerProfile(null);
      return;
    }

    const controller = new AbortController();
    profileAbortRef.current = controller;
    void (async () => {
      try {
        const response = await fetch(
          getApiUrl(`/api/v1/customers/${encodeURIComponent(accountCustomerId)}`),
          {
            headers: { Authorization: `Bearer ${session.sessionToken}` },
            signal: controller.signal,
          }
        );
        if (!response.ok) {
          setCustomerProfile(null);
          return;
        }
        const payload = await readJson<unknown>(response);
        if (!isRecord(payload)) {
          setCustomerProfile(null);
          return;
        }
        const rawCustomer = payload['customer'];
        if (!isRecord(rawCustomer)) {
          setCustomerProfile(null);
          return;
        }

        const idType = isCustomerIdType(rawCustomer['idType']) ? rawCustomer['idType'] : null;
        const preferredLanguage =
          rawCustomer['primaryLanguage'] === 'EN' || rawCustomer['primaryLanguage'] === 'ES'
            ? rawCustomer['primaryLanguage']
            : null;

        const next: CustomerProfile = {
          id: typeof rawCustomer['id'] === 'string' ? rawCustomer['id'] : '',
          name: typeof rawCustomer['name'] === 'string' ? rawCustomer['name'] : '',
          dob: typeof rawCustomer['dob'] === 'string' ? rawCustomer['dob'] : null,
          dobMonthDay: typeof rawCustomer['dobMonthDay'] === 'string' ? rawCustomer['dobMonthDay'] : null,
          membershipNumber:
            typeof rawCustomer['membershipNumber'] === 'string' ? rawCustomer['membershipNumber'] : null,
          membershipValidUntil:
            typeof rawCustomer['membershipValidUntil'] === 'string'
              ? rawCustomer['membershipValidUntil']
              : null,
          idNumber: typeof rawCustomer['idNumber'] === 'string' ? rawCustomer['idNumber'] : null,
          idType,
          idTypeOther:
            typeof rawCustomer['idTypeOther'] === 'string' ? rawCustomer['idTypeOther'] : null,
          idExpirationDate:
            typeof rawCustomer['idExpirationDate'] === 'string'
              ? rawCustomer['idExpirationDate']
              : null,
          preferredLanguage,
          lastVisitAt:
            typeof rawCustomer['lastVisitAt'] === 'string' ? rawCustomer['lastVisitAt'] : null,
          hasEncryptedLookupMarker: Boolean(rawCustomer['hasEncryptedLookupMarker']),
        };

        setCustomerProfile(next);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          setCustomerProfile(null);
        }
      }
    })();

    return () => {
      controller.abort();
    };
  }, [accountCustomerId, session?.sessionToken]);
  const directSelect = laneSessionMode === 'RENEWAL';
  const inventorySnapshot = inventoryAvailable
    ? {
        rooms: inventoryAvailable.rooms,
        lockers: inventoryAvailable.lockers,
      }
    : null;

  const employeeAssistInteractionProps = {
    onHighlightLanguage: (lang: 'EN' | 'ES' | null) =>
      void highlightKioskOption({ step: 'LANGUAGE', option: lang }),
    onConfirmLanguage: (lang: 'EN' | 'ES') => void handleConfirmLanguage(lang),
    onHighlightMembership: (choice: 'ONE_TIME' | 'SIX_MONTH' | null) =>
      void highlightKioskOption({ step: 'MEMBERSHIP', option: choice }),
    onConfirmMembershipOneTime: () => void handleConfirmMembershipOneTime(),
    onConfirmMembershipSixMonth: () => void handleConfirmMembershipSixMonth(),
    onHighlightRental: (rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null) => {
      if (!rental) return;
      void handleProposeSelection(rental);
    },
    onSelectRentalAsCustomer: (rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL') =>
      void handleCustomerSelectRental(rental),
    onDirectSelectRental: (rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL') =>
      void handleDirectSelectRental(rental),
    onHighlightWaitlistBackup: (
      rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null
    ) => void highlightKioskOption({ step: 'WAITLIST_BACKUP', option: rental }),
    onSelectWaitlistBackupAsCustomer: (
      rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL',
      options?: {
        waitlistDesiredTypes?: Array<'STANDARD' | 'DOUBLE' | 'SPECIAL'>;
        waitlistRequestedResourceNumber?: string | null;
        waitlistRequestedResourceType?: 'room' | 'locker' | null;
      }
    ) => void handleSelectWaitlistBackupAsCustomer(rental, options),
    onDirectSelectWaitlistBackup: (rental: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL') =>
      void handleDirectSelectWaitlistBackup(rental),
    onApproveRental: () => void handleConfirmSelection(),
    onBack: () => void handleBackStep(),
    onCancel: () => void handleCancelStep(),
  };

  useEffect(() => {
    if (!currentSessionId) {
      setWaitlistUnavailableOptions(null);
      return;
    }
    const controller = new AbortController();
    void (async () => {
      try {
        const rawEnv = import.meta.env as unknown as Record<string, unknown>;
        const kioskToken =
          typeof rawEnv.VITE_KIOSK_TOKEN === 'string' && rawEnv.VITE_KIOSK_TOKEN.trim()
            ? rawEnv.VITE_KIOSK_TOKEN.trim()
            : null;
        const response = await fetch(getApiUrl('/api/v1/inventory/unavailable-options'), {
          signal: controller.signal,
          headers: kioskToken ? { 'x-kiosk-token': kioskToken } : undefined,
        });
        if (!response.ok) {
          setWaitlistUnavailableOptions(null);
          return;
        }
        const payload = await readJson<unknown>(response);
        if (!isRecord(payload) || !isRecord(payload.rooms) || !Array.isArray(payload.lockers)) {
          setWaitlistUnavailableOptions(null);
          return;
        }
        const toEntries = (value: unknown): Array<{ number: string; status: string }> =>
          Array.isArray(value)
            ? value.filter(
                (entry): entry is { number: string; status: string } =>
                  isRecord(entry) &&
                  typeof entry.number === 'string' &&
                  typeof entry.status === 'string'
              )
            : [];
        setWaitlistUnavailableOptions({
          rooms: {
            SPECIAL: toEntries(payload.rooms.SPECIAL),
            DOUBLE: toEntries(payload.rooms.DOUBLE),
            STANDARD: toEntries(payload.rooms.STANDARD),
          },
          lockers: toEntries(payload.lockers),
        });
      } catch {
        if (!controller.signal.aborted) setWaitlistUnavailableOptions(null);
      }
    })();
    return () => controller.abort();
  }, [currentSessionId]);

  if (accountCustomerId) {
    return (
      <CustomerAccountPanel
        lane={lane}
        sessionToken={session?.sessionToken}
        customerId={accountCustomerId}
        customerLabel={accountCustomerLabel}
        customerSummary={accountCustomerSummary}
        customerProfile={customerProfile}
        autoStartCheckin={accountAutoStartCheckin}
        onStartCheckout={startCheckoutFromCustomerAccount}
        onStartRenewal={(activeCheckin) => openRenewalSelection(activeCheckin)}
        onClearSession={() => void handleClearSession().then(() => selectNavTab('scan'))}
        onGoBack={returnToPreviousTab}
        currentSessionId={currentSessionId}
        currentSessionCustomerId={laneSession.customerId}
        customerName={customerName}
        membershipNumber={membershipNumber}
        customerMembershipValidUntil={customerMembershipValidUntil}
        membershipPurchaseIntent={membershipPurchaseIntent}
        membershipChoice={membershipChoice}
        allowedRentals={allowedRentals}
        proposedRentalType={proposedRentalType}
        proposedBy={proposedBy}
        selectionConfirmed={selectionConfirmed}
        customerPrimaryLanguage={customerPrimaryLanguage}
        customerDob={customerDob}
        customerDobMonthDay={customerDobMonthDay}
        customerIdNumber={customerIdNumber}
        customerLastVisitAt={customerLastVisitAt}
        customerIdExpirationDate={customerIdExpirationDate}
        customerIdType={customerIdType}
        customerIdTypeOther={customerIdTypeOther}
        hasEncryptedLookupMarker={Boolean(laneSession.customerHasEncryptedLookupMarker)}
        waitlistDesiredTier={waitlistDesiredTier}
        waitlistDesiredTypes={waitlistDesiredTypes}
        waitlistBackupType={waitlistBackupType}
        waitlistRequestedResourceNumber={waitlistRequestedResourceNumber}
        waitlistRequestedResourceType={waitlistRequestedResourceType}
        inventoryAvailable={inventorySnapshot}
        waitlistUnavailableOptions={waitlistUnavailableOptions}
        isSubmitting={isSubmitting}
        checkinStage={checkinStage}
        sessionMode={laneSessionMode ?? undefined}
        renewalHours={renewalHours}
        directSelect={directSelect}
        onStartedSession={(data) => {
          const patch: LaneSessionPatch = {};
          if (accountCustomerId) patch.customerId = accountCustomerId;
          if (data.customerName) patch.customerName = data.customerName;
          if (data.membershipNumber) patch.membershipNumber = data.membershipNumber;
          if (data.sessionId) patch.currentSessionId = data.sessionId;
          if (data.mode) patch.mode = data.mode;
          if (data.renewalHours) patch.renewalHours = data.renewalHours;
          if (data.customerHasEncryptedLookupMarker !== undefined) {
            patch.customerHasEncryptedLookupMarker = Boolean(data.customerHasEncryptedLookupMarker);
          }
          if (data.mode === 'RENEWAL' && typeof data.blockEndsAt === 'string') {
            if (isAssignedResourceType(data.activeAssignedResourceType)) {
              patch.assignedResourceType = data.activeAssignedResourceType;
            }
            if (data.activeAssignedResourceNumber)
              patch.assignedResourceNumber = data.activeAssignedResourceNumber;
            patch.checkoutAt = data.blockEndsAt;
          }
          if (Object.keys(patch).length > 0) patchLaneSession(patch);
        }}
        {...employeeAssistInteractionProps}
      />
    );
  }

  if (currentSessionId && (!laneSession.customerId || laneSession.customerId === accountCustomerId)) {
    return (
      <PanelShell align="top" scroll="hidden">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            minHeight: 0,
          }}
        >
          <PanelHeader title="Customer Account" spacing="none" />
          <div
            style={{
              minHeight: '14rem',
              maxHeight: '22rem',
              overflowY: 'auto',
              paddingRight: '0.2rem',
            }}
          >
            <CustomerProfileCard
              name={customerName}
              preferredLanguage={customerPrimaryLanguage || null}
              dob={customerDob || null}
              dobMonthDay={customerDobMonthDay || null}
              membershipNumber={membershipNumber || null}
              idNumber={customerIdNumber || null}
              membershipValidUntil={customerMembershipValidUntil || null}
              lastVisitAt={customerLastVisitAt || null}
              idExpirationDate={customerIdExpirationDate || null}
              idType={customerIdType || null}
              idTypeOther={customerIdTypeOther || null}
              hasEncryptedLookupMarker={Boolean(laneSession.customerHasEncryptedLookupMarker)}
              checkinStage={checkinStage}
              waitlistDesiredTier={waitlistDesiredTier}
              waitlistBackupType={waitlistBackupType}
            />
          </div>
          <EmployeeAssistPanel
            sessionId={currentSessionId}
            customerName={customerName}
            customerPrimaryLanguage={customerPrimaryLanguage}
            membershipNumber={membershipNumber || null}
            customerMembershipValidUntil={customerMembershipValidUntil}
            membershipPurchaseIntent={membershipPurchaseIntent}
            membershipChoice={membershipChoice}
            allowedRentals={allowedRentals}
            proposedRentalType={proposedRentalType}
            proposedBy={proposedBy}
            selectionConfirmed={selectionConfirmed}
            waitlistDesiredTier={waitlistDesiredTier}
            waitlistDesiredTypes={waitlistDesiredTypes}
            waitlistBackupType={waitlistBackupType}
            waitlistRequestedResourceNumber={waitlistRequestedResourceNumber}
            waitlistRequestedResourceType={waitlistRequestedResourceType}
            inventoryAvailable={inventorySnapshot}
            waitlistUnavailableOptions={waitlistUnavailableOptions}
            isSubmitting={isSubmitting}
            directSelect={directSelect}
            onClearSession={() => void handleClearSession().then(() => selectNavTab('scan'))}
            {...employeeAssistInteractionProps}
          />
        </div>
      </PanelShell>
    );
  }

  return (
    <PanelShell align="center">
      <PanelHeader
        align="center"
        spacing="sm"
        title="Customer Account"
        subtitle="Select a customer (scan, search, or first-time) to view their account."
      />
    </PanelShell>
  );
}
