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
    inventory,
    selectedRental,
    proposedRentalType,
    proposedBy,
    selectionConfirmed,
    selectionConfirmedBy,
    waitlistDesiredType,
    waitlistDesiredTypes,
    waitlistBackupType,
    waitlistRequestedResourceNumber,
    waitlistRequestedResourceType,
    waitlistUnavailableOptions,
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
    highlightedWaitlistBackup,
  } = state;

  const { orientationOverlay, welcomeOverlay, isSubmitting } = ui;
  const {
    setUpgradeAction,
    setShowUpgradeDisclaimer,
    setShowRenewalDisclaimer,
  } = setters;

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

  const membershipStatus = getMembershipStatus(session, Date.now());
  const isMember = membershipStatus === 'ACTIVE' || membershipStatus === 'PENDING';

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
        onJoinWaitlist={() => void actions.handleOpenWaitlist()}
      />
      <SelectionFlowModals
        session={session}
        inventory={inventory}
        waitlistDesiredType={waitlistDesiredType}
        waitlistDesiredTypes={waitlistDesiredTypes}
        waitlistRequestedResourceNumber={waitlistRequestedResourceNumber}
        waitlistRequestedResourceType={waitlistRequestedResourceType}
        waitlistUnavailableOptions={waitlistUnavailableOptions}
        waitlistPosition={waitlistPosition}
        waitlistETA={waitlistETA}
        waitlistUpgradeFee={waitlistUpgradeFee}
        showWaitlistModal={showWaitlistModal}
        highlightedWaitlistBackup={highlightedWaitlistBackup}
        showUpgradeDisclaimer={showUpgradeDisclaimer}
        showCustomerConfirmation={showCustomerConfirmation}
        customerConfirmationData={customerConfirmationData}
        showRenewalDisclaimer={showRenewalDisclaimer}
        isSubmitting={isSubmitting}
        onAcknowledgeUpgrade={() => void actions.handleDisclaimerAcknowledge()}
        onCloseUpgrade={() => setShowUpgradeDisclaimer(false)}
        onCustomerConfirm={(confirmed) => void actions.handleCustomerConfirmSelection(confirmed)}
        onWaitlistDesiredTypesChange={actions.handleWaitlistDesiredTypesChange}
        onWaitlistSpecificSelection={actions.handleWaitlistSpecificSelection}
        onWaitlistSpecificFocus={() => void actions.handleWaitlistSpecificFocus()}
        onWaitlistBackupSelection={actions.handleWaitlistBackupSelection}
        onWaitlistBackToPreferences={actions.handleWaitlistBackToPreferences}
        onWaitlistSubmit={() => void actions.handleWaitlistSubmit()}
        onWaitlistCancel={() => void actions.handleWaitlistCancel()}
        onCloseRenewal={() => setShowRenewalDisclaimer(false)}
        onProceedRenewal={() => {
          setShowRenewalDisclaimer(false);
          callbacks.onProceedToAgreement();
        }}
      />
    </>
  );
}
