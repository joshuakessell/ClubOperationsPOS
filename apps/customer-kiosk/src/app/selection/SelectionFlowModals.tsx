import type { CustomerConfirmationRequiredPayload } from '@club-ops/shared';
import { CustomerConfirmationModal } from '../../components/modals/CustomerConfirmationModal';
import { MembershipModal } from '../../components/modals/MembershipModal';
import { RenewalDisclaimerModal } from '../../components/modals/RenewalDisclaimerModal';
import { UpgradeDisclaimerModal } from '../../components/modals/UpgradeDisclaimerModal';
import { WaitlistModal } from '../../components/modals/WaitlistModal';
import type { SessionState } from '../../utils/membership';
import type { SelectionInventory } from './types';

type SelectionFlowModalsProps = {
  session: SessionState;
  inventory: SelectionInventory;
  waitlistDesiredType: string | null;
  waitlistPosition: number | null;
  waitlistETA: string | null;
  waitlistUpgradeFee: number | null;
  showWaitlistModal: boolean;
  highlightedWaitlistBackup: string | null;
  showUpgradeDisclaimer: boolean;
  showCustomerConfirmation: boolean;
  customerConfirmationData: CustomerConfirmationRequiredPayload | null;
  showRenewalDisclaimer: boolean;
  showMembershipModal: boolean;
  membershipModalIntent: 'PURCHASE' | 'RENEW' | null;
  isSubmitting: boolean;
  onAcknowledgeUpgrade: () => void;
  onCloseUpgrade: () => void;
  onCustomerConfirm: (confirmed: boolean) => void;
  onWaitlistBackupSelection: (rental: string) => void;
  onWaitlistCancel: () => void;
  onCloseRenewal: () => void;
  onProceedRenewal: () => void;
  onMembershipContinue: () => void;
  onMembershipClose: () => void;
};

export function SelectionFlowModals({
  session,
  inventory,
  waitlistDesiredType,
  waitlistPosition,
  waitlistETA,
  waitlistUpgradeFee,
  showWaitlistModal,
  highlightedWaitlistBackup,
  showUpgradeDisclaimer,
  showCustomerConfirmation,
  customerConfirmationData,
  showRenewalDisclaimer,
  showMembershipModal,
  membershipModalIntent,
  isSubmitting,
  onAcknowledgeUpgrade,
  onCloseUpgrade,
  onCustomerConfirm,
  onWaitlistBackupSelection,
  onWaitlistCancel,
  onCloseRenewal,
  onProceedRenewal,
  onMembershipContinue,
  onMembershipClose,
}: SelectionFlowModalsProps) {
  return (
    <>
      <UpgradeDisclaimerModal
        isOpen={showUpgradeDisclaimer}
        customerPrimaryLanguage={session.customerPrimaryLanguage}
        onClose={onCloseUpgrade}
        onAcknowledge={onAcknowledgeUpgrade}
        isSubmitting={isSubmitting}
      />
      {customerConfirmationData && (
        <CustomerConfirmationModal
          isOpen={showCustomerConfirmation}
          customerPrimaryLanguage={session.customerPrimaryLanguage}
          data={customerConfirmationData}
          onAccept={() => onCustomerConfirm(true)}
          onDecline={() => onCustomerConfirm(false)}
          isSubmitting={isSubmitting}
        />
      )}
      {waitlistDesiredType && (
        <WaitlistModal
          isOpen={showWaitlistModal}
          customerPrimaryLanguage={session.customerPrimaryLanguage}
          desiredType={waitlistDesiredType}
          allowedRentals={session.allowedRentals}
          inventory={inventory}
          position={waitlistPosition}
          eta={waitlistETA}
          upgradeFee={waitlistUpgradeFee}
          isSubmitting={isSubmitting}
          highlightedBackupRental={highlightedWaitlistBackup}
          onBackupSelection={onWaitlistBackupSelection}
          onClose={onWaitlistCancel}
        />
      )}
      <RenewalDisclaimerModal
        isOpen={showRenewalDisclaimer}
        customerPrimaryLanguage={session.customerPrimaryLanguage}
        blockEndsAt={session.blockEndsAt}
        onClose={onCloseRenewal}
        onProceed={onProceedRenewal}
        isSubmitting={isSubmitting}
      />
      {membershipModalIntent && (
        <MembershipModal
          isOpen={showMembershipModal}
          customerPrimaryLanguage={session.customerPrimaryLanguage}
          intent={membershipModalIntent}
          onContinue={onMembershipContinue}
          onClose={onMembershipClose}
          isSubmitting={isSubmitting}
        />
      )}
    </>
  );
}
