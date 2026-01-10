import { Worker, Job } from 'bullmq';
import {
  connection,
  DockerBuildTask,
  DockerRunTask,
  ComposeUpTask,
  ComposeDownTask,
  K8sDeployTask,
  CICDRunTask,
  testRedisConnection,
  isRedisAvailable,
} from './queue';
import { dockerService } from './docker';
import { DockerComposeService } from './compose';
import { k8sService } from './kubernetes';
import { cicdService } from './cicd';
import type { FastifyInstance } from 'fastify';

const composeService = new DockerComposeService();

let dockerBuildWorker: Worker<DockerBuildTask> | null = null;
let dockerRunWorker: Worker<DockerRunTask> | null = null;
let composeUpWorker: Worker<ComposeUpTask> | null = null;
let composeDownWorker: Worker<ComposeDownTask> | null = null;
let k8sDeployWorker: Worker<K8sDeployTask> | null = null;
let cicdRunWorker: Worker<CICDRunTask> | null = null;
let fastifyInstance: FastifyInstance | null = null;

// Helper to broadcast WebSocket messages
function broadcastWebSocket(message: any) {
  if (!fastifyInstance) return;

  const wsServer = (fastifyInstance as any).websocketServer;
  if (!wsServer?.clients) return;

  const payload = JSON.stringify({
    ...message,
    timestamp: new Date().toISOString(),
  });

  wsServer.clients.forEach((client: any) => {
    if (client.readyState === 1) {
      client.send(payload);
    }
  });
}

