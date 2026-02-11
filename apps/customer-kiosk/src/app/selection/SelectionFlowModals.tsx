import type { CustomerConfirmationRequiredPayload } from '@club-ops/shared';
import { CustomerConfirmationModal } from '../../components/modals/CustomerConfirmationModal';
import { RenewalDisclaimerModal } from '../../components/modals/RenewalDisclaimerModal';
import { UpgradeDisclaimerModal } from '../../components/modals/UpgradeDisclaimerModal';
import { WaitlistModal } from '../../components/modals/WaitlistModal';
import type { SessionState } from '../../utils/membership';
import type { SelectionInventory, WaitlistUnavailableOptions } from './types';

type SelectionFlowModalsProps = {
  session: SessionState;
  inventory: SelectionInventory;
  waitlistDesiredType: string | null;
  waitlistDesiredTypes: string[];
  waitlistRequestedResourceNumber: string | null;
  waitlistRequestedResourceType: 'room' | 'locker' | null;
  waitlistUnavailableOptions: WaitlistUnavailableOptions;
  waitlistPosition: number | null;
  waitlistETA: string | null;
  waitlistUpgradeFee: number | null;
  showWaitlistModal: boolean;
  highlightedWaitlistBackup: string | null;
  showUpgradeDisclaimer: boolean;
  showCustomerConfirmation: boolean;
  customerConfirmationData: CustomerConfirmationRequiredPayload | null;
  showRenewalDisclaimer: boolean;
  isSubmitting: boolean;
  onAcknowledgeUpgrade: () => void;
  onCloseUpgrade: () => void;
  onCustomerConfirm: (confirmed: boolean) => void;
  onWaitlistDesiredTypesChange: (next: string[]) => void;
  onWaitlistSpecificSelection: (params: {
    resourceType: 'room' | 'locker' | null;
    resourceNumber: string | null;
  }) => void;
  onWaitlistSpecificFocus: () => void;
  onWaitlistBackupSelection: (rental: string) => void;
  onWaitlistSubmit: () => void;
  onWaitlistCancel: () => void;
  onCloseRenewal: () => void;
  onProceedRenewal: () => void;
  onMembershipContinue?: () => void;
  onMembershipClose?: () => void;
};

export function SelectionFlowModals({
  session,
  inventory,
  waitlistDesiredType,
  waitlistDesiredTypes,
  waitlistRequestedResourceNumber,
  waitlistRequestedResourceType,
  waitlistUnavailableOptions,
  waitlistPosition,
  waitlistETA,
  waitlistUpgradeFee,
  showWaitlistModal,
  highlightedWaitlistBackup,
  showUpgradeDisclaimer,
  showCustomerConfirmation,
  customerConfirmationData,
  showRenewalDisclaimer,
  isSubmitting,
  onAcknowledgeUpgrade,
  onCloseUpgrade,
  onCustomerConfirm,
  onWaitlistDesiredTypesChange,
  onWaitlistSpecificSelection,
  onWaitlistSpecificFocus,
  onWaitlistBackupSelection,
  onWaitlistSubmit,
  onWaitlistCancel,
  onCloseRenewal,
  onProceedRenewal,
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
          desiredTypes={waitlistDesiredTypes}
          requestedResourceNumber={waitlistRequestedResourceNumber}
          requestedResourceType={waitlistRequestedResourceType}
          specificOptions={waitlistUnavailableOptions}
          allowedRentals={session.allowedRentals}
          inventory={inventory}
          position={waitlistPosition}
          eta={waitlistETA}
          upgradeFee={waitlistUpgradeFee}
          isSubmitting={isSubmitting}
          highlightedBackupRental={highlightedWaitlistBackup}
          onDesiredTypesChange={onWaitlistDesiredTypesChange}
          onSpecificSelection={onWaitlistSpecificSelection}
          onSpecificFocus={onWaitlistSpecificFocus}
          onBackupSelection={onWaitlistBackupSelection}
          onSubmit={onWaitlistSubmit}
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
    </>
  );
}
