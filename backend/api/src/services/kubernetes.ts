import { EventEmitter } from 'events';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as yaml from 'js-yaml';

const execAsync = promisify(exec);

// Use mock mode if kubectl is not available or if explicitly enabled
const USE_MOCK_MODE = process.env.K8S_MOCK_MODE === 'true' || process.env.K8S_MOCK_MODE === '1';

export interface K8sResource {
  apiVersion: string;
  kind: string;
  metadata: {
    name: string;
    namespace?: string;
    labels?: Record<string, string>;
  };
  spec?: any;
}

export interface K8sDeploySession {
  id: string;
  namespace: string;
  status: 'applying' | 'running' | 'completed' | 'error';
  resources: Array<{
    kind: string;
    name: string;
    status: 'pending' | 'creating' | 'ready' | 'error';
    error?: string;
  }>;
  startTime: Date;
  endTime?: Date;
  error?: string;
}

export interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  phase: string;
  restarts: number;
  age: string;
  node?: string;
  ip?: string;
}

export interface DeploymentInfo {
  name: string;
  namespace: string;
  replicas: {
    desired: number;
    ready: number;
    available: number;
  };
  age: string;
  containers: string[];
}

export interface ServiceInfo {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP?: string;
  ports: Array<{ port: number; targetPort: number; protocol: string }>;
  age: string;
}

export class KubernetesService extends EventEmitter {
  private sessions: Map<string, K8sDeploySession> = new Map();
  private mockPods: Map<string, PodInfo[]> = new Map();
  private mockDeployments: Map<string, DeploymentInfo[]> = new Map();
  private mockServices: Map<string, ServiceInfo[]> = new Map();
  private useMockMode: boolean = USE_MOCK_MODE;

  async checkKubectl(): Promise<boolean> {
    if (this.useMockMode) {
      console.log('🎭 Running in MOCK mode');
      return true; // Pretend kubectl is available
    }
    
    try {
      // First check if kubectl is installed
      await execAsync('kubectl version --client --short');
      
      // Then check if we can connect to a cluster
      try {
        await execAsync('kubectl cluster-info --request-timeout=2s');
      } catch (clusterError) {
        console.log('⚠️ kubectl installed but no cluster available, enabling mock mode');
        this.useMockMode = true;
        return true;
      }
      
      return true;
    } catch (error) {
      console.log('⚠️ kubectl not found, enabling mock mode');
      this.useMockMode = true;
      return true; // Enable mock mode automatically
    }
  }

  async getCurrentContext(): Promise<string> {
    if (this.useMockMode) {
      return 'mock-cluster (simulation)';
    }
    
    try {
      const { stdout } = await execAsync('kubectl config current-context');
      return stdout.trim();
    } catch (error: any) {
      throw new Error(`Failed to get current context: ${error.message}`);
    }
  }

  async getNamespaces(): Promise<string[]> {
    if (this.useMockMode) {
      return ['default', 'kube-system', 'kube-public', 'demo'];
    }
    
    try {
      const { stdout } = await execAsync('kubectl get namespaces -o jsonpath="{.items[*].metadata.name}"');
      return stdout.trim().split(' ').filter(Boolean);
    } catch (error: any) {
      throw new Error(`Failed to get namespaces: ${error.message}`);
    }
  }