// Initialize workers
export async function initializeWorkers(fastify?: FastifyInstance) {
  if (fastify) {
    fastifyInstance = fastify;
  }
  if (dockerBuildWorker) {
    return; // Already initialized
  }

  // Test Redis connection first
  console.log('🔧 Testing Redis connection...');
  const redisConnected = await testRedisConnection();

  if (!redisConnected) {
    console.log('⚠️  Redis not available - worker queues disabled');
    console.log('📝 Application will run without background job processing');
    return;
  }

  console.log('🔧 Initializing BullMQ workers...');

  // Try to initialize workers, but don't fail if Redis is unavailable
  try {
    // Initialize CICD service
    cicdService.initialize().catch((err) => {
      console.error('Failed to initialize CICD service:', err);
    });

    // Docker Build Worker
    dockerBuildWorker = new Worker<DockerBuildTask>(
      'docker-build',
      async (job: Job<DockerBuildTask>) => {
        const { dockerfile, imageName, imageTag, sessionId } = job.data;

        try {
          // Update job progress
          await job.updateProgress(10);

          // Execute docker build
          const session = await dockerService.buildImage(
            sessionId,
            dockerfile,
            imageName,
            imageTag
          );

          await job.updateProgress(100);

          return {
            success: true,
            sessionId: session.id,
            imageId: session.imageId,
          };
        } catch (error: any) {
          throw new Error(`Docker build failed: ${error.message}`);
        }
      },
      {
        connection,
        concurrency: 2, // Process 2 builds simultaneously
        limiter: {
          max: 5,
          duration: 60000, // Max 5 builds per minute
        },
      }
    );

    dockerBuildWorker.on('completed', (job) => {
      console.log(`✅ Build job ${job.id} completed`);
      broadcastWebSocket({
        type: 'queue:job:completed',
        queue: 'docker-build',
        jobId: job.id,
        data: job.data,
        returnValue: job.returnvalue,
      });
    });

    dockerBuildWorker.on('failed', (job, err) => {
      console.error(`❌ Build job ${job?.id} failed:`, err.message);
      broadcastWebSocket({
        type: 'queue:job:failed',
        queue: 'docker-build',
        jobId: job?.id,
        error: err.message,
        data: job?.data,
      });
    });

    dockerBuildWorker.on('progress', (job, progress) => {
      console.log(`📊 Build job ${job.id} progress: ${progress}%`);
      broadcastWebSocket({
        type: 'queue:job:progress',
        queue: 'docker-build',
        jobId: job.id,
        progress,
        data: job.data,
      });
    });

    // Docker Run Worker
    dockerRunWorker = new Worker<DockerRunTask>(
      'docker-run',
      async (job: Job<DockerRunTask>) => {
        const { imageName, containerName, ports, env } = job.data;

        try {
          await job.updateProgress(10);

          const result = await dockerService.createAndRunContainer({
            imageName,
            containerName,
            ports,
            env,
          });

          await job.updateProgress(100);

          return {
            success: true,
            containerId: result.id,
            containerName: result.name,
          };
        } catch (error: any) {
          throw new Error(`Container run failed: ${error.message}`);
        }
      },
      {
        connection,
        concurrency: 3,
        limiter: {
          max: 10,
          duration: 60000,
        },
      }
    );

    dockerRunWorker.on('completed', (job) => {
      console.log(`✅ Run job ${job.id} completed`);
      broadcastWebSocket({
        type: 'queue:job:completed',
        queue: 'docker-run',
        jobId: job.id,
        data: job.data,
        returnValue: job.returnvalue,
      });
    });

    dockerRunWorker.on('failed', (job, err) => {
      console.error(`❌ Run job ${job?.id} failed:`, err.message);
      broadcastWebSocket({
        type: 'queue:job:failed',
        queue: 'docker-run',
        jobId: job?.id,
        error: err.message,
        data: job?.data,
      });
    });

    dockerRunWorker.on('progress', (job, progress) => {
      console.log(`📊 Run job ${job.id} progress: ${progress}%`);
      broadcastWebSocket({
        type: 'queue:job:progress',
        queue: 'docker-run',
        jobId: job.id,
        progress,
        data: job.data,
      });
    });

    // Listen to compose service updates and broadcast via WebSocket
    let totalServices = 0;
    let completedServices = 0;

    composeService.on('update', (session) => {
      // Calculate progress based on service statuses
      const services: any[] = Object.values(session.services);
      totalServices = services.length;
      completedServices = services.filter(
        (s) => s.status === 'running' || s.status === 'error'
      ).length;

      const progress =
        totalServices > 0 ? Math.round((completedServices / totalServices) * 90) + 10 : 10;

      broadcastWebSocket({
        type: 'compose:session:update',
        session,
        progress,
      });
    });

    // Compose Up Worker
    composeUpWorker = new Worker<ComposeUpTask>(
      'compose-up',
      async (job: Job<ComposeUpTask>) => {
        const { composeYaml, projectName } = job.data;

        try {
          await job.updateProgress(10);
          totalServices = 0;
          completedServices = 0;

          // Execute docker-compose up
          const session = await composeService.composeUp(composeYaml, projectName);

          await job.updateProgress(100);

          return {
            success: true,
            projectName,
            sessionId: session.id,
            message: 'Compose project started successfully',
          };
        } catch (error: any) {
          throw new Error(`Compose up failed: ${error.message}`);
        }
      },
      {
        connection,
        concurrency: 2,
        limiter: {
          max: 5,
          duration: 60000,
        },
      }
    );

    composeUpWorker.on('completed', (job) => {
      console.log(`✅ Compose job ${job.id} completed`);
      broadcastWebSocket({
        type: 'queue:job:completed',
        queue: 'compose-up',
        jobId: job.id,
        data: job.data,
        returnValue: job.returnvalue,
      });
    });

    composeUpWorker.on('failed', (job, err) => {
      console.error(`❌ Compose job ${job?.id} failed:`, err.message);
      broadcastWebSocket({
        type: 'queue:job:failed',
        queue: 'compose-up',
        jobId: job?.id,
        error: err.message,
        data: job?.data,
      });
    });

    composeUpWorker.on('progress', (job, progress) => {
      console.log(`📊 Compose job ${job.id} progress: ${progress}%`);
      broadcastWebSocket({
        type: 'queue:job:progress',
        queue: 'compose-up',
        jobId: job.id,
        progress,
        data: job.data,
      });
    });

    // Listen to compose down progress events
    composeService.on('down:progress', (data) => {
      broadcastWebSocket({
        type: 'compose:down:progress',
        ...data,
      });
    });

    // Compose Down Worker
    composeDownWorker = new Worker<ComposeDownTask>(
      'compose-down',
      async (job: Job<ComposeDownTask>) => {
        const { projectName, removeVolumes } = job.data;

        try {
          await job.updateProgress(10);

          // Execute docker-compose down
          if (removeVolumes) {
            await composeService.composeDownVolumes(projectName);
          } else {
            await composeService.composeDown(projectName);
          }

          await job.updateProgress(100);

          return {
            success: true,
            projectName,
            message: 'Compose project stopped and removed successfully',
          };
        } catch (error: any) {
          throw new Error(`Compose down failed: ${error.message}`);
        }
      },
      {
        connection,
        concurrency: 2,
        limiter: {
          max: 5,
          duration: 60000,
        },
      }
    );

    composeDownWorker.on('completed', (job) => {
      console.log(`✅ Compose down job ${job.id} completed`);
      broadcastWebSocket({
        type: 'queue:job:completed',
        queue: 'compose-down',
        jobId: job.id,
        data: job.data,
        returnValue: job.returnvalue,
      });
    });

    composeDownWorker.on('failed', (job, err) => {
      console.error(`❌ Compose down job ${job?.id} failed:`, err.message);
      broadcastWebSocket({
        type: 'queue:job:failed',
        queue: 'compose-down',
        jobId: job?.id,
        error: err.message,
        data: job?.data,
      });
    });

    composeDownWorker.on('progress', (job, progress) => {
      console.log(`📊 Compose down job ${job.id} progress: ${progress}%`);
      broadcastWebSocket({
        type: 'queue:job:progress',
        queue: 'compose-down',
        jobId: job.id,
        progress,
        data: job.data,
      });
    });

    // Listen to k8s service updates and broadcast via WebSocket
    k8sService.on('update', (session) => {
      broadcastWebSocket({
        type: 'k8s:session:update',
        session,
      });
    });

    // K8s Deploy Worker
    k8sDeployWorker = new Worker<K8sDeployTask>(
      'k8s-deploy',
      async (job: Job<K8sDeployTask>) => {
        const { manifest, namespace } = job.data;

        try {
          await job.updateProgress(10);

          // Execute kubectl apply
          const session = await k8sService.applyManifest(manifest, namespace);

          await job.updateProgress(100);

          return {
            success: true,
            namespace,
            sessionId: session.id,
            message: 'K8s resources deployed successfully',
          };
        } catch (error: any) {
          throw new Error(`K8s deployment failed: ${error.message}`);
        }
      },
      {
        connection,
        concurrency: 2,
        limiter: {
          max: 5,
          duration: 60000,
        },
      }
    );

    k8sDeployWorker.on('completed', (job) => {
      console.log(`✅ K8s deploy job ${job.id} completed`);
      broadcastWebSocket({
        type: 'queue:job:completed',
        queue: 'k8s-deploy',
        jobId: job.id,
        data: job.data,
        returnValue: job.returnvalue,
      });
    });

    k8sDeployWorker.on('failed', (job, err) => {
      console.error(`❌ K8s deploy job ${job?.id} failed:`, err.message);
      broadcastWebSocket({
        type: 'queue:job:failed',
        queue: 'k8s-deploy',
        jobId: job?.id,
        error: err.message,
        data: job?.data,
      });
    });

    k8sDeployWorker.on('progress', (job, progress) => {
      console.log(`📊 K8s deploy job ${job.id} progress: ${progress}%`);
      broadcastWebSocket({
        type: 'queue:job:progress',
        queue: 'k8s-deploy',
        jobId: job.id,
        progress,
        data: job.data,
      });
    });

    // Listen to cicd service updates and broadcast via WebSocket
    cicdService.on('run:created', (run) => {
      broadcastWebSocket({
        type: 'cicd:run:created',
        data: run,
      });
    });

    cicdService.on('run:started', (run) => {
      broadcastWebSocket({
        type: 'cicd:run:started',
        data: run,
      });
    });

    cicdService.on('job:started', ({ runId, jobRun }) => {
      broadcastWebSocket({
        type: 'cicd:job:started',
        data: { id: runId, jobId: jobRun.id },
        runId,
        job: jobRun,
      });
    });

    cicdService.on('step:started', ({ runId, jobRun, stepRun }) => {
      broadcastWebSocket({
        type: 'cicd:step:started',
        data: { id: runId, jobId: jobRun.id, stepId: stepRun.id },
        runId,
        jobId: jobRun.id,
        step: stepRun,
      });
    });

    cicdService.on('step:output', ({ runId, jobRun, stepRun, line }) => {
      broadcastWebSocket({
        type: 'cicd:step:output',
        data: { id: runId, jobId: jobRun.id, stepId: stepRun.id },
        runId,
        jobId: jobRun.id,
        stepId: stepRun.id,
        line,
      });
    });

    cicdService.on('step:completed', ({ runId, jobRun, stepRun }) => {
      broadcastWebSocket({
        type: 'cicd:step:completed',
        data: { id: runId, jobId: jobRun.id, stepId: stepRun.id },
        runId,
        jobId: jobRun.id,
        step: stepRun,
      });
    });

    cicdService.on('job:completed', ({ runId, jobRun }) => {
      broadcastWebSocket({
        type: 'cicd:job:completed',
        data: { id: runId, jobId: jobRun.id },
        runId,
        job: jobRun,
      });
    });

    cicdService.on('run:completed', (run) => {
      broadcastWebSocket({
        type: 'cicd:run:completed',
        data: run,
      });
    });

    // CICD Run Worker
    cicdRunWorker = new Worker<CICDRunTask>(
      'cicd-run',
      async (job: Job<CICDRunTask>) => {
        const { workflow, trigger, branch, executionMode = 'simulation' } = job.data;

        try {
          await job.updateProgress(10);

          console.log(`🚀 Executing workflow in ${executionMode} mode`);

          // Execute workflow with execution mode
          const run = await cicdService.runWorkflow(workflow, trigger, branch, executionMode);

          await job.updateProgress(100);

          return {
            success: true,
            runId: run.id,
            workflowName: workflow.name,
            executionMode,
            message: `Workflow execution started (${executionMode} mode)`,
          };
        } catch (error: any) {
          throw new Error(`Workflow execution failed: ${error.message}`);
        }
      },
      {
        connection,
        concurrency: 2,
        limiter: {
          max: 5,
          duration: 60000,
        },
      }
    );

    cicdRunWorker.on('completed', (job) => {
      console.log(`✅ CICD run job ${job.id} completed`);
      broadcastWebSocket({
        type: 'queue:job:completed',
        queue: 'cicd-run',
        jobId: job.id,
        data: job.data,
        returnValue: job.returnvalue,
      });
    });

    cicdRunWorker.on('failed', (job, err) => {
      console.error(`❌ CICD run job ${job?.id} failed:`, err.message);
      broadcastWebSocket({
        type: 'queue:job:failed',
        queue: 'cicd-run',
        jobId: job?.id,
        error: err.message,
        data: job?.data,
      });
    });

    cicdRunWorker.on('progress', (job, progress) => {
      console.log(`📊 CICD run job ${job.id} progress: ${progress}%`);
      broadcastWebSocket({
        type: 'queue:job:progress',
        queue: 'cicd-run',
        jobId: job.id,
        progress,
        data: job.data,
      });
    });

    console.log('✅ BullMQ workers initialized');
  } catch (error) {
    console.warn(
      '⚠️  Failed to initialize BullMQ workers (Redis may not be running):',
      error instanceof Error ? error.message : error
    );
    console.log('📝 Application will continue without worker queue functionality');
  }
}

// Export worker for graceful shutdown
export function closeWorkers() {
  const promises = [];
  if (dockerBuildWorker) {
    promises.push(dockerBuildWorker.close());
  }
  if (dockerRunWorker) {
    promises.push(dockerRunWorker.close());
  }
  if (composeUpWorker) {
    promises.push(composeUpWorker.close());
  }
  if (composeDownWorker) {
    promises.push(composeDownWorker.close());
  }
  if (k8sDeployWorker) {
    promises.push(k8sDeployWorker.close());
  }
  if (cicdRunWorker) {
    promises.push(cicdRunWorker.close());
  }
  return Promise.all(promises);
}

// Handle initialization errors
process.on('unhandledRejection', (reason, promise) => {
  if (reason && typeof reason === 'object' && 'message' in reason) {
    const message = (reason as Error).message;
    if (message.includes('ECONNREFUSED') && message.includes('6379')) {
      // Redis connection error - this is expected if Redis is not running
      return;
    }
  }
  console.error('Unhandled Rejection:', reason);
});
