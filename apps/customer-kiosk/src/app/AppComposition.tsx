import { AgreementFlow } from './AgreementFlow';
import { SelectionFlow } from './SelectionFlow';
import { IdleScreen } from '../screens/IdleScreen';
import { LanguageScreen } from '../screens/LanguageScreen';
import { LaneSelectionScreen } from '../screens/LaneSelectionScreen';
import { PaymentScreen } from '../screens/PaymentScreen';
import { AgreementBypassScreen } from '../screens/AgreementBypassScreen';
import { CompleteScreen } from '../screens/CompleteScreen';
import { IdScanBlockedModal } from '../components/modals/IdScanBlockedModal';
import { WelcomeOverlay } from '../components/WelcomeOverlay';
import { useKioskController } from './hooks/useKioskController';
import { useEffect } from 'react';

export function AppComposition() {
  const {
    apiBase,
    kioskAuthHeaders,
    lane,
    handleLaneSelection,
    orientationOverlay,
    inventory,
    session,
    view,
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
    upgradeAction,
    upgradeDisclaimerAcknowledged,
    showRenewalDisclaimer,
    showCustomerConfirmation,
    customerConfirmationData,
    membershipChoice,
    showMembershipModal,
    membershipModalIntent,
    highlightedLanguage,
    highlightedMembershipChoice,
    highlightedWaitlistBackup,
    checkinMode,
    isSubmitting,
    setIsSubmitting,
    setView,
    setProposedRentalType,
    setProposedBy,
    setSelectionConfirmed,
    setSelectionConfirmedBy,
    setWaitlistDesiredType,
    setWaitlistDesiredTypes,
    setWaitlistBackupType,
    setWaitlistRequestedResourceNumber,
    setWaitlistRequestedResourceType,
    setWaitlistUnavailableOptions,
    setWaitlistPosition,
    setWaitlistETA,
    setWaitlistUpgradeFee,
    setShowWaitlistModal,
    setShowUpgradeDisclaimer,
    setUpgradeAction,
    setUpgradeDisclaimerAcknowledged,
    setShowRenewalDisclaimer,
    setShowCustomerConfirmation,
    setCustomerConfirmationData,
    setMembershipChoice,
    setShowMembershipModal,
    setMembershipModalIntent,
    setHighlightedWaitlistBackup,
    setSession,
    showWelcomeOverlay,
    dismissWelcomeOverlay,
    notice,
    showNotice,
    clearNotice,
    handleLanguageSelection,
    handleKioskAcknowledge,
    handleIdScanIssueDismiss,
  } = useKioskController();

  const welcomeOverlayNode = (
    <WelcomeOverlay
      isOpen={showWelcomeOverlay}
      language={session.customerPrimaryLanguage}
      customerName={session.customerName}
      onDismiss={dismissWelcomeOverlay}
    />
  );

  useEffect(() => {
    clearNotice();
  }, [clearNotice, view]);

  if (!lane) {
    return (
      <LaneSelectionScreen
        orientationOverlay={orientationOverlay}
        onSelectLane={handleLaneSelection}
      />
    );
  }

  let screen: JSX.Element | null = null;

  switch (view) {
    case 'idle':
      screen = (
        <IdleScreen
          customerPrimaryLanguage={session.customerPrimaryLanguage}
          orientationOverlay={orientationOverlay}
        />
      );
      break;

    case 'language':
      screen = (
        <LanguageScreen
          customerPrimaryLanguage={session.customerPrimaryLanguage}
          onSelectLanguage={(lang) => void handleLanguageSelection(lang)}
          isSubmitting={isSubmitting}
          highlightedLanguage={highlightedLanguage}
          orientationOverlay={orientationOverlay}
          welcomeOverlay={welcomeOverlayNode}
          notice={notice}
        />
      );
      break;

    case 'payment':
      screen = (
        <PaymentScreen
          customerPrimaryLanguage={session.customerPrimaryLanguage}
          paymentLineItems={session.paymentLineItems}
          paymentTotal={session.paymentTotal}
          paymentFailureReason={session.paymentFailureReason}
          orientationOverlay={orientationOverlay}
          welcomeOverlay={welcomeOverlayNode}
        />
      );
      break;

    case 'agreement-bypass':
      screen = (
        <AgreementBypassScreen
          customerPrimaryLanguage={session.customerPrimaryLanguage}
          orientationOverlay={orientationOverlay}
          welcomeOverlay={welcomeOverlayNode}
        />
      );
      break;

    case 'agreement':
      screen = (
        <AgreementFlow
          apiBase={apiBase}
          kioskAuthHeaders={kioskAuthHeaders}
          session={session}
          lane={lane}
          checkinMode={checkinMode}
          orientationOverlay={orientationOverlay}
          welcomeOverlay={welcomeOverlayNode}
          isSubmitting={isSubmitting}
          setIsSubmitting={setIsSubmitting}
          notice={notice}
          showNotice={showNotice}
        />
      );
      break;

    case 'complete':
      screen = (
        <CompleteScreen
          customerPrimaryLanguage={session.customerPrimaryLanguage}
          assignedResourceType={session.assignedResourceType}
          assignedResourceNumber={session.assignedResourceNumber}
          checkoutAt={session.checkoutAt}
          isSubmitting={isSubmitting}
          onAcknowledge={() => void handleKioskAcknowledge()}
          orientationOverlay={orientationOverlay}
          welcomeOverlay={welcomeOverlayNode}
        />
      );
      break;

    case 'selection':
      screen = (
        <SelectionFlow
          apiBase={apiBase}
          kioskAuthHeaders={kioskAuthHeaders}
          state={{
            session,
            lane,
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
            upgradeAction,
            upgradeDisclaimerAcknowledged,
            showRenewalDisclaimer,
            showCustomerConfirmation,
            customerConfirmationData,
            membershipChoice,
            showMembershipModal,
            membershipModalIntent,
            highlightedMembershipChoice,
            highlightedWaitlistBackup,
          }}
          setters={{
            setProposedRentalType,
            setProposedBy,
            setSelectionConfirmed,
            setSelectionConfirmedBy,
            setWaitlistDesiredType,
            setWaitlistDesiredTypes,
            setWaitlistBackupType,
            setWaitlistRequestedResourceNumber,
            setWaitlistRequestedResourceType,
            setWaitlistUnavailableOptions,
            setWaitlistPosition,
            setWaitlistETA,
            setWaitlistUpgradeFee,
            setShowWaitlistModal,
            setShowUpgradeDisclaimer,
            setUpgradeAction,
            setUpgradeDisclaimerAcknowledged,
            setShowRenewalDisclaimer,
            setShowCustomerConfirmation,
            setCustomerConfirmationData,
            setMembershipChoice,
            setShowMembershipModal,
            setMembershipModalIntent,
            setHighlightedWaitlistBackup,
            setSession,
          }}
          ui={{
            orientationOverlay,
            welcomeOverlay: welcomeOverlayNode,
            isSubmitting,
            setIsSubmitting,
          }}
          callbacks={{
            onSwitchToLanguage: () => setView('language'),
            onProceedToAgreement: () => setView('agreement'),
          }}
          notices={{
            notice,
            showNotice,
          }}
        />
      );
      break;

    default:
      screen = null;
  }

  return (
    <>
      {screen}
      <IdScanBlockedModal
        isOpen={!!session.idScanIssue}
        issue={session.idScanIssue ?? null}
        customerPrimaryLanguage={session.customerPrimaryLanguage}
        onAcknowledge={() => void handleIdScanIssueDismiss()}
        isSubmitting={isSubmitting}
      />
    </>
  );
}
