import Docker from 'dockerode';
import { EventEmitter } from 'events';

const docker = new Docker();

export interface ComposeService {
  name: string;
  image?: string;
  build?: {
    context: string;
    dockerfile?: string;
  };
  ports?: string[];
  environment?: Record<string, string>;
  depends_on?: string[];
  volumes?: string[];
  networks?: string[];
  command?: string | string[];
}

export interface ComposeConfig {
  version: string;
  services: Record<string, ComposeService>;
  networks?: Record<string, any>;
  volumes?: Record<string, any>;
}

export interface ComposeSession {
  id: string;
  projectName: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  services: Record<string, {
    containerId?: string;
    status: 'pending' | 'building' | 'starting' | 'running' | 'stopped' | 'error';
    error?: string;
  }>;
  startTime: Date;
  error?: string;
}

export class DockerComposeService extends EventEmitter {
  private sessions: Map<string, ComposeSession> = new Map();

  parseComposeYAML(yaml: string): ComposeConfig {
    const lines = yaml.split('\n');
    const config: ComposeConfig = { version: '3.8', services: {} };
    let currentService: string | null = null;
    let currentSection: 'services' | 'networks' | 'volumes' | null = null;
    let serviceIndentLevel = -1;
    let currentSubSection: string | null = null;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S/);

