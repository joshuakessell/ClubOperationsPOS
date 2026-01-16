import type { RoomStatus } from '@club-ops/shared';

export type SelectedInventoryItem = {
  type: 'room' | 'locker';
  id: string;
  number: string;
  tier: string;
};

export interface DetailedRoom {
  id: string;
  number: string;
  tier: string; // STANDARD, DOUBLE, SPECIAL
  status: RoomStatus;
  floor: number;
  lastStatusChange: string;
  assignedTo?: string;
  assignedMemberName?: string;
  overrideFlag: boolean;
  checkinAt?: string;
  checkoutAt?: string;
  occupancyId?: string;
}

export interface DetailedLocker {
  id: string;
  number: string;
  status: RoomStatus;
  assignedTo?: string;
  assignedMemberName?: string;
  checkinAt?: string;
  checkoutAt?: string;
  occupancyId?: string;
}

export interface DetailedInventory {
  rooms: DetailedRoom[];
  lockers: DetailedLocker[];
}

export type RoomGroup = 'upgradeRequest' | 'available' | 'occupied' | 'cleaning' | 'dirty';

export interface GroupedRoom {
  room: DetailedRoom;
  group: RoomGroup;
  msUntilCheckout?: number | null;
  isWaitlistMatch?: boolean;
}

export type AlertLevel = 'danger' | 'warning' | null;

