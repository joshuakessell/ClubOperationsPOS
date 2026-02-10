import { useState } from 'react';
import { useEmployeeRegisterTabletUiTweaks } from '../../hooks/useEmployeeRegisterTabletUiTweaks';
import { useEmployeeRegisterDerivedState } from './useEmployeeRegisterDerivedState';
import { useAddOnSaleState } from './slices/useAddOnSaleState';
import { useCheckoutState } from './slices/useCheckoutState';
import { useCustomerSearchState } from './slices/useCustomerSearchState';
import { useCustomerSessionActions } from './slices/useCustomerSessionActions';
import { useDocumentsState } from './slices/useDocumentsState';
import { useHealthStatus } from './slices/useHealthStatus';
import { useHomeNavigationState } from './slices/useHomeNavigationState';
import { useInventorySelectionState } from './slices/useInventorySelectionState';
import { useLaneSessionBindings } from './slices/useLaneSessionBindings';
import { useLaneSessionCustomerLink } from './slices/useLaneSessionCustomerLink';
import { useManualEntryState } from './slices/useManualEntryState';
import { useMembershipActions } from './slices/useMembershipActions';
import { useMembershipPromptState } from './slices/useMembershipPromptState';
import { useNotesState } from './slices/useNotesState';
import { usePastDueState } from './slices/usePastDueState';
import { usePaymentActions } from './slices/usePaymentActions';
import { usePollingFallback } from './slices/usePollingFallback';
import { useRenewalSelectionState } from './slices/useRenewalSelectionState';
import { useRegisterRealtimeState } from './slices/useRegisterRealtimeState';
import { useScanState } from './slices/useScanState';
import { useSelectionActions } from './slices/useSelectionActions';
import { useSessionResetActions } from './slices/useSessionResetActions';
import { useStaffSessionState } from './slices/useStaffSessionState';
import { useToastState } from './slices/useToastState';
import type { ToastNotifier } from './shared/notifications';
import { useResetPaymentSessionState } from './shared/useResetPaymentSessionState';
import { useToastNotifier } from './shared/useToastNotifier';
import { useWaitlistUpgradeState } from './slices/useWaitlistUpgradeState';
import { buildEmployeeRegisterCoreValue } from './value/buildEmployeeRegisterCoreValue';
import { buildEmployeeRegisterModalValue } from './value/buildEmployeeRegisterModalValue';

