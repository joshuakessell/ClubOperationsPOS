import type { FastifyInstance } from 'fastify';
import { requireKioskTokenOrStaff } from '../auth/kioskToken';
import { optionalAuth } from '../auth/middleware';
import type { LocalLaneSockets } from '../realtime/localSockets';
import { transaction } from '../db';
import { getLaneFeatureFlags } from '../checkin/laneFeatureFlags';

function isLanFallbackEnabled(): boolean {
  return process.env.LAN_FALLBACK === 'true';
}

async function isLanFallbackEnabledForLane(laneId: string): Promise<boolean> {
  try {
    const flags = await transaction(async (client) => getLaneFeatureFlags(client, laneId));
    return flags.lanFallbackEnabled;
  } catch {
    return false;
  }
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

  if (!fastify.websocketServer) {
    throw new Error('LAN realtime websocket routes require @fastify/websocket to be registered');
  }

  fastify.get<{
    Params: { laneId: string };
  }>(
    '/v1/realtime/lan/lane/:laneId',
    {
      preHandler: [optionalAuth, requireKioskTokenOrStaff],
      websocket: true,
    },
    async (connection, request) => {
      const laneId = request.params.laneId;

      if (!(await isLanFallbackEnabledForLane(laneId))) {
        connection.socket.close();
        return;
      }

      const sockets = fastify.localLaneSockets;
      if (!sockets) {
        connection.socket.close();
        return;
      }

      sockets.add(laneId, connection.socket);
      connection.socket.on('error', (error) => {
        request.log.error({ error }, 'LAN realtime socket error');
      });

      connection.socket.send(
        JSON.stringify({
          type: 'LAN_SOCKET_READY',
          payload: { laneId },
          timestamp: new Date().toISOString(),
        })
      );
    }
  );
}
