import type { ManualCandidate } from './types';
import { formatClockTime, formatDeltaMinutesLabel, toDate } from './utils';

type Props = {
  entryMode: 'default' | 'direct-confirm';
  typedNumber: string;
  isSubmitting: boolean;
  canContinue: boolean;
  candidates: ManualCandidate[];
  loadingCandidates: boolean;
  selectedOccupancyIds: string[];
  onTypedNumberChange: (value: string) => void;
  onCandidateToggle: (occupancyId: string) => void;
  onContinue: () => void;
};

export function ManualCheckoutPanelSelectStep({
  entryMode,
  typedNumber,
  isSubmitting,
  canContinue,
  candidates,
  loadingCandidates,
  selectedOccupancyIds,
  onTypedNumberChange,
  onCandidateToggle,
  onContinue,
}: Props) {
  if (entryMode === 'direct-confirm') {
    return <div style={{ padding: '0.75rem', color: '#94a3b8' }}>Loading checkout…</div>;
  }

  return (
    <>
      <div
        style={{
          display: 'flex',
          gap: '0.75rem',
          alignItems: 'center',
          flexWrap: 'wrap',
        }}
      >
        <div className="cs-liquid-search" style={{ flex: 1, minWidth: 280 }}>
          <input
            className="cs-liquid-input cs-liquid-search__input"
            placeholder="Enter room/locker number…"
            value={typedNumber}
            onChange={(e) => onTypedNumberChange(e.target.value)}
            disabled={isSubmitting}
          />
          <div className="cs-liquid-search__icon" aria-hidden="true">
            🔎
          </div>
        </div>
        <button
          type="button"
          className="cs-liquid-button"
          onClick={onContinue}
          disabled={!canContinue || isSubmitting}
        >
          Continue
        </button>
      </div>

      <div className="er-checkout-list">
        <div className="er-card-subtitle" style={{ marginBottom: '0.5rem' }}>
          Or select from occupied units
        </div>
        {loadingCandidates ? (
          <div style={{ padding: '0.75rem', color: '#94a3b8' }}>Loading…</div>
        ) : candidates.length === 0 ? (
          <div style={{ padding: '0.75rem', color: '#94a3b8' }}>No occupied rooms/lockers</div>
        ) : (
          <div style={{ display: 'grid', gap: '0.5rem' }}>
            {candidates.map((c) => {
              const selected = selectedOccupancyIds.includes(c.occupancyId);
              const label = `${c.resourceType === 'ROOM' ? 'Room' : 'Locker'} ${c.number}`;
              const scheduled = toDate(c.scheduledCheckoutAt);
              const delta = formatDeltaMinutesLabel(scheduled);
              return (
                <button
                  key={c.occupancyId}
                  type="button"
                  className={[
                    'cs-liquid-card',
                    'er-inv-item',
                    selected ? 'er-inv-item--selected' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={selected}
                  onClick={() => onCandidateToggle(c.occupancyId)}
                >
                  <div className="er-inv-occupied-row">
                    <div className="er-inv-occupied-number">{label}</div>
                    <div className="er-inv-occupied-customer">
                      <span className="er-inv-occupied-customer-text">
                        {c.customerName || '—'}
                      </span>
                    </div>
                    <div className="er-inv-occupied-checkout">
                      <div className="er-inv-occupied-time">
                        Checkout Time: {formatClockTime(scheduled)}
                      </div>
                      <div className="er-inv-occupied-duration" style={{ color: delta.color }}>
                        {delta.label}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
