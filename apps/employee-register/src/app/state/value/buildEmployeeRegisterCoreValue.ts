import type { CheckinStage } from '../../../components/register/CustomerProfileCard';
import type { useCheckoutState } from '../slices/useCheckoutState';
import type { useCustomerSearchState } from '../slices/useCustomerSearchState';
import type { useCustomerSessionActions } from '../slices/useCustomerSessionActions';
import type { useHealthStatus } from '../slices/useHealthStatus';
import type { useNavigationState } from '../slices/useNavigationState';
import type { useInventorySelectionState } from '../slices/useInventorySelectionState';
import type { useLaneSessionBindings } from '../slices/useLaneSessionBindings';
import type { useManualEntryState } from '../slices/useManualEntryState';
import type { useMembershipActions } from '../slices/useMembershipActions';
import type { useRenewalSelectionState } from '../slices/useRenewalSelectionState';
import type { useSelectionActions } from '../slices/useSelectionActions';
import type { useSessionResetActions } from '../slices/useSessionResetActions';
import type { useStaffSessionState } from '../slices/useStaffSessionState';
import type { useWaitlistUpgradeState } from '../slices/useWaitlistUpgradeState';
import { sendFlowCommand } from '../shared/flowCommands';

type EmployeeRegisterCoreParams = {
  deviceId: ReturnType<typeof useStaffSessionState>['deviceId'];
  handleRegisterSignIn: ReturnType<typeof useStaffSessionState>['handleRegisterSignIn'];
  lane: ReturnType<typeof useStaffSessionState>['lane'];
  health: ReturnType<typeof useHealthStatus>['health'];
  realtimeConnected: boolean;
  realtimeMode: 'cloud' | 'lan';
  handleLogout: ReturnType<typeof useStaffSessionState>['handleLogout'];
  handleCloseOut: ReturnType<typeof useStaffSessionState>['handleCloseOut'];
  registerSession: ReturnType<typeof useStaffSessionState>['registerSession'];
  session: ReturnType<typeof useStaffSessionState>['session'];
  checkoutState: ReturnType<typeof useCheckoutState>;
  navState: ReturnType<typeof useNavigationState>;
  waitlistState: ReturnType<typeof useWaitlistUpgradeState>;
  laneBindings: ReturnType<typeof useLaneSessionBindings>;
  selectionActions: ReturnType<typeof useSelectionActions>;
  membershipActions: ReturnType<typeof useMembershipActions>;
  sessionResetActions: ReturnType<typeof useSessionResetActions>;
  inventorySelectionState: ReturnType<typeof useInventorySelectionState>;
  customerSessionActions: ReturnType<typeof useCustomerSessionActions>;
  manualEntryState: ReturnType<typeof useManualEntryState>;
  setManualEntry: (value: boolean) => void;
  customerSearchState: ReturnType<typeof useCustomerSearchState>;
  assignedLabel: string;
  checkinStage: CheckinStage | null;
  isSubmitting: boolean;
  laneSessionMode: ReturnType<typeof useLaneSessionBindings>['mode'];
  renewalHours: ReturnType<typeof useLaneSessionBindings>['renewalHours'];
  ledgerLineItems: ReturnType<typeof useLaneSessionBindings>['ledgerLineItems'];
  ledgerTotal: ReturnType<typeof useLaneSessionBindings>['ledgerTotal'];
  renewalSelectionState: ReturnType<typeof useRenewalSelectionState>;
};