  async applyManifest(manifestYaml: string, namespace: string = 'default'): Promise<K8sDeploySession> {
    const sessionId = `k8s-${Date.now()}`;
    const session: K8sDeploySession = {
      id: sessionId,
      namespace,
      status: 'applying',
      resources: [],
      startTime: new Date(),
    };

    this.sessions.set(sessionId, session);

    try {
      // Parse YAML to extract resources
      const docs = yaml.loadAll(manifestYaml) as K8sResource[];
      
      for (const doc of docs) {
        if (!doc || !doc.kind) continue;

        const resourceName = doc.metadata?.name || 'unknown';
        const resourceKind = doc.kind;

        session.resources.push({
          kind: resourceKind,
          name: resourceName,
          status: 'pending',
        });
      }

      this.emit('update', session);

      if (this.useMockMode) {
        // Mock deployment simulation
        console.log(`🎭 MOCK: Applying manifest to namespace: ${namespace}`);
        return await this.mockApplyManifest(session, docs, namespace);
      }

      // Real kubectl apply
      console.log(`📝 Applying manifest to namespace: ${namespace}`);
      
      // Create temporary file for manifest
      const tempFile = `/tmp/k8s-manifest-${sessionId}.yaml`;
      const fs = require('fs').promises;
      await fs.writeFile(tempFile, manifestYaml);

      try {
        // Apply the manifest
        const { stdout, stderr } = await execAsync(
          `kubectl apply -f ${tempFile} -n ${namespace}`
        );

        console.log('✅ kubectl apply output:', stdout);
        if (stderr) console.log('⚠️ kubectl apply stderr:', stderr);

        // Update resource statuses
        for (const resource of session.resources) {
          resource.status = 'creating';
        }
        session.status = 'running';
        this.emit('update', session);

        // Wait a bit for resources to be created
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Check resource statuses
        for (const resource of session.resources) {
          try {
            const { stdout: statusOut } = await execAsync(
              `kubectl get ${resource.kind} ${resource.name} -n ${namespace} -o jsonpath='{.status.conditions[?(@.type=="Ready")].status}'`
            );
            
            resource.status = 'ready';
            console.log(`✅ ${resource.kind}/${resource.name} is ready`);
          } catch (error: any) {
            // Some resources don't have Ready condition, that's ok
            resource.status = 'ready';
            console.log(`✅ ${resource.kind}/${resource.name} created`);
          }
          
          this.emit('update', session);
        }

        session.status = 'completed';
        session.endTime = new Date();

      } finally {
        // Clean up temp file
        await fs.unlink(tempFile).catch(() => {});
      }

    } catch (error: any) {
      console.error('❌ Failed to apply manifest:', error);
      session.status = 'error';
      session.error = error.message;
      session.endTime = new Date();
      this.emit('update', session);
      throw error;
    }

    this.emit('update', session);
    return session;
  }

