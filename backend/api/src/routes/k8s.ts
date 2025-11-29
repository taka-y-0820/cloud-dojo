import { FastifyInstance } from 'fastify';
import { z } from 'zod';

const deploySchema = z.object({
  manifest: z.string(),
  namespace: z.string().optional(),
  appName: z.string(),
  replicas: z.number().optional().default(3),
});

interface K8sEvent {
  id: number;
  type: 'deployment' | 'replicaset' | 'pod' | 'service' | 'ingress';
  action: 'creating' | 'created' | 'scaling' | 'ready' | 'failed';
  resource: string;
  message: string;
  timestamp: string;
  status: 'pending' | 'in-progress' | 'success' | 'error';
}

interface DeploymentSession {
  deploymentId: string;
  appName: string;
  namespace: string;
  status: 'queued' | 'deploying' | 'completed' | 'failed';
  events: K8sEvent[];
  resources: {
    deployment?: any;
    replicaSet?: any;
    pods: any[];
    service?: any;
    ingress?: any;
  };
  startTime: string;
  endTime?: string;
  totalDuration?: number;
}

const deploymentSessions = new Map<string, DeploymentSession>();

// Simulate Kubernetes deployment
async function executeDeployment(deploymentId: string, appName: string, namespace: string, replicas: number, fastify: FastifyInstance) {
  const session = deploymentSessions.get(deploymentId);
  if (!session) return;
  
  session.status = 'deploying';
  let eventId = 0;
  
  // Event 1: Create Deployment
  await addEvent(session, {
    id: ++eventId,
    type: 'deployment',
    action: 'creating',
    resource: `${appName}-deployment`,
    message: `Creating Deployment ${appName}-deployment`,
    timestamp: new Date().toISOString(),
    status: 'in-progress',
  }, fastify, deploymentId);
  
  await sleep(800);
  
  session.resources.deployment = {
    name: `${appName}-deployment`,
    namespace,
    replicas,
    ready: 0,
  };
  
  session.events[session.events.length - 1].status = 'success';
  session.events[session.events.length - 1].action = 'created';
  broadcastDeploymentUpdate(fastify, deploymentId, session);
  
  // Event 2: Create ReplicaSet
  await addEvent(session, {
    id: ++eventId,
    type: 'replicaset',
    action: 'creating',
    resource: `${appName}-rs-${Math.random().toString(36).substr(2, 5)}`,
    message: 'Creating ReplicaSet',
    timestamp: new Date().toISOString(),
    status: 'in-progress',
  }, fastify, deploymentId);
  
  await sleep(600);
  
  const rsName = session.events[session.events.length - 1].resource;
  session.resources.replicaSet = {
    name: rsName,
    desired: replicas,
    ready: 0,
  };
  
  session.events[session.events.length - 1].status = 'success';
  session.events[session.events.length - 1].action = 'created';
  broadcastDeploymentUpdate(fastify, deploymentId, session);
  
  // Event 3: Create Pods
  for (let i = 0; i < replicas; i++) {
    const podName = `${appName}-${Math.random().toString(36).substr(2, 9)}`;
    
    await addEvent(session, {
      id: ++eventId,
      type: 'pod',
      action: 'creating',
      resource: podName,
      message: `Creating Pod ${podName}`,
      timestamp: new Date().toISOString(),
      status: 'in-progress',
    }, fastify, deploymentId);
    
    await sleep(1000 + Math.random() * 1000);
    
    const pod = {
      name: podName,
      status: 'Running',
      ready: true,
      restarts: 0,
      ip: `10.244.0.${10 + i}`,
      node: `node-${(i % 3) + 1}`,
    };
    
    session.resources.pods.push(pod);
    session.events[session.events.length - 1].status = 'success';
    session.events[session.events.length - 1].action = 'ready';
    session.events[session.events.length - 1].message = `Pod ${podName} is Running`;
    
    if (session.resources.deployment) {
      session.resources.deployment.ready++;
    }
    if (session.resources.replicaSet) {
      session.resources.replicaSet.ready++;
    }
    
    broadcastDeploymentUpdate(fastify, deploymentId, session);
  }
  
  // Event 4: Create Service
  await addEvent(session, {
    id: ++eventId,
    type: 'service',
    action: 'creating',
    resource: `${appName}-service`,
    message: `Creating Service ${appName}-service`,
    timestamp: new Date().toISOString(),
    status: 'in-progress',
  }, fastify, deploymentId);
  
  await sleep(500);
  
  session.resources.service = {
    name: `${appName}-service`,
    type: 'ClusterIP',
    clusterIP: '10.96.0.42',
    port: 80,
    targetPort: 3000,
  };
  
  session.events[session.events.length - 1].status = 'success';
  session.events[session.events.length - 1].action = 'created';
  broadcastDeploymentUpdate(fastify, deploymentId, session);
  
  // Event 5: Create Ingress
  await addEvent(session, {
    id: ++eventId,
    type: 'ingress',
    action: 'creating',
    resource: `${appName}-ingress`,
    message: `Creating Ingress ${appName}-ingress`,
    timestamp: new Date().toISOString(),
    status: 'in-progress',
  }, fastify, deploymentId);
  
  await sleep(800);
  
  session.resources.ingress = {
    name: `${appName}-ingress`,
    host: `${appName}.example.com`,
    path: '/',
    backend: `${appName}-service:80`,
  };
  
  session.events[session.events.length - 1].status = 'success';
  session.events[session.events.length - 1].action = 'ready';
  session.events[session.events.length - 1].message = `Ingress ready at ${appName}.example.com`;
  broadcastDeploymentUpdate(fastify, deploymentId, session);
  
  // Complete deployment
  session.status = 'completed';
  session.endTime = new Date().toISOString();
  session.totalDuration = Math.floor((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / 1000);
  
  await addEvent(session, {
    id: ++eventId,
    type: 'deployment',
    action: 'ready',
    resource: `${appName}-deployment`,
    message: `Deployment ${appName} is ready with ${replicas}/${replicas} pods`,
    timestamp: new Date().toISOString(),
    status: 'success',
  }, fastify, deploymentId);
}

async function addEvent(session: DeploymentSession, event: K8sEvent, fastify: FastifyInstance, deploymentId: string) {
  session.events.push(event);
  broadcastDeploymentUpdate(fastify, deploymentId, session);
  await sleep(100);
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function broadcastDeploymentUpdate(fastify: FastifyInstance, deploymentId: string, session: DeploymentSession) {
  const message = JSON.stringify({
    type: 'k8s:deployment:update',
    deploymentId,
    data: session,
    timestamp: new Date().toISOString(),
  });
  
  // @ts-ignore
  if (fastify.websocketServer && fastify.websocketServer.clients) {
    // @ts-ignore
    fastify.websocketServer.clients.forEach((client: any) => {
      if (client.readyState === 1) {
        client.send(message);
      }
    });
  }
}

export async function k8sRoutes(fastify: FastifyInstance) {
  // Start a new deployment
  fastify.post('/deploy', async (request, reply) => {
    const body = deploySchema.parse(request.body);
    
    const deploymentId = 'deploy-' + Date.now();
    const namespace = body.namespace || 'default';
    
    const session: DeploymentSession = {
      deploymentId,
      appName: body.appName,
      namespace,
      status: 'queued',
      events: [],
      resources: {
        pods: [],
      },
      startTime: new Date().toISOString(),
    };
    
    deploymentSessions.set(deploymentId, session);
    
    // Start deployment asynchronously
    executeDeployment(deploymentId, body.appName, namespace, body.replicas, fastify).catch(err => {
      fastify.log.error({ err, deploymentId }, 'Deployment failed');
      const session = deploymentSessions.get(deploymentId);
      if (session) {
        session.status = 'failed';
        broadcastDeploymentUpdate(fastify, deploymentId, session);
      }
    });
    
    return {
      deploymentId,
      status: 'queued',
      message: 'Deployment started',
    };
  });
  
  // Get deployment status
  fastify.get('/deployment/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    
    const session = deploymentSessions.get(id);
    if (!session) {
      return reply.code(404).send({ error: 'Deployment not found' });
    }
    
    return session;
  });
  
  // Get all deployments
  fastify.get('/deployments', async (request, reply) => {
    return {
      deployments: Array.from(deploymentSessions.values()),
    };
  });
  
  // Get cluster resources (mock data)
  fastify.get('/resources', async (request, reply) => {
    return {
      pods: [
        { name: 'frontend-7d8c9f-abc12', status: 'Running', restarts: 0, age: '2d' },
        { name: 'frontend-7d8c9f-def34', status: 'Running', restarts: 0, age: '2d' },
        { name: 'frontend-7d8c9f-ghi56', status: 'Running', restarts: 1, age: '1d' },
        { name: 'backend-5f6a8b-jkl78', status: 'Running', restarts: 0, age: '2d' },
        { name: 'backend-5f6a8b-mno90', status: 'Running', restarts: 0, age: '2d' },
        { name: 'postgres-0', status: 'Running', restarts: 0, age: '7d' },
      ],
      services: [
        { name: 'frontend-service', type: 'ClusterIP', clusterIP: '10.96.0.10', port: 80 },
        { name: 'backend-service', type: 'ClusterIP', clusterIP: '10.96.0.20', port: 80 },
        { name: 'postgres-service', type: 'ClusterIP', clusterIP: '10.96.0.30', port: 5432 },
      ],
      deployments: [
        { name: 'frontend', replicas: '3/3', ready: true },
        { name: 'backend', replicas: '2/2', ready: true },
      ],
    };
  });
}
