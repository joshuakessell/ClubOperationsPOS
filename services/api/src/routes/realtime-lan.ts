import type { FastifyInstance } from 'fastify';
import { requireKioskTokenOrStaff } from '../auth/kioskToken';
import { optionalAuth } from '../auth/middleware';
import type { LocalLaneSockets } from '../realtime/localSockets';

function isLanFallbackEnabled(): boolean {
  return process.env.LAN_FALLBACK === 'true';
}

declare module 'fastify' {
  interface FastifyInstance {
    localLaneSockets?: LocalLaneSockets;
  }
}

export async function realtimeLanRoutes(fastify: FastifyInstance): Promise<void> {
  if (!isLanFallbackEnabled()) {
    return;
  }

  fastify.get<{
    Params: { laneId: string };
  }>(
    '/v1/realtime/lan/lane/:laneId',
    {
      preHandler: [optionalAuth, requireKioskTokenOrStaff],
      websocket: true,
    },
    (connection, request) => {
      const laneId = request.params.laneId;
      const sockets = fastify.localLaneSockets;
      if (!sockets) {
        connection.socket.close();
        return;
      }

      sockets.add(laneId, connection.socket);
      connection.socket.send(
        JSON.stringify({ type: 'LAN_SOCKET_READY', payload: { laneId }, timestamp: new Date().toISOString() })
      );
    }
  );
}
