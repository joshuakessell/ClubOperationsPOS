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
        <div className="relative" style={{ flex: 1, minWidth: 280 }}>
          <input
            className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 py-2.5 pr-10 text-sm text-gray-800 placeholder:text-gray-400 focus:border-brand-300 focus:ring-brand-500 dark:border-gray-700 dark:text-white/90"
            placeholder="Enter room/locker number…"
            value={typedNumber}
            onChange={(e) => onTypedNumberChange(e.target.value)}
            disabled={isSubmitting}
          />
          <div
            className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          >
            🔎
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50"
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
                    'rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900',
                    'er-inv-item',
                    selected ? 'ring-2 ring-brand-500' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-pressed={selected}
                  onClick={() => onCandidateToggle(c.occupancyId)}
                >
                  <div className="er-inv-occupied-row">
                    <div className="er-inv-occupied-number">{label}</div>
                    <div className="er-inv-occupied-customer">
                      <span className="er-inv-occupied-customer-text">{c.customerName || '—'}</span>
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
