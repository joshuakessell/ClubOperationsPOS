import { useCallback, useEffect, useMemo, useState } from 'react';
import { ModalFrame } from './ModalFrame';
import { Button } from '../../../ui/Button';
import { Input } from '../../../ui/Input';

type Step = 'select' | 'confirm';

type ManualCandidate = {
  occupancyId: string;
  resourceType: 'ROOM' | 'LOCKER';
  number: string;
  customerName: string;
  checkinAt: string | Date;
  scheduledCheckoutAt: string | Date;
  isOverdue: boolean;
};

type ResolveResponse = {
  occupancyId: string;
  resourceType: 'ROOM' | 'LOCKER';
  number: string;
  customerName: string;
  checkinAt: string | Date;
  scheduledCheckoutAt: string | Date;
  lateMinutes: number;
  fee: number;
  banApplied: boolean;
};

export interface ManualCheckoutModalProps {
  isOpen: boolean;
  sessionToken: string;
  onClose: () => void;
  onSuccess: (message: string) => void;
  prefill?: { occupancyId?: string; number?: string };
  entryMode?: 'default' | 'direct-confirm';
}

function toDate(value: string | Date): Date {
  return value instanceof Date ? value : new Date(value);
}

function formatClockTime(value: string | Date): string {
  const d = toDate(value);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatLateDuration(minutesLate: number): string {
  const total = Math.max(0, Math.floor(minutesLate));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h}:${String(m).padStart(2, '0')}`;
}

export function ManualCheckoutModal({
  isOpen,
  sessionToken,
  onClose,
  onSuccess,
  prefill,
  entryMode = 'default',
}: ManualCheckoutModalProps) {
  const [step, setStep] = useState<Step>('select');
  const [candidates, setCandidates] = useState<ManualCandidate[]>([]);
  const [loadingCandidates, setLoadingCandidates] = useState(false);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);

  const [selectedOccupancyId, setSelectedOccupancyId] = useState<string | null>(null);
  const [typedNumber, setTypedNumber] = useState('');

  const [confirmData, setConfirmData] = useState<ResolveResponse | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelWarning, setShowCancelWarning] = useState(false);
  const [autoContinue, setAutoContinue] = useState(false);

  const canContinue = useMemo(() => {
    if (selectedOccupancyId) return true;
    return typedNumber.trim().length > 0;
  }, [selectedOccupancyId, typedNumber]);

  useEffect(() => {
    if (!isOpen) return;
    // Reset per open
    setStep('select');
    setCandidates([]);
    setCandidatesError(null);
    const initialOccupancyId = prefill?.occupancyId ?? null;
    const initialNumber = prefill?.number ?? '';
    setSelectedOccupancyId(initialOccupancyId);
    setTypedNumber(initialOccupancyId ? '' : initialNumber);
    setConfirmData(null);
    setIsSubmitting(false);
    setShowCancelWarning(false);
    setAutoContinue(entryMode === 'direct-confirm' && Boolean(initialOccupancyId || initialNumber));
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    void (async () => {
      setLoadingCandidates(true);
      setCandidatesError(null);
      try {
        const res = await fetch('/api/v1/checkout/manual-candidates', {
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
      const payload = selectedOccupancyId
        ? { occupancyId: selectedOccupancyId }
        : { number: typedNumber.trim() };
      const res = await fetch('/api/v1/checkout/manual-resolve', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Failed to resolve checkout');
      const data = (await res.json()) as ResolveResponse;
      setConfirmData(data);
      setStep('confirm');
    } catch (e) {
      setCandidatesError(e instanceof Error ? e.message : 'Failed to resolve checkout');
    } finally {
      setIsSubmitting(false);
    }
  }, [canContinue, selectedOccupancyId, sessionToken, typedNumber]);

  const handleConfirm = useCallback(async () => {
    if (!confirmData) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/v1/checkout/manual-complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionToken}`,
        },
        body: JSON.stringify({ occupancyId: confirmData.occupancyId }),
      });
      if (!res.ok) throw new Error('Failed to complete checkout');
      const data = (await res.json()) as { alreadyCheckedOut?: boolean };
      onClose();
      onSuccess(data.alreadyCheckedOut ? 'Already checked out' : 'Checkout completed');
    } catch (e) {
      setCandidatesError(e instanceof Error ? e.message : 'Failed to complete checkout');
    } finally {
      setIsSubmitting(false);
    }
  }, [confirmData, onClose, onSuccess, sessionToken]);

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
      <ModalFrame isOpen={isOpen} title="Checkout" onClose={attemptClose} maxWidth="760px" maxHeight="80vh">
        {candidatesError && (
          <div className="mb-3 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">
            {candidatesError}
          </div>
        )}

        {step === 'select' ? (
          <>
            {entryMode === 'direct-confirm' ? (
              <div style={{ padding: '0.75rem', color: '#94a3b8' }}>Loading checkout…</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 280 }}>
                    <Input
                      placeholder="Type room/locker number…"
                      value={typedNumber}
                      onFocus={() => setSelectedOccupancyId(null)}
                      onChange={(e) => {
                        setSelectedOccupancyId(null);
                        setTypedNumber(e.target.value);
                      }}
                      aria-label="Checkout number"
                    />
                  </div>

                  <Button
                    type="button"
                    onClick={() => void handleContinue()}
                    disabled={!canContinue || isSubmitting}
                  >
                    {isSubmitting ? 'Loading…' : 'Continue'}
                  </Button>
                </div>

                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Suggested</div>
                  {loadingCandidates ? (
                    <div style={{ padding: '0.75rem', color: '#94a3b8' }}>Loading candidates…</div>
                  ) : candidates.length === 0 ? (
                    <div style={{ padding: '0.75rem', color: '#94a3b8' }}>No candidates</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      {candidates.map((c) => {
                        const selected = selectedOccupancyId === c.occupancyId;
                        const scheduled = toDate(c.scheduledCheckoutAt);
                        const minutesLate = Math.max(0, Math.floor((Date.now() - scheduled.getTime()) / 60000));
                        const checkoutLabel = `Checkout: ${formatClockTime(scheduled)}${
                          c.isOverdue ? ` (${formatLateDuration(minutesLate)} late)` : ''
                        }`;
                        return (
                          <Button
                            key={c.occupancyId}
                            type="button"
                            variant={selected ? 'primary' : 'secondary'}
                            aria-pressed={selected}
                            onClick={() => {
                              setSelectedOccupancyId(c.occupancyId);
                              setTypedNumber('');
                            }}
                            className="w-full justify-between"
                          >
                            <div
                              style={{
                                display: 'flex',
                                width: '100%',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '1rem',
                              }}
                            >
                              <div style={{ fontWeight: 900 }}>
                                {c.resourceType === 'ROOM' ? 'Room' : 'Locker'} {c.number} -- {c.customerName}
                              </div>
                              <div
                                style={{
                                  fontWeight: 800,
                                  color: c.isOverdue ? '#fecaca' : 'rgba(148, 163, 184, 0.95)',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {checkoutLabel}
                              </div>
                            </div>
                          </Button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>Confirm checkout</div>
              {confirmData && (
                <div className="er-surface" style={{ padding: '1rem', borderRadius: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Customer</div>
                      <div style={{ fontWeight: 800 }}>{confirmData.customerName}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Resource</div>
                      <div style={{ fontWeight: 800 }}>
                        {confirmData.resourceType === 'ROOM' ? 'Room' : 'Locker'} {confirmData.number}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Check-in</div>
                      <div style={{ fontWeight: 800 }}>{toDate(confirmData.checkinAt).toLocaleString()}</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Scheduled checkout</div>
                      <div style={{ fontWeight: 800 }}>
                        {toDate(confirmData.scheduledCheckoutAt).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Late</div>
                      <div style={{ fontWeight: 800 }}>{confirmData.lateMinutes} min</div>
                    </div>
                    <div>
                      <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Outcome</div>
                      <div style={{ fontWeight: 900, color: confirmData.banApplied ? '#f59e0b' : '#10b981' }}>
                        Fee ${confirmData.fee.toFixed(2)}
                        {confirmData.banApplied ? ' • 30-day ban' : ''}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    if (entryMode === 'direct-confirm') {
                      onClose();
                      return;
                    }
                    setStep('select');
                    setShowCancelWarning(false);
                  }}
                  disabled={isSubmitting}
                >
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={() => void handleConfirm()}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Confirming…' : 'Confirm'}
                </Button>
              </div>
            </div>
          </>
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
          <Button
            type="button"
            onClick={() => setShowCancelWarning(false)}
          >
            Return to confirm checkout
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={() => {
              setShowCancelWarning(false);
              onClose();
            }}
          >
            Cancel checkout
          </Button>
        </div>
      </ModalFrame>
    </>
  );
}


