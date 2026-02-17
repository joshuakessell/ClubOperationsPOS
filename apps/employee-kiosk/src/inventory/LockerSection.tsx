import { useMemo } from 'react';
import { RoomStatus } from '@club-ops/shared';
import type { AlertLevel, DetailedLocker } from './types';
import {
  ROOM_TYPE_LABELS,
  alertLevelFromMsUntil,
  formatDurationHuman,
  formatTimeOfDay,
  getMsUntil,
} from './utils';
import { INVENTORY_COLUMN_HEADER_STYLE } from './inventorySectionStyles';

interface LockerSectionProps {
  lockers: DetailedLocker[];
  onSelectLocker: (locker: DetailedLocker) => void;
  selectedItem: { type: 'room' | 'locker'; id: string; number: string; tier: string } | null;
  nowMs: number;
  disableSelection?: boolean;
  occupancyLookupMode?: boolean;
  highlightId?: string | null;
  onOpenCustomerAccount?: (customerId: string, customerLabel?: string) => void;
}

export function LockerSection({
  lockers,
  onSelectLocker,
  selectedItem,
  nowMs,
  disableSelection = false,
  occupancyLookupMode = false,
  highlightId = null,
  onOpenCustomerAccount: _onOpenCustomerAccount,
}: LockerSectionProps) {
  const availableCount = lockers.filter(
    (l) => l.status === RoomStatus.CLEAN && !l.assignedTo
  ).length;
  const availableLockers = useMemo(
    () =>
      lockers
        .filter((l) => l.status === RoomStatus.CLEAN && !l.assignedTo)
        .sort((a, b) => parseInt(a.number) - parseInt(b.number)),
    [lockers]
  );
  const occupiedLockers = useMemo(
    () =>
      lockers
        .filter((l) => !!l.assignedTo || l.status === RoomStatus.OCCUPIED)
        .sort((a, b) => {
          const aMs = getMsUntil(a.checkoutAt, nowMs);
          const bMs = getMsUntil(b.checkoutAt, nowMs);
          const aLevel = alertLevelFromMsUntil(aMs);
          const bLevel = alertLevelFromMsUntil(bMs);
          const rank = (lvl: AlertLevel) => (lvl === 'danger' ? 0 : lvl === 'warning' ? 1 : 2);
          if (rank(aLevel) !== rank(bLevel)) return rank(aLevel) - rank(bLevel);
          if (aLevel === 'danger' && bLevel === 'danger') return (aMs ?? 0) - (bMs ?? 0);
          if (aLevel === 'warning' && bLevel === 'warning') return (aMs ?? 0) - (bMs ?? 0);
          const aTime = a.checkoutAt ? new Date(a.checkoutAt).getTime() : Number.POSITIVE_INFINITY;
          const bTime = b.checkoutAt ? new Date(b.checkoutAt).getTime() : Number.POSITIVE_INFINITY;
          return aTime - bTime;
        }),
    [lockers, nowMs]
  );

  const sectionCounts = useMemo(() => {
    let nearing = 0;
    let late = 0;
    for (const l of occupiedLockers) {
      const lvl = alertLevelFromMsUntil(getMsUntil(l.checkoutAt, nowMs));
      if (lvl === 'danger') late += 1;
      else if (lvl === 'warning') nearing += 1;
    }
    return { availableCount, nearing, late };
  }, [availableCount, nowMs, occupiedLockers]);

  return (
    <div>
      <div className="er-inv-section-header">
        <div className="er-inv-section-title">{ROOM_TYPE_LABELS.LOCKER}</div>
        <div className="er-inv-section-meta er-inv-meta">
          Available: {sectionCounts.availableCount}
          {sectionCounts.nearing > 0 ? ` • Nearing: ${sectionCounts.nearing}` : ''}
          {sectionCounts.late > 0 ? ` • Late: ${sectionCounts.late}` : ''}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        <div style={{ minWidth: 0 }}>
          <div
            className="er-inv-column-title er-inv-column-title--occupied"
            style={{ ...INVENTORY_COLUMN_HEADER_STYLE }}
          >
            🔒 Occupied
          </div>
          {occupiedLockers.length > 0 ? (
            occupiedLockers.map((locker) => {
              const msUntil = getMsUntil(locker.checkoutAt, nowMs);
              const duration = msUntil !== null ? formatDurationHuman(msUntil) : null;
              const checkoutTime = formatTimeOfDay(locker.checkoutAt);
              const customerLabel = locker.assignedMemberName || locker.assignedTo || null;
              const dueLevel = alertLevelFromMsUntil(msUntil);
              return (
                <button
                  key={locker.id}
                  onClick={() => onSelectLocker(locker)}
                  type="button"
                  className={[
                    'rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900',
                    'er-inv-item',
                    highlightId === locker.id ? 'er-inv-item--highlight' : '',
                    dueLevel === 'danger'
                      ? 'er-inv-item--danger'
                      : dueLevel === 'warning'
                        ? 'er-inv-item--warning'
                        : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  <div className="er-inv-occupied-row">
                    <div className="er-inv-occupied-number">{locker.number}</div>
                    <div className="er-inv-occupied-customer">
                      <span className="er-inv-occupied-customer-text">{customerLabel ?? '—'}</span>
                    </div>
                    <div className="er-inv-occupied-checkout">
                      <div className="er-inv-occupied-time">{checkoutTime ?? '—'}</div>
                      <div
                        className="er-inv-occupied-duration"
                        style={{
                          color: duration?.isOverdue ? '#ef4444' : 'rgba(148, 163, 184, 0.95)',
                        }}
                      >
                        {duration
                          ? duration.isOverdue
                            ? `Late ${duration.label}`
                            : duration.label
                          : '—'}
                      </div>
                    </div>
                  </div>
                </button>
              );
            })
          ) : (
            <div style={{ padding: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>None</div>
          )}
        </div>

        <div style={{ minWidth: 0 }}>
          <div className="er-inv-column-title er-inv-column-title--available">✓ Available</div>
          {availableLockers.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '0.5rem' }}>
              {availableLockers.map((locker) => {
                const isSelected = selectedItem?.type === 'locker' && selectedItem.id === locker.id;
                const isHighlighted = highlightId === locker.id;
                return (
                  <div
                    key={locker.id}
                    onClick={() => {
                      if (disableSelection || occupancyLookupMode) return;
                      onSelectLocker(locker);
                    }}
                    style={{
                      padding: '0.5rem',
                      background: isSelected ? '#3b82f6' : '#0f172a',
                      border: isSelected
                        ? '2px solid #60a5fa'
                        : isHighlighted
                          ? '2px solid rgba(255,255,255,0.55)'
                          : '1px solid #475569',
                      borderRadius: '4px',
                      textAlign: 'center',
                      fontSize: '0.875rem',
                      cursor: disableSelection || occupancyLookupMode ? 'default' : 'pointer',
                      minHeight: '44px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ fontWeight: 600 }}>{locker.number}</div>
                    {isSelected && <div style={{ fontSize: '1rem', marginTop: '0.25rem' }}>✓</div>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>None</div>
          )}
        </div>
      </div>
    </div>
  );
}