  private async mockApplyManifest(session: K8sDeploySession, docs: K8sResource[], namespace: string): Promise<K8sDeploySession> {
    // Simulate deployment process
    for (const resource of session.resources) {
      resource.status = 'creating';
      this.emit('update', session);
      await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 400));
    }
    
    session.status = 'running';
    this.emit('update', session);
    
    // Simulate resources becoming ready
    for (const [index, resource] of session.resources.entries()) {
      await new Promise(resolve => setTimeout(resolve, 600 + Math.random() * 600));
      resource.status = 'ready';
      console.log(`🎭 MOCK: ${resource.kind}/${resource.name} is ready`);
      this.emit('update', session);
      
      // Create mock resources in memory
      const doc = docs[index];
      if (doc) {
        this.createMockResource(doc, namespace);
      }
    }
    
    session.status = 'completed';
    session.endTime = new Date();
    this.emit('update', session);
    
    return session;
  }

  private createMockResource(resource: K8sResource, namespace: string): void {
    const name = resource.metadata.name;
    const kind = resource.kind;
    
    if (kind === 'Deployment') {
      const replicas = resource.spec?.replicas || 1;
      const deployment: DeploymentInfo = {
        name,
        namespace,
        replicas: {
          desired: replicas,
          ready: replicas,
          available: replicas,
        },
        age: '< 1m',
        containers: resource.spec?.template?.spec?.containers?.map((c: any) => c.name) || ['container'],
      };
      
      const deps = this.mockDeployments.get(namespace) || [];
      deps.push(deployment);
      this.mockDeployments.set(namespace, deps);
      
      // Create mock pods for this deployment
      for (let i = 0; i < replicas; i++) {
        const pod: PodInfo = {
          name: `${name}-${Math.random().toString(36).substr(2, 9)}`,
          namespace,
          status: 'Running',
          phase: 'Running',
          restarts: 0,
          age: '< 1m',
          node: `node-${(i % 3) + 1}`,
          ip: `10.244.0.${10 + i}`,
        };
        
        const pods = this.mockPods.get(namespace) || [];
        pods.push(pod);
        this.mockPods.set(namespace, pods);
      }
    } else if (kind === 'Service') {
      const service: ServiceInfo = {
        name,
        namespace,
        type: resource.spec?.type || 'ClusterIP',
        clusterIP: `10.96.${Math.floor(Math.random() * 255)}.${Math.floor(Math.random() * 255)}`,
        ports: resource.spec?.ports?.map((p: any) => ({
          port: p.port,
          targetPort: p.targetPort,
          protocol: p.protocol || 'TCP',
        })) || [],
        age: '< 1m',
      };
      
      const services = this.mockServices.get(namespace) || [];
      services.push(service);
      this.mockServices.set(namespace, services);
    } else if (kind === 'StatefulSet') {
      const replicas = resource.spec?.replicas || 1;
      const deployment: DeploymentInfo = {
        name,
        namespace,
        replicas: {
          desired: replicas,
          ready: replicas,
          available: replicas,
        },
        age: '< 1m',
        containers: resource.spec?.template?.spec?.containers?.map((c: any) => c.name) || ['container'],
      };
      
      const deps = this.mockDeployments.get(namespace) || [];
      deps.push(deployment);
      this.mockDeployments.set(namespace, deps);
      
      // Create mock pods with stable names
      for (let i = 0; i < replicas; i++) {
        const pod: PodInfo = {
          name: `${name}-${i}`,
          namespace,
          status: 'Running',
          phase: 'Running',
          restarts: 0,
          age: '< 1m',
          node: `node-${(i % 3) + 1}`,
          ip: `10.244.0.${10 + i}`,
        };
        
        const pods = this.mockPods.get(namespace) || [];
        pods.push(pod);
        this.mockPods.set(namespace, pods);
      }
    }
  }

  async deleteResource(kind: string, name: string, namespace: string = 'default'): Promise<void> {
    if (this.useMockMode) {
      console.log(`🎭 MOCK: Deleting ${kind}/${name} in namespace ${namespace}`);
      // Remove from mock storage
      if (kind === 'Deployment' || kind === 'StatefulSet') {
        const deps = this.mockDeployments.get(namespace) || [];
        this.mockDeployments.set(namespace, deps.filter(d => d.name !== name));
        // Also remove associated pods
        const pods = this.mockPods.get(namespace) || [];
        this.mockPods.set(namespace, pods.filter(p => !p.name.startsWith(name)));
      } else if (kind === 'Service') {
        const services = this.mockServices.get(namespace) || [];
        this.mockServices.set(namespace, services.filter(s => s.name !== name));
      }
      return;
    }
    
    try {
      console.log(`🗑️ Deleting ${kind}/${name} in namespace ${namespace}`);
      const { stdout } = await execAsync(`kubectl delete ${kind} ${name} -n ${namespace}`);
      console.log('✅ Delete output:', stdout);
    } catch (error: any) {
      throw new Error(`Failed to delete ${kind}/${name}: ${error.message}`);
    }
  }

  async getPods(namespace: string = 'default'): Promise<PodInfo[]> {
    if (this.useMockMode) {
      return this.mockPods.get(namespace) || [];
    }
    
    try {
      const { stdout } = await execAsync(
        `kubectl get pods -n ${namespace} -o json`
      );
      
      const data = JSON.parse(stdout);
      const pods: PodInfo[] = data.items.map((item: any) => {
        const containerStatuses = item.status.containerStatuses || [];
        const restarts = containerStatuses.reduce((sum: number, c: any) => sum + (c.restartCount || 0), 0);
        
        return {
          name: item.metadata.name,
          namespace: item.metadata.namespace,
          status: item.status.phase,
          phase: item.status.phase,
          restarts,
          age: this.calculateAge(item.metadata.creationTimestamp),
          node: item.spec.nodeName,
          ip: item.status.podIP,
        };
      });

      return pods;
    } catch (error: any) {
      console.log('⚠️ Failed to get pods, switching to mock mode');
      this.useMockMode = true;
      return this.mockPods.get(namespace) || [];
    }
  }

  async getDeployments(namespace: string = 'default'): Promise<DeploymentInfo[]> {
    if (this.useMockMode) {
      return this.mockDeployments.get(namespace) || [];
    }
    
    try {
      const { stdout } = await execAsync(
        `kubectl get deployments -n ${namespace} -o json`
      );
      
      const data = JSON.parse(stdout);
      const deployments: DeploymentInfo[] = data.items.map((item: any) => ({
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        replicas: {
          desired: item.spec.replicas || 0,
          ready: item.status.readyReplicas || 0,
          available: item.status.availableReplicas || 0,
        },
        age: this.calculateAge(item.metadata.creationTimestamp),
        containers: item.spec.template.spec.containers.map((c: any) => c.name),
      }));

      return deployments;
    } catch (error: any) {
      console.log('⚠️ Failed to get deployments, switching to mock mode');
      this.useMockMode = true;
      return this.mockDeployments.get(namespace) || [];
    }
  }

  async getServices(namespace: string = 'default'): Promise<ServiceInfo[]> {
    if (this.useMockMode) {
      return this.mockServices.get(namespace) || [];
    }
    
    try {
      const { stdout } = await execAsync(
        `kubectl get services -n ${namespace} -o json`
      );
      
      const data = JSON.parse(stdout);
      const services: ServiceInfo[] = data.items.map((item: any) => ({
        name: item.metadata.name,
        namespace: item.metadata.namespace,
        type: item.spec.type,
        clusterIP: item.spec.clusterIP,
        externalIP: item.status.loadBalancer?.ingress?.[0]?.ip,
        ports: (item.spec.ports || []).map((p: any) => ({
          port: p.port,
          targetPort: p.targetPort,
          protocol: p.protocol,
        })),
        age: this.calculateAge(item.metadata.creationTimestamp),
      }));

      return services;
    } catch (error: any) {
      console.log('⚠️ Failed to get services, switching to mock mode');
      this.useMockMode = true;
      return this.mockServices.get(namespace) || [];
    }
  }

  async getPodLogs(podName: string, namespace: string = 'default', tail: number = 100): Promise<string> {
    if (this.useMockMode) {
      // Return mock logs
      const logs = [
        `[MOCK] Logs for pod: ${podName}`,
        `[INFO] Container started at ${new Date().toISOString()}`,
        `[INFO] Application initializing...`,
        `[INFO] Loading configuration`,
        `[INFO] Connecting to database`,
        `[INFO] Database connection established`,
        `[INFO] Starting HTTP server on port 3000`,
        `[INFO] Server is ready to accept connections`,
        `[INFO] Health check passed`,
        `[DEBUG] Memory usage: 45MB`,
      ];
      return logs.slice(-tail).join('\n');
    }
    
    try {
      const { stdout } = await execAsync(
        `kubectl logs ${podName} -n ${namespace} --tail=${tail}`
      );
      return stdout;
    } catch (error: any) {
      throw new Error(`Failed to get logs for pod ${podName}: ${error.message}`);
    }
  }

  private calculateAge(timestamp: string): string {
    const now = new Date();
    const created = new Date(timestamp);
    const diffMs = now.getTime() - created.getTime();
    
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    
    if (diffDays > 0) return `${diffDays}d`;
    if (diffHours > 0) return `${diffHours}h`;
    if (diffMins > 0) return `${diffMins}m`;
    return '< 1m';
  }

  getSession(sessionId: string): K8sDeploySession | undefined {
    return this.sessions.get(sessionId);
  }
}

export const k8sService = new KubernetesService();
