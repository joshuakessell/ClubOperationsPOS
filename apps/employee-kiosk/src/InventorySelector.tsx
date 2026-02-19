import { useCallback, useEffect, useMemo, useState } from 'react';
import { RoomStatus } from '@club-ops/shared';

import { InventoryListPane } from './inventory/InventoryListPane';
import { InventoryNav } from './inventory/InventoryNav';
import { OccupancyDetailsModal } from './inventory/OccupancyDetailsModal';
import type { DetailedLocker, DetailedRoom } from './inventory/types';
import {
  alertLevelFromMsUntil,
  getMsUntil,
  groupRooms,
  isUuid,
  sortGroupedRooms,
} from './inventory/utils';
import { useInventoryData } from './inventory/useInventoryData';
import { PanelHeader } from './views/PanelHeader';

interface InventorySelectorProps {
  customerSelectedType: string | null; // LOCKER, STANDARD, DOUBLE, SPECIAL
  waitlistDesiredTier?: string | null;
  waitlistBackupType?: string | null;
  onSelect: (type: 'room' | 'locker', id: string, number: string, tier: string) => void;
  selectedItem: { type: 'room' | 'locker'; id: string; number: string; tier: string } | null;
  onClearSelection?: () => void;
  sessionId: string | null;
  lane: string;
  sessionToken: string;
  filterQuery?: string;
  forcedExpandedSection?: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null;
  onExpandedSectionChange?: (next: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null) => void;
  disableSelection?: boolean;
  onAlertSummaryChange?: (summary: { hasLate: boolean; hasNearing: boolean }) => void;
  /**
   * When provided, inventory can request an inline checkout flow (rendered on the main home tab panel),
   * rather than opening a modal within the drawer.
   */
  onRequestCheckout?: (prefill: { occupancyId?: string; number: string }) => void;
  onOpenCustomerAccount?: (customerId: string, customerLabel?: string) => void;
  /** External refresh nonce to force inventory refetch (e.g. after an inline checkout completes). */
  externalRefreshNonce?: number;
}

