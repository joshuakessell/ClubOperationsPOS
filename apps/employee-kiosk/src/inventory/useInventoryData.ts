import { useEffect, useMemo, useState } from 'react';
import { RoomStatus, getApiUrl } from '@club-ops/shared';
import { useLaneSession } from '@club-ops/shared/realtime/useLaneSession';
import { safeJsonParse } from '@club-ops/ui';

import type { DetailedInventory, DetailedLocker, DetailedRoom } from './types';
import { alertLevelFromMsUntil, getMsUntil, isRecord, readJson } from './utils';
import { getRoomTier } from '../utils/getRoomTier';

type Params = {
  lane: string;
  sessionToken: string;
  filterQuery?: string;
  localFilterQuery: string;
  externalRefreshNonce?: number;
};

export function useInventoryData({
  lane,
  sessionToken,
  filterQuery,
  localFilterQuery,
  externalRefreshNonce,
}: Params) {
  const [inventory, setInventory] = useState<DetailedInventory | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const API_BASE = getApiUrl('/api');

  // Live countdown tick (UI-only; does not refetch)
  useEffect(() => {
    const id = window.setInterval(() => setNowMs(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const rawEnv = import.meta.env as unknown as Record<string, unknown>;
  const kioskToken =
    typeof rawEnv.VITE_KIOSK_TOKEN === 'string' && rawEnv.VITE_KIOSK_TOKEN.trim()
      ? rawEnv.VITE_KIOSK_TOKEN.trim()
      : null;

  const { lastMessage } = useLaneSession({
    laneId: lane,
    role: 'employee',
    kioskToken: kioskToken ?? '',
    enabled: true,
  });

  useEffect(() => {
    if (!lastMessage) return;
    const parsed = safeJsonParse<unknown>(String(lastMessage.data));
    if (!isRecord(parsed) || typeof parsed.type !== 'string') return;
    const t = parsed.type;
    if (
      t === 'ROOM_STATUS_CHANGED' ||
      t === 'INVENTORY_UPDATED' ||
      t === 'ROOM_ASSIGNED' ||
      t === 'ROOM_RELEASED'
    ) {
      setRefreshTrigger((prev) => prev + 1);
    }
  }, [lastMessage]);

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
  }, [API_BASE, sessionToken, refreshTrigger, externalRefreshNonce]);

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
    const rooms = inventory?.rooms;
    if (!rooms) {
      return { SPECIAL: [], DOUBLE: [], STANDARD: [] };
    }
    const grouped: Record<'SPECIAL' | 'DOUBLE' | 'STANDARD', DetailedRoom[]> = {
      SPECIAL: [],
      DOUBLE: [],
      STANDARD: [],
    };

    for (const room of rooms) {
      if (room.tier === 'SPECIAL' || room.tier === 'DOUBLE' || room.tier === 'STANDARD') {
        if (matchesQuery(room.number, room.assignedMemberName)) {
          grouped[room.tier].push(room);
        }
      }
    }

    return grouped;
  }, [inventory?.rooms, matchesQuery]);

  const filteredLockers = useMemo(() => {
    const lockers = inventory?.lockers;
    if (!lockers) return [];
    return lockers.filter((l) => matchesQuery(l.number, l.assignedMemberName));
  }, [inventory?.lockers, matchesQuery]);

  const navCounts = useMemo(() => {
    const base = {
      LOCKER: { available: 0, nearing: 0, late: 0 },
      STANDARD: { available: 0, nearing: 0, late: 0 },
      DOUBLE: { available: 0, nearing: 0, late: 0 },
      SPECIAL: { available: 0, nearing: 0, late: 0 },
    };

    if (!inventory) return base;

    for (const r of inventory.rooms) {
      if (r.tier !== 'STANDARD' && r.tier !== 'DOUBLE' && r.tier !== 'SPECIAL') continue;
      if (r.status === RoomStatus.CLEAN && !r.assignedTo) {
        base[r.tier].available += 1;
        continue;
      }
      const isOccupied = !!r.assignedTo || r.status === RoomStatus.OCCUPIED;
      if (!isOccupied) continue;
      const lvl = alertLevelFromMsUntil(getMsUntil(r.checkoutAt, nowMs));
      if (lvl === 'danger') base[r.tier].late += 1;
      else if (lvl === 'warning') base[r.tier].nearing += 1;
    }

    for (const l of inventory.lockers) {
      if (l.status === RoomStatus.CLEAN && !l.assignedTo) {
        base.LOCKER.available += 1;
        continue;
      }
      const isOccupied = !!l.assignedTo || l.status === RoomStatus.OCCUPIED;
      if (!isOccupied) continue;
      const lvl = alertLevelFromMsUntil(getMsUntil(l.checkoutAt, nowMs));
      if (lvl === 'danger') base.LOCKER.late += 1;
      else if (lvl === 'warning') base.LOCKER.nearing += 1;
    }

    return base;
  }, [inventory, nowMs]);

  return {
    inventory,
    loading,
    error,
    nowMs,
    navCounts,
    roomsByTier,
    filteredLockers,
    effectiveFilterQuery,
    query,
  };
}
