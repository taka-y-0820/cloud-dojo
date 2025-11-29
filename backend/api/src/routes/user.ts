import { FastifyInstance } from 'fastify';

export async function userRoutes(fastify: FastifyInstance) {
  fastify.get('/me', async (request, reply) => {
    // TODO: Get authenticated user
    return {
      id: '1',
      email: 'user@example.com',
      role: 'owner',
    };
  });
  
  fastify.get('/progress', async (request, reply) => {
    // TODO: Get user learning progress
    return {
      completedModules: [],
      currentModule: null,
      achievements: [],
    };
  });
}
