import type { WebSocket } from 'ws';
import type { 
  WebSocketEventType, 
  WebSocketEvent,
  RoomStatusChangedPayload,
  InventoryUpdatedPayload,
  SessionUpdatedPayload,
} from '@club-ops/shared';

/**
 * Room assignment event payload.
 */
export interface RoomAssignedPayload {
  roomId: string;
  sessionId: string;
  memberId: string;
}

/**
 * Room released event payload.
 */
export interface RoomReleasedPayload {
  roomId: string;
  sessionId: string;
}

/**
 * Union type for all WebSocket payloads.
 */
export type WebSocketPayload =
  | RoomStatusChangedPayload
  | InventoryUpdatedPayload
  | RoomAssignedPayload
  | RoomReleasedPayload
  | SessionUpdatedPayload;

/**
 * WebSocket broadcaster for sending real-time updates to connected clients.
 * Follows AGENTS.md requirement: "Realtime is push-based"
 */
export interface Broadcaster {
  addClient(id: string, socket: WebSocket): void;
  removeClient(id: string): void;
  broadcast<T>(event: WebSocketEvent<T>): void;
  broadcastRoomStatusChanged(payload: RoomStatusChangedPayload): void;
  broadcastInventoryUpdated(payload: InventoryUpdatedPayload): void;
  broadcastRoomAssigned(payload: RoomAssignedPayload): void;
  broadcastRoomReleased(payload: RoomReleasedPayload): void;
  broadcastSessionUpdated(payload: SessionUpdatedPayload): void;
  getClientCount(): number;
}

export function createBroadcaster(): Broadcaster {
  const clients = new Map<string, WebSocket>();

  function broadcast<T>(event: WebSocketEvent<T>): void {
    const message = JSON.stringify(event);
    const failedClients: string[] = [];

    for (const [id, socket] of clients) {
      try {
        if (socket.readyState === socket.OPEN) {
          socket.send(message);
        } else {
          failedClients.push(id);
        }
      } catch {
        failedClients.push(id);
      }
    }

    // Clean up failed clients
    for (const id of failedClients) {
      clients.delete(id);
    }
  }

  function createEvent<T>(type: WebSocketEventType, payload: T): WebSocketEvent<T> {
    return {
      type,
      payload,
      timestamp: new Date().toISOString(),
    };
  }

  return {
    addClient(id: string, socket: WebSocket) {
      clients.set(id, socket);
    },

    removeClient(id: string) {
      clients.delete(id);
    },

    broadcast,

    /**
     * Broadcast a room status change event.
     * Called when a room's cleaning status changes (DIRTY, CLEANING, CLEAN).
     */
    broadcastRoomStatusChanged(payload: RoomStatusChangedPayload) {
      broadcast(createEvent('ROOM_STATUS_CHANGED', payload));
    },

    /**
     * Broadcast an inventory update event.
     * Called when the overall inventory counts change.
     */
    broadcastInventoryUpdated(payload: InventoryUpdatedPayload) {
      broadcast(createEvent('INVENTORY_UPDATED', payload));
    },

    /**
     * Broadcast a room assignment event.
     * Called when a room is assigned to a member session.
     */
    broadcastRoomAssigned(payload: RoomAssignedPayload) {
      broadcast(createEvent('ROOM_ASSIGNED', payload));
    },

    /**
     * Broadcast a room released event.
     * Called when a room is released from a session.
     */
    broadcastRoomReleased(payload: RoomReleasedPayload) {
      broadcast(createEvent('ROOM_RELEASED', payload));
    },

    broadcastSessionUpdated(payload: SessionUpdatedPayload) {
      broadcast(createEvent('SESSION_UPDATED', payload));
    },

    getClientCount() {
      return clients.size;
    },
  };
}
