import type { ResolveResponse } from './types';
import { formatClockTime, formatLateDuration } from './utils';

type Props = {
  confirmQueue: ResolveResponse[];
  confirmIndex: number;
  isSubmitting: boolean;
  onConfirm: () => void;
};

export function ManualCheckoutPanelConfirmStep({
  confirmQueue,
  confirmIndex,
  isSubmitting,
  onConfirm,
}: Props) {
  if (confirmQueue.length === 0) {
    return <div style={{ padding: '0.75rem', color: '#94a3b8' }}>Loading…</div>;
  }

  const current = confirmQueue[confirmIndex];

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div
        className="er-text-sm"
        style={{ color: '#94a3b8', fontWeight: 900, textAlign: 'center' }}
      >
        {confirmIndex + 1} of {confirmQueue.length}
      </div>
      <div style={{ textAlign: 'center', fontSize: '1.5rem', fontWeight: 900 }}>
        {current?.customerName || '—'}
      </div>

      <div className="er-surface" style={{ padding: '0.75rem', borderRadius: 12 }}>
        <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
          Checkout
        </div>
        <div style={{ fontWeight: 900 }}>
          {current?.resourceType === 'ROOM' ? 'Room' : 'Locker'} {current?.number}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div className="er-surface" style={{ padding: '0.75rem', borderRadius: 12 }}>
          <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
            Check-in
          </div>
          <div style={{ fontWeight: 900 }}>{formatClockTime(current!.checkinAt)}</div>
        </div>
        <div className="er-surface" style={{ padding: '0.75rem', borderRadius: 12 }}>
          <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
            Scheduled checkout
          </div>
          <div style={{ fontWeight: 900 }}>{formatClockTime(current!.scheduledCheckoutAt)}</div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
          gap: '0.75rem',
        }}
      >
        <div className="er-surface" style={{ padding: '0.75rem', borderRadius: 12 }}>
          <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
            Late
          </div>
          <div style={{ fontWeight: 900 }}>
            {current!.lateMinutes > 0 ? formatLateDuration(current!.lateMinutes) : '—'}
          </div>
        </div>
        <div className="er-surface" style={{ padding: '0.75rem', borderRadius: 12 }}>
          <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
            Fee
          </div>
          <div style={{ fontWeight: 900 }}>${current!.fee.toFixed(2)}</div>
        </div>
      </div>

      {current!.banApplied && (
        <div className="er-surface" style={{ padding: '0.75rem', borderRadius: 12 }}>
          <div style={{ fontWeight: 900, color: '#f59e0b' }}>⚠️ Ban applied</div>
          <div className="er-text-sm" style={{ color: '#94a3b8' }}>
            The account is now blocked from check-in until cleared.
          </div>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          justifyContent: 'flex-end',
          flexWrap: 'wrap',
        }}
      >
        <button
          type="button"
          className="cs-liquid-button"
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          Complete checkout
        </button>
      </div>
    </div>
  );
}
