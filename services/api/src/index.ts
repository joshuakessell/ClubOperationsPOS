import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { healthRoutes } from './routes/health.js';
import { createBroadcaster } from './websocket/broadcaster.js';
import type { WebSocket } from 'ws';

const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.HOST || '0.0.0.0';

async function main() {
  const fastify = Fastify({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
    },
  });

  // Register CORS
  await fastify.register(cors, {
    origin: true,
    credentials: true,
  });

  // Register WebSocket support
  await fastify.register(websocket);

  // Create broadcaster for WebSocket events
  const broadcaster = createBroadcaster();

  // Decorate fastify with broadcaster for access in routes
  fastify.decorate('broadcaster', broadcaster);

  // Register routes
  await fastify.register(healthRoutes);

  // WebSocket endpoint
  fastify.get('/ws', { websocket: true }, (connection, _req) => {
    const clientId = crypto.randomUUID();
    const socket = connection.socket as unknown as WebSocket;
    fastify.log.info({ clientId }, 'WebSocket client connected');

    broadcaster.addClient(clientId, socket);

    connection.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString()) as unknown;
        fastify.log.info({ clientId, data }, 'Received message from client');
      } catch {
        fastify.log.warn({ clientId }, 'Received invalid JSON from client');
      }
    });

    connection.on('close', () => {
      broadcaster.removeClient(clientId);
      fastify.log.info({ clientId }, 'WebSocket client disconnected');
    });

    connection.on('error', (err) => {
      fastify.log.error({ clientId, err }, 'WebSocket error');
      broadcaster.removeClient(clientId);
    });
  });

  try {
    await fastify.listen({ port: PORT, host: HOST });
    fastify.log.info(`Server listening on http://${HOST}:${PORT}`);
    fastify.log.info(`WebSocket available at ws://${HOST}:${PORT}/ws`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
}

main().catch(console.error);