export function useEmployeeRegisterStateValue() {
  useEmployeeRegisterTabletUiTweaks();

  const [manualEntry, setManualEntry] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [, setSelectedRentalType] = useState<string | null>(null);

  const laneBindings = useLaneSessionBindings();
  const {
    currentSessionId,
    customerName,
    checkoutAt,
    customerSelectedType,
    waitlistDesiredTier,
    waitlistBackupType,
    membershipNumber,
    membershipPurchaseIntent,
    paymentStatus,
    paymentQuote,
    customerMembershipValidUntil,
    pastDueBlocked,
    pastDueBalance,
    mode,
    renewalHours,
    ledgerLineItems,
    ledgerTotal,
    proposedRentalType,
    selectionConfirmed,
    paymentIntentId,
  } = laneBindings;

  const toastState = useToastState();
  const notifier: ToastNotifier = useToastNotifier(toastState.pushBottomToast);

  const staffSessionState = useStaffSessionState({
    currentSessionId,
    customerName,
    checkoutAt,
    notifications: notifier,
  });
  const {
    session,
    registerSession,
    deviceId,
    lane,
    handleRegisterSignIn,
    handleLogout,
    handleCloseOut,
  } = staffSessionState;

  const { health } = useHealthStatus(lane);
  const addOnState = useAddOnSaleState();

  const laneSessionCustomerId = laneBindings.customerId ?? null;
  const navState = useHomeNavigationState({
    setManualEntry,
    currentSessionId,
    laneSessionCustomerId,
  });

  useLaneSessionCustomerLink({
    accountCustomerId: navState.accountCustomerId,
    currentSessionId,
    laneSessionCustomerId,
    setCurrentSessionCustomerId: laneBindings.setCurrentSessionCustomerId,
  });

  const customerSessionActions = useCustomerSessionActions({
    session,
    openCustomerAccount: navState.openCustomerAccount,
    setIsSubmitting,
    notifications: notifier,
  });

  const manualEntryState = useManualEntryState({
    session,
    manualEntry,
    setManualEntry,
    startLaneSessionByCustomerId: customerSessionActions.startLaneSessionByCustomerId,
    notifications: notifier,
  });

  const customerSearchState = useCustomerSearchState(session);

  const inventorySelectionState = useInventorySelectionState({ customerSelectedType });

  const checkoutState = useCheckoutState({ session, setIsSubmitting, notifications: notifier });

  const waitlistState = useWaitlistUpgradeState({
    session,
    registerSession,
    sessionActive: !!currentSessionId,
    selectHomeTab: navState.selectHomeTab,
    setIsSubmitting,
    setPaymentDeclineError: laneBindings.setPaymentDeclineError,
    notifications: notifier,
    onUnauthorized: () => {
      staffSessionState.setSession(null);
      staffSessionState.setRegisterSession(null);
    },
  });

  const documentsState = useDocumentsState(session);

  const membershipPromptState = useMembershipPromptState({
    session,
    lane,
    currentSessionId,
    membershipNumber,
    membershipPurchaseIntent,
    paymentStatus,
    paymentQuote,
    customerMembershipValidUntil,
    notifications: notifier,
  });

  const pastDueState = usePastDueState({
    session,
    lane,
    currentSessionId,
    pastDueBlocked,
    pastDueBalance,
    setPaymentDeclineError: laneBindings.setPaymentDeclineError,
    setIsSubmitting,
    notifications: notifier,
  });

  const notesState = useNotesState({
    session,
    lane,
    currentSessionId,
    setIsSubmitting,
    notifications: notifier,
  });

  const realtimeState = useRegisterRealtimeState({
    lane,
    staffToken: session?.sessionToken,
    currentSessionId,
    selectedCheckoutRequest: checkoutState.selectedCheckoutRequest,
    customerSelectedType,
    laneSessionActions: {
      applySessionUpdated: laneBindings.laneSessionActions.applySessionUpdated,
      applySelectionProposed: laneBindings.laneSessionActions.applySelectionProposed,
      applySelectionLocked: laneBindings.laneSessionActions.applySelectionLocked,
      applySelectionForced: laneBindings.laneSessionActions.applySelectionForced,
      selectionAcknowledged: laneBindings.laneSessionActions.selectionAcknowledged,
    },
    setCheckoutRequests: checkoutState.setCheckoutRequests,
    setCheckoutItemsConfirmed: checkoutState.setCheckoutItemsConfirmed,
    setCheckoutFeePaid: checkoutState.setCheckoutFeePaid,
    setSelectedCheckoutRequest: checkoutState.setSelectedCheckoutRequest,
    setCheckoutChecklist: checkoutState.setCheckoutChecklist,
    refreshWaitlistAndInventory: waitlistState.refreshWaitlistAndInventory,
    refreshInventoryAvailable: waitlistState.refreshInventoryAvailable,
    setSelectedInventoryItem: inventorySelectionState.setSelectedInventoryItem,
    setShowAddOnSaleModal: addOnState.setShowAddOnSaleModal,
    resetAddOnCart: addOnState.resetAddOnCart,
    resetMembershipPrompt: membershipPromptState.resetMembershipPrompt,
    setShowWaitlistModal: waitlistState.setShowWaitlistModal,
    setCurrentSessionCustomerId: laneBindings.setCurrentSessionCustomerId,
    setAccountCustomerId: navState.setAccountCustomerId,
    setAccountCustomerLabel: navState.setAccountCustomerLabel,
    selectHomeTab: navState.selectHomeTab,
    pushBottomToast: toastState.pushBottomToast,
    setShowCustomerConfirmationPending: inventorySelectionState.setShowCustomerConfirmationPending,
    setCustomerConfirmationType: inventorySelectionState.setCustomerConfirmationType,
  });

  const { pollOnce } = usePollingFallback({
    lane,
    realtimeConnected: realtimeState.realtimeConnected,
    staffToken: session?.sessionToken,
    currentSessionId,
    laneSessionActions: {
      applySessionUpdated: laneBindings.laneSessionActions.applySessionUpdated,
      resetCleared: laneBindings.laneSessionActions.resetCleared,
    },
  });

  const membershipActions = useMembershipActions({
    session,
    lane,
    currentSessionId,
    customerName,
    membershipNumber,
    customerMembershipValidUntil,
    setIsSubmitting,
    pollOnce,
    notifications: notifier,
  });

  const selectionActions = useSelectionActions({
    session,
    lane,
    currentSessionId,
    inventoryAvailable: waitlistState.inventoryAvailable,
    waitlistDesiredTier,
    proposedRentalType,
    setIsSubmitting,
    pollOnce,
    setSelectionConfirmed: laneBindings.setSelectionConfirmed,
    setCustomerSelectedType: laneBindings.setCustomerSelectedType,
    laneSessionActions: {
      patch: laneBindings.laneSessionActions.patch,
    },
    notifications: notifier,
  });

  const renewalSelectionState = useRenewalSelectionState({
    lane,
    session,
    accountCustomerId: navState.accountCustomerId,
    setIsSubmitting,
    laneSessionActions: laneBindings.laneSessionActions,
  });

  const sessionResetActions = useSessionResetActions({
    session,
    lane,
    setCustomerName: laneBindings.setCustomerName,
    setMembershipNumber: laneBindings.setMembershipNumber,
    setCurrentSessionId: laneBindings.setCurrentSessionId,
    setCurrentSessionCustomerId: laneBindings.setCurrentSessionCustomerId,
    setAccountCustomerId: navState.setAccountCustomerId,
    setAccountCustomerLabel: navState.setAccountCustomerLabel,
    setAgreementSigned: laneBindings.setAgreementSigned,
    setManualEntry,
    setSelectedRentalType,
    setCustomerSelectedType: laneBindings.setCustomerSelectedType,
    setWaitlistDesiredTier: laneBindings.setWaitlistDesiredTier,
    setWaitlistBackupType: laneBindings.setWaitlistBackupType,
    setSelectedInventoryItem: inventorySelectionState.setSelectedInventoryItem,
    setPaymentIntentId: laneBindings.setPaymentIntentId,
    setPaymentQuote: laneBindings.setPaymentQuote,
    setPaymentStatus: laneBindings.setPaymentStatus,
    setShowCustomerConfirmationPending: inventorySelectionState.setShowCustomerConfirmationPending,
    setCustomerConfirmationType: inventorySelectionState.setCustomerConfirmationType,
    setShowWaitlistModal: waitlistState.setShowWaitlistModal,
    notifications: notifier,
  });

  const resetPaymentSessionState = useResetPaymentSessionState({
    laneBindings,
    navState,
    inventorySelectionState,
    addOnState,
    setSelectedRentalType,
  });

  const paymentActions = usePaymentActions({
    session,
    registerSession,
    lane,
    currentSessionId,
    selectionConfirmed,
    paymentIntentId,
    paymentStatus,
    addOnCart: addOnState.addOnCart,
    ui: { setIsSubmitting },
    paymentSetters: {
      setPaymentIntentId: laneBindings.setPaymentIntentId,
      setPaymentQuote: laneBindings.setPaymentQuote,
      setPaymentStatus: laneBindings.setPaymentStatus,
      setPaymentDeclineError: laneBindings.setPaymentDeclineError,
    },
    addOn: {
      resetAddOnCart: addOnState.resetAddOnCart,
      setShowAddOnSaleModal: addOnState.setShowAddOnSaleModal,
    },
    notifications: {
      setSuccessToastMessage: toastState.setSuccessToastMessage,
      pushBottomToast: toastState.pushBottomToast,
    },
    resetSessionState: resetPaymentSessionState,
  });

  const { externalBlocking, checkinStage, assignedLabel, pastDueLineItems } =
    useEmployeeRegisterDerivedState({
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
    });

  const scanState = useScanState({
    session,
    lane,
    homeTab: navState.homeTab,
    manualEntry,
    isSubmitting,
    externalBlocking,
    notifications: notifier,
    startLaneSessionByCustomerId: customerSessionActions.startLaneSessionByCustomerId,
  });

  const coreValue = buildEmployeeRegisterCoreValue({
    deviceId,
    handleRegisterSignIn,
    lane,
    health,
    realtimeConnected: realtimeState.realtimeConnected,
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
    isSubmitting,
    laneSessionMode: mode,
    renewalHours,
    ledgerLineItems,
    ledgerTotal,
    renewalSelectionState,
  });

  const modalValue = buildEmployeeRegisterModalValue({
    scanState,
    pastDueState,
    pastDueLineItems,
    membershipPromptState,
    addOnState,
    paymentActions,
    waitlistState,
    notesState,
    toastState,
    setPaymentDeclineError: laneBindings.setPaymentDeclineError,
    currentSessionIdRef: realtimeState.currentSessionIdRef,
    documentsState,
    selectionActions,
  });

  return { ...coreValue, ...modalValue };
}

export type EmployeeRegisterStateValue = ReturnType<typeof useEmployeeRegisterStateValue>;
