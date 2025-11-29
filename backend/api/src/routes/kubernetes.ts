import { FastifyInstance } from 'fastify';
import { k8sService } from '../services/kubernetes';
import { addK8sDeployTask } from '../services/queue';

export async function kubernetesRoutes(fastify: FastifyInstance) {
  // Check if kubectl is available
  fastify.get('/api/k8s/check', async (request, reply) => {
    try {
      const isAvailable = await k8sService.checkKubectl();
      const context = isAvailable ? await k8sService.getCurrentContext() : null;
      
      return { 
        available: isAvailable,
        context,
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get namespaces
  fastify.get('/api/k8s/namespaces', async (request, reply) => {
    try {
      const namespaces = await k8sService.getNamespaces();
      return { namespaces };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Apply manifest (via queue)
  fastify.post('/api/k8s/apply', async (request, reply) => {
    try {
      const { manifest, namespace } = request.body as { 
        manifest: string; 
        namespace?: string;
      };

      if (!manifest) {
        return reply.code(400).send({ error: 'manifest is required' });
      }

      // Add to queue
      const jobId = await addK8sDeployTask({
        manifest,
        namespace: namespace || 'default',
      });

      return { 
        jobId,
        queueName: 'k8s-deploy',
        status: 'queued',
        message: 'K8s deployment job added to queue'
      };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Delete resource
  fastify.delete('/api/k8s/resource', async (request, reply) => {
    try {
      const { kind, name, namespace } = request.body as { 
        kind: string;
        name: string;
        namespace?: string;
      };

      if (!kind || !name) {
        return reply.code(400).send({ error: 'kind and name are required' });
      }

      await k8sService.deleteResource(kind, name, namespace || 'default');
      return { success: true };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get pods
  fastify.get('/api/k8s/pods', async (request, reply) => {
    try {
      const { namespace } = request.query as { namespace?: string };
      const pods = await k8sService.getPods(namespace || 'default');
      return { pods };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get deployments
  fastify.get('/api/k8s/deployments', async (request, reply) => {
    try {
      const { namespace } = request.query as { namespace?: string };
      const deployments = await k8sService.getDeployments(namespace || 'default');
      return { deployments };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get services
  fastify.get('/api/k8s/services', async (request, reply) => {
    try {
      const { namespace } = request.query as { namespace?: string };
      const services = await k8sService.getServices(namespace || 'default');
      return { services };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get pod logs
  fastify.get('/api/k8s/pods/:name/logs', async (request, reply) => {
    try {
      const { name } = request.params as { name: string };
      const { namespace, tail } = request.query as { namespace?: string; tail?: string };
      
      const logs = await k8sService.getPodLogs(
        name, 
        namespace || 'default',
        tail ? parseInt(tail) : 100
      );
      
      return { logs };
    } catch (error: any) {
      fastify.log.error(error);
      return reply.code(500).send({ error: error.message });
    }
  });

  // Get session info
  fastify.get('/api/k8s/session/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const session = k8sService.getSession(id);
      
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
