import { useCallback, useEffect, useRef, useState } from 'react';
import { debounce } from '../../../utils/debounce';
import { searchCustomers, startLaneSession as apiStartLaneSession, isApiError } from '../../../api/employeeRegisterApi';
import type { RegisterSessionState } from '../../../app/registerSessionReducer';

export function useCustomerSearchController(opts: {
  sessionToken: string | null;
  lane: string;
  patchRegister: (patch: Partial<RegisterSessionState>) => void;
  setIsSubmitting: (next: boolean) => void;
  showAlert: (message: string, title?: string) => void;

  // Used for "already checked in" UX
  clearAlreadyCheckedIn: () => void;
  tryOpenAlreadyCheckedInModal: (payload: unknown, customerLabel?: string | null) => boolean;
}): {
  customerSearch: string;
  setCustomerSearch: (next: string) => void;
  customerSearchLoading: boolean;
  customerSuggestions: Array<{
    id: string;
    name: string;
    firstName: string;
    lastName: string;
    dobMonthDay?: string;
    membershipNumber?: string;
    disambiguator: string;
  }>;
  selectedCustomerId: string | null;
  selectedCustomerLabel: string | null;
  setSelectedCustomerId: (next: string | null) => void;
  setSelectedCustomerLabel: (next: string | null) => void;
  onConfirmCustomerSelection: () => Promise<void>;
} {
  const {
    sessionToken,
    lane,
    patchRegister,
    setIsSubmitting,
    showAlert,
    clearAlreadyCheckedIn,
    tryOpenAlreadyCheckedInModal,
  } = opts;

  const searchAbortRef = useRef<AbortController | null>(null);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerSuggestions, setCustomerSuggestions] = useState<
    Array<{
      id: string;
      name: string;
      firstName: string;
      lastName: string;
      dobMonthDay?: string;
      membershipNumber?: string;
      disambiguator: string;
    }>
  >([]);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string | null>(null);
  const [selectedCustomerLabel, setSelectedCustomerLabel] = useState<string | null>(null);

  const runCustomerSearch = useCallback(
    debounce(async (query: string) => {
      if (!sessionToken || query.trim().length < 3) {
        setCustomerSuggestions([]);
        setCustomerSearchLoading(false);
        return;
      }

      if (searchAbortRef.current) {
        searchAbortRef.current.abort();
      }
      const controller = new AbortController();
      searchAbortRef.current = controller;

      setCustomerSearchLoading(true);
      try {
        const data = await searchCustomers({
          sessionToken,
          query,
          limit: 10,
          signal: controller.signal,
        });
        setCustomerSuggestions(data.suggestions || []);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          // eslint-disable-next-line no-console
          console.error('Customer search failed:', error);
          setCustomerSuggestions([]);
        }
      } finally {
        setCustomerSearchLoading(false);
      }
    }, 200),
    [sessionToken]
  );

  useEffect(() => {
    if (customerSearch.trim().length >= 3) {
      setSelectedCustomerId(null);
      setSelectedCustomerLabel(null);
      runCustomerSearch(customerSearch);
    } else {
      setCustomerSuggestions([]);
      setSelectedCustomerId(null);
      setSelectedCustomerLabel(null);
    }
  }, [customerSearch, runCustomerSearch]);

  const onConfirmCustomerSelection = useCallback(async () => {
    if (!sessionToken || !selectedCustomerId) return;

    setIsSubmitting(true);
    try {
      clearAlreadyCheckedIn();
      let data: {
        sessionId?: string;
        customerName?: string;
        membershipNumber?: string;
        mode?: 'INITIAL' | 'RENEWAL';
        blockEndsAt?: string;
        activeAssignedResourceType?: 'room' | 'locker';
        activeAssignedResourceNumber?: string;
      };
      try {
        data = await apiStartLaneSession({
          sessionToken,
          lane,
          body: { customerId: selectedCustomerId },
        });
      } catch (err) {
        if (isApiError(err) && err.status === 409) {
          if (tryOpenAlreadyCheckedInModal(err.body, selectedCustomerLabel || selectedCustomerId)) {
            return;
          }
        }
        throw err;
      }

      if (data.customerName) patchRegister({ customerName: data.customerName });
      if (data.membershipNumber) patchRegister({ membershipNumber: data.membershipNumber });
      if (data.sessionId) patchRegister({ sessionId: data.sessionId });
      if (data.mode === 'RENEWAL' && typeof data.blockEndsAt === 'string') {
        if (data.activeAssignedResourceType) patchRegister({ assignedResourceType: data.activeAssignedResourceType });
        if (data.activeAssignedResourceNumber)
          patchRegister({ assignedResourceNumber: data.activeAssignedResourceNumber });
        patchRegister({ checkoutAt: data.blockEndsAt });
      }

      setCustomerSearch('');
      setCustomerSuggestions([]);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to confirm customer:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to confirm customer', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    clearAlreadyCheckedIn,
    lane,
    patchRegister,
    selectedCustomerId,
    selectedCustomerLabel,
    sessionToken,
    setIsSubmitting,
    showAlert,
    tryOpenAlreadyCheckedInModal,
  ]);

  return {
    customerSearch,
    setCustomerSearch,
    customerSearchLoading,
    customerSuggestions,
    selectedCustomerId,
    selectedCustomerLabel,
    setSelectedCustomerId,
    setSelectedCustomerLabel,
    onConfirmCustomerSelection,
  };
}

