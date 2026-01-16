import { useCallback } from 'react';
import { isRecord } from '@club-ops/ui';
import { assignResource, isApiError } from '../../../api/employeeRegisterApi';
import type { SelectedInventoryItem } from '../../inventory/useInventorySelectionController';

export function useRegisterAssignmentActions(opts: {
  lane: string;
  sessionToken: string | null;
  currentSessionId: string | null;
  selectedInventoryItem: SelectedInventoryItem | null;
  showCustomerConfirmationPending: boolean;
  setShowCustomerConfirmationPending(next: boolean): void;
  agreementSigned: boolean;
  paymentStatus: 'DUE' | 'PAID' | null;
  setIsSubmitting(next: boolean): void;
  clearSelection(): void;
  showAlert(message: string, title?: string): void;
}) {
  const {
    lane,
    sessionToken,
    currentSessionId,
    selectedInventoryItem,
    showCustomerConfirmationPending,
    setShowCustomerConfirmationPending,
    agreementSigned,
    paymentStatus,
    setIsSubmitting,
    clearSelection,
    showAlert,
  } = opts;

  const onAssign = useCallback(async () => {
    if (!selectedInventoryItem || !currentSessionId || !sessionToken) {
      showAlert('Please select an item to assign', 'Validation');
      return;
    }

    // Guardrails: Prevent assignment if conditions not met
    if (showCustomerConfirmationPending) {
      showAlert('Please wait for customer confirmation before assigning', 'Validation');
      return;
    }

    if (!agreementSigned) {
      showAlert(
        'Agreement must be signed before assignment. Please wait for customer to sign the agreement.',
        'Validation'
      );
      return;
    }

    if (paymentStatus !== 'PAID') {
      showAlert(
        'Payment must be marked as paid before assignment. Please mark payment as paid in Square first.',
        'Validation'
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // Use check-in assign endpoint
      try {
        const data = await assignResource({
          sessionToken,
          lane,
          resourceType: selectedInventoryItem.type,
          resourceId: selectedInventoryItem.id,
        });

        // Preserve existing behavior: if cross-type assignment needs customer confirmation,
        // pause and show the pending confirmation modal.
        if (data?.needsConfirmation === true) {
          setShowCustomerConfirmationPending(true);
          return;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : null;
        const body = isApiError(err) ? err.body : null;
        if (
          isRecord(body) &&
          (body['raceLost'] === true || (typeof msg === 'string' && msg.includes('already assigned')))
        ) {
          // Race condition - refresh inventory and re-select
          showAlert('Item no longer available. Refreshing inventory...', 'Error');
          clearSelection();
          return;
        }
        throw err;
      }
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to assign:', error);
      showAlert(error instanceof Error ? error.message : 'Failed to assign', 'Error');
    } finally {
      setIsSubmitting(false);
    }
  }, [
    agreementSigned,
    clearSelection,
    currentSessionId,
    lane,
    paymentStatus,
    selectedInventoryItem,
    sessionToken,
    setShowCustomerConfirmationPending,
    setIsSubmitting,
    showAlert,
    showCustomerConfirmationPending,
  ]);

  return { onAssign };
}

