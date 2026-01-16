import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal } from '../../../ui/Modal';
import { Button } from '../../../ui/Button';

export type TenderOutcomeChoice = 'CREDIT_SUCCESS' | 'CREDIT_DECLINE' | 'CASH_SUCCESS';

export function RequiredTenderOutcomeModal({
  isOpen,
  totalLabel,
  isSubmitting,
  onConfirm,
}: {
  isOpen: boolean;
  totalLabel: string;
  isSubmitting: boolean;
  onConfirm: (choice: TenderOutcomeChoice) => void;
}) {
  const [choice, setChoice] = useState<TenderOutcomeChoice | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const continueDisabled = isSubmitting || !choice;

  useEffect(() => {
    if (!isOpen) return;
    setChoice(null);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const root = modalRef.current;
    if (!root) return;

    // Focus the first option for tablet usability.
    const first = root.querySelector<HTMLElement>('button[data-choice]');
    first?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Required modal: prevent ESC close semantics from bubbling.
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
        ? (idx <= 0 ? focusables.length - 1 : idx - 1)
        : (idx === -1 || idx === focusables.length - 1 ? 0 : idx + 1);
      e.preventDefault();
      focusables[nextIdx]?.focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [isOpen]);

  const options = useMemo(
    () =>
      [
        { value: 'CREDIT_SUCCESS' as const, label: 'Credit Success' },
        { value: 'CREDIT_DECLINE' as const, label: 'Credit Failure' },
        { value: 'CASH_SUCCESS' as const, label: 'Cash Success' },
      ] as const,
    []
  );

  if (!isOpen) return null;

  return (
    <Modal open={isOpen} width="lg" panelClassName="p-0 overflow-hidden">
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Select tender outcome">
        <div className="border-b border-gray-200 px-6 py-4">
          <div className="text-lg font-semibold text-gray-900">Select Tender Outcome</div>
          <div className="mt-1 text-sm text-gray-600">{totalLabel}</div>
        </div>

        <div className="px-6 py-4">
          <div className="grid gap-2" role="radiogroup" aria-label="Tender outcome">
            {options.map((o) => {
              const selected = choice === o.value;
              return (
                <Button
                  key={o.value}
                  type="button"
                  data-choice={o.value}
                  variant={selected ? 'primary' : 'secondary'}
                  className="w-full"
                  onClick={() => setChoice(o.value)}
                  disabled={isSubmitting}
                  aria-pressed={selected}
                >
                  {o.label}
                </Button>
              );
            })}
          </div>

          <div className="mt-4">
            <Button
              type="button"
              className="w-full"
              onClick={() => {
                if (!choice) return;
                onConfirm(choice);
              }}
              disabled={continueDisabled}
            >
              {isSubmitting ? 'Processing…' : 'Continue'}
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

