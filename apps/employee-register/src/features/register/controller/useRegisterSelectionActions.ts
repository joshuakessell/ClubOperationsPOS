import { useCallback } from 'react';
import { confirmSelection, proposeSelection } from '../../../api/employeeRegisterApi';

export function useRegisterSelectionActions(opts: {
  lane: string;
  sessionToken: string | null;
  currentSessionId: string | null;
  proposedRentalType: string | null;
  selectionConfirmed: boolean;
  setIsSubmitting(next: boolean): void;
  patchRegister(patch: Record<string, unknown>): void;
  showAlert(message: string, title?: string): void;
}) {
  const {
    lane,
    sessionToken,
    currentSessionId,
    proposedRentalType,
    selectionConfirmed,
    setIsSubmitting,
    patchRegister,
    showAlert,
  } = opts;

  const onConfirmSelection = useCallback(async () => {
    if (!currentSessionId || !sessionToken || !proposedRentalType) return;

    setIsSubmitting(true);
    try {
      await confirmSelection({
        sessionToken,
        lane,
        confirmedBy: 'EMPLOYEE',
      });
      patchRegister({
        selectionConfirmed: true,
        selectionConfirmedBy: 'EMPLOYEE',
        selectionAcknowledged: true,
        customerSelectedType: proposedRentalType,
      });
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Failed to confirm selection:', error);
      showAlert(
        error instanceof Error ? error.message : 'Failed to confirm selection. Please try again.',
        'Error'
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [
    currentSessionId,
    lane,
    patchRegister,
    proposedRentalType,
    sessionToken,
    setIsSubmitting,
    showAlert,
  ]);

  const onProposeSelection = useCallback(
    async (rentalType: string) => {
      if (!currentSessionId || !sessionToken) return;

      // Second tap on same rental forces selection
      if (proposedRentalType === rentalType && !selectionConfirmed) {
        await onConfirmSelection();
        return;
      }

      setIsSubmitting(true);
      try {
        await proposeSelection({
          sessionToken,
          lane,
          rentalType,
          proposedBy: 'EMPLOYEE',
        });
        patchRegister({ proposedRentalType: rentalType, proposedBy: 'EMPLOYEE' });
      } catch (error) {
        // eslint-disable-next-line no-console
        console.error('Failed to propose selection:', error);
        showAlert(
          error instanceof Error ? error.message : 'Failed to propose selection. Please try again.',
          'Error'
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      currentSessionId,
      lane,
      onConfirmSelection,
      patchRegister,
      proposedRentalType,
      selectionConfirmed,
      sessionToken,
      setIsSubmitting,
      showAlert,
    ]
  );

  return { onProposeSelection, onConfirmSelection };
}

