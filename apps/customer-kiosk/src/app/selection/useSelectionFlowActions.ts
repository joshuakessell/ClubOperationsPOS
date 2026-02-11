import { getErrorMessage, isRecord } from '@club-ops/ui';
import { t } from '../../i18n';
import type {
  SelectionFlowCallbacks,
  SelectionFlowNotices,
  SelectionFlowSetters,
  SelectionFlowState,
  SelectionFlowUi,
} from './types';
import {
  getAvailableCount,
  isLanguageRequiredConflict,
  mapWaitlistUnavailableOptions,
  parseConfirmedBy,
  resetWaitlistDraft,
} from './selectionFlowShared';

type SelectionFlowActionParams = {
  apiBase: string;
  kioskAuthHeaders: (extra?: Record<string, string>) => Record<string, string>;
  state: SelectionFlowState;
  setters: SelectionFlowSetters;
  ui: SelectionFlowUi;
  callbacks: SelectionFlowCallbacks;
  notices: SelectionFlowNotices;
};

export function useSelectionFlowActions({
  apiBase,
  kioskAuthHeaders,
  state,
  setters,
  ui,
  callbacks,
  notices,
}: SelectionFlowActionParams) {
  const {
    session,
    lane,
    inventory,
    selectedRental,
    waitlistDesiredType,
    waitlistDesiredTypes,
    waitlistBackupType,
    waitlistRequestedResourceNumber,
    waitlistRequestedResourceType,
    waitlistUnavailableOptions,
    upgradeAction,
    customerConfirmationData,
  } = state;

  const {
    setIsSubmitting,
  } = ui;

  const {
    onSwitchToLanguage,
  } = callbacks;

  const { showNotice } = notices;

  const showLanguageRequiredNotice = () => {
    onSwitchToLanguage();
    showNotice({ tone: 'warning', title: t('EN', 'selectLanguage') });
  };

  const buildUnavailableRentalTypes = () =>
    session.allowedRentals.filter((rental) => getAvailableCount(inventory, rental) === 0);

  const confirmSelectionAsCustomer = async ({
    rentalType,
    waitlistDesiredType,
    waitlistDesiredTypes,
    waitlistRequestedResourceNumber,
    waitlistRequestedResourceType,
  }: {
    rentalType: string;
    waitlistDesiredType?: string;
    waitlistDesiredTypes?: string[];
    waitlistRequestedResourceNumber?: string;
    waitlistRequestedResourceType?: 'room' | 'locker';
  }) => {
    if (!lane) return null;

    const response = await fetch(`${apiBase}/v1/checkin/lane/${lane}/propose-selection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...kioskAuthHeaders(),
      },
      body: JSON.stringify({
        rentalType,
        proposedBy: 'CUSTOMER',
        waitlistDesiredType,
        waitlistDesiredTypes,
        backupRentalType: rentalType,
        waitlistRequestedResourceNumber,
        waitlistRequestedResourceType,
      }),
    });

    if (!response.ok) {
      const errorPayload: unknown = await response.json().catch(() => null);
      if (isLanguageRequiredConflict(response.status, errorPayload)) {
        showLanguageRequiredNotice();
        return null;
      }
      throw new Error(getErrorMessage(errorPayload) || 'Failed to propose selection');
    }

    await response.json().catch(() => null);

    const confirmResponse = await fetch(`${apiBase}/v1/checkin/lane/${lane}/confirm-selection`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...kioskAuthHeaders(),
      },
      body: JSON.stringify({
        confirmedBy: 'CUSTOMER',
      }),
    });

    if (!confirmResponse.ok) {
      const errorPayload: unknown = await confirmResponse.json().catch(() => null);
      if (isLanguageRequiredConflict(confirmResponse.status, errorPayload)) {
        showLanguageRequiredNotice();
        return null;
      }
      throw new Error(getErrorMessage(errorPayload) || 'Failed to confirm selection');
    }

    const confirmPayload: unknown = await confirmResponse.json().catch(() => null);
    const confirmedBy = parseConfirmedBy(confirmPayload);

    setters.setProposedRentalType(rentalType);
    setters.setProposedBy('CUSTOMER');
    setters.setSelectionConfirmed(true);
    setters.setSelectionConfirmedBy(confirmedBy);

    return confirmedBy;
  };

  const handleOpenWaitlist = () => {
    const unavailableTypes = buildUnavailableRentalTypes();
    if (!unavailableTypes.length) {
      showNotice({
        tone: 'warning',
        title: t(session.customerPrimaryLanguage, 'error.noUnavailableForWaitlist'),
      });
      return;
    }

    setters.setWaitlistDesiredType(unavailableTypes[0] ?? null);
    setters.setWaitlistDesiredTypes(unavailableTypes);
    setters.setWaitlistRequestedResourceNumber(null);
    setters.setWaitlistRequestedResourceType(null);
    setters.setWaitlistUnavailableOptions(null);
    setters.setShowWaitlistModal(true);
  };

  const handleRentalSelection = async (rental: string) => {
    if (!session.sessionId) {
      showNotice({ tone: 'warning', title: t(session.customerPrimaryLanguage, 'error.noActiveSession') });
      return;
    }
    if (!lane) return;

    const availableCount = getAvailableCount(inventory, rental);

    if (availableCount === 0) {
      setters.setWaitlistDesiredType(rental);
      try {
        await fetch(`${apiBase}/v1/checkin/lane/${lane}/waitlist-desired`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...kioskAuthHeaders(),
          },
          body: JSON.stringify({ waitlistDesiredType: rental }),
        });
      } catch {
        // Best-effort; UI can still proceed with local waitlist flow.
      }
      try {
        const response = await fetch(
          `${apiBase}/v1/checkin/lane/${lane}/waitlist-info?desiredTier=${rental}&currentTier=${selectedRental || 'LOCKER'}`
        );
        if (response.ok) {
          const data: unknown = await response.json();
          if (isRecord(data)) {
            setters.setWaitlistPosition(typeof data.position === 'number' ? data.position : null);
            setters.setWaitlistETA(
              typeof data.estimatedReadyAt === 'string' ? data.estimatedReadyAt : null
            );
            setters.setWaitlistUpgradeFee(
              typeof data.upgradeFee === 'number' ? data.upgradeFee : null
            );
          }
        }
      } catch (error) {
        console.error('Failed to fetch waitlist info:', error);
      }
      setters.setShowWaitlistModal(true);
      return;
    }

    setIsSubmitting(true);

    try {
      await confirmSelectionAsCustomer({ rentalType: rental });
    } catch (error) {
      console.error('Failed to propose selection:', error);
      showNotice({
        tone: 'warning',
        title: t(session.customerPrimaryLanguage, 'error.processSelection'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDisclaimerAcknowledge = async () => {
    if (!session.sessionId || !upgradeAction) return;
    if (!lane) return;

    try {
      const backupType = waitlistBackupType || selectedRental || 'LOCKER';
      const confirmedBy = await confirmSelectionAsCustomer({
        rentalType: backupType,
        waitlistDesiredType: waitlistDesiredType || undefined,
      });
      if (!confirmedBy) return;

      setters.setUpgradeDisclaimerAcknowledged(true);
      setters.setShowUpgradeDisclaimer(false);
      setters.setUpgradeAction(null);
    } catch (error) {
      console.error('Failed to acknowledge upgrade disclaimer:', error);
      showNotice({ tone: 'warning', title: t(session.customerPrimaryLanguage, 'error.process') });
    }
  };

  const handleWaitlistBackupSelection = (rental: string) => {
    if (!session.sessionId || !waitlistDesiredType) return;

    const availableCount = getAvailableCount(inventory, rental);
    if (availableCount === 0) {
      showNotice({
        tone: 'warning',
        title: t(session.customerPrimaryLanguage, 'error.rentalNotAvailable'),
      });
      return;
    }

    setters.setWaitlistBackupType(rental);
    setters.setShowWaitlistModal(false);
    setters.setUpgradeAction('waitlist');
    setters.setShowUpgradeDisclaimer(true);
  };

  const handleWaitlistCancel = async () => {
    setters.setShowWaitlistModal(false);
    if (!session.sessionId) {
      resetWaitlistDraft(setters);
      return;
    }
    if (!lane) return;
    try {
      await fetch(`${apiBase}/v1/checkin/lane/${lane}/waitlist-desired`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...kioskAuthHeaders(),
        },
        body: JSON.stringify({ waitlistDesiredType: null, sessionId: session.sessionId }),
      });
    } catch (error) {
      console.error('Failed to clear waitlist selection:', error);
    } finally {
      resetWaitlistDraft(setters, { clearHighlightedBackup: true });
    }
  };

  const handleWaitlistDesiredTypesChange = (next: string[]) => {
    setters.setWaitlistDesiredTypes(next);
    setters.setWaitlistDesiredType(next[0] ?? null);
  };

  const handleWaitlistSpecificSelection = (params: {
    resourceType: 'room' | 'locker' | null;
    resourceNumber: string | null;
  }) => {
    setters.setWaitlistRequestedResourceType(params.resourceType);
    setters.setWaitlistRequestedResourceNumber(params.resourceNumber);
  };

  const handleWaitlistSpecificFocus = async () => {
    if (!lane) return;
    if (waitlistUnavailableOptions) return;
    try {
      const response = await fetch(`${apiBase}/v1/inventory/unavailable-options`, {
        headers: kioskAuthHeaders(),
      });
      if (!response.ok) return;
      const data: unknown = await response.json();
      const mapped = mapWaitlistUnavailableOptions(data);
      if (!mapped) return;
      setters.setWaitlistUnavailableOptions(mapped);
    } catch {
      // Best effort only; waitlist still works without specific options.
    }
  };

  const handleWaitlistSubmit = async () => {
    if (!session.sessionId) return;
    if (!lane) return;
    if (!waitlistDesiredTypes.length) {
      showNotice({ tone: 'warning', title: t(session.customerPrimaryLanguage, 'error.waitlistNeedsDesired') });
      return;
    }

    const backupType = waitlistBackupType || selectedRental || 'LOCKER';

    setIsSubmitting(true);
    try {
      const confirmedBy = await confirmSelectionAsCustomer({
        rentalType: backupType,
        waitlistDesiredType: waitlistDesiredTypes[0],
        waitlistDesiredTypes,
        waitlistRequestedResourceNumber: waitlistRequestedResourceNumber || undefined,
        waitlistRequestedResourceType: waitlistRequestedResourceType || undefined,
      });
      if (!confirmedBy) return;

      setters.setShowWaitlistModal(false);
    } catch (error) {
      console.error('Failed to submit waitlist flow:', error);
      showNotice({ tone: 'warning', title: t(session.customerPrimaryLanguage, 'error.process') });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCustomerConfirmSelection = async (confirmed: boolean) => {
    if (!customerConfirmationData?.sessionId) return;
    if (!lane) return;
    setIsSubmitting(true);
    try {
      const response = await fetch(`${apiBase}/v1/checkin/lane/${lane}/customer-confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...kioskAuthHeaders() },
        body: JSON.stringify({
          sessionId: customerConfirmationData.sessionId,
          confirmed,
        }),
      });
      if (response.ok) {
        setters.setShowCustomerConfirmation(false);
        setters.setCustomerConfirmationData(null);
      }
    } catch (error) {
      console.error('Failed to confirm selection:', error);
      showNotice({
        tone: 'warning',
        title: t(session.customerPrimaryLanguage, 'error.confirmSelection'),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    handleOpenWaitlist,
    handleRentalSelection,
    handleDisclaimerAcknowledge,
    handleWaitlistDesiredTypesChange,
    handleWaitlistSpecificSelection,
    handleWaitlistSpecificFocus,
    handleWaitlistSubmit,
    handleWaitlistBackupSelection,
    handleWaitlistCancel,
    handleCustomerConfirmSelection,
  };
}
