import Docker from 'dockerode';
import { EventEmitter } from 'events';

const docker = new Docker();

export interface BuildStep {
  step: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  command: string;
  output: string;
  timestamp: Date;
}

export interface BuildSession {
  id: string;
  status: 'preparing' | 'building' | 'completed' | 'error';
  currentStep: number;
  totalSteps: number;
  steps: BuildStep[];
  imageId?: string;
  imageName?: string;
  imageTag?: string;
  imageSize?: number;
  startTime: Date;
  endTime?: Date;
  error?: string;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: Date;
  ports: Array<{ private: number; public?: number; type: string }>;
}

export interface ContainerCreateOptions {
  imageName: string;
  containerName?: string;
  ports?: Array<{ container: number; host: number }>;
  env?: Array<string>;
  volumes?: Array<{ host: string; container: string }>;
  cmd?: string[];
}

export class DockerService extends EventEmitter {
  private buildSessions: Map<string, BuildSession> = new Map();

  async buildImage(
    sessionId: string,
    dockerfile: string,
    imageName: string,
    imageTag: string = 'latest'
  ): Promise<BuildSession> {
    const session: BuildSession = {
      id: sessionId,
      status: 'preparing',
      currentStep: 0,
      totalSteps: 0,
      steps: [],
      imageName,
      imageTag,
      startTime: new Date(),
    };

    this.buildSessions.set(sessionId, session);
    this.emit('update', session);

    try {
      // Dockerfile を一時ディレクトリに作成
      const path = await import('path');
      const fs = await import('fs/promises');
      const os = await import('os');
      const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'cloud-dojo-'));
      const dockerfilePath = path.join(tmpDir, 'Dockerfile');
      await fs.writeFile(dockerfilePath, dockerfile);

      session.status = 'building';
      this.emit('update', session);

      // Docker イメージをビルド
      const stream = await docker.buildImage(
        {
          context: tmpDir,
          src: ['Dockerfile'],
        },
        {
          t: `${imageName}:${imageTag}`,
        }
      );

      // ビルド進捗を監視
      await new Promise<BuildSession>((resolve, reject) => {
        let stepNumber = 0;

        docker.modem.followProgress(
          stream,
          (err, res) => {
            if (err) {
              session.status = 'error';
              session.error = err.message;
              session.endTime = new Date();
              this.emit('update', session);
              reject(err);
            } else {
              // ビルド完了後にイメージ情報を取得
              docker
                .getImage(`${imageName}:${imageTag}`)
                .inspect()
                .then((imageInfo) => {
                  session.status = 'completed';
                  session.imageId = imageInfo.Id;
                  session.imageSize = imageInfo.Size;
                  session.endTime = new Date();
                  this.emit('update', session);
                  resolve(session);
                })
                .catch(() => {
                  session.status = 'completed';
                  session.endTime = new Date();
                  this.emit('update', session);
                  resolve(session);
                });
            }
          },
          (event) => {
            if (event.stream) {
              const output = event.stream.trim();
              
              // ステップの検出
              if (output.match(/^Step \d+\/\d+/)) {
                const match = output.match(/^Step (\d+)\/(\d+) : (.+)/);
                if (match) {
                  stepNumber = parseInt(match[1]);
                  session.totalSteps = parseInt(match[2]);
                  
                  const step: BuildStep = {
                    step: stepNumber,
                    status: 'running',
                    command: match[3],
                    output: '',
                    timestamp: new Date(),
                  };
                  
                  session.steps.push(step);
                  session.currentStep = stepNumber;
                  this.emit('update', session);
                }
              } else if (output && stepNumber > 0) {
                // 現在のステップに出力を追加
                const currentStep = session.steps.find(s => s.step === stepNumber);
                if (currentStep && currentStep.status === 'running') {
                  currentStep.output += output + '\n';
                  this.emit('update', session);
                }
              }
            }

            // ステップ完了の検出
            if (event.stream && event.stream.includes('---> ')) {
              const currentStep = session.steps.find(s => s.step === stepNumber);
              if (currentStep) {
                currentStep.status = 'completed';
                this.emit('update', session);
              }
            }
          }
        );
      });

