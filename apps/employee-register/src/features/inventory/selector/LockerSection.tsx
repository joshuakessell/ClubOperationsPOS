import { useMemo, type CSSProperties } from 'react';
import { RoomStatus } from '@club-ops/shared';
import type { AlertLevel, DetailedLocker, SelectedInventoryItem } from './types';
import { alertLevelFromMsUntil, formatDurationHuman, formatTimeOfDay, getMsUntil, maxAlert } from './time';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';

const INVENTORY_COLUMN_HEADER_STYLE: CSSProperties = {
  fontWeight: 700,
  marginBottom: '0.5rem',
  paddingBottom: '0.25rem',
  borderBottom: '1px solid #334155',
  minHeight: '28px',
  display: 'flex',
  alignItems: 'center',
};

export function LockerSection({
  lockers,
  isExpanded,
  onToggle,
  onSelectLocker,
  selectedItem,
  nowMs,
  disableSelection = false,
  occupancyLookupMode = false,
}: {
  lockers: DetailedLocker[];
  isExpanded: boolean;
  onToggle: () => void;
  onSelectLocker: (locker: DetailedLocker) => void;
  selectedItem: SelectedInventoryItem | null;
  nowMs: number;
  disableSelection?: boolean;
  occupancyLookupMode?: boolean;
}) {
  const availableCount = lockers.filter((l) => l.status === RoomStatus.CLEAN && !l.assignedTo).length;
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

  const sectionAlertLevel = useMemo(() => {
    let level: AlertLevel = null;
    for (const l of occupiedLockers) {
      level = maxAlert(level, alertLevelFromMsUntil(getMsUntil(l.checkoutAt, nowMs)));
      if (level === 'danger') return 'danger';
    }
    return level;
  }, [nowMs, occupiedLockers]);

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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
        flex: isExpanded ? '1 1 0' : '0 0 auto',
        minHeight: 0,
      }}
    >
      <Button
        onClick={onToggle}
        variant={sectionAlertLevel === 'danger' ? 'danger' : isExpanded ? 'primary' : 'secondary'}
        className={[
          'w-full py-3 relative text-left',
          sectionAlertLevel === 'warning'
            ? 'bg-amber-600 text-white hover:bg-amber-700 focus-visible:ring-amber-600/40'
            : '',
        ].join(' ')}
      >
        <span
          aria-hidden={true}
          style={{
            position: 'absolute',
            top: '0.75rem',
            right: '0.75rem',
            fontWeight: 900,
          }}
        >
          {isExpanded ? '▼' : '▶'}
        </span>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', alignItems: 'flex-start' }}>
          <div style={{ fontWeight: 700 }}>Lockers</div>
          <div className="er-text-sm er-inv-meta" style={{ fontWeight: 800 }}>
            Available: {sectionCounts.availableCount}
          </div>
          {sectionCounts.nearing > 0 && (
            <div className="er-text-sm" style={{ fontWeight: 900, color: '#f59e0b' }}>
              Nearing Checkout: {sectionCounts.nearing}
            </div>
          )}
          {sectionCounts.late > 0 && (
            <div className="er-text-sm" style={{ fontWeight: 900, color: '#ef4444' }}>
              Late for Checkout: {sectionCounts.late}
            </div>
          )}
        </div>
      </Button>

      {isExpanded && (
        <Card padding="sm" className="flex-1 min-h-0 overflow-hidden bg-slate-900/70 text-white ring-slate-700">
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '0.75rem',
              height: '100%',
              overflowY: 'auto',
              paddingRight: '0.25rem',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div className="er-text-sm" style={{ color: '#94a3b8', ...INVENTORY_COLUMN_HEADER_STYLE }}>
                🔒 Occupied
              </div>

              {occupiedLockers.length > 0 ? (
                <>
                  {occupiedLockers.map((locker) => {
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
                          'er-inv-item',
                          'rounded-xl bg-slate-900/70 text-white ring-1 ring-slate-700',
                          dueLevel === 'danger'
                            ? 'er-inv-item--danger'
                            : dueLevel === 'warning'
                              ? 'er-inv-item--warning'
                              : '',
                        ]
                          .filter(Boolean)
                          .join(' ')}
                      >
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.25rem 0.75rem' }}>
                          <div
                            className="er-text-lg"
                            style={{
                              fontWeight: 800,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            Locker {locker.number}
                          </div>
                          <div className="er-text-md er-inv-meta" style={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                            Checkout: {checkoutTime ?? '—'}
                          </div>

                          <div
                            className="er-text-md er-inv-meta"
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {customerLabel ?? '—'}
                          </div>
                          <div
                            className="er-text-md"
                            style={{
                              fontWeight: 900,
                              color: duration?.isOverdue
                                ? '#ef4444'
                                : duration
                                  ? 'rgba(148, 163, 184, 0.95)'
                                  : 'rgba(148, 163, 184, 0.95)',
                              fontVariantNumeric: 'tabular-nums',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            ({duration ? (duration.isOverdue ? `Overdue ${duration.label}` : duration.label) : '—'})
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </>
              ) : (
                <div style={{ padding: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>None</div>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div className="er-text-sm" style={{ color: '#94a3b8', ...INVENTORY_COLUMN_HEADER_STYLE }}>
                ✅ Available
              </div>

              {availableLockers.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(72px, 1fr))', gap: '0.5rem' }}>
                  {availableLockers.map((locker) => {
                    const isSelected = selectedItem?.type === 'locker' && selectedItem.id === locker.id;
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
                          border: isSelected ? '2px solid #60a5fa' : '1px solid #475569',
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
        </Card>
      )}
    </div>
  );
}

