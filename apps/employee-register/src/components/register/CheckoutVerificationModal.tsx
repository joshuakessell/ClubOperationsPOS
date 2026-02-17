import type { CheckoutRequestSummary } from '@club-ops/shared';
import { computeCheckoutDelta, formatCheckoutDelta } from '@club-ops/shared';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Button } from '@club-ops/ui/tailadmin';

export interface CheckoutVerificationModalProps {
  request: CheckoutRequestSummary;
  isSubmitting: boolean;
  checkoutItemsConfirmed: boolean;
  checkoutFeePaid: boolean;
  onOpenCustomerAccount?: (customerId: string, customerLabel?: string) => void;
  onConfirmItems: () => void;
  onMarkFeePaid: () => void;
  onComplete: () => void;
  onCancel: () => void;
}

export function CheckoutVerificationModal({
  request,
  isSubmitting,
  checkoutItemsConfirmed,
  checkoutFeePaid,
  onOpenCustomerAccount,
  onConfirmItems,
  onMarkFeePaid,
  onComplete,
  onCancel,
}: CheckoutVerificationModalProps) {
  const [now, setNow] = useState(() => new Date());
  const modalRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const root = modalRef.current;
    if (!root) return;
    const focusables = Array.from(
      root.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
    ).filter((el) => el.offsetParent !== null);
    (focusables[0] ?? root).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active && !root.contains(active)) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      if (e.key !== 'Tab') return;
      const nextFocusables = Array.from(
        root.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter((el) => el.offsetParent !== null);
      if (nextFocusables.length === 0) return;
      const idx = active ? nextFocusables.indexOf(active) : -1;
      const nextIdx = e.shiftKey
        ? idx <= 0
          ? nextFocusables.length - 1
          : idx - 1
        : idx === -1 || idx === nextFocusables.length - 1
          ? 0
          : idx + 1;
      e.preventDefault();
      nextFocusables[nextIdx]?.focus();
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  const scheduled = useMemo(
    () => new Date(request.scheduledCheckoutAt),
    [request.scheduledCheckoutAt]
  );
  const delta = useMemo(() => computeCheckoutDelta(now, scheduled), [now, scheduled]);
  const deltaLabel = useMemo(() => formatCheckoutDelta(delta), [delta]);

  const number = request.roomNumber || request.lockerNumber || 'N/A';
  const numberLabel = request.roomNumber ? 'Room' : request.lockerNumber ? 'Locker' : 'Rental';
  const canOpenCustomer = Boolean(request.customerId && onOpenCustomerAccount);

  return (
    <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black/80 p-8">
      <div
        className="w-full max-w-[600px] max-h-[80vh] overflow-y-auto rounded-2xl border border-gray-200 bg-white p-8 shadow-theme-lg dark:border-gray-800 dark:bg-gray-900"
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
      >
        <h2 className="mb-6 text-2xl font-semibold text-gray-800 dark:text-white/90">
          Checkout Verification
        </h2>

        <div className="mb-6">
          <div className="mb-4 rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-700 dark:bg-white/[0.03]">
            <div className="text-3xl font-black tracking-tight text-gray-800 dark:text-white/90">
              {numberLabel} {number}
            </div>
            <div className="mt-1.5 text-xl font-extrabold text-gray-700 dark:text-gray-200">
              {canOpenCustomer ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenCustomerAccount?.(request.customerId!, request.customerName)}
                >
                  {request.customerName}
                  {request.membershipNumber ? ` (${request.membershipNumber})` : ''}
                </Button>
              ) : (
                <>
                  {request.customerName}
                  {request.membershipNumber && (
                    <span className="font-bold text-gray-400"> ({request.membershipNumber})</span>
                  )}
                </>
              )}
            </div>
            <div className="mt-2 font-bold text-gray-400 dark:text-gray-500">
              Expected Check Out:{' '}
              <span className="font-extrabold">{scheduled.toLocaleString()}</span>
            </div>
            <div
              className="mt-1.5 font-black"
              style={{
                color: delta.status === 'late' ? '#f59e0b' : '#10b981',
              }}
            >
              {deltaLabel}
            </div>
          </div>

          {request.lateFeeAmount > 0 && (
            <div className="mb-2 font-semibold text-warning-500">
              <strong>Late Fee:</strong> ${request.lateFeeAmount.toFixed(2)}
              {request.banApplied && ' • 30-day ban applied'}
            </div>
          )}
        </div>

        <div className="mb-6 rounded-lg border border-gray-200 p-4 dark:border-gray-700">
          <div className="mb-2 font-semibold text-gray-800 dark:text-white/90">
            Customer Checklist:
          </div>
          <div className="text-sm text-gray-400 dark:text-gray-500">
            (Items customer marked as returned)
          </div>
        </div>

        <div className="mb-6 flex flex-col gap-4">
          <Button
            fullWidth
            variant={checkoutItemsConfirmed ? 'primary' : 'outline'}
            onClick={onConfirmItems}
            disabled={checkoutItemsConfirmed}
          >
            {checkoutItemsConfirmed ? '✓ Items Confirmed' : 'Confirm Items Returned'}
          </Button>

          {request.lateFeeAmount > 0 && (
            <Button
              fullWidth
              variant={checkoutFeePaid ? 'primary' : 'outline'}
              onClick={onMarkFeePaid}
              disabled={checkoutFeePaid}
            >
              {checkoutFeePaid ? '✓ Fee Marked Paid' : 'Mark Late Fee Paid'}
            </Button>
          )}

          <Button
            fullWidth
            onClick={onComplete}
            disabled={
              !checkoutItemsConfirmed ||
              (request.lateFeeAmount > 0 && !checkoutFeePaid) ||
              isSubmitting
            }
          >
            {isSubmitting ? 'Processing...' : 'Complete Checkout'}
          </Button>
        </div>

        <Button fullWidth variant="danger" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
