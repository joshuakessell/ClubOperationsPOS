import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import type { CheckoutChecklist, CheckoutRequestSummary } from '@club-ops/shared';
import {
  checkoutClaim,
  checkoutComplete,
  checkoutConfirmItems,
  checkoutMarkFeePaid,
} from '../../api/employeeRegisterApi';

export type CheckoutRequestsWsDeps = {
  selectedCheckoutRequestRef: { current: string | null };
  setCheckoutRequests: Dispatch<SetStateAction<Map<string, CheckoutRequestSummary>>>;
  setSelectedCheckoutRequest: Dispatch<SetStateAction<string | null>>;
  setCheckoutChecklist: Dispatch<SetStateAction<CheckoutChecklist>>;
  setCheckoutItemsConfirmed: Dispatch<SetStateAction<boolean>>;
  setCheckoutFeePaid: Dispatch<SetStateAction<boolean>>;
};

export type CheckoutRequestsController = {
  wsDeps: CheckoutRequestsWsDeps;

  checkoutRequests: Map<string, CheckoutRequestSummary>;
  selectedCheckoutRequest: string | null;
  checkoutItemsConfirmed: boolean;
  checkoutFeePaid: boolean;

  claim: (requestId: string) => Promise<void>;
  confirmItems: (requestId: string) => Promise<void>;
  markFeePaid: (requestId: string) => Promise<void>;
  complete: (requestId: string) => Promise<void>;
  cancel: () => void;
};

export function useCheckoutRequestsController(opts: {
  sessionToken: string | null;
  isSubmitting: boolean;
  setIsSubmitting: Dispatch<SetStateAction<boolean>>;
  showAlert: (message: string, title?: string) => void;
}): CheckoutRequestsController {
  const { sessionToken, setIsSubmitting, showAlert } = opts;

  const [checkoutRequests, setCheckoutRequests] = useState<Map<string, CheckoutRequestSummary>>(
    new Map()
  );
  const [selectedCheckoutRequest, setSelectedCheckoutRequest] = useState<string | null>(null);
  const [, setCheckoutChecklist] = useState<CheckoutChecklist>({});
  const [checkoutItemsConfirmed, setCheckoutItemsConfirmed] = useState(false);
  const [checkoutFeePaid, setCheckoutFeePaid] = useState(false);

  // Keep WS handlers stable while still reading the latest values.
  const selectedCheckoutRequestRef = useRef<string | null>(null);
  useEffect(() => {
    selectedCheckoutRequestRef.current = selectedCheckoutRequest;
  }, [selectedCheckoutRequest]);

  const cancel = () => {
    setSelectedCheckoutRequest(null);
    setCheckoutChecklist({});
    setCheckoutItemsConfirmed(false);
    setCheckoutFeePaid(false);
  };

  const claim = async (requestId: string) => {
    if (!sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }
    try {
      await checkoutClaim({ sessionToken, requestId });
      setSelectedCheckoutRequest(requestId);
      setCheckoutChecklist({});
      setCheckoutItemsConfirmed(false);
      setCheckoutFeePaid(false);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to claim checkout:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to claim checkout', 'Error');
    }
  };

  const confirmItems = async (requestId: string) => {
    if (!sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }
    try {
      await checkoutConfirmItems({ sessionToken, requestId });
      setCheckoutItemsConfirmed(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to confirm items:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to confirm items', 'Error');
    }
  };

  const markFeePaid = async (requestId: string) => {
    if (!sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }
    try {
      await checkoutMarkFeePaid({ sessionToken, requestId });
      setCheckoutFeePaid(true);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to mark fee as paid:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to mark fee as paid', 'Error');
    }
  };

  const complete = async (requestId: string) => {
    if (!sessionToken) {
      showAlert('Not authenticated', 'Error');
      return;
    }

    if (!checkoutItemsConfirmed) {
      showAlert('Please confirm items returned first', 'Validation');
      return;
    }

    const request = checkoutRequests.get(requestId);
    if (request && request.lateFeeAmount > 0 && !checkoutFeePaid) {
      showAlert('Please mark late fee as paid first', 'Validation');
      return;
    }

    setIsSubmitting(true);
    try {
      await checkoutComplete({ sessionToken, requestId });
      cancel();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to complete checkout:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to complete checkout', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const wsDeps = useMemo<CheckoutRequestsWsDeps>(
    () => ({
      selectedCheckoutRequestRef,
      setCheckoutRequests,
      setSelectedCheckoutRequest,
      setCheckoutChecklist,
      setCheckoutItemsConfirmed,
      setCheckoutFeePaid,
    }),
    []
  );

  return {
    wsDeps,
    checkoutRequests,
    selectedCheckoutRequest,
    checkoutItemsConfirmed,
    checkoutFeePaid,
    claim,
    confirmItems,
    markFeePaid,
    complete,
    cancel,
  };
}

