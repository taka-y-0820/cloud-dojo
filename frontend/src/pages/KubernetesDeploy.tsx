import { motion } from 'framer-motion';
import { 
  Network, Server, Database, Activity, CheckCircle2, AlertCircle, 
  Play, Loader2, FileText, BookOpen, Layers, Terminal, Trash2,
  RefreshCw, Box, Code, Zap, Globe, Shield
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

interface K8sDeploySession {
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

interface PodInfo {
  name: string;
  namespace: string;
  status: string;
  phase: string;
  restarts: number;
  age: string;
  node?: string;
  ip?: string;
}

interface DeploymentInfo {
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

interface ServiceInfo {
  name: string;
  namespace: string;
  type: string;
  clusterIP: string;
  externalIP?: string;
  ports: Array<{ port: number; targetPort: number; protocol: string }>;
  age: string;
}

const sampleManifest = `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nginx-deployment
  labels:
    app: nginx
spec:
  replicas: 3
  selector:
    matchLabels:
      app: nginx
  template:
    metadata:
      labels:
        app: nginx
    spec:
      containers:
      - name: nginx
        image: nginx:alpine
        ports:
        - containerPort: 80
---
apiVersion: v1
kind: Service
metadata:
  name: nginx-service
spec:
  selector:
    app: nginx
  ports:
  - protocol: TCP
    port: 80
    targetPort: 80
  type: ClusterIP`;

const manifestTemplates = [
  {
    name: 'Nginx Deployment',
    description: 'シンプルなWebサーバー',
    manifest: sampleManifest,
  },
  {
    name: 'Node.js App',
    description: 'Node.jsアプリケーション + Service',
    manifest: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: nodejs-app
  labels:
    app: nodejs
spec:
  replicas: 2
  selector:
    matchLabels:
      app: nodejs
  template:
    metadata:
      labels:
        app: nodejs
    spec:
      containers:
      - name: nodejs
        image: node:18-alpine
        command: ["sh", "-c", "sleep infinity"]
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
---
apiVersion: v1
kind: Service
metadata:
  name: nodejs-service
spec:
  selector:
    app: nodejs
  ports:
  - port: 80
    targetPort: 3000
  type: LoadBalancer`,
  },
  {
    name: 'PostgreSQL StatefulSet',
    description: 'ステートフルなデータベース',
    manifest: `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      containers:
      - name: postgres
        image: postgres:15-alpine
        ports:
        - containerPort: 5432
        env:
        - name: POSTGRES_USER
          value: admin
        - name: POSTGRES_PASSWORD
          value: password
        - name: POSTGRES_DB
          value: mydb
        volumeMounts:
        - name: data
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: data
    spec:
      accessModes: ["ReadWriteOnce"]
      resources:
        requests:
          storage: 1Gi
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
spec:
  selector:
    app: postgres
  ports:
  - port: 5432
  clusterIP: None`,
  },
];

export function KubernetesDeploy() {
  const [manifest, setManifest] = useState(sampleManifest);
  const [activeTab, setActiveTab] = useState<'learn' | 'deploy' | 'pods' | 'deployments' | 'services'>('learn');
  const [namespace, setNamespace] = useState('default');
  const [namespaces, setNamespaces] = useState<string[]>(['default']);
  const [isDeploying, setIsDeploying] = useState(false);
  const [currentSession, setCurrentSession] = useState<K8sDeploySession | null>(null);
  const [pods, setPods] = useState<PodInfo[]>([]);
  const [deployments, setDeployments] = useState<DeploymentInfo[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [kubectlAvailable, setKubectlAvailable] = useState(false);
  const [currentContext, setCurrentContext] = useState<string>('');
  
  const { lastMessage } = useWebSocket(WS_URL);

  // Check kubectl availability on mount
  useEffect(() => {
    checkKubectl();
    loadNamespaces();
  }, []);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('[K8s WebSocket]', lastMessage.type, lastMessage);

    if (lastMessage.type === 'k8s:session:update' && lastMessage.session) {
      setCurrentSession(lastMessage.session);
      
      if (lastMessage.session.status === 'completed' || lastMessage.session.status === 'error') {
        setIsDeploying(false);
        // Reload resources
        loadPods();
        loadDeployments();
        loadServices();
      }
    }
  }, [lastMessage]);

  const checkKubectl = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/k8s/check`);
      setKubectlAvailable(response.data.available);
      setCurrentContext(response.data.context || '');
      
      // Check if it's mock mode
      if (response.data.context?.includes('mock') || response.data.context?.includes('simulation')) {
        console.log('🎭 Running in mock/simulation mode');
      }
    } catch (error) {
      console.error('Failed to check kubectl:', error);
      setKubectlAvailable(false);
    }
  };

  const loadNamespaces = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/k8s/namespaces`);
      setNamespaces(response.data.namespaces || ['default']);
    } catch (error) {
      console.error('Failed to load namespaces:', error);
    }
  };

  const loadPods = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/k8s/pods`, {
        params: { namespace }
      });
      setPods(response.data.pods || []);
    } catch (error) {
      console.error('Failed to load pods:', error);
    }
  };

  const loadDeployments = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/k8s/deployments`, {
        params: { namespace }
      });
      setDeployments(response.data.deployments || []);
    } catch (error) {
      console.error('Failed to load deployments:', error);
    }
  };

  const loadServices = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/k8s/services`, {
        params: { namespace }
      });
      setServices(response.data.services || []);
    } catch (error) {
      console.error('Failed to load services:', error);
    }
  };

  const handleApply = async () => {
    try {
      setIsDeploying(true);
      setCurrentSession(null);
      
      const response = await axios.post(`${API_URL}/api/k8s/apply`, {
        manifest,
        namespace
      });
      
      console.log('K8s apply queued:', response.data);
      
      // Show info if in mock mode
      if (currentContext?.includes('mock') || currentContext?.includes('simulation')) {
        console.log('🎭 デプロイをシミュレーション中...');
      }
    } catch (error: any) {
      console.error('Failed to apply manifest:', error);
      alert(`Failed to apply manifest: ${error.response?.data?.error || error.message}`);
      setIsDeploying(false);
    }
  };

  const handleRefresh = () => {
    loadPods();
    loadDeployments();
    loadServices();
  };

  const selectTemplate = (template: typeof manifestTemplates[0]) => {
    setManifest(template.manifest);
    setShowTemplateDialog(false);
    setActiveTab('deploy');
  };

  const isMockMode = currentContext?.includes('mock') || currentContext?.includes('simulation');

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Mock Mode Banner */}
        {isMockMode && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 flex items-center gap-3"
          >
            <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium">シミュレーションモードで動作中</p>
              <p className="text-xs text-muted-foreground mt-1">
                kubectlが見つからないため、シミュレーションモードで実行しています。実際のクラスターには接続されていません。
              </p>
            </div>
          </motion.div>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-2xl flex items-center justify-center">
              <Network className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                Kubernetes Deploy
              </h1>
              <p className="text-muted-foreground">
                現在のコンテキスト: <span className="font-mono text-sm">{currentContext}</span>
              </p>
            </div>
          </div>
          <button
            onClick={handleRefresh}
            className="px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
        </motion.div>

        {/* Tabs */}
        <div className="flex items-center gap-2 border-b border-border">
          {(['learn', 'deploy', 'pods', 'deployments', 'services'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab === 'pods') loadPods();
                if (tab === 'deployments') loadDeployments();
                if (tab === 'services') loadServices();
              }}
              className={`px-6 py-3 font-medium transition-all ${
                activeTab === tab
                  ? 'border-b-2 border-primary text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'learn' && <><BookOpen className="w-4 h-4 inline mr-2" />学習</>}
              {tab === 'deploy' && <><FileText className="w-4 h-4 inline mr-2" />デプロイ</>}
              {tab === 'pods' && <><Box className="w-4 h-4 inline mr-2" />Pods ({pods.length})</>}
              {tab === 'deployments' && <><Layers className="w-4 h-4 inline mr-2" />Deployments ({deployments.length})</>}
              {tab === 'services' && <><Globe className="w-4 h-4 inline mr-2" />Services ({services.length})</>}
            </button>
          ))}
        </div>

        {/* Learn Tab */}
        {activeTab === 'learn' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* What is Kubernetes */}
            <div className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-indigo-500" />
                Kubernetesとは？
              </h3>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  <strong className="text-foreground">Kubernetes (K8s)</strong>は、コンテナ化されたアプリケーションのデプロイ、スケーリング、管理を自動化するオープンソースのコンテナオーケストレーションプラットフォームです。
                </p>
                <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                  <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-indigo-500" />
                    主な機能
                  </h4>
                  <ul className="space-y-2 ml-4">
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>自動スケーリング:</strong> トラフィックに応じてPodを自動増減</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>セルフヒーリング:</strong> 障害発生時に自動で復旧</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>ロードバランシング:</strong> トラフィックを均等に分散</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span><strong>ローリングアップデート:</strong> ダウンタイムなしでデプロイ</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Core Concepts */}
            <div className="bg-card rounded-2xl p-6 border border-border">
              <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Layers className="w-5 h-5 text-purple-500" />
                主要リソース
              </h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Box className="w-5 h-5 text-blue-500" />
                    <h4 className="font-semibold">Pod</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    最小のデプロイ単位。1つ以上のコンテナをグループ化
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Layers className="w-5 h-5 text-green-500" />
                    <h4 className="font-semibold">Deployment</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Podのレプリカ管理とローリングアップデート
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Globe className="w-5 h-5 text-purple-500" />
                    <h4 className="font-semibold">Service</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Podへのネットワークアクセスを提供
                  </p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Database className="w-5 h-5 text-orange-500" />
                    <h4 className="font-semibold">StatefulSet</h4>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    ステートフルなアプリケーション（DB等）の管理
                  </p>
                </div>
              </div>
            </div>

            {/* Try it out */}
            <div className="bg-gradient-to-r from-indigo-500/10 via-purple-500/10 to-pink-500/10 border border-indigo-500/20 rounded-2xl p-6">
              <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
                <Play className="w-5 h-5 text-indigo-500" />
                実際に試してみよう！
              </h3>
              <p className="text-muted-foreground mb-4">
                「デプロイ」タブに移動して、実際にKubernetesマニフェストをデプロイしてみましょう。
              </p>
              <button
                onClick={() => setActiveTab('deploy')}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all flex items-center gap-2"
              >
                <Play className="w-4 h-4" />
                デプロイタブで試す
              </button>
            </div>
          </motion.div>
        )}

        {/* Deploy Tab */}
        {activeTab === 'deploy' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowTemplateDialog(true)}
                className="px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors flex items-center gap-2"
              >
                <FileText className="w-4 h-4" />
                テンプレート
              </button>
              <button
                onClick={handleApply}
                disabled={isDeploying}
                className="px-6 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeploying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isDeploying ? 'デプロイ中...' : 'Apply'}
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Manifest Editor */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <div className="mb-4">
                    <label className="text-sm text-muted-foreground mb-2 block">Namespace</label>
                    <select
                      value={namespace}
                      onChange={(e) => setNamespace(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {namespaces.map(ns => (
                        <option key={ns} value={ns}>{ns}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">Kubernetes Manifest (YAML)</label>
                    <textarea
                      value={manifest}
                      onChange={(e) => setManifest(e.target.value)}
                      className="w-full h-96 px-3 py-2 bg-muted border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                      spellCheck={false}
                    />
                  </div>
                </div>
              </div>

              {/* Deploy Status */}
              <div className="space-y-4">
                <div className="bg-card border border-border rounded-2xl p-6">
                  <h3 className="font-semibold mb-4 flex items-center gap-2">
                    <Activity className="w-5 h-5 text-primary" />
                    デプロイ状態
                  </h3>
                  {currentSession ? (
                    <div className="space-y-3">
                      <div className="flex justify-between items-center pb-3 border-b border-border">
                        <span className="text-sm text-muted-foreground">Status</span>
                        <span className={`text-sm font-medium ${
                          currentSession.status === 'completed' ? 'text-green-500' :
                          currentSession.status === 'error' ? 'text-red-500' :
                          'text-blue-500'
                        }`}>
                          {currentSession.status}
                        </span>
                      </div>
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Resources:</p>
                        {currentSession.resources.map((resource, index) => (
                          <div key={index} className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">{resource.kind}/{resource.name}</span>
                            <span className="flex items-center gap-1">
                              {resource.status === 'ready' ? (
                                <CheckCircle2 className="w-3 h-3 text-green-500" />
                              ) : resource.status === 'creating' ? (
                                <Loader2 className="w-3 h-3 animate-spin text-blue-500" />
                              ) : resource.status === 'error' ? (
                                <AlertCircle className="w-3 h-3 text-red-500" />
                              ) : (
                                <div className="w-3 h-3 rounded-full bg-muted" />
                              )}
                              <span className="text-xs">{resource.status}</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <Terminal className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">マニフェストをApplyしてください</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Pods Tab */}
        {activeTab === 'pods' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Box className="w-6 h-6 text-primary" />
                Pods
              </h2>
              <select
                value={namespace}
                onChange={(e) => {
                  setNamespace(e.target.value);
                  loadPods();
                }}
                className="px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {namespaces.map(ns => (
                  <option key={ns} value={ns}>{ns}</option>
                ))}
              </select>
            </div>

            {pods.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Box className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Podが見つかりません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {pods.map((pod, index) => (
                  <motion.div
                    key={pod.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className={`w-2 h-2 rounded-full ${
                      pod.status === 'Running' ? 'bg-green-500 animate-pulse' :
                      pod.status === 'Pending' ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`} />
                    <div className="flex-1">
                      <h3 className="font-mono text-sm font-medium">{pod.name}</h3>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
                        <span>Status: {pod.phase}</span>
                        <span>Restarts: {pod.restarts}</span>
                        <span>Age: {pod.age}</span>
                        {pod.node && <span>Node: {pod.node}</span>}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Deployments Tab */}
        {activeTab === 'deployments' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Layers className="w-6 h-6 text-primary" />
                Deployments
              </h2>
              <select
                value={namespace}
                onChange={(e) => {
                  setNamespace(e.target.value);
                  loadDeployments();
                }}
                className="px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {namespaces.map(ns => (
                  <option key={ns} value={ns}>{ns}</option>
                ))}
              </select>
            </div>

            {deployments.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Layers className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Deploymentが見つかりません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {deployments.map((deployment, index) => (
                  <motion.div
                    key={deployment.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-xl border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{deployment.name}</h3>
                      <span className="flex items-center gap-1 text-sm">
                        {deployment.replicas.ready === deployment.replicas.desired ? (
                          <CheckCircle2 className="w-4 h-4 text-green-500" />
                        ) : (
                          <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                        )}
                        {deployment.replicas.ready}/{deployment.replicas.desired}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span>Containers: {deployment.containers.join(', ')}</span>
                      <span>Age: {deployment.age}</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* Services Tab */}
        {activeTab === 'services' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-card border border-border rounded-2xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Globe className="w-6 h-6 text-primary" />
                Services
              </h2>
              <select
                value={namespace}
                onChange={(e) => {
                  setNamespace(e.target.value);
                  loadServices();
                }}
                className="px-3 py-2 bg-muted border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary"
              >
                {namespaces.map(ns => (
                  <option key={ns} value={ns}>{ns}</option>
                ))}
              </select>
            </div>

            {services.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Globe className="w-16 h-16 mx-auto mb-4 opacity-50" />
                <p>Serviceが見つかりません</p>
              </div>
            ) : (
              <div className="space-y-3">
                {services.map((service, index) => (
                  <motion.div
                    key={service.name}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="p-4 rounded-xl border border-border hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-semibold">{service.name}</h3>
                      <span className="text-sm px-2 py-1 rounded bg-blue-500/10 text-blue-500 border border-blue-500/20">
                        {service.type}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm text-muted-foreground">
                      <div>
                        <span className="block text-xs text-muted-foreground/70">Cluster IP</span>
                        <span className="font-mono">{service.clusterIP}</span>
                      </div>
                      {service.externalIP && (
                        <div>
                          <span className="block text-xs text-muted-foreground/70">External IP</span>
                          <span className="font-mono">{service.externalIP}</span>
                        </div>
                      )}
                      <div>
                        <span className="block text-xs text-muted-foreground/70">Ports</span>
                        <span>{service.ports.map(p => `${p.port}:${p.targetPort}/${p.protocol}`).join(', ')}</span>
                      </div>
                      <div>
                        <span className="block text-xs text-muted-foreground/70">Age</span>
                        <span>{service.age}</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Template Dialog */}
      {showTemplateDialog && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-card border border-border rounded-2xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
          >
            <h3 className="text-xl font-bold mb-4">マニフェストテンプレート</h3>
            <div className="space-y-3">
              {manifestTemplates.map((template, index) => (
                <button
                  key={index}
                  onClick={() => selectTemplate(template)}
                  className="w-full text-left p-4 rounded-xl border border-border hover:bg-accent transition-colors"
                >
                  <h4 className="font-semibold mb-1">{template.name}</h4>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </button>
              ))}
            </div>
            <button
              onClick={() => setShowTemplateDialog(false)}
              className="mt-4 px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors w-full"
            >
              閉じる
            </button>
          </motion.div>
        </div>
      )}
    </div>
  );
}
