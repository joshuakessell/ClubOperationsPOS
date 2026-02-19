import { useCallback, useEffect, useRef } from 'react';
import { getErrorMessage, readJson } from '@club-ops/shared';
import { RETAIL_CATALOG } from '../../../components/retail/retailCatalog';
import { API_BASE } from '../shared/api';
import type { StaffSession } from '../shared/types';
import type { PaymentQuoteSetter, RegisterSession } from './paymentTypes';

export type PaymentActionsParams = {
  session: StaffSession | null;
  registerSession: RegisterSession | null;
  lane: string;
  currentSessionId: string | null;
  selectionConfirmed: boolean;
  paymentIntentId: string | null;
  paymentStatus: 'DUE' | 'PAID' | null;
  addOnCart: Record<string, number>;
  ui: {
    setIsSubmitting: (value: boolean) => void;
  };
  paymentSetters: {
    setPaymentIntentId: (value: string | null) => void;
    setPaymentQuote: PaymentQuoteSetter;
    setPaymentStatus: (value: 'DUE' | 'PAID' | null) => void;
    setPaymentDeclineError: (value: string | null) => void;
  };
  addOn: {
    resetAddOnCart: () => void;
    setShowAddOnSaleModal: (value: boolean) => void;
  };
  notifications: {
    setSuccessToastMessage: (value: string | null) => void;
    pushBottomToast: (toast: { message: string; tone?: 'info' | 'warning' }) => void;
  };
  resetSessionState: () => void;
};

