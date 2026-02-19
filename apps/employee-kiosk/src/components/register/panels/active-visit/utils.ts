import { getErrorMessage } from '@club-ops/shared';
import { getRoomTier } from '../../../../utils/getRoomTier';
import type { AvailableLocker, AvailableRoom } from './types';

export function roomSort(a: AvailableRoom, b: AvailableRoom): number {
  const tierOrder: Record<AvailableRoom['tier'], number> = {
    SPECIAL: 0,
    DOUBLE: 1,
    STANDARD: 2,
  };
  const byTier = tierOrder[a.tier] - tierOrder[b.tier];
  if (byTier !== 0) return byTier;
  return Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10);
}

export function lockerSort(a: AvailableLocker, b: AvailableLocker): number {
  return Number.parseInt(a.number, 10) - Number.parseInt(b.number, 10);
}

export function formatDisplayError(errorPayload: unknown, fallback: string): string {
  return getErrorMessage(errorPayload) || fallback;
}

export function mapAvailableRooms(
  input: Array<{ id: string; number: string; status: string; assignedTo?: string }>
): AvailableRoom[] {
  return input
    .filter((room) => room.status === 'CLEAN' && !room.assignedTo)
    .map((room) => ({ id: room.id, number: room.number, tier: getRoomTier(room.number) }))
    .sort(roomSort);
}

export function mapAvailableLockers(
  input: Array<{ id: string; number: string; status: string; assignedTo?: string }>
): AvailableLocker[] {
  return input
    .filter((locker) => locker.status === 'CLEAN' && !locker.assignedTo)
    .map((locker) => ({ id: locker.id, number: locker.number }))
    .sort(lockerSort);
}
