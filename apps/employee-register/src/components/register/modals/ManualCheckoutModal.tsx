import { useCallback, useEffect, useMemo, useState } from 'react';
import { getApiUrl } from '@club-ops/shared';
import { ModalFrame } from './ModalFrame';
import { ManualCheckoutModalConfirmStep } from '../manual-checkout/ManualCheckoutModalConfirmStep';
import { ManualCheckoutModalSelectStep } from '../manual-checkout/ManualCheckoutModalSelectStep';
import type { ManualCheckoutStep, ManualCandidate, ResolveResponse } from '../manual-checkout/types';

export interface ManualCheckoutModalProps {
  isOpen: boolean;
  sessionToken: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  prefill?: { occupancyId?: string; number?: string };
  entryMode?: 'default' | 'direct-confirm';
}


export function ManualCheckoutModal({
  isOpen,
  sessionToken,
  onClose,
  onSuccess,
  prefill,
  entryMode = 'default',
}: ManualCheckoutModalProps) {
  const [step, setStep] = useState<ManualCheckoutStep>('select');
  const [candidates, setCandidates] = useState<ManualCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  const [selectedOccupancyIds, setSelectedOccupancyIds] = useState<string[]>([]);
  const [typedNumber, setTypedNumber] = useState('');

  const [confirmQueue, setConfirmQueue] = useState<ResolveResponse[]>([]);
  const [confirmIndex, setConfirmIndex] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [autoContinue, setAutoContinue] = useState(false);

  const canContinue = useMemo(() => {
    if (selectedOccupancyIds.length > 0) return true;
    return typedNumber.trim().length > 0;
  }, [selectedOccupancyIds.length, typedNumber]);

  useEffect(() => {
    if (!isOpen) return;
    // Reset per open
    setStep('select');
    setCandidates([]);
    setCandidatesError(null);
    const initialOccupancyId = prefill?.occupancyId ?? null;
    const initialNumber = prefill?.number ?? '';
    setSelectedOccupancyIds(initialOccupancyId ? [initialOccupancyId] : []);
    setTypedNumber(initialOccupancyId ? '' : initialNumber);
    setConfirmQueue([]);
    setConfirmIndex(0);
    setIsSubmitting(false);
    setShowCancelWarning(false);
    setAutoContinue(entryMode === 'direct-confirm' && Boolean(initialOccupancyId || initialNumber));
  }, [entryMode, isOpen, prefill?.number, prefill?.occupancyId]);

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      setLoadingCandidates(true);
      setCandidatesError(null);
      try {
        const res = await fetch(getApiUrl('/api/v1/checkout/manual-candidates'), {
          headers: { Authorization: `Bearer ${sessionToken}` },
        });
        if (!res.ok) throw new Error('Failed to load candidates');
        const data = (await res.json()) as { candidates?: ManualCandidate[] };
        setCandidates(Array.isArray(data.candidates) ? data.candidates : []);
      } catch (e) {
        setCandidatesError(e instanceof Error ? e.message : 'Failed to load candidates');
        setCandidates([]);
      } finally {
        setLoadingCandidates(false);
      }
    })();
  }, [isOpen, sessionToken]);

  const attemptClose = () => {
    // In direct-confirm entry mode, Back/X should just return to inventory (no warning).
    if (entryMode === 'direct-confirm') {
      onClose();
      return;
    }
    if (step === 'confirm') {
      setShowCancelWarning(true);
      return;
    }
    onClose();
  };

  const handleContinue = useCallback(async () => {
    if (!canContinue) return;
    setIsSubmitting(true);
    try {
      const resolveOne = async (payload: { occupancyId?: string; number?: string }) => {
        const res = await fetch(getApiUrl('/api/v1/checkout/manual-resolve'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${sessionToken}`,
          },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error('Failed to resolve checkout');
        return (await res.json()) as ResolveResponse;
      };

      const queue: ResolveResponse[] = [];
      if (selectedOccupancyIds.length > 0) {
        for (const occupancyId of selectedOccupancyIds) {
          queue.push(await resolveOne({ occupancyId }));
        }
      } else {
        queue.push(await resolveOne({ number: typedNumber.trim() }));
      }

      setConfirmQueue(queue);
      setConfirmIndex(0);
      setStep('confirm');
    } catch (e) {
      setCandidatesError(e instanceof Error ? e.message : 'Failed to resolve checkout');
    } finally {
      setIsSubmitting(false);
    }
  }, [canContinue, selectedOccupancyIds, sessionToken, typedNumber]);

  const handleTypedNumberChange = useCallback((value: string) => {
    setSelectedOccupancyIds([]);
    setTypedNumber(value);
  }, []);

  const handleInputFocus = useCallback(() => {
    setSelectedOccupancyIds([]);
  }, []);

  const handleCandidateToggle = useCallback((occupancyId: string) => {
    setTypedNumber('');
    setSelectedOccupancyIds((prev) => {
      if (prev.includes(occupancyId)) return prev.filter((id) => id !== occupancyId);
      return [...prev, occupancyId];
    });
  }, []);

  const handleConfirm = useCallback(async () => {
    const current = confirmQueue[confirmIndex];
    if (!current) return;
    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl('/api/v1/checkout/manual-complete'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ occupancyId: current.occupancyId }),
      });
      if (!res.ok) throw new Error('Failed to complete checkout');
      const data = (await res.json()) as { alreadyCheckedOut?: boolean };
      const total = confirmQueue.length || 1;
      const nextIndex = confirmIndex + 1;
      if (nextIndex < total) {
        setConfirmIndex(nextIndex);
        return;
      }
      onClose();
      onSuccess(
        data.alreadyCheckedOut
          ? 'Already checked out'
          : total > 1
            ? `Checkout completed (${total})`
            : 'Checkout completed'
      );
    } catch (e) {
      setCandidatesError(e instanceof Error ? e.message : 'Failed to complete checkout');
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmIndex, confirmQueue, onClose, onSuccess, sessionToken]);

  // If this modal is opened as a "direct confirm" action (e.g. from Inventory occupancy details),
  // automatically resolve and land on the confirm step.
  useEffect(() => {
    if (!isOpen) return;
    if (entryMode !== 'direct-confirm') return;
    if (!autoContinue) return;
    if (step !== 'select') {
      setAutoContinue(false);
      return;
    }
    if (!canContinue) return;
    setAutoContinue(false);
    void handleContinue();
  }, [autoContinue, canContinue, entryMode, handleContinue, isOpen, step]);

  return (
    <>
      <ModalFrame
        isOpen={isOpen}
        title="Checkout"
        onClose={attemptClose}
        maxWidth="760px"
        maxHeight="80vh"
      >
        {candidatesError && (
          <div
            style={{
              marginBottom: '0.75rem',
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 12,
              color: '#fecaca',
              fontWeight: 700,
            }}
          >
            {candidatesError}
          </div>
        )}

        {step === 'select' ? (
          <ManualCheckoutModalSelectStep
            entryMode={entryMode}
            typedNumber={typedNumber}
            isSubmitting={isSubmitting}
            canContinue={canContinue}
            candidates={candidates}
            loadingCandidates={loadingCandidates}
            selectedOccupancyIds={selectedOccupancyIds}
            onTypedNumberChange={handleTypedNumberChange}
            onInputFocus={handleInputFocus}
            onCandidateToggle={handleCandidateToggle}
            onContinue={() => void handleContinue()}
          />
        ) : (
          <ManualCheckoutModalConfirmStep
            confirmQueue={confirmQueue}
            confirmIndex={confirmIndex}
            isSubmitting={isSubmitting}
            onConfirm={() => void handleConfirm()}
          />
        )}
      </ModalFrame>

      <ModalFrame
        isOpen={isOpen && showCancelWarning}
        title="Cancel checkout"
        onClose={() => setShowCancelWarning(false)}
        maxWidth="520px"
        closeOnOverlayClick={false}
      >
        <div style={{ marginBottom: '1rem', color: '#94a3b8' }}>
          You’re on the confirmation step. Do you want to cancel checkout?
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
          <button
            type="button"
            className="cs-liquid-button cs-liquid-button--secondary"
            onClick={() => setShowCancelWarning(false)}
          >
            Return to confirm checkout
          </button>
          <button
            type="button"
            className="cs-liquid-button cs-liquid-button--danger"
            onClick={() => {
              setShowCancelWarning(false);
              onClose();
            }}
          >
            Cancel checkout
          </button>
        </div>
      </ModalFrame>
    </>
  );
}
