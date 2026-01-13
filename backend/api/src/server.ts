import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import websocket from '@fastify/websocket';
import { config } from './config/env';
import { registerRoutes } from './routes/index';
import { setupWebSocket } from './websocket/index';
import { initializeWorkers } from './services/workers';

const fastify = Fastify({
  logger: {
    level: 'info',
    transport:
      config.nodeEnv === 'development'
        ? {
            target: 'pino-pretty',
            options: {
              colorize: true,
              translateTime: 'HH:MM:ss',
              ignore: 'pid,hostname',
            },
          }
        : undefined,
  },
});

// Register plugins
await fastify.register(cors, {
  origin: [
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
    'http://localhost:3003',
    'http://localhost:4173',
    'null',
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
});

await fastify.register(jwt, {
  secret: config.jwt.secret,
});

await fastify.register(websocket);

// Register routes
registerRoutes(fastify);

// Setup WebSocket
setupWebSocket(fastify);

// Health check
fastify.get('/health', async () => {
  return { status: 'ok', timestamp: new Date().toISOString() };
});

// Start server
const start = async () => {
  try {
    await fastify.listen({
      port: config.port,
      host: '0.0.0.0',
    });
    console.log(`🚀 API Server running on port ${config.port}`);

    // Initialize BullMQ workers after server starts
    await initializeWorkers(fastify);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

await start();

// Graceful shutdown
const signals = ['SIGINT', 'SIGTERM'];
signals.forEach((signal) => {
  process.on(signal, async () => {
    console.log(`\n${signal} received, closing server...`);
    await fastify.close();
    process.exit(0);
  });
});
