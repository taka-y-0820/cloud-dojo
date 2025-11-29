import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { dockerService, BuildSession } from '../services/docker.js';
import { addDockerBuildTask, addDockerRunTask } from '../services/queue.js';

const buildSchema = z.object({
  dockerfile: z.string(),
  imageName: z.string().default('cloud-dojo-app'),
  imageTag: z.string().default('latest'),
});

const containerActionSchema = z.object({
  containerId: z.string(),
  force: z.boolean().optional().default(false),
});

const imageActionSchema = z.object({
  imageId: z.string(),
  force: z.boolean().optional().default(false),
});

export async function dockerRoutes(fastify: FastifyInstance) {
  // WebSocket経由でビルド更新を送信
  dockerService.on('update', (session: BuildSession) => {
    const message = JSON.stringify({
      type: 'docker:build:update',
      buildId: session.id,
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
  });

  // Docker情報を取得
  fastify.get('/info', async (request, reply) => {
    try {
      const info = await dockerService.getDockerInfo();
      return info;
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get Docker info');
      return reply.code(500).send({
        error: 'Failed to get Docker info',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // Dockerイメージをビルド（キュー経由）
  fastify.post('/build', async (request, reply) => {
    try {
      const body = buildSchema.parse(request.body);
      const sessionId = 'build-' + Date.now();

      // タスクをキューに追加
      const jobId = await addDockerBuildTask({
        sessionId,
        dockerfile: body.dockerfile,
        imageName: body.imageName,
        imageTag: body.imageTag,
      });

      return {
        jobId,
        sessionId,
        queueName: 'docker-build',
        status: 'queued',
        message: 'Build task queued successfully',
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to queue build task');
      return reply.code(500).send({
        error: 'Failed to queue build task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ビルドステータスとログを取得
  fastify.get('/build/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const session = dockerService.getBuildSession(id);

    if (!session) {
      return reply.code(404).send({ error: 'Build not found' });
    }

    return session;
  });

  // コンテナ一覧を取得
  fastify.get('/containers', async (request, reply) => {
    try {
      const { all } = request.query as { all?: string };
      const containers = await dockerService.listContainers(all === 'true');
      return { containers };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to list containers');
      return reply.code(500).send({
        error: 'Failed to list containers',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // イメージ一覧を取得
  fastify.get('/images', async (request, reply) => {
    try {
      const images = await dockerService.listImages();
      return { images };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to list images');
      return reply.code(500).send({
        error: 'Failed to list images',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // コンテナを削除
  fastify.delete('/containers/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { force } = request.query as { force?: string };
      
      await dockerService.removeContainer(id, force === 'true');
      
      return {
        message: 'Container removed successfully',
        containerId: id,
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to remove container');
      return reply.code(500).send({
        error: 'Failed to remove container',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // イメージを削除
  fastify.delete('/images/:id', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { force } = request.query as { force?: string };
      
      await dockerService.removeImage(id, force === 'true');
      
      return {
        message: 'Image removed successfully',
        imageId: id,
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to remove image');
      return reply.code(500).send({
        error: 'Failed to remove image',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // コンテナを停止
  fastify.post('/containers/:id/stop', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await dockerService.stopContainer(id);
      
      return {
        message: 'Container stopped successfully',
        containerId: id,
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to stop container');
      return reply.code(500).send({
        error: 'Failed to stop container',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // コンテナを起動
  fastify.post('/containers/:id/start', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      await dockerService.startContainer(id);
      
      return {
        message: 'Container started successfully',
        containerId: id,
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to start container');
      return reply.code(500).send({
        error: 'Failed to start container',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // コンテナを作成して実行（キュー経由）
  fastify.post('/containers/run', async (request, reply) => {
    try {
      const body = request.body as {
        imageName: string;
        containerName?: string;
        ports?: Array<{ container: number; host: number }>;
        env?: Array<string>;
        volumes?: Array<{ host: string; container: string }>;
        cmd?: string[];
      };

      // キューに追加
      const jobId = await addDockerRunTask({
        imageName: body.imageName,
        containerName: body.containerName,
        ports: body.ports,
        env: body.env,
      });
      
      return {
        jobId,
        queueName: 'docker-run',
        status: 'queued',
        message: 'Container run task queued successfully',
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to queue run task');
      return reply.code(500).send({
        error: 'Failed to queue run task',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // コンテナログを取得
  fastify.get('/containers/:id/logs', async (request, reply) => {
    try {
      const { id } = request.params as { id: string };
      const { tail } = request.query as { tail?: string };
      
      const logs = await dockerService.getContainerLogs(id, tail ? parseInt(tail) : 100);
      
      return {
        containerId: id,
        logs,
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get container logs');
      return reply.code(500).send({
        error: 'Failed to get container logs',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });
}
