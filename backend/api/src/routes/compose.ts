import { FastifyInstance } from 'fastify';
import { composeService } from '../services/compose';
import { addComposeUpTask, addComposeDownTask } from '../services/queue';

export async function composeRoutes(fastify: FastifyInstance) {
  // Compose Up - Start multi-container application (via queue)
  fastify.post('/api/compose/up', async (request, reply) => {
    try {
      const { composeYaml, projectName } = request.body as { 
        composeYaml: string; 
        projectName?: string;
      };

      if (!composeYaml) {
        return reply.code(400).send({ error: 'composeYaml is required' });
      }

      // Add to queue instead of executing directly
      const jobId = await addComposeUpTask({
        composeYaml,
        projectName: projectName || 'cloud-dojo',
      });

      return { 
        jobId,
        queueName: 'compose-up',
        status: 'queued',
        message: 'Compose up job added to queue'
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Compose Down - Stop and remove containers (via queue)
  fastify.post('/api/compose/down', async (request, reply) => {
    try {
      const { projectName, removeVolumes } = request.body as { 
        projectName?: string;
        removeVolumes?: boolean;
      };

      // Add to queue instead of executing directly
      const jobId = await addComposeDownTask({
        projectName: projectName || 'cloud-dojo',
        removeVolumes: removeVolumes || false,
      });

      return { 
        jobId,
        queueName: 'compose-down',
        status: 'queued',
        message: 'Compose down job added to queue'
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Compose Down with Volumes (via queue)
  fastify.post('/api/compose/down-volumes', async (request, reply) => {
    try {
      const { projectName } = request.body as { projectName?: string };
      
      const jobId = await addComposeDownTask({
        projectName: projectName || 'cloud-dojo',
        removeVolumes: true,
      });

      return { 
        jobId,
        queueName: 'compose-down',
        status: 'queued',
        message: 'Compose down with volumes job added to queue'
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get Compose Status
  fastify.get('/api/compose/status', async (request, reply) => {
    try {
      const { projectName } = request.query as { projectName?: string };
      const status = await composeService.getComposeStatus(projectName);
      return { status };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get Session Info
  fastify.get('/api/compose/session/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const session = composeService.getSession(id);
      
      if (!session) {
        return reply.code(404).send({ error: 'Session not found' });
      }
      
      return { session };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });
}
