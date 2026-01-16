import { RoomStatus } from '@club-ops/shared';
import type { DetailedRoom, GroupedRoom, RoomGroup, AlertLevel } from './types';
import { alertLevelFromMsUntil, getMsUntil } from './time';

export function groupRooms(
  rooms: DetailedRoom[],
  waitlistEntries: Array<{ desiredTier: string; status: string }> = [],
  nowMs: number
): GroupedRoom[] {
  const waitlistTiers = new Set(
    waitlistEntries
      .filter((e) => e.status === 'ACTIVE' || e.status === 'OFFERED')
      .map((e) => e.desiredTier)
  );

  return rooms.map((room) => {
    const isWaitlistMatch =
      waitlistTiers.has(room.tier) && room.status === RoomStatus.CLEAN && !room.assignedTo;

    if (isWaitlistMatch) {
      return { room, group: 'upgradeRequest' as RoomGroup, isWaitlistMatch: true };
    }

    if (room.status === RoomStatus.CLEAN && !room.assignedTo) {
      return { room, group: 'available' as RoomGroup };
    }

    if (room.assignedTo || room.status === RoomStatus.OCCUPIED) {
      return {
        room,
        group: 'occupied' as RoomGroup,
        msUntilCheckout: getMsUntil(room.checkoutAt, nowMs),
      };
    }

    if (room.status === RoomStatus.CLEANING) {
      return { room, group: 'cleaning' as RoomGroup };
    }

    if (room.status === RoomStatus.DIRTY) {
      return { room, group: 'dirty' as RoomGroup };
    }

    return { room, group: 'available' as RoomGroup };
  });
}

export function sortGroupedRooms(grouped: GroupedRoom[]): GroupedRoom[] {
  return grouped.sort((a, b) => {
    const groupOrder: Record<RoomGroup, number> = {
      upgradeRequest: 0,
      available: 1,
      occupied: 2,
      cleaning: 3,
      dirty: 4,
    };

    if (groupOrder[a.group] !== groupOrder[b.group]) {
      return groupOrder[a.group] - groupOrder[b.group];
    }

    if (a.group === 'available' || a.group === 'upgradeRequest') {
      return parseInt(a.room.number) - parseInt(b.room.number);
    }

    if (a.group === 'cleaning' || a.group === 'dirty') {
      return parseInt(a.room.number) - parseInt(b.room.number);
    }

    if (a.group === 'occupied') {
      const aMs = a.msUntilCheckout ?? null;
      const bMs = b.msUntilCheckout ?? null;
      const aLevel = alertLevelFromMsUntil(aMs);
      const bLevel = alertLevelFromMsUntil(bMs);

      const rank = (lvl: AlertLevel) => (lvl === 'danger' ? 0 : lvl === 'warning' ? 1 : 2);
      if (rank(aLevel) !== rank(bLevel)) return rank(aLevel) - rank(bLevel);

      if (aLevel === 'danger' && bLevel === 'danger') return (aMs ?? 0) - (bMs ?? 0);
      if (aLevel === 'warning' && bLevel === 'warning') return (aMs ?? 0) - (bMs ?? 0);

      const aTime = a.room.checkoutAt ? new Date(a.room.checkoutAt).getTime() : Number.POSITIVE_INFINITY;
      const bTime = b.room.checkoutAt ? new Date(b.room.checkoutAt).getTime() : Number.POSITIVE_INFINITY;
      return aTime - bTime;
    }

    return 0;
  });
}

