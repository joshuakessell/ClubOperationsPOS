import { useEffect, useRef } from 'react';
import { Modal } from '../../../ui/Modal';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';

export function TransactionCompleteModal({
  isOpen,
  agreementPending,
  assignedLabel,
  assignedNumber,
  checkoutAt,
  verifyDisabled,
  showComplete,
  completeLabel,
  completeDisabled,
  onVerifyAgreementArtifacts,
  onCompleteTransaction,
}: {
  isOpen: boolean;
  agreementPending: boolean;
  assignedLabel: string;
  assignedNumber: string;
  checkoutAt: string | null;
  verifyDisabled: boolean;
  showComplete: boolean;
  completeLabel: string;
  completeDisabled: boolean;
  onVerifyAgreementArtifacts: () => void;
  onCompleteTransaction: () => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const root = modalRef.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>('button');
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Transaction completion gate: prevent ESC from bubbling to other app handlers.
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== 'Tab') return;
      // Minimal focus trap
      const focusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (focusables.length === 0) return;
      const active = document.activeElement as HTMLElement | null;
      const idx = active ? focusables.indexOf(active) : -1;
      const nextIdx = e.shiftKey
        ? idx <= 0
          ? focusables.length - 1
          : idx - 1
        : idx === -1 || idx === focusables.length - 1
          ? 0
          : idx + 1;
      e.preventDefault();
      focusables[nextIdx]?.focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} width="lg" panelClassName="p-0 overflow-hidden">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Transaction ready">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="text-lg font-semibold text-gray-900">Transaction Ready</div>
        </div>

        <div className="grid gap-3 px-6 py-4">
          {agreementPending ? (
            <Card padding="md" className="bg-amber-50 ring-amber-200">
              <div className="font-semibold text-gray-900">Agreement Pending</div>
              <div className="mt-1 text-sm text-gray-700">
                Waiting for customer to sign the agreement on their device.
              </div>
            </Card>
          ) : null}

          <Card padding="md">
            <div className="font-semibold text-gray-900">
              Assigned: {assignedLabel} {assignedNumber}
            </div>
            {checkoutAt ? (
              <div className="mt-1 text-sm text-gray-600">
                Checkout: {new Date(checkoutAt).toLocaleString()}
              </div>
            ) : null}
          </Card>

          <Button
            type="button"
            variant="secondary"
            onClick={onVerifyAgreementArtifacts}
            disabled={verifyDisabled}
          >
            Verify agreement PDF + signature saved
          </Button>

          {showComplete ? (
            <Button
              type="button"
              onClick={onCompleteTransaction}
              disabled={completeDisabled}
            >
              {completeLabel}
            </Button>
          ) : null}
        </div>
      </div>
    </Modal>
  );
}