      // Version
      if (trimmed.startsWith('version:')) {
        config.version = trimmed.split(':')[1].trim().replace(/['"]/g, '');
        continue;
      }

      // Top level sections
      if (trimmed === 'services:' && indent === 0) {
        currentSection = 'services';
        serviceIndentLevel = -1; // Will be set when first service is found
        continue;
      }
      if (trimmed === 'networks:' && indent === 0) {
        currentSection = 'networks';
        currentService = null;
        config.networks = {};
        continue;
      }
      if (trimmed === 'volumes:' && indent === 0) {
        currentSection = 'volumes';
        currentService = null;
        config.volumes = {};
        continue;
      }

      if (currentSection === 'services') {
        // Service name - any line ending with : at the first level under services
        if (trimmed.endsWith(':') && !trimmed.includes(' ') && trimmed !== 'services:') {
          // Check if this is a service name (not a subsection like 'build:', 'ports:', etc.)
          const potentialServiceName = trimmed.slice(0, -1);
          const knownSubSections = ['build', 'environment', 'ports', 'depends_on', 'volumes', 'networks', 'healthcheck', 'labels', 'restart', 'command'];
          
          if (!knownSubSections.includes(potentialServiceName)) {
            // This is a new service
            if (serviceIndentLevel === -1) {
              serviceIndentLevel = indent;
            }
            
            if (indent === serviceIndentLevel) {
              currentService = potentialServiceName;
              config.services[currentService] = { name: currentService };
              currentSubSection = null;
              continue;
            }
          }
        }

        if (currentService && indent > serviceIndentLevel) {
          const service = config.services[currentService];

          // Subsections
          if (trimmed === 'build:') {
            currentSubSection = 'build';
            service.build = { context: '.' };
            continue;
          }
          if (trimmed === 'environment:') {
            currentSubSection = 'environment';
            service.environment = {};
            continue;
          }
          if (trimmed === 'ports:') {
            currentSubSection = 'ports';
            service.ports = [];
            continue;
          }
          if (trimmed === 'depends_on:') {
            currentSubSection = 'depends_on';
            service.depends_on = [];
            continue;
          }
          if (trimmed === 'volumes:') {
            currentSubSection = 'volumes';
            service.volumes = [];
            continue;
          }
          if (trimmed === 'networks:') {
            currentSubSection = 'networks';
            service.networks = [];
            continue;
          }

          // Properties
          // Check for single-line properties first (these reset currentSubSection)
          if (trimmed.startsWith('image:') && !trimmed.startsWith('-')) {
            service.image = trimmed.split(':').slice(1).join(':').trim();
            currentSubSection = null;
            continue;
          }
          if (trimmed.startsWith('command:') && !trimmed.startsWith('-')) {
            const cmdValue = trimmed.substring('command:'.length).trim();
            // Parse command - it can be a string or array
            if (cmdValue.startsWith('[')) {
              // Array format: command: ["sleep", "infinity"]
              service.command = JSON.parse(cmdValue);
            } else {
              // String format: command: sleep infinity
              service.command = cmdValue.split(' ');
            }
            currentSubSection = null;
            continue;
          }
          
          // Process subsection items
          if (currentSubSection === 'build') {
            if (trimmed.startsWith('context:')) {
              service.build!.context = trimmed.split(':')[1].trim();
            } else if (trimmed.startsWith('dockerfile:')) {
              service.build!.dockerfile = trimmed.split(':')[1].trim();
            }
          } else if (currentSubSection === 'environment') {
            if (trimmed.includes(':') && !trimmed.startsWith('-')) {
              const [key, ...valueParts] = trimmed.split(':');
              service.environment![key.trim()] = valueParts.join(':').trim();
            }
          } else if (currentSubSection === 'ports') {
            if (trimmed.startsWith('-')) {
              service.ports!.push(trimmed.substring(1).trim().replace(/['"]/g, ''));
            }
          } else if (currentSubSection === 'depends_on') {
            if (trimmed.startsWith('-')) {
              service.depends_on!.push(trimmed.substring(1).trim());
            }
          } else if (currentSubSection === 'volumes') {
            if (trimmed.startsWith('-')) {
              service.volumes!.push(trimmed.substring(1).trim());
            }
          } else if (currentSubSection === 'networks') {
            if (trimmed.startsWith('-')) {
              service.networks!.push(trimmed.substring(1).trim());
            }
          }
        }
      }

      // Parse network names
      if (currentSection === 'networks') {
        if (indent === 2 && trimmed.endsWith(':')) {
          const networkName = trimmed.slice(0, -1);
          config.networks![networkName] = { driver: 'bridge' };
        } else if (trimmed.startsWith('driver:')) {
          // Network driver config
          const lastNetwork = Object.keys(config.networks || {}).pop();
          if (lastNetwork && config.networks) {
            config.networks[lastNetwork].driver = trimmed.split(':')[1].trim();
          }
        }
      }

      // Parse volume names
      if (currentSection === 'volumes') {
        if (indent === 2 && trimmed.endsWith(':')) {
          const volumeName = trimmed.slice(0, -1);
          config.volumes![volumeName] = {};
        }
      }
    }

    return config;
  }

  private parsePortMapping(portStr: string): { host: number; container: number } | null {
    const match = portStr.match(/^(\d+):(\d+)$/);
    if (match) {
      return { host: parseInt(match[1]), container: parseInt(match[2]) };
    }
    return null;
  }

  private topologicalSort(services: Record<string, ComposeService>): string[] {
    const sorted: string[] = [];
    const visited = new Set<string>();
    const visiting = new Set<string>();

    const visit = (name: string) => {
      if (visited.has(name)) return;
      if (visiting.has(name)) {
        throw new Error(`Circular dependency detected: ${name}`);
      }

      visiting.add(name);

      const service = services[name];
      if (service.depends_on) {
        for (const dep of service.depends_on) {
          if (services[dep]) {
            visit(dep);
          }
        }
      }

      visiting.delete(name);
      visited.add(name);
      sorted.push(name);
    };

    for (const name of Object.keys(services)) {
      visit(name);
    }

    return sorted;
  }

  async composeUp(composeYaml: string, projectName: string = 'cloud-dojo'): Promise<ComposeSession> {
    const sessionId = `compose-${Date.now()}`;
    const config = this.parseComposeYAML(composeYaml);

    console.log('📋 Parsed services:');
    Object.entries(config.services).forEach(([name, service]) => {
      console.log(`  ${name}:`, { image: service.image, command: service.command });
    });

    const session: ComposeSession = {
      id: sessionId,
      projectName,
      status: 'starting',
      services: {},
      startTime: new Date()
    };

    // Initialize service statuses
    for (const serviceName of Object.keys(config.services)) {
      session.services[serviceName] = { status: 'pending' };
    }

    this.sessions.set(sessionId, session);
    this.emit('update', session);

    try {
      // Sort services by dependencies
      const serviceOrder = this.topologicalSort(config.services);
      console.log('🚀 Starting services in order:', serviceOrder.join(' -> '));

      // Create network if needed
      if (config.networks && Object.keys(config.networks).length > 0) {
        for (const networkName of Object.keys(config.networks)) {
          try {
            await docker.getNetwork(`${projectName}_${networkName}`).inspect();
          } catch {
            await docker.createNetwork({
              Name: `${projectName}_${networkName}`,
              Driver: 'bridge'
            });
          }
        }
      }

      // Start services in dependency order
      console.log(`🚀 Starting ${serviceOrder.length} services...`);
      
      for (const serviceName of serviceOrder) {
        const service = config.services[serviceName];
        session.services[serviceName].status = 'starting';
        this.emit('update', session);

        try {
          // Remove any existing container with the same name
          try {
            const existingContainer = docker.getContainer(`${projectName}_${serviceName}`);
            const containerInfo = await existingContainer.inspect();
            if (containerInfo.State.Running) {
              await existingContainer.stop();
            }
            await existingContainer.remove();
          } catch {
            // Container doesn't exist, which is fine
          }

          // Determine image name
          let imageName: string;
          
          if (service.image) {
            // Use specified image
            imageName = service.image;
          } else if (service.build) {
            // Use build tag or generate from project and service name
            imageName = `${projectName}_${serviceName}:latest`;
          } else {
            throw new Error(`Service ${serviceName} must specify either 'image' or 'build'`);
          }

          // Create container config
          const containerConfig: any = {
            name: `${projectName}_${serviceName}`,
            Image: imageName,
            Env: [],
            HostConfig: {
              PortBindings: {},
              Binds: [],
              NetworkMode: config.networks 
                ? `${projectName}_${Object.keys(config.networks)[0]}` 
                : 'bridge'
            }
          };

          // Command
          if (service.command) {
            containerConfig.Cmd = Array.isArray(service.command) 
              ? service.command 
              : service.command.split(' ');
          }

          // Environment variables
          if (service.environment) {
            containerConfig.Env = Object.entries(service.environment).map(
              ([key, value]) => `${key}=${value}`
            );
          }

          // Command
          if (service.command) {
            containerConfig.Cmd = Array.isArray(service.command) 
              ? service.command 
              : service.command.split(' ');
          }

          // Port mappings
          if (service.ports) {
            containerConfig.ExposedPorts = {};
            for (const portStr of service.ports) {
              const portMap = this.parsePortMapping(portStr);
              if (portMap) {
                const containerPort = `${portMap.container}/tcp`;
                containerConfig.ExposedPorts[containerPort] = {};
                containerConfig.HostConfig.PortBindings[containerPort] = [
                  { HostPort: portMap.host.toString() }
                ];
              }
            }
          }

          // Volumes
          if (service.volumes) {
            for (const volStr of service.volumes) {
              const [host, container] = volStr.split(':');
              if (host && container) {
                // Check if it's a named volume
                if (!host.startsWith('/') && !host.startsWith('.')) {
                  // Named volume - ensure it exists
                  try {
                    await docker.getVolume(`${projectName}_${host}`).inspect();
                  } catch {
                    await docker.createVolume({ Name: `${projectName}_${host}` });
                  }
                  containerConfig.HostConfig.Binds.push(`${projectName}_${host}:${container}`);
                } else {
                  containerConfig.HostConfig.Binds.push(volStr);
                }
              }
            }
          }

          // Check if image exists
          let imageExists = false;
          try {
            await docker.getImage(imageName).inspect();
            imageExists = true;
          } catch {
            imageExists = false;
          }

          // If image doesn't exist, handle based on whether build or image is specified
          if (!imageExists) {
            if (service.build) {
              // Image needs to be built first
              const buildContext = service.build.context || '.';
              const dockerfile = service.build.dockerfile || 'Dockerfile';
              
              throw new Error(
                `Image '${imageName}' does not exist for service '${serviceName}'. ` +
                `Please build the image first using:\n` +
                `  docker build -t ${imageName} -f ${buildContext}/${dockerfile} ${buildContext}\n` +
                `Or use the Docker Build page in Cloud Dojo.`
              );
            } else if (service.image) {
              // Pull image if it doesn't exist
              session.services[serviceName].status = 'building';
              this.emit('update', session);
              
              await new Promise((resolve, reject) => {
                docker.pull(service.image!, (err: any, stream: any) => {
                  if (err) return reject(err);
                  docker.modem.followProgress(stream, (err: any) => {
                    if (err) return reject(err);
                    resolve(null);
                  });
                });
              });
            }
          }

          // Create and start container
          const container = await docker.createContainer(containerConfig);
          
          await container.start();

          session.services[serviceName].containerId = container.id;
          session.services[serviceName].status = 'running';
          this.emit('update', session);
          
          console.log(`✅ Service ${serviceName} is now running`);

        } catch (error: any) {
          console.error(`❌ Failed to start service ${serviceName}:`, error.message);
          session.services[serviceName].status = 'error';
          session.services[serviceName].error = error.message;
          this.emit('update', session);
          // Continue with other services instead of throwing
        }
      }

      console.log(`\n📊 Final service status check...`);
      
      // Wait a bit for containers to settle
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Re-check all container states
      for (const serviceName of Object.keys(session.services)) {
        if (session.services[serviceName].containerId) {
          try {
            const container = docker.getContainer(session.services[serviceName].containerId!);
            const containerInfo = await container.inspect();
            if (!containerInfo.State.Running && session.services[serviceName].status === 'running') {
              console.error(`⚠️ Service ${serviceName} is not running (exit code: ${containerInfo.State.ExitCode})`);
              session.services[serviceName].status = 'error';
              session.services[serviceName].error = `Container exited with code ${containerInfo.State.ExitCode}`;
            }
          } catch (err) {
            console.error(`⚠️ Failed to inspect ${serviceName}:`, err);
          }
        }
      }
      
      // Check if all services are running or if some failed
      const allRunning = Object.values(session.services).every(s => s.status === 'running');
      const anyError = Object.values(session.services).some(s => s.status === 'error');
      console.log(`  - All running: ${allRunning}`);
      console.log(`  - Any errors: ${anyError}`);
      
      if (allRunning) {
        session.status = 'running';
        console.log(`✅ All services started successfully`);
      } else if (anyError) {
        session.status = 'error';
        const errors = Object.entries(session.services)
          .filter(([_, s]) => s.status === 'error')
          .map(([name, s]) => `${name}: ${s.error}`)
          .join('; ');
        session.error = `Some services failed to start: ${errors}`;
        console.log(`⚠️ Some services failed`);
      } else {
        session.status = 'running'; // Partial success
      }
      
      this.emit('update', session);
      console.log(`📡 Sent final session update to frontend`);

    } catch (error: any) {
      session.status = 'error';
      session.error = error.message;
      this.emit('update', session);
    }

    return session;
  }

  async composeDown(projectName: string = 'cloud-dojo'): Promise<void> {
    try {
      // List all containers with the project prefix
      const containers = await docker.listContainers({ all: true });
      const projectContainers = containers.filter(c => 
        c.Names[0]?.replace(/^\//, '').startsWith(`${projectName}_`)
      );
      
      const totalSteps = projectContainers.length + 1; // containers + networks
      let currentStep = 0;
      
      this.emit('down:progress', {
        projectName,
        progress: 0,
        status: 'stopping_containers',
        message: `Stopping ${projectContainers.length} containers...`,
      });
      
      for (const containerInfo of projectContainers) {
        const containerName = containerInfo.Names[0]?.replace(/^\//, '');
        const serviceName = containerName?.replace(`${projectName}_`, '');
        
        console.log(`🛑 Stopping container: ${containerName}`);
        this.emit('down:progress', {
          projectName,
          progress: Math.round((currentStep / totalSteps) * 100),
          status: 'stopping',
          message: `Stopping ${serviceName}...`,
          currentService: serviceName,
        });
        
        const container = docker.getContainer(containerInfo.Id);
        
        // Stop if running
        if (containerInfo.State === 'running') {
          await container.stop();
          console.log(`✅ Stopped: ${containerName}`);
        }
        
        // Remove container
        await container.remove();
        console.log(`🗑️ Removed: ${containerName}`);
        
        currentStep++;
        this.emit('down:progress', {
          projectName,
          progress: Math.round((currentStep / totalSteps) * 100),
          status: 'removed',
          message: `Removed ${serviceName}`,
          currentService: serviceName,
        });
      }

      // Remove networks
      console.log('🌐 Removing networks...');
      this.emit('down:progress', {
        projectName,
        progress: Math.round((currentStep / totalSteps) * 100),
        status: 'removing_networks',
        message: 'Removing networks...',
      });
      
      const networks = await docker.listNetworks();
      for (const networkInfo of networks) {
        if (networkInfo.Name?.startsWith(`${projectName}_`)) {
          const network = docker.getNetwork(networkInfo.Id);
          try {
            await network.remove();
            console.log(`✅ Removed network: ${networkInfo.Name}`);
          } catch (networkError: any) {
            // If network has active endpoints, log warning but don't fail
            if (networkError.message?.includes('has active endpoints')) {
              console.warn(`⚠️ Cannot remove network ${networkInfo.Name}: still has active endpoints`);
            } else {
              throw networkError;
            }
          }
        }
      }

      this.emit('down:progress', {
        projectName,
        progress: 100,
        status: 'completed',
        message: 'Compose down completed',
      });
      
      console.log('✅ Compose down completed');

      // Note: We don't remove volumes by default (like docker-compose down)
      // Use composeDownVolumes() for that

    } catch (error: any) {
      this.emit('down:progress', {
        projectName,
        progress: 0,
        status: 'error',
        message: error.message,
      });
      throw new Error(`Failed to stop compose project: ${error.message}`);
    }
  }

  async composeDownVolumes(projectName: string = 'cloud-dojo'): Promise<void> {
    await this.composeDown(projectName);

    // Remove volumes
    const volumes = await docker.listVolumes();
    if (volumes.Volumes) {
      for (const volumeInfo of volumes.Volumes) {
        if (volumeInfo.Name?.startsWith(`${projectName}_`)) {
          const volume = docker.getVolume(volumeInfo.Name);
          await volume.remove();
        }
      }
    }
  }

  async getComposeStatus(projectName: string = 'cloud-dojo'): Promise<Record<string, any>> {
    const containers = await docker.listContainers({ all: true });
    const status: Record<string, any> = {};

    for (const containerInfo of containers) {
      const containerName = containerInfo.Names[0]?.replace(/^\//, '');
      if (containerName?.startsWith(`${projectName}_`)) {
        const serviceName = containerName.replace(`${projectName}_`, '');
        status[serviceName] = {
          id: containerInfo.Id,
          state: containerInfo.State,
          status: containerInfo.Status,
          image: containerInfo.Image,
          ports: containerInfo.Ports
        };
      }
    }

    return status;
  }

  getSession(sessionId: string): ComposeSession | undefined {
    return this.sessions.get(sessionId);
  }
}

export const composeService = new DockerComposeService();
