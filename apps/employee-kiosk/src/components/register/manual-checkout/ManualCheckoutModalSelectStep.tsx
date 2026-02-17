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
  onInputFocus: () => void;
  onCandidateToggle: (occupancyId: string) => void;
  onContinue: () => void;
};

export function ManualCheckoutModalSelectStep({
  entryMode,
  typedNumber,
  isSubmitting,
  canContinue,
  candidates,
  loadingCandidates,
  selectedOccupancyIds,
  onTypedNumberChange,
  onInputFocus,
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
            placeholder="Type room/locker number…"
            value={typedNumber}
            onFocus={onInputFocus}
            onChange={(e) => onTypedNumberChange(e.target.value)}
            aria-label="Checkout number"
          />
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
            <svg
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M7.33333 12.6667C10.2789 12.6667 12.6667 10.2789 12.6667 7.33333C12.6667 4.38781 10.2789 2 7.33333 2C4.38781 2 2 4.38781 2 7.33333C2 10.2789 4.38781 12.6667 7.33333 12.6667Z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M14 14L11.1 11.1"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        <button
          type="button"
          className="inline-flex items-center justify-center rounded-lg bg-brand-500 px-4 py-2.5 text-sm font-semibold text-white shadow-theme-xs transition hover:bg-brand-600 disabled:opacity-50"
          onClick={onContinue}
          disabled={!canContinue || isSubmitting}
        >
          {isSubmitting ? 'Loading…' : 'Continue'}
        </button>
      </div>

      <div style={{ marginTop: '1rem' }}>
        <div style={{ fontWeight: 800, marginBottom: '0.5rem' }}>Suggested</div>
        {loadingCandidates ? (
          <div style={{ padding: '0.75rem', color: '#94a3b8' }}>Loading candidates…</div>
        ) : candidates.length === 0 ? (
          <div style={{ padding: '0.75rem', color: '#94a3b8' }}>No candidates</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {candidates.map((c) => {
              const selected = selectedOccupancyIds.includes(c.occupancyId);
              const scheduled = toDate(c.scheduledCheckoutAt);
              const delta = formatDeltaMinutesLabel(scheduled);
              return (
                <button
                  key={c.occupancyId}
                  type="button"
                  className={[
                    'rounded-lg border px-3 py-2.5 text-left transition',
                    selected
                      ? 'border-brand-500 bg-brand-50 dark:bg-brand-500/10'
                      : 'border-gray-200 text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]',
                  ].join(' ')}
                  aria-pressed={selected}
                  onClick={() => onCandidateToggle(c.occupancyId)}
                  style={{
                    justifyContent: 'space-between',
                    padding: '0.75rem',
                    borderColor: c.isOverdue ? 'rgba(239, 68, 68, 0.65)' : undefined,
                    background: selected
                      ? undefined
                      : c.isOverdue
                        ? 'rgba(239, 68, 68, 0.08)'
                        : undefined,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      width: '100%',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '1rem',
                    }}
                  >
                    <div
                      style={{
                        fontWeight: 900,
                        minWidth: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {c.resourceType === 'ROOM' ? 'Room' : 'Locker'} {c.number} - {c.customerName}{' '}
                      - {formatClockTime(scheduled)}
                    </div>
                    <div style={{ fontWeight: 900, whiteSpace: 'nowrap', color: delta.color }}>
                      {delta.label}
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
