import { useMemo } from 'react';
import { RoomStatus } from '@club-ops/shared';
import type { DetailedRoom } from './types';
import { alertLevelFromMsUntil, getMsUntil, groupRooms, sortGroupedRooms } from './utils';
import { INVENTORY_COLUMN_HEADER_STYLE } from './InventorySectionStyles';
import { RoomItem } from './RoomItem';

interface InventorySectionProps {
  title: string;
  rooms: DetailedRoom[];
  onSelectRoom: (room: DetailedRoom) => void;
  selectedItem: { type: 'room' | 'locker'; id: string; number: string; tier: string } | null;
  nowMs: number;
  disableSelection?: boolean;
  occupancyLookupMode?: boolean;
  highlightId?: string | null;
  onOpenCustomerAccount?: (customerId: string, customerLabel?: string) => void;
}

export function InventorySection({
  title,
  rooms,
  onSelectRoom,
  selectedItem,
  waitlistEntries = [],
  nowMs,
  disableSelection = false,
  occupancyLookupMode = false,
  highlightId = null,
  onOpenCustomerAccount,
}: InventorySectionProps & { waitlistEntries?: Array<{ desiredTier: string; status: string }> }) {
  const grouped = useMemo(() => {
    const groupedRooms = groupRooms(rooms, waitlistEntries, nowMs);
    return sortGroupedRooms(groupedRooms);
  }, [rooms, waitlistEntries, nowMs]);

  const upgradeRequests = grouped.filter((g) => g.group === 'upgradeRequest');
  const available = grouped.filter((g) => g.group === 'available');
  const occupied = grouped.filter((g) => g.group === 'occupied');
  const cleaning = grouped.filter((g) => g.group === 'cleaning');
  const dirty = grouped.filter((g) => g.group === 'dirty');
  const availableForDisplay = [...upgradeRequests, ...available];
  const allowAvailableSelection = !disableSelection && !occupancyLookupMode;

  const sectionCounts = useMemo(() => {
    const availableCount = rooms.filter(
      (r) => r.status === RoomStatus.CLEAN && !r.assignedTo
    ).length;
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
    <div>
      <div className="er-inv-section-header">
        <div className="er-inv-section-title">{title}</div>
        <div className="er-inv-section-meta er-inv-meta">
          Available: {sectionCounts.availableCount}
          {sectionCounts.nearing > 0 ? ` • Nearing: ${sectionCounts.nearing}` : ''}
          {sectionCounts.late > 0 ? ` • Late: ${sectionCounts.late}` : ''}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {/* Occupied */}
        <div style={{ minWidth: 0 }}>
          <div
            className="er-inv-column-title er-inv-column-title--occupied"
            style={{ ...INVENTORY_COLUMN_HEADER_STYLE }}
          >
            🔒 Occupied
          </div>
          {occupied.length > 0 ? (
            occupied.map(({ room }) => (
              <RoomItem
                key={room.id}
                room={room}
                isSelectable={true}
                isSelected={false}
                isHighlighted={highlightId === room.id}
                onClick={() => onSelectRoom(room)}
                nowMs={nowMs}
                onOpenCustomerAccount={onOpenCustomerAccount}
              />
            ))
          ) : (
            <div style={{ padding: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>None</div>
          )}
        </div>

        {/* Dirty / Cleaning */}
        <div style={{ minWidth: 0 }}>
          <div className="er-inv-column-title" style={{ ...INVENTORY_COLUMN_HEADER_STYLE }}>
            🧹 Dirty / Cleaning
          </div>
          {cleaning.map(({ room }) => (
            <RoomItem
              key={room.id}
              room={room}
              isSelectable={false}
              isSelected={false}
              isHighlighted={highlightId === room.id}
              nowMs={nowMs}
            />
          ))}
          {dirty.map(({ room }) => (
            <RoomItem
              key={room.id}
              room={room}
              isSelectable={false}
              isSelected={false}
              isHighlighted={highlightId === room.id}
              nowMs={nowMs}
            />
          ))}
          {cleaning.length === 0 && dirty.length === 0 && (
            <div style={{ padding: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>None</div>
          )}
        </div>

        {/* Available */}
        <div style={{ minWidth: 0 }}>
          <div className="er-inv-column-title er-inv-column-title--available">✓ Available</div>
          {availableForDisplay.length > 0 ? (
            availableForDisplay.map(({ room, isWaitlistMatch }) => (
              <RoomItem
                key={room.id}
                room={room}
                isSelectable={allowAvailableSelection}
                isSelected={selectedItem?.type === 'room' && selectedItem.id === room.id}
                isHighlighted={highlightId === room.id}
                onClick={() => {
                  if (!allowAvailableSelection) return;
                  onSelectRoom(room);
                }}
                isWaitlistMatch={isWaitlistMatch}
                nowMs={nowMs}
                onOpenCustomerAccount={onOpenCustomerAccount}
              />
            ))
          ) : (
            <div style={{ padding: '0.75rem', color: '#94a3b8', textAlign: 'center' }}>None</div>
          )}
        </div>
      </div>
    </div>
  );
}
