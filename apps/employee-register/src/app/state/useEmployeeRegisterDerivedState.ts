import { useMemo } from 'react';
import { deriveAssignedLabel } from '../../shared/derive/assignedLabel';
import { deriveCheckinStage } from '../../shared/derive/checkinStage';
import { derivePastDueLineItems } from '../../shared/derive/pastDueLineItems';
import type { useCheckoutState } from './slices/useCheckoutState';
import type { useDocumentsState } from './slices/useDocumentsState';
import type { useInventorySelectionState } from './slices/useInventorySelectionState';
import type { useLaneSessionBindings } from './slices/useLaneSessionBindings';
import type { useMembershipPromptState } from './slices/useMembershipPromptState';
import type { useNotesState } from './slices/useNotesState';
import type { usePastDueState } from './slices/usePastDueState';
import type { useRenewalSelectionState } from './slices/useRenewalSelectionState';
import type { useWaitlistUpgradeState } from './slices/useWaitlistUpgradeState';

export type EmployeeRegisterDerivedParams = {
  laneBindings: ReturnType<typeof useLaneSessionBindings>;
  currentSessionId: string | null;
  customerName: string;
  selectionConfirmed: boolean;
  membershipNumber: string | null;
  customerMembershipValidUntil: string | null;
  membershipPurchaseIntent: 'PURCHASE' | 'RENEW' | null;
  proposedRentalType: string | null;
  customerSelectedType: string | null;
  pastDueBalance: number;
  pastDueState: ReturnType<typeof usePastDueState>;
  membershipPromptState: ReturnType<typeof useMembershipPromptState>;
  waitlistState: ReturnType<typeof useWaitlistUpgradeState>;
  notesState: ReturnType<typeof useNotesState>;
  documentsState: ReturnType<typeof useDocumentsState>;
  renewalSelectionState: ReturnType<typeof useRenewalSelectionState>;
  waitlistDesiredTier: string | null;
  waitlistBackupType: string | null;
  inventorySelectionState: ReturnType<typeof useInventorySelectionState>;
  checkoutState: ReturnType<typeof useCheckoutState>;
};

export function useEmployeeRegisterDerivedState(params: EmployeeRegisterDerivedParams) {
  const {
    laneBindings,
    currentSessionId,
    customerName,
    selectionConfirmed,
    membershipNumber,
    customerMembershipValidUntil,
    membershipPurchaseIntent,
    proposedRentalType,
    customerSelectedType,
    pastDueBalance,
    pastDueState,
    membershipPromptState,
    waitlistState,
    notesState,
    documentsState,
    renewalSelectionState,
    waitlistDesiredTier,
    waitlistBackupType,
    inventorySelectionState,
    checkoutState,
  } = params;

  const externalBlocking =
    pastDueState.showPastDueModal ||
    pastDueState.showManagerBypassModal ||
    membershipPromptState.showMembershipIdPrompt ||
    waitlistState.showUpgradePaymentModal ||
    notesState.showAddNoteModal ||
    documentsState.documentsModalOpen ||
    !!waitlistState.offerUpgradeModal ||
    !!renewalSelectionState.renewalSelection ||
    (waitlistState.showWaitlistModal && !!waitlistDesiredTier && !!waitlistBackupType) ||
    (inventorySelectionState.showCustomerConfirmationPending &&
      !!inventorySelectionState.customerConfirmationType) ||
    !!checkoutState.selectedCheckoutRequest;

  const checkinStage = useMemo(
    () =>
      deriveCheckinStage({
        currentSessionId,
        customerName,
        assignedResourceType: laneBindings.assignedResourceType,
        assignedResourceNumber: laneBindings.assignedResourceNumber,
        agreementSigned: laneBindings.agreementSigned,
        selectionConfirmed,
        customerPrimaryLanguage: laneBindings.customerPrimaryLanguage,
        membershipNumber: membershipNumber || null,
        customerMembershipValidUntil: customerMembershipValidUntil || null,
        membershipPurchaseIntent,
        membershipChoice: laneBindings.membershipChoice,
      }),
    [
      laneBindings.agreementSigned,
      laneBindings.assignedResourceNumber,
      laneBindings.assignedResourceType,
      customerMembershipValidUntil,
      customerName,
      laneBindings.customerPrimaryLanguage,
      currentSessionId,
      laneBindings.membershipChoice,
      membershipNumber,
      membershipPurchaseIntent,
      selectionConfirmed,
    ]
  );

  const assignedLabel = useMemo(
    () =>
      deriveAssignedLabel({
        assignedResourceType: laneBindings.assignedResourceType,
        proposedRentalType,
        customerSelectedType,
      }),
    [laneBindings.assignedResourceType, customerSelectedType, proposedRentalType]
  );

  const pastDueLineItems = useMemo(
    () => derivePastDueLineItems(laneBindings.customerNotes, pastDueBalance),
    [laneBindings.customerNotes, pastDueBalance]
  );

  return { externalBlocking, checkinStage, assignedLabel, pastDueLineItems };
}
