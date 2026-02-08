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

        <div className="cs-liquid-card" style={{ padding: '0.85rem' }}>
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
            className="cs-liquid-button"
            disabled={!eligibility.allowTwoHour || isSubmitting}
            onClick={() => onSelectHours(2)}
          >
            Extend 2 Hours
          </button>
          <button
            type="button"
            className="cs-liquid-button cs-liquid-button--secondary"
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