export function InventorySelector({
  customerSelectedType,
  waitlistDesiredTier: _waitlistDesiredTier,
  waitlistBackupType,
  onSelect,
  selectedItem,
  onClearSelection,
  sessionId: _sessionId,
  lane,
  sessionToken,
  filterQuery,
  forcedExpandedSection,
  onExpandedSectionChange,
  disableSelection = false,
  onAlertSummaryChange,
  onRequestCheckout,
  onOpenCustomerAccount,
  externalRefreshNonce,
}: InventorySelectorProps) {
  // When there's no active lane session, treat inventory as a lookup tool (occupied-only details),
  // not an assignment picker.
  const occupancyLookupMode = !_sessionId;

  const [uncontrolledExpandedSection, setUncontrolledExpandedSection] = useState<
    'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null
  >(null);
  const [localFilterQuery, setLocalFilterQuery] = useState('');
  const [occupancyDetails, setOccupancyDetails] = useState<{
    type: 'room' | 'locker';
    number: string;
    occupancyId?: string;
    customerId?: string;
    customerName?: string;
    checkinAt?: string;
    checkoutAt?: string;
  } | null>(null);
  const [searchHighlight, setSearchHighlight] = useState<null | {
    type: 'room' | 'locker';
    id: string;
  }>(null);
  const waitlistEntries: Array<{ desiredTier: string; status: string }> = useMemo(() => [], []);

  const {
    inventory,
    loading,
    error,
    nowMs,
    navCounts,
    roomsByTier,
    filteredLockers,
    effectiveFilterQuery,
    query,
  } = useInventoryData({
    lane,
    sessionToken,
    filterQuery,
    localFilterQuery,
    externalRefreshNonce,
  });

  // Determine which section to auto-expand
  useEffect(() => {
    if (!customerSelectedType) return;

    const sectionToExpand = waitlistBackupType || customerSelectedType;
    if (
      sectionToExpand === 'LOCKER' ||
      sectionToExpand === 'STANDARD' ||
      sectionToExpand === 'DOUBLE' ||
      sectionToExpand === 'SPECIAL'
    ) {
      if (forcedExpandedSection !== undefined) {
        onExpandedSectionChange?.(sectionToExpand);
      } else {
        setUncontrolledExpandedSection(sectionToExpand);
        onExpandedSectionChange?.(sectionToExpand);
      }
    }
  }, [customerSelectedType, waitlistBackupType, forcedExpandedSection, onExpandedSectionChange]);

  // Auto-select first available when customer selects type
  useEffect(() => {
    if (occupancyLookupMode) return;
    if (!inventory || !customerSelectedType || selectedItem) return;

    const sectionToUse = waitlistBackupType || customerSelectedType;
    let firstAvailable: {
      type: 'room' | 'locker';
      id: string;
      number: string;
      tier: string;
    } | null = null;

    if (sectionToUse === 'LOCKER') {
      const availableLockers = inventory.lockers
        .filter((l) => l.status === RoomStatus.CLEAN && !l.assignedTo)
        .sort((a, b) => parseInt(a.number) - parseInt(b.number));

      const first = availableLockers[0];
      if (first) {
        firstAvailable = {
          type: 'locker',
          id: first.id,
          number: first.number,
          tier: 'LOCKER',
        };
      }
    } else {
      const roomsOfType = inventory.rooms.filter((r) => r.tier === sectionToUse);
      const grouped = groupRooms(roomsOfType, waitlistEntries, nowMs);
      const sorted = sortGroupedRooms(grouped);
      const firstAvailableRoom = sorted.find(
        (g) => g.group === 'available' || g.group === 'upgradeRequest'
      );

      if (firstAvailableRoom) {
        firstAvailable = {
          type: 'room',
          id: firstAvailableRoom.room.id,
          number: firstAvailableRoom.room.number,
          tier: firstAvailableRoom.room.tier,
        };
      }
    }

    if (firstAvailable) {
      onSelect(firstAvailable.type, firstAvailable.id, firstAvailable.number, firstAvailable.tier);
    }
  }, [
    inventory,
    customerSelectedType,
    waitlistBackupType,
    selectedItem,
    onSelect,
    waitlistEntries,
    nowMs,
    occupancyLookupMode,
  ]);

  const expandedSection =
    forcedExpandedSection !== undefined ? forcedExpandedSection : uncontrolledExpandedSection;

  const setExpandedSection = useCallback(
    (next: typeof expandedSection) => {
      onExpandedSectionChange?.(next);
      if (forcedExpandedSection === undefined) {
        setUncontrolledExpandedSection(next);
      }
    },
    [forcedExpandedSection, onExpandedSectionChange]
  );

  const setActiveSection = useCallback(
    (section: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL') => {
      setExpandedSection(section);
    },
    [setExpandedSection]
  );

  const activeSection: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' = expandedSection ?? 'LOCKER';

  const openOccupancyDetails = (payload: {
    type: 'room' | 'locker';
    number: string;
    occupancyId?: string;
    customerId?: string;
    customerName?: string;
    checkinAt?: string;
    checkoutAt?: string;
  }) => {
    setOccupancyDetails(payload);
  };

  const handleRoomClick = (room: DetailedRoom) => {
    const isOccupied = !!room.assignedTo || room.status === RoomStatus.OCCUPIED;
    if (isOccupied) {
      openOccupancyDetails({
        type: 'room',
        number: room.number,
        occupancyId: room.occupancyId,
        customerId: isUuid(room.assignedTo) ? room.assignedTo : undefined,
        customerName: room.assignedMemberName || room.assignedTo,
        checkinAt: room.checkinAt,
        checkoutAt: room.checkoutAt,
      });
      return;
    }
    if (occupancyLookupMode) return;
    if (disableSelection) return;
    onSelect('room', room.id, room.number, room.tier);
  };

  const handleLockerClick = (locker: DetailedLocker) => {
    const isOccupied = !!locker.assignedTo || locker.status === RoomStatus.OCCUPIED;
    if (isOccupied) {
      openOccupancyDetails({
        type: 'locker',
        number: locker.number,
        occupancyId: locker.occupancyId,
        customerId: isUuid(locker.assignedTo) ? locker.assignedTo : undefined,
        customerName: locker.assignedMemberName || locker.assignedTo,
        checkinAt: locker.checkinAt,
        checkoutAt: locker.checkoutAt,
      });
      return;
    }
    if (occupancyLookupMode) return;
    if (disableSelection) return;
    onSelect('locker', locker.id, locker.number, 'LOCKER');
  };

  // Overall alert summary for drawer handle tinting.
  // NOTE: Must be defined before any early returns to preserve hook order.
  useEffect(() => {
    if (!inventory || !onAlertSummaryChange) return;

    let hasLate = false;
    let hasNearing = false;

    for (const r of inventory.rooms) {
      const isOccupied = !!r.assignedTo || r.status === RoomStatus.OCCUPIED;
      if (!isOccupied) continue;
      const lvl = alertLevelFromMsUntil(getMsUntil(r.checkoutAt, nowMs));
      if (lvl === 'danger') hasLate = true;
      if (lvl === 'warning') hasNearing = true;
      if (hasLate && hasNearing) break;
    }
    if (!hasLate) {
      for (const l of inventory.lockers) {
        const isOccupied = !!l.assignedTo || l.status === RoomStatus.OCCUPIED;
        if (!isOccupied) continue;
        const lvl = alertLevelFromMsUntil(getMsUntil(l.checkoutAt, nowMs));
        if (lvl === 'danger') hasLate = true;
        if (lvl === 'warning') hasNearing = true;
        if (hasLate && hasNearing) break;
      }
    }

    onAlertSummaryChange({ hasLate, hasNearing });
  }, [inventory, nowMs, onAlertSummaryChange]);

  useEffect(() => {
    if (!query) {
      setSearchHighlight(null);
      return;
    }

    // Prefer first match across sections: LOCKER → STANDARD → DOUBLE → SPECIAL
    const locker = filteredLockers[0];
    if (locker) {
      setExpandedSection('LOCKER');
      setSearchHighlight({ type: 'locker', id: locker.id });
      return;
    }

    const standard = roomsByTier.STANDARD[0];
    if (standard) {
      setExpandedSection('STANDARD');
      setSearchHighlight({ type: 'room', id: standard.id });
      return;
    }

    const dbl = roomsByTier.DOUBLE[0];
    if (dbl) {
      setExpandedSection('DOUBLE');
      setSearchHighlight({ type: 'room', id: dbl.id });
      return;
    }

    const special = roomsByTier.SPECIAL[0];
    if (special) {
      setExpandedSection('SPECIAL');
      setSearchHighlight({ type: 'room', id: special.id });
      return;
    }

    setSearchHighlight(null);
  }, [query, filteredLockers, roomsByTier, setExpandedSection]);

  if (loading) {
    return <div style={{ padding: '1rem', textAlign: 'center' }}>Loading inventory...</div>;
  }

  if (error) {
    return <div style={{ padding: '1rem', color: '#ef4444' }}>Error: {error}</div>;
  }

  if (!inventory) {
    return null;
  }

  return (
    <>
      <div
        style={{
          height: '100%',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <PanelHeader title="Rentals" />
        {/* Vertical tabs + content layout filling available space */}
        <div
          style={{
            display: 'flex',
            gap: '1.25rem',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div style={{ minHeight: 0, overflow: 'auto', minWidth: '170px', maxWidth: '220px' }}>
            <InventoryNav
              activeSection={activeSection}
              navCounts={navCounts}
              onSectionSelect={setActiveSection}
              effectiveFilterQuery={effectiveFilterQuery}
              onFilterQueryChange={setLocalFilterQuery}
              filterQueryLocked={filterQuery !== undefined}
            />
          </div>

          <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
            {!occupancyLookupMode && !disableSelection && selectedItem && onClearSelection && (
              <button
                className="mb-2 inline-flex w-full items-center justify-center rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 shadow-theme-xs transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-white/[0.03]"
                onClick={onClearSelection}
              >
                Clear selection ({selectedItem.type === 'room' ? 'Room' : 'Locker'}{' '}
                {selectedItem.number})
              </button>
            )}
            <InventoryListPane
              activeSection={activeSection}
              roomsByTier={roomsByTier}
              lockers={filteredLockers}
              onSelectRoom={handleRoomClick}
              onSelectLocker={handleLockerClick}
              selectedItem={selectedItem}
              waitlistEntries={waitlistEntries}
              nowMs={nowMs}
              disableSelection={disableSelection}
              occupancyLookupMode={occupancyLookupMode}
              searchHighlight={searchHighlight}
              onOpenCustomerAccount={onOpenCustomerAccount}
            />
          </div>
        </div>
      </div>

      <OccupancyDetailsModal
        occupancyDetails={occupancyDetails}
        onClose={() => setOccupancyDetails(null)}
        onRequestCheckout={onRequestCheckout}
        onOpenCustomerAccount={onOpenCustomerAccount}
      />
    </>
  );
}
