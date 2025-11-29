import { FastifyInstance } from 'fastify';
import { 
  addDockerBuildTask, 
  addDockerRunTask,
  addK8sDeployTask,
  addComposeUpTask,
  getJobStatus,
  getQueueStats
} from '../services/queue';

export async function queueRoutes(fastify: FastifyInstance) {
  // Get job status
  fastify.get('/api/queue/jobs/:queueName/:jobId', async (request, reply) => {
    try {
      const { queueName, jobId } = request.params as { queueName: string; jobId: string };
      const status = await getJobStatus(queueName, jobId);
      
      if (!status) {
        return reply.code(404).send({ error: 'Job not found' });
      }
      
      return { job: status };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get queue statistics
  fastify.get('/api/queue/stats/:queueName', async (request, reply) => {
    try {
      const { queueName } = request.params as { queueName: string };
      const stats = await getQueueStats(queueName);
      return { stats };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get all queue statistics
  fastify.get('/api/queue/stats', async (request, reply) => {
    try {
      const queueNames = ['docker-build', 'docker-run', 'k8s-deploy', 'compose-up'];
      const stats = await Promise.all(
        queueNames.map(async (name) => ({
          queue: name,
          ...(await getQueueStats(name)),
        }))
      );
      return { stats };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });
}
