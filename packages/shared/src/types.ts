import { RoomStatus, RoomType } from './enums';

/**
 * Represents a room in the club.
 */
export interface Room {
  id: string;
  number: string;
  type: RoomType;
  status: RoomStatus;
  floor: number;
  lastStatusChange: Date;
  assignedTo?: string;
  overrideFlag: boolean;
}

/**
 * Represents a locker in the club.
 */
export interface Locker {
  id: string;
  number: string;
  status: RoomStatus;
  assignedTo?: string;
}

/**
 * Summary of room inventory by status.
 */
export interface InventorySummary {
  clean: number;
  cleaning: number;
  dirty: number;
  total: number;
}

/**
 * Detailed inventory breakdown by room type.
 */
export interface DetailedInventory {
  byType: Record<RoomType, InventorySummary>;
  overall: InventorySummary;
  lockers: InventorySummary;
}

/**
 * WebSocket event types for real-time updates.
 */
export type WebSocketEventType =
  | 'ROOM_STATUS_CHANGED'
  | 'INVENTORY_UPDATED'
  | 'ROOM_ASSIGNED'
  | 'ROOM_RELEASED';

/**
 * Base WebSocket event structure.
 */
export interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
}

/**
 * Room status change event payload.
 */
export interface RoomStatusChangedPayload {
  roomId: string;
  previousStatus: RoomStatus;
  newStatus: RoomStatus;
  changedBy: string;
  override: boolean;
  reason?: string;
}

/**
 * Inventory update event payload.
 */
export interface InventoryUpdatedPayload {
  inventory: DetailedInventory;
}

