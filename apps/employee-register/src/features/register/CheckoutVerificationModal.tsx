import type { CheckoutRequestSummary } from '@club-ops/shared';
import { computeCheckoutDelta, formatCheckoutDelta } from '@club-ops/shared';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '../../ui/Button';
import { Card } from '../../ui/Card';

export interface CheckoutVerificationModalProps {
  request: CheckoutRequestSummary;
  isSubmitting: boolean;
  checkoutItemsConfirmed: boolean;
  checkoutFeePaid: boolean;
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
  onConfirmItems,
  onMarkFeePaid,
  onComplete,
  onCancel,
}: CheckoutVerificationModalProps) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);

  const scheduled = useMemo(() => new Date(request.scheduledCheckoutAt), [request.scheduledCheckoutAt]);
  const delta = useMemo(() => computeCheckoutDelta(now, scheduled), [now, scheduled]);
  const deltaLabel = useMemo(() => formatCheckoutDelta(delta), [delta]);

  const number = request.roomNumber || request.lockerNumber || 'N/A';
  const numberLabel = request.roomNumber ? 'Room' : request.lockerNumber ? 'Locker' : 'Rental';

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.8)',
        zIndex: 2000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}
    >
      <Card
        padding="none"
        className="w-full max-w-[600px] overflow-y-auto bg-slate-900/70 text-white ring-slate-700"
        style={{ maxHeight: '80vh', padding: '2rem' }}
      >
        <h2 style={{ marginBottom: '1.5rem', fontSize: '1.5rem', fontWeight: 600 }}>
          Checkout Verification
        </h2>

        <div style={{ marginBottom: '1.5rem' }}>
          {/* Display order (required):
              1) Room/Locker Number
              2) Customer name
              3) Expected Check Out time
              4) Delta (remaining/late) with 15-min floor rounding
          */}
          <Card padding="md" className="mb-4 bg-slate-900/70 text-white ring-slate-700">
            <div style={{ fontWeight: 900, fontSize: '2rem', letterSpacing: '0.01em' }}>
              {numberLabel} {number}
            </div>
            <div style={{ marginTop: '0.35rem', fontSize: '1.25rem', fontWeight: 800 }}>
              {request.customerName}
              {request.membershipNumber && (
                <span style={{ fontWeight: 700, color: '#94a3b8' }}> ({request.membershipNumber})</span>
              )}
            </div>
            <div style={{ marginTop: '0.5rem', color: '#cbd5e1', fontWeight: 700 }}>
              Expected Check Out:{' '}
              <span style={{ fontWeight: 800 }}>{scheduled.toLocaleString()}</span>
            </div>
            <div
              style={{
                marginTop: '0.35rem',
                fontWeight: 900,
                color: delta.status === 'late' ? '#f59e0b' : '#10b981',
              }}
            >
              {deltaLabel}
            </div>
          </Card>

          {request.lateFeeAmount > 0 && (
            <div style={{ marginBottom: '0.5rem', color: '#f59e0b', fontWeight: 600 }}>
              <strong>Late Fee:</strong> ${request.lateFeeAmount.toFixed(2)}
              {request.banApplied && ' • 30-day ban applied'}
            </div>
          )}
        </div>

        <Card padding="md" className="mb-6 bg-slate-900/70 text-white ring-slate-700">
          <div style={{ marginBottom: '0.5rem', fontWeight: 600 }}>
            Customer Checklist:
          </div>
          <div style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            (Items customer marked as returned)
          </div>
        </Card>

        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            marginBottom: '1.5rem',
          }}
        >
          <Button
            onClick={onConfirmItems}
            disabled={checkoutItemsConfirmed}
            className={[
              'w-full',
              checkoutItemsConfirmed
                ? 'bg-emerald-600 text-white hover:bg-emerald-600 focus-visible:ring-emerald-600/40'
                : '',
            ].join(' ')}
            variant={checkoutItemsConfirmed ? 'secondary' : 'primary'}
          >
            {checkoutItemsConfirmed ? '✓ Items Confirmed' : 'Confirm Items Returned'}
          </Button>

          {request.lateFeeAmount > 0 && (
            <Button
              onClick={onMarkFeePaid}
              disabled={checkoutFeePaid}
              className={[
                'w-full',
                checkoutFeePaid
                  ? 'bg-emerald-600 text-white hover:bg-emerald-600 focus-visible:ring-emerald-600/40'
                  : '',
              ].join(' ')}
              variant={checkoutFeePaid ? 'secondary' : 'primary'}
            >
              {checkoutFeePaid ? '✓ Fee Marked Paid' : 'Mark Late Fee Paid'}
            </Button>
          )}

          <Button
            onClick={onComplete}
            disabled={
              !checkoutItemsConfirmed ||
              (request.lateFeeAmount > 0 && !checkoutFeePaid) ||
              isSubmitting
            }
            className="w-full"
          >
            {isSubmitting ? 'Processing...' : 'Complete Checkout'}
          </Button>
        </div>

        <Button onClick={onCancel} variant="danger" className="w-full">
          Cancel
        </Button>
      </Card>
    </div>
  );
}

