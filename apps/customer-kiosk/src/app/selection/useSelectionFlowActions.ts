import { getErrorMessage, isRecord } from '@club-ops/ui';
import { t } from '../../i18n';
import type {
  SelectionFlowCallbacks,
  SelectionFlowNotices,
  SelectionFlowSetters,
  SelectionFlowState,
  SelectionFlowUi,
} from './types';
import { createMembershipFlowActions } from './membershipFlowActions';

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
    waitlistBackupType,
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

  const handleRentalSelection = async (rental: string) => {
    if (!session.sessionId) {
      showNotice({ tone: 'warning', title: t(session.customerPrimaryLanguage, 'error.noActiveSession') });
      return;
    }
    if (!lane) return;

    const availableCount =
      inventory?.rooms?.[rental] ??
      (rental === 'LOCKER' || rental === 'GYM_LOCKER' ? inventory?.lockers : undefined);

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
      const response = await fetch(`${apiBase}/v1/checkin/lane/${lane}/propose-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...kioskAuthHeaders(),
        },
        body: JSON.stringify({
          rentalType: rental,
          proposedBy: 'CUSTOMER',
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        if (
          response.status === 409 &&
          isRecord(errorPayload) &&
          errorPayload.code === 'LANGUAGE_REQUIRED'
        ) {
          onSwitchToLanguage();
          showNotice({ tone: 'warning', title: t('EN', 'selectLanguage') });
          return;
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
        if (
          confirmResponse.status === 409 &&
          isRecord(errorPayload) &&
          errorPayload.code === 'LANGUAGE_REQUIRED'
        ) {
          onSwitchToLanguage();
          showNotice({ tone: 'warning', title: t('EN', 'selectLanguage') });
          return;
        }
        throw new Error(getErrorMessage(errorPayload) || 'Failed to confirm selection');
      }

      const confirmPayload: unknown = await confirmResponse.json().catch(() => null);
      const confirmedBy =
        isRecord(confirmPayload) &&
        (confirmPayload.confirmedBy === 'CUSTOMER' || confirmPayload.confirmedBy === 'EMPLOYEE')
          ? confirmPayload.confirmedBy
          : 'CUSTOMER';
      setters.setProposedRentalType(rental);
      setters.setProposedBy('CUSTOMER');
      setters.setSelectionConfirmed(true);
      setters.setSelectionConfirmedBy(confirmedBy);
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
      const response = await fetch(`${apiBase}/v1/checkin/lane/${lane}/propose-selection`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...kioskAuthHeaders(),
        },
        body: JSON.stringify({
          rentalType: backupType,
          proposedBy: 'CUSTOMER',
          waitlistDesiredType: waitlistDesiredType || undefined,
          backupRentalType: backupType,
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        if (
          response.status === 409 &&
          isRecord(errorPayload) &&
          errorPayload.code === 'LANGUAGE_REQUIRED'
        ) {
          onSwitchToLanguage();
          showNotice({ tone: 'warning', title: t('EN', 'selectLanguage') });
          return;
        }
        throw new Error(getErrorMessage(errorPayload) || 'Failed to process waitlist selection');
      }

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
        if (
          confirmResponse.status === 409 &&
          isRecord(errorPayload) &&
          errorPayload.code === 'LANGUAGE_REQUIRED'
        ) {
          onSwitchToLanguage();
          showNotice({ tone: 'warning', title: t('EN', 'selectLanguage') });
          return;
        }
        throw new Error(getErrorMessage(errorPayload) || 'Failed to confirm selection');
      }

      const confirmPayload: unknown = await confirmResponse.json().catch(() => null);
      const confirmedBy =
        isRecord(confirmPayload) &&
        (confirmPayload.confirmedBy === 'CUSTOMER' || confirmPayload.confirmedBy === 'EMPLOYEE')
          ? confirmPayload.confirmedBy
          : 'CUSTOMER';
      setters.setUpgradeDisclaimerAcknowledged(true);
      setters.setShowUpgradeDisclaimer(false);
      setters.setUpgradeAction(null);
      setters.setProposedRentalType(waitlistBackupType || selectedRental || 'LOCKER');
      setters.setProposedBy('CUSTOMER');
      setters.setSelectionConfirmed(true);
      setters.setSelectionConfirmedBy(confirmedBy);
    } catch (error) {
      console.error('Failed to acknowledge upgrade disclaimer:', error);
      showNotice({ tone: 'warning', title: t(session.customerPrimaryLanguage, 'error.process') });
    }
  };

  const handleWaitlistBackupSelection = (rental: string) => {
    if (!session.sessionId || !waitlistDesiredType) return;

    const availableCount =
      inventory?.rooms?.[rental] ??
      (rental === 'LOCKER' || rental === 'GYM_LOCKER' ? inventory?.lockers : undefined);
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
      setters.setWaitlistDesiredType(null);
      setters.setWaitlistBackupType(null);
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
      setters.setWaitlistDesiredType(null);
      setters.setWaitlistBackupType(null);
      setters.setHighlightedWaitlistBackup(null);
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

  const membershipActions = createMembershipFlowActions({
    apiBase,
    kioskAuthHeaders,
    state,
    setters,
    ui,
    callbacks,
    notices,
  });

  return {
    handleRentalSelection,
    handleDisclaimerAcknowledge,
    handleWaitlistBackupSelection,
    handleWaitlistCancel,
    handleCustomerConfirmSelection,
    ...membershipActions,
  };
}
