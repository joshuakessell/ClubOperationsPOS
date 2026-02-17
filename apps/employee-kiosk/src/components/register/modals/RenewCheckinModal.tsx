import { ModalFrame } from './ModalFrame';
import type { ActiveCheckinDetails } from './AlreadyCheckedInModal';
import { formatLocal, getRenewalEligibility } from '../renewalEligibility';

export function RenewCheckinModal(props: {
  isOpen: boolean;
  activeCheckin: ActiveCheckinDetails | null;
  errorMessage?: string | null;
  isSubmitting?: boolean;
  onClose: () => void;
  onSelectHours: (hours: 2 | 6) => void;
}) {
  const {
    isOpen,
    activeCheckin,
    errorMessage,
    isSubmitting = false,
    onClose,
    onSelectHours,
  } = props;

  const eligibility = getRenewalEligibility(activeCheckin);
  const totalHoursLabel =
    eligibility.totalHours === null || !Number.isFinite(eligibility.totalHours)
      ? '—'
      : `${eligibility.totalHours.toFixed(2).replace(/\.00$/, '')} hours`;

  return (
    <ModalFrame isOpen={isOpen} title="Renew Check-in" onClose={onClose} maxWidth="560px">
      <div style={{ display: 'grid', gap: '0.75rem' }}>
        <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
          Renewals are available within 1 hour of checkout. Maximum stay is 14 hours.
        </div>

        <div
          className="rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900"
          style={{ padding: '0.85rem' }}
        >
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            <div>
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
                Current checkout
              </div>
              <div style={{ fontWeight: 900 }}>{formatLocal(activeCheckin?.checkoutAt)}</div>
            </div>
            <div>
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800 }}>
                Total hours today
              </div>
              <div style={{ fontWeight: 900 }}>{totalHoursLabel}</div>
            </div>
          </div>
        </div>

        {errorMessage ? (
          <div
            style={{
              padding: '0.75rem',
              background: 'rgba(239, 68, 68, 0.18)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              borderRadius: 12,
              color: '#fecaca',
              fontWeight: 800,
            }}
          >
            {errorMessage}
          </div>
        ) : null}

        <div className="er-renewal-modal__actions">
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600"
            disabled={!eligibility.allowTwoHour || isSubmitting}
            onClick={() => onSelectHours(2)}
          >
            Extend 2 Hours
          </button>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
            disabled={!eligibility.allowSixHour || isSubmitting}
            onClick={() => onSelectHours(6)}
          >
            Extend 6 Hours
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}
