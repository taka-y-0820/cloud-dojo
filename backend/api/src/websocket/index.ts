import { FastifyInstance } from 'fastify';
import type { SocketStream } from '@fastify/websocket';

export function setupWebSocket(fastify: FastifyInstance) {
  // Store WebSocket clients for broadcasting
  const clients = new Set<any>();
  
  // Only decorate if not already decorated
  if (!fastify.hasDecorator('websocketServer')) {
    fastify.decorate('websocketServer', { clients });
  }
  
  fastify.get('/ws', { websocket: true }, (connection: SocketStream, req) => {
    clients.add(connection.socket);
    
    fastify.log.info('WebSocket client connected');

    connection.socket.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        fastify.log.info({ data }, 'Received WebSocket message');
      } catch (error) {
        fastify.log.error({ error }, 'Failed to parse WebSocket message');
      }
    });

    connection.socket.on('close', () => {
      clients.delete(connection.socket);
      fastify.log.info('WebSocket client disconnected');
    });

    connection.socket.on('error', (error: Error) => {
      fastify.log.error({ error }, 'WebSocket error');
    });

    // Send welcome message
    connection.socket.send(
      JSON.stringify({
        type: 'welcome',
        message: 'Connected to Cloud Dojo API',
        timestamp: new Date().toISOString(),
      })
    );
  });
}
