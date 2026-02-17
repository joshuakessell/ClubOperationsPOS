import { RoomStatus } from '@club-ops/shared';
import type { DetailedRoom } from './types';
import { alertLevelFromMsUntil, formatDurationHuman, formatTimeOfDay, getMsUntil } from './utils';

interface RoomItemProps {
  room: DetailedRoom;
  isSelectable: boolean;
  isSelected: boolean;
  isHighlighted?: boolean;
  onClick?: () => void;
  isWaitlistMatch?: boolean;
  nowMs: number;
  onOpenCustomerAccount?: (customerId: string, customerLabel?: string) => void;
}

export function RoomItem({
  room,
  isSelectable,
  isSelected,
  isHighlighted = false,
  onClick,
  isWaitlistMatch,
  nowMs,
  onOpenCustomerAccount: _onOpenCustomerAccount,
}: RoomItemProps) {
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
        'rounded-2xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-gray-900',
        'er-inv-item',
        isWaitlistMatch ? 'er-inv-item--waitlist' : '',
        isSelected ? 'er-inv-item--selected' : '',
        isHighlighted ? 'er-inv-item--highlight' : '',
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
        <div className="er-inv-occupied-row">
          <div className="er-inv-occupied-number">{room.number}</div>
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
              {duration ? (duration.isOverdue ? `Late ${duration.label}` : duration.label) : '—'}
            </div>
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.75rem',
          }}
        >
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
              {room.number}
            </div>
            {!isCleaning && !isDirty && isWaitlistMatch && (
              <div
                className="er-text-sm"
                style={{ color: '#f59e0b', marginTop: '0.25rem', fontWeight: 800 }}
              >
                Upgrade Request
              </div>
            )}
            {isCleaning && (
              <div
                className="er-text-sm"
                style={{ color: '#94a3b8', marginTop: '0.25rem', fontWeight: 800 }}
              >
                Cleaning
              </div>
            )}
            {!isCleaning && isDirty && (
              <div
                className="er-text-sm"
                style={{ color: '#ef4444', marginTop: '0.25rem', fontWeight: 900 }}
              >
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