export function usePaymentActions({
  session,
  registerSession,
  lane,
  currentSessionId,
  selectionConfirmed,
  paymentIntentId,
  paymentStatus,
  addOnCart,
  ui,
  paymentSetters,
  addOn,
  notifications,
  resetSessionState,
}: PaymentActionsParams) {
  const paymentIntentCreateInFlightRef = useRef(false);

  const notifyWarning = useCallback(
    (message: string) => {
      notifications.pushBottomToast({ message, tone: 'warning' });
    },
    [notifications]
  );

  const handleCreatePaymentIntent = useCallback(async () => {
    if (!currentSessionId || !session?.sessionToken) {
      return;
    }

    try {
      const response = await fetch(`${API_BASE}/v1/checkin/lane/${lane}/create-payment-intent`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(getErrorMessage(errorPayload) || 'Failed to create payment intent');
      }

      const data = await readJson<{
        paymentIntentId?: string;
        quote?: {
          total: number;
          lineItems: Array<{ description: string; amount: number }>;
          messages: string[];
        };
      }>(response);
      if (typeof data.paymentIntentId === 'string') {
        paymentSetters.setPaymentIntentId(data.paymentIntentId);
      }
      paymentSetters.setPaymentQuote(data.quote ?? null);
      paymentSetters.setPaymentStatus('DUE');
    } catch (error) {
      console.error('Failed to create payment intent:', error);
      notifyWarning(error instanceof Error ? error.message : 'Failed to create payment intent');
    }
  }, [currentSessionId, lane, notifyWarning, paymentSetters, session?.sessionToken]);

  useEffect(() => {
    if (!currentSessionId || !session?.sessionToken) return;
    if (!selectionConfirmed) return;
    if (paymentIntentId || paymentStatus === 'DUE' || paymentStatus === 'PAID') return;
    if (paymentIntentCreateInFlightRef.current) return;

    paymentIntentCreateInFlightRef.current = true;
    void handleCreatePaymentIntent().finally(() => {
      paymentIntentCreateInFlightRef.current = false;
    });
  }, [
    currentSessionId,
    session?.sessionToken,
    selectionConfirmed,
    paymentIntentId,
    paymentStatus,
    handleCreatePaymentIntent,
  ]);

  const handleAddOnSaleToCheckin = useCallback(async () => {
    if (!currentSessionId || !session?.sessionToken) {
      notifyWarning('Not authenticated');
      return;
    }
    if (!paymentIntentId) {
      notifyWarning('No active payment intent for this session.');
      return;
    }

    const items = Object.entries(addOnCart)
      .map(([id, quantity]) => {
        const catalogItem = RETAIL_CATALOG.find((item) => item.id === id);
        if (!catalogItem || quantity <= 0) return null;
        return {
          label: catalogItem.label,
          quantity,
          unitPrice: catalogItem.price,
        };
      })
      .filter((item): item is { label: string; quantity: number; unitPrice: number } =>
        Boolean(item)
      );

    if (items.length === 0) {
      notifyWarning('Add at least one item to continue.');
      return;
    }

    ui.setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/v1/checkin/lane/${lane}/add-ons`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({ sessionId: currentSessionId, items }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(getErrorMessage(errorPayload) || 'Failed to add add-on items');
      }

      const payload = await readJson<{
        status?: 'DUE' | 'PAID';
        quote?: {
          total: number;
          lineItems: Array<{ description: string; amount: number }>;
          messages: string[];
        };
      }>(response);

      if (payload.quote) {
        paymentSetters.setPaymentQuote(payload.quote);
      }

      addOn.setShowAddOnSaleModal(false);
      addOn.resetAddOnCart();
      notifications.setSuccessToastMessage('Add-on items added to check-in.');
    } catch (error) {
      console.error('Failed to add add-on items:', error);
      notifyWarning(error instanceof Error ? error.message : 'Failed to add add-on items');
    } finally {
      ui.setIsSubmitting(false);
    }
  }, [
    addOn,
    addOnCart,
    currentSessionId,
    lane,
    notifyWarning,
    notifications,
    paymentIntentId,
    paymentSetters,
    session?.sessionToken,
    ui,
  ]);

  const handleDemoPayment = async (
    outcome: 'CASH_SUCCESS' | 'CREDIT_SUCCESS' | 'CREDIT_DECLINE',
    declineReason?: string
  ) => {
    if (!session?.sessionToken || !currentSessionId) {
      notifyWarning('Not authenticated');
      return;
    }

    ui.setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/v1/checkin/lane/${lane}/demo-take-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({
          outcome,
          declineReason,
          registerNumber: registerSession?.registerNumber,
          sessionId: currentSessionId,
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(getErrorMessage(errorPayload) || 'Failed to process payment');
      }

      const payload = await readJson<{
        status?: 'DUE' | 'PAID';
        quote?: {
          total: number;
          lineItems: Array<{ description: string; amount: number }>;
          messages: string[];
        };
      }>(response);
      if (payload.quote) paymentSetters.setPaymentQuote(payload.quote);
      if (payload.status) paymentSetters.setPaymentStatus(payload.status);
      if (outcome === 'CREDIT_DECLINE') {
        paymentSetters.setPaymentDeclineError(declineReason || 'Payment declined');
      } else {
        paymentSetters.setPaymentDeclineError(null);
      }
    } catch (error) {
      console.error('Failed to process payment:', error);
      notifyWarning(error instanceof Error ? error.message : 'Failed to process payment');
    } finally {
      ui.setIsSubmitting(false);
    }
  };

  const handleDemoSplitPayment = async (cardAmount: number): Promise<boolean> => {
    if (!session?.sessionToken || !currentSessionId) {
      notifyWarning('Not authenticated');
      return false;
    }

    const roundedAmount = Math.round(cardAmount * 100) / 100;
    if (!Number.isFinite(roundedAmount) || roundedAmount <= 0) {
      notifyWarning('Enter a valid card amount.');
      return false;
    }

    ui.setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/v1/checkin/lane/${lane}/demo-take-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.sessionToken}`,
        },
        body: JSON.stringify({
          outcome: 'CREDIT_SUCCESS',
          splitCardAmount: roundedAmount,
          registerNumber: registerSession?.registerNumber,
          sessionId: currentSessionId,
        }),
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(getErrorMessage(errorPayload) || 'Failed to process split payment');
      }

      const payload = await readJson<{
        status?: 'DUE' | 'PAID';
        quote?: {
          total: number;
          lineItems: Array<{ description: string; amount: number }>;
          messages: string[];
        };
      }>(response);
      if (payload.quote) paymentSetters.setPaymentQuote(payload.quote);
      if (payload.status) paymentSetters.setPaymentStatus(payload.status);

      paymentSetters.setPaymentDeclineError(null);
      return true;
    } catch (error) {
      console.error('Failed to process split payment:', error);
      notifyWarning(error instanceof Error ? error.message : 'Failed to process split payment');
      return false;
    } finally {
      ui.setIsSubmitting(false);
    }
  };

  const handleCompleteTransaction = async () => {
    if (!session?.sessionToken) {
      notifyWarning('Not authenticated');
      return;
    }

    ui.setIsSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/v1/checkin/lane/${lane}/reset`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.sessionToken}`,
        },
      });

      if (!response.ok) {
        const errorPayload: unknown = await response.json().catch(() => null);
        throw new Error(getErrorMessage(errorPayload) || 'Failed to complete transaction');
      }

      resetSessionState();
    } catch (error) {
      console.error('Failed to complete transaction:', error);
      notifyWarning(error instanceof Error ? error.message : 'Failed to complete transaction');
    } finally {
      ui.setIsSubmitting(false);
    }
  };

  return {
    handleAddOnSaleToCheckin,
    handleDemoPayment,
    handleDemoSplitPayment,
    handleCompleteTransaction,
  };
}
