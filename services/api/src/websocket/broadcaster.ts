import type { WebSocket } from 'ws';

/**
 * WebSocket event types for real-time updates.
 */
type WebSocketEventType =
  | 'ROOM_STATUS_CHANGED'
  | 'INVENTORY_UPDATED'
  | 'ROOM_ASSIGNED'
  | 'ROOM_RELEASED';

/**
 * Base WebSocket event structure.
 */
interface WebSocketEvent<T = unknown> {
  type: WebSocketEventType;
  payload: T;
  timestamp: string;
}

/**
 * WebSocket broadcaster for sending real-time updates to connected clients.
 * Follows AGENTS.md requirement: "Realtime is push-based"
 */
export interface Broadcaster {
  addClient(id: string, socket: WebSocket): void;
  removeClient(id: string): void;
  broadcast<T>(event: WebSocketEvent<T>): void;
  getClientCount(): number;
}

export function createBroadcaster(): Broadcaster {
  const clients = new Map<string, WebSocket>();

  return {
    addClient(id: string, socket: WebSocket) {
      clients.set(id, socket);
    },

    removeClient(id: string) {
      clients.delete(id);
    },

    broadcast<T>(event: WebSocketEvent<T>) {
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
    },

    getClientCount() {
      return clients.size;
    },
  };
}