export function buildEmployeeRegisterCoreValue(params: EmployeeRegisterCoreParams) {
  const {
    deviceId,
    handleRegisterSignIn,
    lane,
    health,
    realtimeConnected,
    realtimeMode,
    handleLogout,
    handleCloseOut,
    registerSession,
    session,
    checkoutState,
    navState,
    waitlistState,
    laneBindings,
    selectionActions,
    membershipActions,
    sessionResetActions,
    inventorySelectionState,
    customerSessionActions,
    manualEntryState,
    setManualEntry,
    customerSearchState,
    assignedLabel,
    checkinStage,
    laneSessionMode,
    renewalHours,
    ledgerLineItems,
    ledgerTotal,
    renewalSelectionState,
  } = params;

  const {
    laneSession,
    laneSessionActions,
    currentSessionId,
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
    customerSelectedType,
    waitlistDesiredTier,
    waitlistDesiredTypes,
    waitlistBackupType,
    waitlistRequestedResourceNumber,
    waitlistRequestedResourceType,
    assignedResourceType,
    assignedResourceNumber,
    checkoutAt,
    agreementSigned,
    agreementBypassPending,
    agreementSignedMethod,
    paymentIntentId,
    paymentQuote,
    paymentStatus,
    paymentDeclineError,
    pastDueBlocked,
    pastDueBalance,
    flowVersion,
  } = laneBindings;

  const handleBackStep = async () => {
    if (!lane) return;
    if (!session?.sessionToken) return;
    if (!currentSessionId) return;
    if (typeof flowVersion !== 'number') return;
    await sendFlowCommand({
      lane,
      sessionToken: session.sessionToken,
      sessionId: currentSessionId,
      flowVersion,
      actor: 'EMPLOYEE',
      type: 'BACK_STEP',
    });
  };

  const handleCancelStep = async () => {
    if (!lane) return;
    if (!session?.sessionToken) return;
    if (!currentSessionId) return;
    if (typeof flowVersion !== 'number') return;
    await sendFlowCommand({
      lane,
      sessionToken: session.sessionToken,
      sessionId: currentSessionId,
      flowVersion,
      actor: 'EMPLOYEE',
      type: 'CANCEL_STEP',
    });
  };

  return {
    deviceId,
    handleRegisterSignIn,
    lane,
    health,
    realtimeConnected,
    realtimeMode,
    handleLogout,
    handleCloseOut,
    registerSession,
    session,
    checkoutRequests: checkoutState.checkoutRequests,
    selectedCheckoutRequest: checkoutState.selectedCheckoutRequest,
    checkoutItemsConfirmed: checkoutState.checkoutItemsConfirmed,
    checkoutFeePaid: checkoutState.checkoutFeePaid,
    handleClaimCheckout: checkoutState.handleClaimCheckout,
    openCustomerAccount: navState.openCustomerAccount,
    handleConfirmItems: checkoutState.handleConfirmItems,
    handleMarkFeePaid: checkoutState.handleMarkFeePaid,
    handleCompleteCheckout: checkoutState.handleCompleteCheckout,
    setSelectedCheckoutRequest: checkoutState.setSelectedCheckoutRequest,
    setCheckoutChecklist: checkoutState.setCheckoutChecklist,
    setCheckoutItemsConfirmed: checkoutState.setCheckoutItemsConfirmed,
    setCheckoutFeePaid: checkoutState.setCheckoutFeePaid,
    navTab: navState.navTab,
    selectNavTab: navState.selectNavTab,
    returnToPreviousTab: navState.returnToPreviousTab,
    handleBackStep,
    handleCancelStep,
    canOpenAccountTab: navState.canOpenAccountTab,
    inventoryHasLate: checkoutState.inventoryHasLate,
    setInventoryHasLate: checkoutState.setInventoryHasLate,
    hasEligibleEntries: waitlistState.hasEligibleEntries,
    isEntryOfferEligible: waitlistState.isEntryOfferEligible,
    dismissUpgradePulse: waitlistState.dismissUpgradePulse,
    startCheckout: navState.startCheckout,
    startCheckoutFromInventory: navState.startCheckoutFromInventory,
    startCheckoutFromCustomerAccount: navState.startCheckoutFromCustomerAccount,
    exitCheckout: navState.exitCheckout,
    accountCustomerId: navState.accountCustomerId,
    accountCustomerLabel: navState.accountCustomerLabel,
    accountCustomerSummary: navState.accountCustomerSummary,
    accountAutoStartCheckin: navState.accountAutoStartCheckin,
    laneSession,
    laneSessionActions,
    currentSessionId,
    customerName,
    membershipNumber,
    customerMembershipValidUntil,
    membershipPurchaseIntent,
    membershipChoice,
    laneSessionMode,
    renewalHours,
    ledgerLineItems,
    ledgerTotal,
    allowedRentals,
    proposedRentalType,
    proposedBy,
    selectionConfirmed,
    customerPrimaryLanguage,
    customerDob,
    customerDobMonthDay,
    customerIdNumber,
    customerLastVisitAt,
    checkinStage,
    customerIdExpirationDate,
    customerIdType,
    customerIdTypeOther,
    customerSelectedType,
    waitlistDesiredTier,
    waitlistDesiredTypes,
    waitlistBackupType,
    waitlistRequestedResourceNumber,
    waitlistRequestedResourceType,
    inventoryAvailable: waitlistState.inventoryAvailable,
    assignedResourceType,
    assignedResourceNumber,
    checkoutAt,
    agreementSigned,
    agreementBypassPending,
    agreementSignedMethod,
    paymentIntentId,
    paymentQuote,
    paymentStatus,
    paymentDeclineError,
    pastDueBlocked,
    pastDueBalance,
    isSubmitting: params.isSubmitting,
    highlightKioskOption: membershipActions.highlightKioskOption,
    handleConfirmLanguage: membershipActions.handleConfirmLanguage,
    handleConfirmMembershipOneTime: membershipActions.handleConfirmMembershipOneTime,
    handleConfirmMembershipSixMonth: membershipActions.handleConfirmMembershipSixMonth,
    handleProposeSelection: selectionActions.handleProposeSelection,
    handleCustomerSelectRental: selectionActions.handleCustomerSelectRental,
    handleDirectSelectRental: selectionActions.handleDirectSelectRental,
    handleSelectWaitlistBackupAsCustomer: selectionActions.handleSelectWaitlistBackupAsCustomer,
    handleDirectSelectWaitlistBackup: selectionActions.handleDirectSelectWaitlistBackup,
    handleConfirmSelection: selectionActions.handleConfirmSelection,
    handleStartAgreementBypass: selectionActions.handleStartAgreementBypass,
    renewalSelection: renewalSelectionState.renewalSelection,
    renewalSelectionError: renewalSelectionState.renewalSelectionError,
    openRenewalSelection: renewalSelectionState.openRenewalSelection,
    closeRenewalSelection: renewalSelectionState.closeRenewalSelection,
    handleStartRenewal: renewalSelectionState.handleStartRenewal,
    handleClearSession: sessionResetActions.handleClearSession,
    handleInventorySelect: inventorySelectionState.handleInventorySelect,
    startLaneSessionByCustomerId: customerSessionActions.startLaneSessionByCustomerId,
    handleManualSubmit: manualEntryState.handleManualSubmit,
    setManualEntry,
    manualFirstName: manualEntryState.manualFirstName,
    setManualFirstName: manualEntryState.setManualFirstName,
    manualLastName: manualEntryState.manualLastName,
    setManualLastName: manualEntryState.setManualLastName,
    manualDobDigits: manualEntryState.manualDobDigits,
    setManualDobDigits: manualEntryState.setManualDobDigits,
    manualDobIso: manualEntryState.manualDobIso,
    manualIdExpirationDigits: manualEntryState.manualIdExpirationDigits,
    setManualIdExpirationDigits: manualEntryState.setManualIdExpirationDigits,
    manualIdExpirationIso: manualEntryState.manualIdExpirationIso,
    manualIdType: manualEntryState.manualIdType,
    setManualIdType: manualEntryState.setManualIdType,
    manualIdTypeOther: manualEntryState.manualIdTypeOther,
    setManualIdTypeOther: manualEntryState.setManualIdTypeOther,
    manualIdNumber: manualEntryState.manualIdNumber,
    setManualIdNumber: manualEntryState.setManualIdNumber,
    manualEntrySubmitting: manualEntryState.manualEntrySubmitting,
    manualExistingPrompt: manualEntryState.manualExistingPrompt,
    manualExistingPromptError: manualEntryState.manualExistingPromptError,
    manualExistingPromptSubmitting: manualEntryState.manualExistingPromptSubmitting,
    setManualExistingPrompt: manualEntryState.setManualExistingPrompt,
    setManualExistingPromptError: manualEntryState.setManualExistingPromptError,
    setManualExistingPromptSubmitting: manualEntryState.setManualExistingPromptSubmitting,
    customerSearch: customerSearchState.customerSearch,
    setCustomerSearch: customerSearchState.setCustomerSearch,
    customerSearchLoading: customerSearchState.customerSearchLoading,
    customerSuggestions: customerSearchState.customerSuggestions,
    setCustomerSuggestions: customerSearchState.setCustomerSuggestions,
    inventoryForcedSection: inventorySelectionState.inventoryForcedSection,
    setInventoryForcedSection: inventorySelectionState.setInventoryForcedSection,
    selectedInventoryItem: inventorySelectionState.selectedInventoryItem,
    setSelectedInventoryItem: inventorySelectionState.setSelectedInventoryItem,
    inventoryRefreshNonce: checkoutState.inventoryRefreshNonce,
    setInventoryRefreshNonce: checkoutState.setInventoryRefreshNonce,
    waitlistEntries: waitlistState.waitlistEntries,
    showWaitlistModal: waitlistState.showWaitlistModal,
    setShowWaitlistModal: waitlistState.setShowWaitlistModal,
    offerUpgradeModal: waitlistState.offerUpgradeModal,
    setOfferUpgradeModal: waitlistState.setOfferUpgradeModal,
    openOfferUpgradeModal: waitlistState.openOfferUpgradeModal,
    resetUpgradeState: waitlistState.resetUpgradeState,
    setSelectedWaitlistEntry: waitlistState.setSelectedWaitlistEntry,
    handleStartUpgradePayment: waitlistState.handleStartUpgradePayment,
    refreshWaitlistAndInventory: waitlistState.refreshWaitlistAndInventory,
    checkoutEntryMode: navState.checkoutEntryMode,
    checkoutPrefill: navState.checkoutPrefill,
    checkoutReturnToTabRef: navState.checkoutReturnToTabRef,
    showCustomerConfirmationPending: inventorySelectionState.showCustomerConfirmationPending,
    customerConfirmationType: inventorySelectionState.customerConfirmationType,
    setShowCustomerConfirmationPending: inventorySelectionState.setShowCustomerConfirmationPending,
    setCustomerConfirmationType: inventorySelectionState.setCustomerConfirmationType,
    assignedLabel,
  };
}
