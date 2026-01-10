import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import Docker from 'dockerode';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const docker = new Docker();

const execCommandSchema = z.object({
  containerId: z.string(),
  command: z.string(),
});

const createNetworkLabSchema = z.object({
  nodeCount: z.number().min(2).max(10).default(3),
  networkName: z.string().default('lab-network'),
});

// Dockerの起動状態を確認するヘルパー関数
async function checkDockerStatus(): Promise<{ running: boolean; error?: string }> {
  try {
    await docker.ping();
    return { running: true };
  } catch (error: any) {
    if (error.code === 'ENOENT' || error.errno === -4058) {
      return {
        running: false,
        error: 'Docker Engine is not running. Please start Docker Desktop.',
      };
    }
    return {
      running: false,
      error: `Docker connection error: ${error.message}`,
    };
  }
}

export async function networkRoutes(fastify: FastifyInstance) {
  // ネットワークラボ環境を作成
  fastify.post('/lab/create', async (request, reply) => {
    try {
      // Docker起動状態を確認
      const dockerStatus = await checkDockerStatus();
      if (!dockerStatus.running) {
        return reply.status(503).send({
          error: 'Docker Engine is not available',
          message: dockerStatus.error,
          suggestion: 'Please start Docker Desktop and try again.',
        });
      }

      const body = createNetworkLabSchema.parse(request.body);
      const { nodeCount, networkName } = body;

      // Alpine イメージの確認とpull
      try {
        await docker.getImage('alpine:latest').inspect();
        fastify.log.info('Alpine image already exists');
      } catch (error) {
        fastify.log.info('Pulling alpine image...');
        await new Promise((resolve, reject) => {
          docker.pull('alpine:latest', (err: any, stream: any) => {
            if (err) return reject(err);
            docker.modem.followProgress(stream, (err: any, res: any) => {
              if (err) return reject(err);
              resolve(res);
            });
          });
        });
        fastify.log.info('Alpine image pulled successfully');
      }

      // カスタムネットワークを作成
      let network;
      try {
        network = await docker.createNetwork({
          Name: networkName,
          Driver: 'bridge',
          Internal: false,
          Attachable: true,
          Labels: {
            'cloud-dojo': 'network-lab',
          },
        });
      } catch (error: any) {
        // ネットワークが既に存在する場合は取得
        if (error.statusCode === 409) {
          const networks = await docker.listNetworks({
            filters: { name: [networkName] },
          });
          network = docker.getNetwork(networks[0].Id);
        } else {
          throw error;
        }
      }

      // 複数のLinuxコンテナを作成
      const containers = [];
      for (let i = 1; i <= nodeCount; i++) {
        const containerName = `network-node-${i}`;

        // 既存のコンテナを削除
        try {
          const existingContainer = docker.getContainer(containerName);
          await existingContainer.remove({ force: true });
        } catch (error) {
          // コンテナが存在しない場合は無視
        }

        const container = await docker.createContainer({
          Image: 'alpine:latest',
          name: containerName,
          Cmd: [
            '/bin/sh',
            '-c',
            'apk add --no-cache iproute2 iputils curl tcpdump bind-tools && sleep infinity',
          ],
          Tty: true,
          OpenStdin: true,
          HostConfig: {
            NetworkMode: networkName,
            CapAdd: ['NET_ADMIN', 'NET_RAW'], // ネットワーク管理権限
          },
          Labels: {
            'cloud-dojo': 'network-lab',
            'node-id': i.toString(),
          },
        });

        await container.start();

        const inspectData = await container.inspect();
        containers.push({
          id: container.id,
          name: containerName,
          ipAddress: inspectData.NetworkSettings.Networks[networkName]?.IPAddress,
          nodeId: i,
        });
      }

      return {
        networkId: network.id,
        networkName,
        containers,
        message: `Created ${nodeCount} network nodes`,
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to create network lab');
      return reply.code(500).send({
        error: 'Failed to create network lab',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ネットワークラボ環境のステータスを取得
  fastify.get('/lab/status', async (request, reply) => {
    try {
      const containers = await docker.listContainers({
        all: true,
        filters: {
          label: ['cloud-dojo=network-lab'],
        },
      });

      const networks = await docker.listNetworks({
        filters: {
          label: ['cloud-dojo=network-lab'],
        },
      });

      const containerDetails = await Promise.all(
        containers.map(async (c) => {
          const container = docker.getContainer(c.Id);
          const inspectData = await container.inspect();
          const networkName = Object.keys(inspectData.NetworkSettings.Networks)[0];
          return {
            id: c.Id,
            name: c.Names[0].replace('/', ''),
            status: c.State,
            ipAddress: networkName
              ? inspectData.NetworkSettings.Networks[networkName]?.IPAddress
              : null,
            nodeId: c.Labels['node-id'],
          };
        })
      );

      return {
        containers: containerDetails,
        networks: networks.map((n) => ({
          id: n.Id,
          name: n.Name,
          driver: n.Driver,
        })),
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to get lab status');
      return reply.code(500).send({
        error: 'Failed to get lab status',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // ネットワークラボ環境を削除
  fastify.delete('/lab/cleanup', async (request, reply) => {
    try {
      // ラボのコンテナを停止・削除
      const containers = await docker.listContainers({
        all: true,
        filters: {
          label: ['cloud-dojo=network-lab'],
        },
      });

      await Promise.all(
        containers.map(async (c) => {
          const container = docker.getContainer(c.Id);
          await container.remove({ force: true });
        })
      );

      // ラボのネットワークを削除
      const networks = await docker.listNetworks({
        filters: {
          label: ['cloud-dojo=network-lab'],
        },
      });

      await Promise.all(
        networks.map(async (n) => {
          const network = docker.getNetwork(n.Id);
          try {
            await network.remove();
          } catch (error) {
            // ネットワークが使用中の場合は無視
          }
        })
      );

      return { message: 'Network lab cleaned up successfully' };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to cleanup lab');
      return reply.code(500).send({
        error: 'Failed to cleanup lab',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // コンテナ内でコマンドを実行
  fastify.post('/exec', async (request, reply) => {
    try {
      const body = execCommandSchema.parse(request.body);
      const { containerId, command } = body;

      const container = docker.getContainer(containerId);

      const exec = await container.exec({
        Cmd: ['/bin/sh', '-c', command],
        AttachStdout: true,
        AttachStderr: true,
      });

      const stream = await exec.start({ Detach: false });

      let output = '';
      stream.on('data', (chunk: Buffer) => {
        // Docker の stream format を処理（最初の8バイトはヘッダー）
        output += chunk.slice(8).toString();
      });

      await new Promise((resolve, reject) => {
        stream.on('end', resolve);
        stream.on('error', reject);
      });

      const inspectData = await exec.inspect();

      return {
        exitCode: inspectData.ExitCode,
        output: output.trim(),
      };
    } catch (error) {
      fastify.log.error({ error }, 'Failed to execute command');
      return reply.code(500).send({
        error: 'Failed to execute command',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  // よく使うネットワークコマンドのチートシートを取得
  fastify.get('/cheatsheet', async (request, reply) => {
    return {
      categories: [
        {
          name: '基本情報',
          commands: [
            {
              cmd: 'ip addr show',
              description: 'ネットワークインターフェース一覧とIPアドレス表示',
            },
            { cmd: 'ip link show', description: 'ネットワークインターフェースの状態表示' },
            { cmd: 'ip route show', description: 'ルーティングテーブル表示' },
            { cmd: 'hostname', description: 'ホスト名表示' },
          ],
        },
        {
          name: '接続確認',
          commands: [
            { cmd: 'ping -c 4 <IP>', description: '指定したIPアドレスへのICMP疎通確認（4回）' },
            { cmd: 'ping -c 4 network-node-2', description: '他のノードへの疎通確認' },
            { cmd: 'traceroute <IP>', description: 'パケットの経路を追跡' },
          ],
        },
        {
          name: 'ポート・サービス確認',
          commands: [
            { cmd: 'netstat -tuln', description: 'リスニング中のポート一覧' },
            { cmd: 'ss -tuln', description: 'ソケット統計（netstatの代替）' },
            { cmd: 'nslookup google.com', description: 'DNS名前解決テスト' },
          ],
        },
        {
          name: 'パケットキャプチャ',
          commands: [
            { cmd: 'tcpdump -i any icmp', description: 'ICMP（ping）パケットをキャプチャ' },
            { cmd: 'tcpdump -i any port 80', description: 'HTTP（ポート80）通信をキャプチャ' },
            {
              cmd: 'tcpdump -i any -c 10',
              description: '任意のインターフェースで10パケットキャプチャ',
            },
          ],
        },
        {
          name: 'HTTP通信',
          commands: [
            { cmd: 'curl http://<IP>', description: 'HTTPリクエストを送信' },
            { cmd: 'curl -I http://<IP>', description: 'HTTPヘッダーのみ取得' },
          ],
        },
      ],
    };
  });
}
