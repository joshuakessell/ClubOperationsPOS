import { useState, useEffect, useMemo } from 'react';
import { RoomStatus } from '@club-ops/shared';
import { safeJsonParse, useReconnectingWebSocket } from '@club-ops/ui';
import { getRoomTier } from './utils/getRoomTier';
import { ModalFrame } from './components/register/modals/ModalFrame';
import { ManualCheckoutModal } from './components/register/modals/ManualCheckoutModal';
import type { DetailedInventory, DetailedLocker, DetailedRoom, SelectedInventoryItem } from './components/inventory/selector/types';
import { InventorySection } from './components/inventory/selector/InventorySection';
import { LockerSection } from './components/inventory/selector/LockerSection';
import { alertLevelFromMsUntil, getMsUntil } from './components/inventory/selector/time';
import { Button } from './ui/Button';
import { Card } from './ui/Card';
import { Input } from './ui/Input';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

async function readJson<T>(response: Response): Promise<T> {
  const data: unknown = await response.json();
  return data as T;
}


interface InventorySelectorProps {
  customerSelectedType: string | null; // LOCKER, STANDARD, DOUBLE, SPECIAL
  waitlistDesiredTier?: string | null;
  waitlistBackupType?: string | null;
  onSelect: (type: 'room' | 'locker', id: string, number: string, tier: string) => void;
  selectedItem: SelectedInventoryItem | null;
  onClearSelection?: () => void;
  sessionId: string | null;
  lane: string;
  sessionToken: string;
  filterQuery?: string;
  forcedExpandedSection?: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null;
  onExpandedSectionChange?: (next: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null) => void;
  disableSelection?: boolean;
  onAlertSummaryChange?: (summary: { hasLate: boolean; hasNearing: boolean }) => void;
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
}: InventorySelectorProps) {
  // When there's no active lane session, treat inventory as a lookup tool (occupied-only details),
  // not an assignment picker.
  const occupancyLookupMode = !_sessionId;

  const [inventory, setInventory] = useState<DetailedInventory | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [uncontrolledExpandedSection, setUncontrolledExpandedSection] = useState<
    'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL' | null
  >(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [localFilterQuery, setLocalFilterQuery] = useState('');
  const [occupancyDetails, setOccupancyDetails] = useState<{
    type: 'room' | 'locker';
    number: string;
    occupancyId?: string;
    customerName?: string;
    checkinAt?: string;
    checkoutAt?: string;
  } | null>(null);
  const [quickCheckout, setQuickCheckout] = useState<null | { occupancyId?: string; number: string }>(null);
  const waitlistEntries: Array<{ desiredTier: string; status: string }> = useMemo(() => [], []);

  const API_BASE = '/api';

  // Live countdown tick (UI-only; does not refetch)
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${window.location.host}/ws?lane=${encodeURIComponent(lane)}`;

  useReconnectingWebSocket({
    url: wsUrl,
    onOpenSendJson: [
      {
        type: 'subscribe',
        events: ['ROOM_STATUS_CHANGED', 'INVENTORY_UPDATED', 'ROOM_ASSIGNED', 'ROOM_RELEASED'],
      },
    ],
    onMessage: (event) => {
      const parsed = safeJsonParse<unknown>(String(event.data));
      if (!isRecord(parsed) || typeof parsed.type !== 'string') return;
      const t = parsed.type;
      if (t === 'ROOM_STATUS_CHANGED' || t === 'INVENTORY_UPDATED' || t === 'ROOM_ASSIGNED' || t === 'ROOM_RELEASED') {
        setRefreshTrigger((prev) => prev + 1);
      }
    },
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

  // Fetch inventory
  useEffect(() => {
    let mounted = true;

    async function fetchInventory() {
      try {
        setLoading(true);
        // Use detailed inventory endpoint to get all statuses
        const response = await fetch(`${API_BASE}/v1/inventory/detailed`, {
          headers: {
            Authorization: `Bearer ${sessionToken}`,
          },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch inventory');
        }

        const data = await readJson<{ rooms?: unknown[]; lockers?: unknown[] }>(response);
        if (mounted) {
          // Transform detailed inventory response
          const rooms: DetailedRoom[] = (Array.isArray(data.rooms) ? data.rooms : [])
            .filter(isRecord)
            .filter(
              (room) =>
                typeof room.id === 'string' &&
                typeof room.number === 'string' &&
                typeof room.status === 'string'
            )
            .map((room) => ({
              id: room.id as string,
              number: room.number as string,
              tier: getRoomTier(room.number as string), // Compute tier from room number
              status: room.status as RoomStatus,
              floor: typeof room.floor === 'number' ? room.floor : 1,
              lastStatusChange:
                typeof room.lastStatusChange === 'string'
                  ? room.lastStatusChange
                  : new Date().toISOString(),
              assignedTo: typeof room.assignedTo === 'string' ? room.assignedTo : undefined,
              assignedMemberName:
                typeof room.assignedMemberName === 'string' ? room.assignedMemberName : undefined,
              overrideFlag: typeof room.overrideFlag === 'boolean' ? room.overrideFlag : false,
              checkinAt: typeof room.checkinAt === 'string' ? room.checkinAt : undefined,
              checkoutAt: typeof room.checkoutAt === 'string' ? room.checkoutAt : undefined,
              occupancyId: typeof room.occupancyId === 'string' ? room.occupancyId : undefined,
            }));

          const lockers: DetailedLocker[] = (Array.isArray(data.lockers) ? data.lockers : [])
            .filter(isRecord)
            .filter(
              (locker) =>
                typeof locker.id === 'string' &&
                typeof locker.number === 'string' &&
                typeof locker.status === 'string'
            )
            .map((locker) => ({
              id: locker.id as string,
              number: locker.number as string,
              status: locker.status as RoomStatus,
              assignedTo: typeof locker.assignedTo === 'string' ? locker.assignedTo : undefined,
              assignedMemberName:
                typeof locker.assignedMemberName === 'string'
                  ? locker.assignedMemberName
                  : undefined,
              checkinAt: typeof locker.checkinAt === 'string' ? locker.checkinAt : undefined,
              checkoutAt: typeof locker.checkoutAt === 'string' ? locker.checkoutAt : undefined,
              occupancyId: typeof locker.occupancyId === 'string' ? locker.occupancyId : undefined,
            }));

          setInventory({ rooms, lockers });
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load inventory');
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }

    void fetchInventory();

    return () => {
      mounted = false;
    };
  }, [sessionToken, refreshTrigger]);

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

  // Group rooms by tier (must be before conditional returns to follow React hooks rules)
  const effectiveFilterQuery = filterQuery !== undefined ? filterQuery : localFilterQuery;
  const query = effectiveFilterQuery.trim().toLowerCase();

  const matchesQuery = useMemo(() => {
    if (!query) return () => true;
    return (number: string, assignedMemberName?: string) => {
      const num = String(number ?? '').toLowerCase();
      const name = String(assignedMemberName ?? '').toLowerCase();
      return num.includes(query) || name.includes(query);
    };
  }, [query]);

  const roomsByTier = useMemo(() => {
    if (!inventory) {
      return { SPECIAL: [], DOUBLE: [], STANDARD: [] };
    }
    const grouped: Record<'SPECIAL' | 'DOUBLE' | 'STANDARD', DetailedRoom[]> = {
      SPECIAL: [],
      DOUBLE: [],
      STANDARD: [],
    };

    for (const room of inventory.rooms) {
      if (room.tier === 'SPECIAL' || room.tier === 'DOUBLE' || room.tier === 'STANDARD') {
        if (matchesQuery(room.number, room.assignedMemberName)) {
          grouped[room.tier].push(room);
        }
      }
    }

    return grouped;
  }, [inventory?.rooms, matchesQuery]);

  const filteredLockers = useMemo(() => {
    if (!inventory) return [];
    return inventory.lockers.filter((l) => matchesQuery(l.number, l.assignedMemberName));
  }, [inventory?.lockers, matchesQuery]);

  const expandedSection =
    forcedExpandedSection !== undefined ? forcedExpandedSection : uncontrolledExpandedSection;

  const setExpandedSection = (next: typeof expandedSection) => {
    onExpandedSectionChange?.(next);
    if (forcedExpandedSection === undefined) {
      setUncontrolledExpandedSection(next);
    }
  };

  const toggleSection = (section: 'LOCKER' | 'STANDARD' | 'DOUBLE' | 'SPECIAL') => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const openOccupancyDetails = (payload: {
    type: 'room' | 'locker';
    number: string;
    occupancyId?: string;
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

  if (loading) {
    return <div style={{ padding: '1rem', textAlign: 'center' }}>Loading inventory...</div>;
  }

  if (error) {
    return <div style={{ padding: '1rem', color: '#ef4444' }}>Error: {error}</div>;
  }

  if (!inventory) {
    return null;
  }

  const selectionLockedToType: 'room' | 'locker' | null = selectedItem?.type ?? null;

  return (
    <>
      <Card padding="md" className="flex h-full min-h-0 flex-col bg-slate-900/70 text-white ring-slate-700">
        <h2 style={{ margin: 0, marginBottom: '0.75rem', fontSize: '1.25rem', fontWeight: 800 }}>
          Inventory
        </h2>

        {!occupancyLookupMode && !disableSelection && selectedItem && onClearSelection && (
          <Button variant="secondary" onClick={onClearSelection} className="mb-3 w-full">
            Clear selection (currently {selectedItem.type === 'room' ? 'Room' : 'Locker'} {selectedItem.number})
          </Button>
        )}

        {/*
          The drawer panel itself should not scroll.
          Instead, whichever category is expanded gets a scrollable viewport.
        */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            flex: 1,
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          {/* Lockers */}
          <LockerSection
            lockers={filteredLockers}
            isExpanded={expandedSection === 'LOCKER'}
            onToggle={() => toggleSection('LOCKER')}
            onSelectLocker={handleLockerClick}
            selectedItem={selectedItem}
            nowMs={nowMs}
            disableSelection={disableSelection || selectionLockedToType === 'room'}
            occupancyLookupMode={occupancyLookupMode}
          />

          {/* Standard */}
          <InventorySection
            title="Standard"
            rooms={roomsByTier.STANDARD}
            isExpanded={expandedSection === 'STANDARD'}
            onToggle={() => toggleSection('STANDARD')}
            onSelectRoom={handleRoomClick}
            selectedItem={selectedItem}
            waitlistEntries={waitlistEntries}
            nowMs={nowMs}
            disableSelection={disableSelection || selectionLockedToType === 'locker'}
            occupancyLookupMode={occupancyLookupMode}
          />

          {/* Double */}
          <InventorySection
            title="Double"
            rooms={roomsByTier.DOUBLE}
            isExpanded={expandedSection === 'DOUBLE'}
            onToggle={() => toggleSection('DOUBLE')}
            onSelectRoom={handleRoomClick}
            selectedItem={selectedItem}
            waitlistEntries={waitlistEntries}
            nowMs={nowMs}
            disableSelection={disableSelection || selectionLockedToType === 'locker'}
            occupancyLookupMode={occupancyLookupMode}
          />

          {/* Special */}
          <InventorySection
            title="Special"
            rooms={roomsByTier.SPECIAL}
            isExpanded={expandedSection === 'SPECIAL'}
            onToggle={() => toggleSection('SPECIAL')}
            onSelectRoom={handleRoomClick}
            selectedItem={selectedItem}
            waitlistEntries={waitlistEntries}
            nowMs={nowMs}
            disableSelection={disableSelection || selectionLockedToType === 'locker'}
            occupancyLookupMode={occupancyLookupMode}
          />
        </div>

        {/* Search pinned at the bottom of the same card */}
        <div style={{ marginTop: '0.75rem', flexShrink: 0 }}>
          <div style={{ margin: 0, marginBottom: '0.35rem', fontSize: '1.25rem', fontWeight: 800 }}>
            Search
          </div>
          <div className="relative">
            <Input
              type="text"
              placeholder="Search by name or number..."
              value={effectiveFilterQuery}
              onChange={(e) => setLocalFilterQuery(e.target.value)}
              aria-label="Inventory search"
              disabled={filterQuery !== undefined}
              className="w-full pl-10"
            />
            <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-slate-400">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
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
        </div>
      </Card>

      <ModalFrame
        isOpen={!!occupancyDetails}
        title={
          occupancyDetails
            ? `${occupancyDetails.type === 'room' ? 'Room' : 'Locker'} ${occupancyDetails.number}`
            : 'Occupancy'
        }
        onClose={() => setOccupancyDetails(null)}
        maxWidth="420px"
        maxHeight="50vh"
      >
        {occupancyDetails && (
          <div style={{ display: 'grid', gap: '0.75rem' }}>
            <div
              style={{
                textAlign: 'center',
                fontSize: '1.5rem',
                fontWeight: 600,
              }}
            >
              {occupancyDetails.customerName || '—'}
            </div>

            <div className="er-surface" style={{ padding: '0.75rem', borderRadius: 12 }}>
              <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
                Check-in
              </div>
              <div style={{ fontWeight: 800 }}>
                {occupancyDetails.checkinAt ? new Date(occupancyDetails.checkinAt).toLocaleString() : '—'}
              </div>
            </div>

            <div className="er-surface" style={{ padding: '0.75rem', borderRadius: 12 }}>
              <div className="er-text-sm" style={{ color: '#94a3b8', marginBottom: '0.25rem' }}>
                Checkout
              </div>
              <div style={{ fontWeight: 800 }}>
                {occupancyDetails.checkoutAt ? new Date(occupancyDetails.checkoutAt).toLocaleString() : '—'}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <Button
                type="button"
                onClick={() => {
                  setQuickCheckout({ occupancyId: occupancyDetails.occupancyId, number: occupancyDetails.number });
                  setOccupancyDetails(null);
                }}
              >
                Checkout
              </Button>
            </div>
          </div>
        )}
      </ModalFrame>

      {quickCheckout && (
        <ManualCheckoutModal
          isOpen={true}
          sessionToken={sessionToken}
          entryMode="direct-confirm"
          prefill={
            quickCheckout.occupancyId
              ? { occupancyId: quickCheckout.occupancyId }
              : { number: quickCheckout.number }
          }
          onClose={() => setQuickCheckout(null)}
          onSuccess={() => {
            setQuickCheckout(null);
            setRefreshTrigger((prev) => prev + 1);
          }}
        />
      )}
    </>
  );
}
