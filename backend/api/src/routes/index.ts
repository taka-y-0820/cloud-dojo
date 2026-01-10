import { FastifyInstance } from 'fastify';
import { authRoutes } from './auth';
import { userRoutes } from './user';
import { dockerRoutes } from './docker';
import { composeRoutes } from './compose';
import { kubernetesRoutes } from './kubernetes';
import { cicdRoutes } from './cicd';
import { aiRoutes } from './ai';
import { queueRoutes } from './queue';
import { learningRoutes } from './learning';
import { networkRoutes } from './network';

export function registerRoutes(fastify: FastifyInstance) {
  fastify.register(authRoutes, { prefix: '/api/auth' });
  fastify.register(userRoutes, { prefix: '/api/users' });
  fastify.register(dockerRoutes, { prefix: '/api/docker' });
  fastify.register(composeRoutes);
  fastify.register(kubernetesRoutes); // Real kubectl integration with mock mode
  fastify.register(cicdRoutes, { prefix: '/api/cicd' });
  fastify.register(aiRoutes, { prefix: '/api/ai' });
  fastify.register(queueRoutes);
  fastify.register(learningRoutes, { prefix: '/api/learning' });
  fastify.register(networkRoutes, { prefix: '/api/network' });
}
