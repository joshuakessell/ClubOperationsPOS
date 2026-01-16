import type { ComponentProps, FormEvent } from 'react';
import { RegisterMainView } from '../views/RegisterMainView';
import { useRegisterAssignmentActions } from './useRegisterAssignmentActions';
import { useRegisterSelectionActions } from './useRegisterSelectionActions';
import type { RegisterSessionState } from '../../../app/registerSessionReducer';
import type { InventorySelectionController } from '../../inventory/useInventorySelectionController';

export type RegisterMainViewProps = ComponentProps<typeof RegisterMainView>;

export function useRegisterMainViewProps(opts: {
  lane: string;
  sessionToken: string | null;

  // From reducer / register view-model
  registerState: RegisterSessionState;
  patchRegister: (patch: Partial<RegisterSessionState>) => void;

  // Local view state
  isSubmitting: boolean;
  setIsSubmitting: (next: boolean) => void;
  showAlert: (message: string, title?: string) => void;

  // Inventory controller
  inventory: InventorySelectionController;

  // Customer-confirmation modal state (assignment guard)
  showCustomerConfirmationPending: boolean;
  setShowCustomerConfirmationPending: (next: boolean) => void;

  // Inventory availability counts (summary bar)
  inventoryAvailable: RegisterMainViewProps['inventoryAvailable'];

  // Note modal
  onAddNote: () => void;

  // Payment + signature actions still live outside for now
  onManualSignatureOverride: () => void;
  onMarkPaid: () => void;

  // Customer search state
  customerSearch: string;
  setCustomerSearch: (next: string) => void;
  customerSearchLoading: boolean;
  customerSuggestions: RegisterMainViewProps['customerSuggestions'];
  selectedCustomerId: string | null;
  selectedCustomerLabel: string | null;
  setSelectedCustomerId: (next: string | null) => void;
  setSelectedCustomerLabel: (next: string | null) => void;
  onConfirmCustomerSelection: () => void;

  // Manual entry state
  manualEntry: boolean;
  setManualEntry: (next: boolean) => void;
  manualFirstName: string;
  setManualFirstName: (next: string) => void;
  manualLastName: string;
  setManualLastName: (next: string) => void;
  manualDobDigits: string;
  setManualDobDigits: (next: string) => void;
  onManualSubmit: (e: FormEvent) => void;
  manualEntrySubmitting: boolean;

  onClearSession: () => void;
}) {
  const currentSessionId = opts.registerState.sessionId;
  const proposedRentalType = opts.registerState.proposedRentalType;
  const selectionConfirmed = opts.registerState.selectionConfirmed;

  const selectionActions = useRegisterSelectionActions({
    lane: opts.lane,
    sessionToken: opts.sessionToken,
    currentSessionId,
    proposedRentalType,
    selectionConfirmed,
    setIsSubmitting: opts.setIsSubmitting,
    patchRegister: opts.patchRegister as unknown as (patch: Record<string, unknown>) => void,
    showAlert: opts.showAlert,
  });

  const assignmentActions = useRegisterAssignmentActions({
    lane: opts.lane,
    sessionToken: opts.sessionToken,
    currentSessionId,
    selectedInventoryItem: opts.inventory.selectedInventoryItem,
    showCustomerConfirmationPending: opts.showCustomerConfirmationPending,
    setShowCustomerConfirmationPending: opts.setShowCustomerConfirmationPending,
    agreementSigned: !!opts.registerState.agreementSigned,
    paymentStatus: opts.registerState.paymentStatus,
    setIsSubmitting: opts.setIsSubmitting,
    clearSelection: opts.inventory.clearSelection,
    showAlert: opts.showAlert,
  });

  const props: RegisterMainViewProps = {
    currentSessionId,
    customerName: opts.registerState.customerName,
    customerPrimaryLanguage: opts.registerState.customerPrimaryLanguage ?? null,
    customerDobMonthDay: opts.registerState.customerDobMonthDay ?? null,
    customerLastVisitAt: opts.registerState.customerLastVisitAt ?? null,
    pastDueBalance: opts.registerState.pastDueBalance,
    customerNotes: opts.registerState.customerNotes ?? null,
    onAddNote: opts.onAddNote,

    waitlistDesiredTier: opts.registerState.waitlistDesiredTier,
    waitlistBackupType: opts.registerState.waitlistBackupType,

    proposedRentalType: opts.registerState.proposedRentalType,
    proposedBy: opts.registerState.proposedBy,
    selectionConfirmed: opts.registerState.selectionConfirmed,
    selectionConfirmedBy: opts.registerState.selectionConfirmedBy,
    onConfirmSelection: () => void selectionActions.onConfirmSelection(),

    pastDueBlocked: opts.registerState.pastDueBlocked,
    isSubmitting: opts.isSubmitting,
    onProposeSelection: (rentalType) => void selectionActions.onProposeSelection(rentalType),

    inventoryAvailable: opts.inventoryAvailable,
    onOpenInventorySection: (section) => opts.inventory.openInventorySection(section),

    selectedInventoryItem: opts.inventory.selectedInventoryItem,
    customerSelectedType: opts.registerState.customerSelectedType,
    showCustomerConfirmationPending: opts.showCustomerConfirmationPending,
    agreementSigned: !!opts.registerState.agreementSigned,
    paymentStatus: opts.registerState.paymentStatus,
    paymentQuote: opts.registerState.paymentQuote,
    onAssign: () => void assignmentActions.onAssign(),
    onManualSignatureOverride: opts.onManualSignatureOverride,
    onClearSelection: opts.inventory.clearSelection,
    onMarkPaid: opts.onMarkPaid,

    customerSearch: opts.customerSearch,
    setCustomerSearch: opts.setCustomerSearch,
    customerSearchLoading: opts.customerSearchLoading,
    customerSuggestions: opts.customerSuggestions,
    selectedCustomerId: opts.selectedCustomerId,
    selectedCustomerLabel: opts.selectedCustomerLabel,
    setSelectedCustomerId: opts.setSelectedCustomerId,
    setSelectedCustomerLabel: opts.setSelectedCustomerLabel,
    onConfirmCustomerSelection: opts.onConfirmCustomerSelection,

    manualEntry: opts.manualEntry,
    setManualEntry: opts.setManualEntry,
    manualFirstName: opts.manualFirstName,
    setManualFirstName: opts.setManualFirstName,
    manualLastName: opts.manualLastName,
    setManualLastName: opts.setManualLastName,
    manualDobDigits: opts.manualDobDigits,
    setManualDobDigits: opts.setManualDobDigits,
    onManualSubmit: opts.onManualSubmit,
    manualEntrySubmitting: opts.manualEntrySubmitting,
    onClearSession: opts.onClearSession,

    membershipNumber: opts.registerState.membershipNumber,
  };

  return props;
}

