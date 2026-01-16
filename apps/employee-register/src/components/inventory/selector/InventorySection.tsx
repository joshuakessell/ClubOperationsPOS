import { useMemo } from 'react';
import { RoomStatus } from '@club-ops/shared';
import type { AlertLevel, DetailedRoom, SelectedInventoryItem } from './types';
import { groupRooms, sortGroupedRooms } from './grouping';
import { alertLevelFromMsUntil, getMsUntil, maxAlert } from './time';
import { RoomItem } from './RoomItem';
import { Button } from '../../../ui/Button';
import { Card } from '../../../ui/Card';

export function InventorySection({
  title,
  rooms,
  isExpanded,
  onToggle,
  onSelectRoom,
  selectedItem,
  waitlistEntries = [],
  nowMs,
  disableSelection = false,
  occupancyLookupMode = false,
}: {
  title: string;
  rooms: DetailedRoom[];
  isExpanded: boolean;
  onToggle: () => void;
  onSelectRoom: (room: DetailedRoom) => void;
  selectedItem: SelectedInventoryItem | null;
  waitlistEntries?: Array<{ desiredTier: string; status: string }>;
  nowMs: number;
  disableSelection?: boolean;
  occupancyLookupMode?: boolean;
}) {
  const grouped = useMemo(() => sortGroupedRooms(groupRooms(rooms, waitlistEntries, nowMs)), [rooms, waitlistEntries, nowMs]);

  const upgradeRequests = grouped.filter((g) => g.group === 'upgradeRequest');
  const available = grouped.filter((g) => g.group === 'available');
  const occupied = grouped.filter((g) => g.group === 'occupied');
  const cleaning = grouped.filter((g) => g.group === 'cleaning');
  const dirty = grouped.filter((g) => g.group === 'dirty');
  const availableForDisplay = [...upgradeRequests, ...available];
  const allowAvailableSelection = !disableSelection && !occupancyLookupMode;

  const sectionAlertLevel = useMemo(() => {
    let level: AlertLevel = null;
    for (const r of rooms) {
      const isOccupied = !!r.assignedTo || r.status === RoomStatus.OCCUPIED;
      if (!isOccupied) continue;
      const ms = getMsUntil(r.checkoutAt, nowMs);
      level = maxAlert(level, alertLevelFromMsUntil(ms));
      if (level === 'danger') return 'danger';
    }
    return level;
  }, [nowMs, rooms]);

  const sectionCounts = useMemo(() => {
    const availableCount = rooms.filter((r) => r.status === RoomStatus.CLEAN && !r.assignedTo).length;
    let nearing = 0;
    let late = 0;
    for (const r of rooms) {
      const isOccupied = !!r.assignedTo || r.status === RoomStatus.OCCUPIED;
      if (!isOccupied) continue;
      const lvl = alertLevelFromMsUntil(getMsUntil(r.checkoutAt, nowMs));
      if (lvl === 'danger') late += 1;
      else if (lvl === 'warning') nearing += 1;
    }
    return { availableCount, nearing, late };
  }, [nowMs, rooms]);

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
          <div style={{ fontWeight: 700 }}>{title}</div>
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
          {/* Single-column layout: Occupied → Available → Cleaning → Dirty */}
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
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800, marginBottom: '0.5rem' }}>
                🔒 Occupied
              </div>
              {occupied.length > 0 ? (
                occupied.map((g) => (
                  <RoomItem
                    key={g.room.id}
                    room={g.room}
                    isSelectable={true}
                    isSelected={selectedItem?.type === 'room' && selectedItem.id === g.room.id}
                    onClick={() => onSelectRoom(g.room)}
                    nowMs={nowMs}
                  />
                ))
              ) : (
                <div style={{ padding: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>None</div>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800, marginBottom: '0.5rem' }}>
                ✅ Available
              </div>
              {availableForDisplay.length > 0 ? (
                availableForDisplay.map((g) => (
                  <RoomItem
                    key={g.room.id}
                    room={g.room}
                    isSelectable={allowAvailableSelection}
                    isSelected={selectedItem?.type === 'room' && selectedItem.id === g.room.id}
                    onClick={() => {
                      if (!allowAvailableSelection) return;
                      onSelectRoom(g.room);
                    }}
                    isWaitlistMatch={g.isWaitlistMatch}
                    nowMs={nowMs}
                  />
                ))
              ) : (
                <div style={{ padding: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>None</div>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800, marginBottom: '0.5rem' }}>
                🧹 Cleaning
              </div>
              {cleaning.length > 0 ? (
                cleaning.map((g) => (
                  <RoomItem
                    key={g.room.id}
                    room={g.room}
                    isSelectable={false}
                    isSelected={false}
                    nowMs={nowMs}
                  />
                ))
              ) : (
                <div style={{ padding: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>None</div>
              )}
            </div>

            <div style={{ minWidth: 0 }}>
              <div className="er-text-sm" style={{ color: '#94a3b8', fontWeight: 800, marginBottom: '0.5rem' }}>
                🧽 Dirty
              </div>
              {dirty.length > 0 ? (
                dirty.map((g) => (
                  <RoomItem
                    key={g.room.id}
                    room={g.room}
                    isSelectable={false}
                    isSelected={false}
                    nowMs={nowMs}
                  />
                ))
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

