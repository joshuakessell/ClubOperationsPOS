import { useCallback } from 'react';

type ResetPaymentSessionStateParams = {
  laneBindings: {
    setCustomerName: (value: string) => void;
    setMembershipNumber: (value: string) => void;
    setCurrentSessionId: (value: string | null) => void;
    setCurrentSessionCustomerId: (value: string | null) => void;
    setAgreementSigned: (value: boolean) => void;
    setCustomerSelectedType: (value: string | null) => void;
    setPaymentIntentId: (value: string | null) => void;
    setPaymentQuote: (value: null) => void;
    setPaymentStatus: (value: 'DUE' | 'PAID' | null) => void;
    setAssignedResourceType: (value: 'room' | 'locker' | null) => void;
    setAssignedResourceNumber: (value: string | null) => void;
    setCheckoutAt: (value: string | null) => void;
    setCustomerPrimaryLanguage: (value: 'EN' | 'ES' | undefined) => void;
    setCustomerDobMonthDay: (value: string | undefined) => void;
    setCustomerLastVisitAt: (value: string | undefined) => void;
    setCustomerNotes: (value: string | undefined) => void;
    setPaymentDeclineError: (value: string | null) => void;
  };
  navState: {
    setAccountCustomerId: (value: string | null) => void;
    setAccountCustomerLabel: (value: string | null) => void;
  };
  inventorySelectionState: {
    setSelectedInventoryItem: (value: null) => void;
  };
  addOnState: {
    resetAddOnCart: () => void;
    setShowAddOnSaleModal: (value: boolean) => void;
  };
  setSelectedRentalType: (value: string | null) => void;
};

export function useResetPaymentSessionState({
  laneBindings,
  navState,
  inventorySelectionState,
  addOnState,
  setSelectedRentalType,
}: ResetPaymentSessionStateParams) {
  return useCallback(() => {
    laneBindings.setCustomerName('');
    laneBindings.setMembershipNumber('');
    laneBindings.setCurrentSessionId(null);
    laneBindings.setCurrentSessionCustomerId(null);
    navState.setAccountCustomerId(null);
    navState.setAccountCustomerLabel(null);
    laneBindings.setAgreementSigned(false);
    setSelectedRentalType(null);
    laneBindings.setCustomerSelectedType(null);
    inventorySelectionState.setSelectedInventoryItem(null);
    laneBindings.setPaymentIntentId(null);
    laneBindings.setPaymentQuote(null);
    laneBindings.setPaymentStatus(null);
    addOnState.resetAddOnCart();
    addOnState.setShowAddOnSaleModal(false);
    laneBindings.setAssignedResourceType(null);
    laneBindings.setAssignedResourceNumber(null);
    laneBindings.setCheckoutAt(null);
    laneBindings.setCustomerPrimaryLanguage(undefined);
    laneBindings.setCustomerDobMonthDay(undefined);
    laneBindings.setCustomerLastVisitAt(undefined);
    laneBindings.setCustomerNotes(undefined);
    laneBindings.setPaymentDeclineError(null);
  }, [addOnState, inventorySelectionState, laneBindings, navState, setSelectedRentalType]);
}
