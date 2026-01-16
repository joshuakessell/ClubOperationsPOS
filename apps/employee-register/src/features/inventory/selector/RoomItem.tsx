import { RoomStatus } from '@club-ops/shared';
import type { DetailedRoom } from './types';
import { alertLevelFromMsUntil, formatDurationHuman, formatTimeOfDay, getMsUntil } from './time';

export function RoomItem({
  room,
  isSelectable,
  isSelected,
  onClick,
  isWaitlistMatch,
  nowMs,
}: {
  room: DetailedRoom;
  isSelectable: boolean;
  isSelected: boolean;
  onClick?: () => void;
  isWaitlistMatch?: boolean;
  nowMs: number;
}) {
  const isOccupied = !!room.assignedTo || room.status === RoomStatus.OCCUPIED;
  const isCleaning = room.status === RoomStatus.CLEANING;
  const isDirty = room.status === RoomStatus.DIRTY;
  const msUntil = isOccupied ? getMsUntil(room.checkoutAt, nowMs) : null;
  const duration = msUntil !== null ? formatDurationHuman(msUntil) : null;
  const checkoutTime = isOccupied ? formatTimeOfDay(room.checkoutAt) : null;
  const customerLabel = room.assignedMemberName || room.assignedTo || null;
  const dueLevel = isOccupied ? alertLevelFromMsUntil(msUntil) : null;

  return (
    <button
      type="button"
      className={[
        'er-inv-item',
        'rounded-xl bg-slate-900/70 text-white ring-1 ring-slate-700',
        isWaitlistMatch ? 'er-inv-item--waitlist' : '',
        isSelected ? 'er-inv-item--selected' : '',
        dueLevel === 'danger'
          ? 'er-inv-item--danger'
          : dueLevel === 'warning'
            ? 'er-inv-item--warning'
            : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={isSelectable ? onClick : undefined}
      disabled={!isSelectable}
      aria-disabled={!isSelectable}
    >
      {isOccupied ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.25rem 0.75rem' }}>
          <div
            className="er-text-lg"
            style={{
              fontWeight: 900,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Room {room.number}
          </div>
          <div className="er-text-md er-inv-meta" style={{ fontWeight: 900, whiteSpace: 'nowrap' }}>
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
      ) : (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{ minWidth: 0, overflow: 'hidden' }}>
            <div
              className="er-text-lg"
              style={{
                fontWeight: 800,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              Room {room.number}
            </div>
            {!isCleaning && !isDirty && isWaitlistMatch && (
              <div className="er-text-sm" style={{ color: '#f59e0b', marginTop: '0.25rem', fontWeight: 800 }}>
                Upgrade Request
              </div>
            )}
            {isCleaning && (
              <div className="er-text-sm" style={{ color: '#94a3b8', marginTop: '0.25rem', fontWeight: 800 }}>
                Cleaning
              </div>
            )}
            {!isCleaning && isDirty && (
              <div className="er-text-sm" style={{ color: '#ef4444', marginTop: '0.25rem', fontWeight: 900 }}>
                Dirty
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            {isSelected && <span className="er-text-xl">✓</span>}
          </div>
        </div>
      )}
    </button>
  );
}

