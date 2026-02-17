import { useEffect, useRef, type ReactNode } from 'react';

export function TransactionCompleteModal({
  isOpen,
  agreementPending,
  agreementSigned,
  agreementBypassPending,
  agreementSignedMethod,
  selectionSummary,
  assignedLabel,
  assignedNumber,
  checkoutAt,
  assignmentActions,
  verifyDisabled,
  showComplete,
  completeLabel,
  completeDisabled,
  showBypassAction,
  showPhysicalConfirmAction,
  onVerifyAgreementArtifacts,
  onStartAgreementBypass,
  onConfirmPhysicalAgreement,
  onCompleteTransaction,
}: {
  isOpen: boolean;
  agreementPending: boolean;
  agreementSigned: boolean;
  agreementBypassPending: boolean;
  agreementSignedMethod: 'DIGITAL' | 'MANUAL' | null;
  selectionSummary?: {
    membershipChoice?: string | null;
    rentalType?: string | null;
    waitlistDesiredType?: string | null;
    waitlistBackupType?: string | null;
  };
  assignedLabel: string;
  assignedNumber: string | null;
  checkoutAt: string | null;
  assignmentActions?: ReactNode;
  verifyDisabled: boolean;
  showComplete: boolean;
  completeLabel: string;
  completeDisabled: boolean;
  showBypassAction: boolean;
  showPhysicalConfirmAction: boolean;
  onVerifyAgreementArtifacts: () => void;
  onStartAgreementBypass: () => void;
  onConfirmPhysicalAgreement: () => void;
  onCompleteTransaction: () => void;
}) {
  const modalRef = useRef<HTMLDivElement | null>(null);
  const hasAssignment = Boolean(assignedNumber);

  useEffect(() => {
    if (!isOpen) return;
    const root = modalRef.current;
    if (!root) return;
    const first = root.querySelector<HTMLElement>('button');
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active && !root.contains(active)) return;

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
    <div className="er-txn-complete-modal__overlay" role="presentation">
      <div
        ref={modalRef}
        className="er-txn-complete-modal rounded-2xl border border-gray-200 bg-white/80 shadow-theme-lg backdrop-blur-md dark:border-gray-800 dark:bg-gray-900/80"
        role="dialog"
        aria-modal="true"
        aria-label="Transaction ready"
      >
        <div className="er-txn-complete-modal__title">Transaction Ready</div>

        {agreementPending && (
          <div className="er-txn-complete-modal__notice er-surface">
            <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>Agreement Pending</div>
            <div style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 700 }}>
              {agreementBypassPending
                ? 'Digital agreement bypass requested; awaiting physical signature.'
                : 'Waiting for customer to sign the agreement on their device.'}
            </div>
          </div>
        )}

        {selectionSummary && (
          <div className="er-txn-complete-modal__assignment er-surface">
            <div style={{ fontWeight: 900, fontSize: '1.05rem' }}>Selection Summary</div>
            {selectionSummary.membershipChoice && (
              <div style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 700 }}>
                Membership: {selectionSummary.membershipChoice}
              </div>
            )}
            {selectionSummary.rentalType && (
              <div style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 700 }}>
                Rental: {selectionSummary.rentalType}
              </div>
            )}
            {selectionSummary.waitlistDesiredType && (
              <div style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 700 }}>
                Waitlist desired: {selectionSummary.waitlistDesiredType}
              </div>
            )}
            {selectionSummary.waitlistBackupType && (
              <div style={{ fontSize: '0.95rem', color: '#94a3b8', fontWeight: 700 }}>
                Waitlist backup: {selectionSummary.waitlistBackupType}
              </div>
            )}
          </div>
        )}

        <div className="er-txn-complete-modal__assignment er-surface">
          <div style={{ fontWeight: 900, fontSize: '1.2rem' }}>
            {hasAssignment
              ? `Assigned: ${assignedLabel} ${assignedNumber}`
              : `Assignment: ${assignedLabel === 'Resource' ? 'Pending' : `${assignedLabel} pending`}`}
          </div>
          {checkoutAt && (
            <div style={{ fontSize: '1rem', color: '#94a3b8', fontWeight: 700 }}>
              Checkout: {new Date(checkoutAt).toLocaleString()}
            </div>
          )}
        </div>

        {assignmentActions ? (
          <div style={{ display: 'grid', gap: '0.6rem' }}>{assignmentActions}</div>
        ) : null}

        {agreementSigned && agreementSignedMethod !== 'MANUAL' && (
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03] er-txn-complete-modal__verify"
            onClick={onVerifyAgreementArtifacts}
            disabled={verifyDisabled}
          >
            Verify agreement PDF + signature saved
          </button>
        )}

        {showBypassAction && (
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-warning-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-warning-600 er-txn-complete-modal__verify"
            onClick={onStartAgreementBypass}
            disabled={completeDisabled}
          >
            Bypass digital agreement
          </button>
        )}

        {showPhysicalConfirmAction && (
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-success-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-success-600 er-txn-complete-modal__verify"
            onClick={onConfirmPhysicalAgreement}
            disabled={completeDisabled}
          >
            Physical agreement signed
          </button>
        )}

        {showComplete && (
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 er-txn-complete-modal__complete"
            onClick={onCompleteTransaction}
            disabled={completeDisabled}
          >
            {completeLabel}
          </button>
        )}
      </div>
    </div>
  );
}
