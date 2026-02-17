import type { ResolveResponse } from './types';
import { toDate } from './utils';

type Props = {
  confirmQueue: ResolveResponse[];
  confirmIndex: number;
  isSubmitting: boolean;
  onConfirm: () => void;
};

export function ManualCheckoutModalConfirmStep({
  confirmQueue,
  confirmIndex,
  isSubmitting,
  onConfirm,
}: Props) {
  const confirmCurrent = confirmQueue[confirmIndex] ?? null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem',
          alignItems: 'baseline',
        }}
      >
        <div style={{ fontWeight: 900, fontSize: '1.15rem' }}>Confirm checkout</div>
        <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 900 }}>
          {confirmIndex + 1} of {confirmQueue.length || 1}
        </div>
      </div>
      {confirmCurrent && (
        <div className="er-surface" style={{ padding: '1rem', borderRadius: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Customer</div>
              <div style={{ fontWeight: 800 }}>{confirmCurrent.customerName}</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Resource</div>
              <div style={{ fontWeight: 800 }}>
                {confirmCurrent.resourceType === 'ROOM' ? 'Room' : 'Locker'} {confirmCurrent.number}
              </div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Check-in</div>
              <div style={{ fontWeight: 800 }}>
                {toDate(confirmCurrent.checkinAt).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Scheduled checkout</div>
              <div style={{ fontWeight: 800 }}>
                {toDate(confirmCurrent.scheduledCheckoutAt).toLocaleString()}
              </div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Late</div>
              <div style={{ fontWeight: 800 }}>{confirmCurrent.lateMinutes} min</div>
            </div>
            <div>
              <div style={{ color: '#94a3b8', fontSize: '0.875rem' }}>Outcome</div>
              <div
                style={{
                  fontWeight: 900,
                  color: confirmCurrent.banApplied ? '#f59e0b' : '#10b981',
                }}
              >
                Fee ${confirmCurrent.fee.toFixed(2)}
                {confirmCurrent.banApplied ? ' • 30-day ban' : ''}
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.25rem' }}>
        <div />
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50"
          onClick={onConfirm}
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Confirming…' : 'Confirm'}
        </button>
      </div>
    </div>
  );
}
