import { useEffect } from 'react';
import { SelectionScreen } from '../screens/SelectionScreen';
import { getMembershipStatus } from '../utils/membership';
import { SelectionFlowModals } from './selection/SelectionFlowModals';
import type { SelectionFlowProps } from './selection/types';
import { useSelectionFlowActions } from './selection/useSelectionFlowActions';

export function SelectionFlow({
  apiBase,
  kioskAuthHeaders,
  state,
  setters,
  ui,
  callbacks,
  notices,
}: SelectionFlowProps) {
  const actions = useSelectionFlowActions({
    apiBase,
    kioskAuthHeaders,
    state,
    setters,
    ui,
    callbacks,
    notices,
  });

  const {
    session,
    lane,
    inventory,
    selectedRental,
    proposedRentalType,
    proposedBy,
    selectionConfirmed,
    selectionConfirmedBy,
    waitlistDesiredType,
    waitlistBackupType,
    waitlistPosition,
    waitlistETA,
    waitlistUpgradeFee,
    showWaitlistModal,
    showUpgradeDisclaimer,
    upgradeDisclaimerAcknowledged,
    showRenewalDisclaimer,
    showCustomerConfirmation,
    customerConfirmationData,
    membershipChoice,
    showMembershipModal,
    membershipModalIntent,
    highlightedMembershipChoice,
    highlightedWaitlistBackup,
  } = state;

  const { orientationOverlay, welcomeOverlay, isSubmitting } = ui;
  const {
    setMembershipModalIntent,
    setShowMembershipModal,
    setUpgradeAction,
    setShowUpgradeDisclaimer,
    setShowWaitlistModal,
    setWaitlistPosition,
    setWaitlistETA,
    setWaitlistUpgradeFee,
    setShowRenewalDisclaimer,
  } = setters;

  const openMembershipModal = (intent: 'PURCHASE' | 'RENEW') => {
    setMembershipModalIntent(intent);
    setShowMembershipModal(true);
  };

  useEffect(() => {
    if (!waitlistDesiredType || !waitlistBackupType) return;
    if (upgradeDisclaimerAcknowledged) return;
    if (showUpgradeDisclaimer) return;
    setUpgradeAction('waitlist');
    setShowUpgradeDisclaimer(true);
  }, [
    showUpgradeDisclaimer,
    upgradeDisclaimerAcknowledged,
    waitlistBackupType,
    waitlistDesiredType,
    setShowUpgradeDisclaimer,
    setUpgradeAction,
  ]);

  useEffect(() => {
    if (!waitlistDesiredType) return;
    if (waitlistBackupType) return;
    if (!session.sessionId) return;
    if (!lane) return;
    setShowWaitlistModal(true);
    void (async () => {
      try {
        const response = await fetch(
          `${apiBase}/v1/checkin/lane/${lane}/waitlist-info?desiredTier=${waitlistDesiredType}&currentTier=${selectedRental || 'LOCKER'}`
        );
        if (response.ok) {
          const data: unknown = await response.json();
          if (data && typeof data === 'object') {
            const record = data as Record<string, unknown>;
            setWaitlistPosition(
              typeof record.position === 'number' ? record.position : null
            );
            setWaitlistETA(
              typeof record.estimatedReadyAt === 'string' ? record.estimatedReadyAt : null
            );
            setWaitlistUpgradeFee(
              typeof record.upgradeFee === 'number' ? record.upgradeFee : null
            );
          }
        }
      } catch (error) {
        console.error('Failed to fetch waitlist info:', error);
      }
    })();
  }, [
    apiBase,
    lane,
    selectedRental,
    session.sessionId,
    setShowWaitlistModal,
    setWaitlistETA,
    setWaitlistPosition,
    setWaitlistUpgradeFee,
    waitlistBackupType,
    waitlistDesiredType,
  ]);

  const membershipStatus = getMembershipStatus(session, Date.now());
  const isMember = membershipStatus === 'ACTIVE' || membershipStatus === 'PENDING';
  const isExpired = membershipStatus === 'EXPIRED';

  return (
    <>
      <SelectionScreen
        session={session}
        inventory={inventory}
        proposedRentalType={proposedRentalType}
        proposedBy={proposedBy}
        selectionConfirmed={selectionConfirmed}
        selectionConfirmedBy={selectionConfirmedBy}
        selectedRental={selectedRental}
        isSubmitting={isSubmitting}
        orientationOverlay={orientationOverlay}
        welcomeOverlay={welcomeOverlay}
        notice={notices.notice}
        onSelectRental={(rental) => void actions.handleRentalSelection(rental)}
        membershipChoice={isMember ? null : membershipChoice}
        onSelectOneTimeMembership={() => void actions.handleSelectOneTimeMembership()}
        onSelectSixMonthMembership={() => openMembershipModal(isExpired ? 'RENEW' : 'PURCHASE')}
        highlightedMembershipChoice={highlightedMembershipChoice}
      />
      <SelectionFlowModals
        session={session}
        inventory={inventory}
        waitlistDesiredType={waitlistDesiredType}
        waitlistPosition={waitlistPosition}
        waitlistETA={waitlistETA}
        waitlistUpgradeFee={waitlistUpgradeFee}
        showWaitlistModal={showWaitlistModal}
        highlightedWaitlistBackup={highlightedWaitlistBackup}
        showUpgradeDisclaimer={showUpgradeDisclaimer}
        showCustomerConfirmation={showCustomerConfirmation}
        customerConfirmationData={customerConfirmationData}
        showRenewalDisclaimer={showRenewalDisclaimer}
        showMembershipModal={showMembershipModal}
        membershipModalIntent={membershipModalIntent}
        isSubmitting={isSubmitting}
        onAcknowledgeUpgrade={() => void actions.handleDisclaimerAcknowledge()}
        onCloseUpgrade={() => setShowUpgradeDisclaimer(false)}
        onCustomerConfirm={(confirmed) => void actions.handleCustomerConfirmSelection(confirmed)}
        onWaitlistBackupSelection={actions.handleWaitlistBackupSelection}
        onWaitlistCancel={() => void actions.handleWaitlistCancel()}
        onCloseRenewal={() => setShowRenewalDisclaimer(false)}
        onProceedRenewal={() => {
          setShowRenewalDisclaimer(false);
          callbacks.onProceedToAgreement();
        }}
        onMembershipContinue={() => void actions.handleMembershipContinue()}
        onMembershipClose={() => {
          setShowMembershipModal(false);
          setMembershipModalIntent(null);
        }}
      />
    </>
  );
}
