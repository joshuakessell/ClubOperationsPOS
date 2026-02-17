import { ModalFrame } from './ModalFrame';

export interface UpgradePaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerLabel: string;
  newRoomNumber?: string | null;
  offeredRoomNumber?: string | null;
  originalCharges: Array<{ description: string; amount: number }>;
  originalTotal: number | null;
  upgradeFee: number | null;
  paymentStatus: 'DUE' | 'PAID' | null;
  isSubmitting: boolean;
  canComplete: boolean;
  onPayCreditSuccess: () => void;
  onPayCashSuccess: () => void;
  onDecline: () => void;
  onComplete: () => void;
}

export function UpgradePaymentModal({
  isOpen,
  onClose,
  customerLabel,
  newRoomNumber,
  offeredRoomNumber,
  originalCharges,
  originalTotal,
  upgradeFee,
  paymentStatus,
  isSubmitting,
  canComplete,
  onPayCreditSuccess,
  onPayCashSuccess,
  onDecline,
  onComplete,
}: UpgradePaymentModalProps) {
  const totalDue = typeof upgradeFee === 'number' && Number.isFinite(upgradeFee) ? upgradeFee : 0;

  return (
    <ModalFrame isOpen={isOpen} title="Upgrade Payment Quote" onClose={onClose} maxWidth="560px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ color: '#cbd5e1' }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>{customerLabel}</div>
          {(newRoomNumber || offeredRoomNumber) && (
            <div style={{ fontSize: '0.9rem', color: '#94a3b8' }}>
              Upgrade to room {newRoomNumber || offeredRoomNumber}
            </div>
          )}
        </div>

        <div
          className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            padding: '0.75rem',
          }}
        >
          <div style={{ fontWeight: 700, color: '#e2e8f0' }}>Already Paid</div>
          {originalCharges.length > 0 ? (
            <>
              {originalCharges.map((item, idx) => (
                <div
                  key={`${item.description}-${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#94a3b8',
                    fontStyle: 'italic',
                  }}
                >
                  <span>{item.description}</span>
                  <span>${item.amount.toFixed(2)}</span>
                </div>
              ))}
              {originalTotal !== null && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    color: '#94a3b8',
                    fontStyle: 'italic',
                    fontWeight: 600,
                  }}
                >
                  <span>Original total</span>
                  <span>${originalTotal.toFixed(2)}</span>
                </div>
              )}
            </>
          ) : (
            <div style={{ color: '#94a3b8', fontStyle: 'italic' }}>
              All prior charges are settled.
            </div>
          )}
        </div>

        <div
          className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.5rem',
            padding: '0.75rem',
          }}
        >
          <div style={{ fontWeight: 700, color: '#e2e8f0' }}>New Charge</div>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              color: '#f8fafc',
              fontWeight: 600,
            }}
          >
            <span>Upgrade Fee</span>
            <span>
              ${upgradeFee !== null && Number.isFinite(upgradeFee) ? upgradeFee.toFixed(2) : '—'}
            </span>
          </div>
        </div>

        <div
          className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.75rem',
          }}
        >
          <div style={{ fontWeight: 700, color: '#e2e8f0' }}>Total Due</div>
          <div style={{ fontWeight: 800, color: '#f59e0b' }}>${totalDue.toFixed(2)}</div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
            gap: '0.5rem',
          }}
        >
          <button
            onClick={onPayCreditSuccess}
            disabled={isSubmitting || !canComplete}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
            style={{
              padding: '0.75rem 1rem',
              fontWeight: 700,
            }}
          >
            Credit Success
          </button>
          <button
            onClick={onPayCashSuccess}
            disabled={isSubmitting || !canComplete}
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
            style={{
              padding: '0.75rem 1rem',
              fontWeight: 700,
            }}
          >
            Cash Success
          </button>
          <button
            onClick={onDecline}
            disabled={isSubmitting}
            className="inline-flex items-center justify-center rounded-lg border border-error-300 bg-error-50 px-4 py-2.5 text-sm font-semibold text-error-600 shadow-theme-xs transition hover:bg-error-100 dark:border-error-700 dark:bg-error-500/10 dark:text-error-400 dark:hover:bg-error-500/20"
            style={{
              padding: '0.75rem 1rem',
              fontWeight: 700,
            }}
          >
            Credit Decline
          </button>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div
            style={{
              fontSize: '0.9rem',
              color: paymentStatus === 'PAID' ? '#10b981' : '#f59e0b',
              fontWeight: 700,
            }}
          >
            Status: {paymentStatus === 'PAID' ? 'Paid' : 'Payment Due'}
          </div>
          <button
            onClick={onComplete}
            disabled={paymentStatus !== 'PAID' || isSubmitting || !canComplete}
            className={[
              'inline-flex items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold shadow-theme-xs transition',
              paymentStatus === 'PAID'
                ? 'border-brand-500 bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-400'
                : 'border border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]',
            ].join(' ')}
            style={{
              padding: '0.75rem 1.25rem',
              fontWeight: 700,
            }}
          >
            Complete Upgrade
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