      // 一時ディレクトリを削除
      await fs.rm(tmpDir, { recursive: true, force: true });
      
      return session;
    } catch (error) {
      session.status = 'error';
      session.error = error instanceof Error ? error.message : 'Unknown error';
      session.endTime = new Date();
      this.emit('update', session);
      throw error;
    }
  }

  async listContainers(all: boolean = false): Promise<ContainerInfo[]> {
    const containers = await docker.listContainers({ all });
    
    return containers.map((container) => ({
      id: container.Id,
      name: container.Names[0]?.replace(/^\//, '') || 'unknown',
      image: container.Image,
      status: container.Status,
      state: container.State,
      created: new Date(container.Created * 1000),
      ports: container.Ports.map((port) => ({
        private: port.PrivatePort,
        public: port.PublicPort,
        type: port.Type,
      })),
    }));
  }

  async listImages(): Promise<Array<{
    id: string;
    tags: string[];
    size: number;
    created: Date;
  }>> {
    const images = await docker.listImages();
    
    return images.map((image) => ({
      id: image.Id,
      tags: image.RepoTags || [],
      size: image.Size,
      created: new Date(image.Created * 1000),
    }));
  }

  async removeContainer(containerId: string, force: boolean = false): Promise<void> {
    const container = docker.getContainer(containerId);
    await container.remove({ force });
  }

  async removeImage(imageId: string, force: boolean = false): Promise<void> {
    const image = docker.getImage(imageId);
    await image.remove({ force });
  }

  async stopContainer(containerId: string): Promise<void> {
    const container = docker.getContainer(containerId);
    await container.stop();
  }

  async startContainer(containerId: string): Promise<void> {
    const container = docker.getContainer(containerId);
    await container.start();
  }

  async createAndRunContainer(options: ContainerCreateOptions): Promise<{ id: string; name: string }> {
    const portBindings: any = {};
    const exposedPorts: any = {};
    
    if (options.ports) {
      options.ports.forEach(({ container, host }) => {
        const key = `${container}/tcp`;
        exposedPorts[key] = {};
        portBindings[key] = [{ HostPort: host.toString() }];
      });
    }

    const binds: string[] = [];
    if (options.volumes) {
      options.volumes.forEach(({ host, container }) => {
        binds.push(`${host}:${container}`);
      });
    }

    const container = await docker.createContainer({
      Image: options.imageName,
      name: options.containerName,
      Env: options.env,
      Cmd: options.cmd,
      ExposedPorts: exposedPorts,
      HostConfig: {
        PortBindings: portBindings,
        Binds: binds.length > 0 ? binds : undefined,
      },
    });

    await container.start();

    const info = await container.inspect();
    return {
      id: info.Id,
      name: info.Name.replace(/^\//, ''),
    };
  }

  async getContainerLogs(containerId: string, tail: number = 100): Promise<string> {
    const container = docker.getContainer(containerId);
    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail,
      timestamps: true,
    });
    
    return logs.toString('utf-8');
  }

  async streamContainerLogs(
    containerId: string,
    onLog: (log: string) => void
  ): Promise<void> {
    const container = docker.getContainer(containerId);
    const stream = await container.logs({
      follow: true,
      stdout: true,
      stderr: true,
      timestamps: true,
    });

    stream.on('data', (chunk: Buffer) => {
      onLog(chunk.toString('utf-8'));
    });
  }

  getBuildSession(sessionId: string): BuildSession | undefined {
    return this.buildSessions.get(sessionId);
  }

  async getDockerInfo(): Promise<{
    version: string;
    containers: number;
    images: number;
    running: number;
  }> {
    const info = await docker.info();
    const version = await docker.version();
    
    return {
      version: version.Version,
      containers: info.Containers,
      images: info.Images,
      running: info.ContainersRunning,
    };
  }
}

export const dockerService = new DockerService();
