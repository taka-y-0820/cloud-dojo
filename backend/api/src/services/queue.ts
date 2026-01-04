import { Queue, Worker, Job } from 'bullmq';
import IORedis from 'ioredis';

let redisAvailable = false;

const connection = new IORedis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  maxRetriesPerRequest: null,
  retryStrategy: () => null, // Don't retry on connection failure
  lazyConnect: true, // Don't connect immediately
  enableOfflineQueue: false, // Don't queue commands when offline
  connectTimeout: 3000, // 3 second timeout
});

// Handle connection errors gracefully - suppress error output
connection.on('error', () => {
  // Silently ignore Redis errors
  redisAvailable = false;
});

connection.on('connect', () => {
  console.log('✅ Redis connected - worker queues enabled');
  redisAvailable = true;
});

// Test Redis connection
export async function testRedisConnection(): Promise<boolean> {
  try {
    await connection.connect();
    redisAvailable = true;
    return true;
  } catch (err) {
    redisAvailable = false;
    return false;
  }
}

export function isRedisAvailable(): boolean {
  return redisAvailable;
}

export interface DockerBuildTask {
  dockerfile: string;
  imageName: string;
  imageTag: string;
  sessionId: string;
}

export interface DockerRunTask {
  imageName: string;
  containerName?: string;
  ports?: Array<{ host: number; container: number }>;
  env?: string[];
}

export interface K8sDeployTask {
  manifest: string;
  namespace: string;
}

export interface ComposeUpTask {
  composeYaml: string;
  projectName: string;
}

export interface ComposeDownTask {
  projectName: string;
  removeVolumes?: boolean;
}

export interface CICDRunTask {
  workflow: any;
  trigger: string;
  branch: string;
  executionMode?: 'simulation' | 'real';
}

// Queue definitions
export const dockerBuildQueue = new Queue<DockerBuildTask>('docker-build', { connection });
export const dockerRunQueue = new Queue<DockerRunTask>('docker-run', { connection });
export const k8sDeployQueue = new Queue<K8sDeployTask>('k8s-deploy', { connection });
export const composeUpQueue = new Queue<ComposeUpTask>('compose-up', { connection });
export const composeDownQueue = new Queue<ComposeDownTask>('compose-down', { connection });
export const cicdRunQueue = new Queue<CICDRunTask>('cicd-run', { connection });

// Add task to queue
export async function addDockerBuildTask(task: DockerBuildTask) {
  const job = await dockerBuildQueue.add('build-image', task, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: 100, // Keep last 100 completed jobs
    removeOnFail: 1000, // Keep last 1000 failed jobs
  });
  return job.id;
}

export async function addDockerRunTask(task: DockerRunTask) {
  const job = await dockerRunQueue.add('run-container', task, {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
  return job.id;
}

export async function addK8sDeployTask(task: K8sDeployTask) {
  const job = await k8sDeployQueue.add('deploy', task, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 3000,
    },
  });
  return job.id;
}

export async function addComposeUpTask(task: ComposeUpTask) {
  const job = await composeUpQueue.add('compose-up', task, {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
  return job.id;
}

export async function addComposeDownTask(task: ComposeDownTask) {
  const job = await composeDownQueue.add('compose-down', task, {
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 1000,
    },
  });
  return job.id;
}

export async function addCICDRunTask(task: CICDRunTask) {
  const job = await cicdRunQueue.add('cicd-run', task, {
    attempts: 1,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
  });
  return job.id;
}

// Get job status
export async function getJobStatus(queueName: string, jobId: string) {
  let queue: Queue;

  switch (queueName) {
    case 'docker-build':
      queue = dockerBuildQueue;
      break;
    case 'docker-run':
      queue = dockerRunQueue;
      break;
    case 'k8s-deploy':
      queue = k8sDeployQueue;
      break;
    case 'compose-up':
      queue = composeUpQueue;
      break;
    case 'cicd-run':
      queue = cicdRunQueue;
      break;
    default:
      throw new Error(`Unknown queue: ${queueName}`);
  }

  const job = await queue.getJob(jobId);
  if (!job) {
    return null;
  }

  const state = await job.getState();
  const progress = job.progress;
  const returnValue = job.returnvalue;
  const failedReason = job.failedReason;

  return {
    id: job.id,
    state,
    progress,
    data: job.data,
    returnValue,
    failedReason,
    attemptsMade: job.attemptsMade,
    processedOn: job.processedOn,
    finishedOn: job.finishedOn,
  };
}

// Get queue stats
export async function getQueueStats(queueName: string) {
  let queue: Queue;

  switch (queueName) {
    case 'docker-build':
      queue = dockerBuildQueue;
      break;
    case 'docker-run':
      queue = dockerRunQueue;
      break;
    case 'k8s-deploy':
      queue = k8sDeployQueue;
      break;
    case 'compose-up':
      queue = composeUpQueue;
      break;
    case 'compose-down':
      queue = composeDownQueue;
      break;
    case 'cicd-run':
      queue = cicdRunQueue;
      break;
    default:
      throw new Error(`Unknown queue: ${queueName}`);
  }

  const [waiting, active, completed, failed] = await Promise.all([
    queue.getWaitingCount(),
    queue.getActiveCount(),
    queue.getCompletedCount(),
    queue.getFailedCount(),
  ]);

  return {
    waiting,
    active,
    completed,
    failed,
  };
}

export { connection };
