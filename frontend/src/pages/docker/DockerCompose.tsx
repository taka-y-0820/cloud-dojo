import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Play,
  FileCode,
  CheckCircle2,
  Loader2,
  Terminal,
  Square,
  GitBranch,
  Box,
  Network,
  FileText,
  BookOpen,
  Zap,
  Lightbulb,
  Globe,
  Code,
  Database,
  Activity,
  AlertCircle,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import axios from 'axios';
import { PageLayout } from '@/layouts/PageLayout';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';
const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';

interface Service {
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
}

interface ComposeConfig {
  version: string;
  services: Record<string, Service>;
  networks?: Record<string, any>;
  volumes?: Record<string, any>;
}

interface ComposeSession {
  id: string;
  projectName: string;
  status: 'starting' | 'running' | 'stopping' | 'stopped' | 'error';
  services: Record<
    string,
    {
      containerId?: string;
      status: 'pending' | 'building' | 'starting' | 'running' | 'stopped' | 'error' | 'pulling';
      error?: string;
    }
  >;
  startTime: Date;
  error?: string;
}

const sampleCompose = `version: '3.8'

# 3層アーキテクチャのサンプル
# フロントエンド、バックエンド、データベース、キャッシュの連携を体験

services:
  # フロントエンド (Nginx)
  frontend:
    image: nginx:alpine
    ports:
      - "9000:80"
    depends_on:
      - backend
    networks:
      - app-network

  # バックエンドAPI (Node.js)
  backend:
    image: node:18-alpine
    ports:
      - "9001:4000"
    environment:
      DATABASE_URL: postgresql://user:password@db:5432/mydb
      REDIS_URL: redis://cache:6379
    command: sleep infinity
    depends_on:
      - db
      - cache
    networks:
      - app-network

  # データベース (PostgreSQL)
  db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: user
      POSTGRES_PASSWORD: password
      POSTGRES_DB: mydb
    volumes:
      - db-data:/var/lib/postgresql/data
    networks:
      - app-network
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U user"]
      interval: 10s
      timeout: 5s
      retries: 5

  # キャッシュ (Redis)
  cache:
    image: redis:7-alpine
    ports:
      - "9002:6379"
    networks:
      - app-network
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 3s
      retries: 5

networks:
  app-network:
    driver: bridge

volumes:
  db-data:
`;

const composeTemplates = [
  {
    name: 'MERN Stack',
    description: 'MongoDB + Express + React + Node.js',
    compose: `version: '3.8'

services:
  frontend:
    image: node:18-alpine
    ports:
      - "8080:3000"
    command: sleep infinity
    depends_on:
      - backend
    networks:
      - mern-network

  backend:
    image: node:18-alpine
    ports:
      - "8081:4000"
    environment:
      MONGODB_URI: mongodb://mongo:27017/mydb
    command: sleep infinity
    depends_on:
      - mongo
    networks:
      - mern-network

  mongo:
    image: mongo:7
    volumes:
      - mongo-data:/data/db
    networks:
      - mern-network

networks:
  mern-network:

volumes:
  mongo-data:
`,
  },
  {
    name: 'Microservices',
    description: 'API Gateway + Services + Database',
    compose: `version: '3.8'

services:
  nginx:
    image: nginx:alpine
    ports:
      - "8082:80"
    command: sh -c "sleep infinity"
    depends_on:
      - api-gateway
    networks:
      - frontend

  api-gateway:
    image: node:18-alpine
    ports:
      - "8083:8080"
    command: sleep infinity
    depends_on:
      - auth-service
      - user-service
    networks:
      - frontend
      - backend

  auth-service:
    image: node:18-alpine
    environment:
      DATABASE_URL: postgres://postgres:password@postgres:5432/auth
    command: sleep infinity
    depends_on:
      - postgres
    networks:
      - backend

  user-service:
    image: node:18-alpine
    environment:
      DATABASE_URL: postgres://postgres:password@postgres:5432/users
    command: sleep infinity
    depends_on:
      - postgres
    networks:
      - backend

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_PASSWORD: password
    volumes:
      - pg-data:/var/lib/postgresql/data
    networks:
      - backend

networks:
  frontend:
  backend:

volumes:
  pg-data:
`,
  },
  {
    name: 'WordPress',
    description: 'WordPress + MySQL + phpMyAdmin',
    compose: `version: '3.8'

services:
  wordpress:
    image: wordpress:latest
    ports:
      - "8084:80"
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: wordpress
      WORDPRESS_DB_NAME: wordpress
    depends_on:
      - db
    volumes:
      - wp-content:/var/www/html
    networks:
      - wp-network

  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: wordpress
      MYSQL_ROOT_PASSWORD: rootpassword
    volumes:
      - db-data:/var/lib/mysql
    networks:
      - wp-network

  phpmyadmin:
    image: phpmyadmin:latest
    ports:
      - "8085:80"
    environment:
      PMA_HOST: db
    depends_on:
      - db
    networks:
      - wp-network

networks:
  wp-network:

volumes:
  wp-content:
  db-data:
`,
  },
];

export function DockerCompose() {
  const [compose, setCompose] = useState(sampleCompose);
  const [activeTab, setActiveTab] = useState<'learn' | 'editor' | 'services' | 'graph'>('learn');
  const [services, setServices] = useState<Record<string, Service>>({});
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [currentSession, setCurrentSession] = useState<ComposeSession | null>(null);
  const [projectName] = useState('demo-app');
  const [jobProgress, setJobProgress] = useState<number>(0);
  const [downProgress, setDownProgress] = useState<number>(0);
  const [downStatus, setDownStatus] = useState<string>('');
  const [debugMessages, setDebugMessages] = useState<string[]>([]);

  const { lastMessage } = useWebSocket(WS_URL);

  // Handle WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    const timestamp = new Date().toLocaleTimeString();
    console.log('[WebSocket]', lastMessage.type, lastMessage);
    setDebugMessages((prev) =>
      [
        ...prev,
        `[${timestamp}] ${lastMessage.type}: ${JSON.stringify(lastMessage).substring(0, 100)}`,
      ].slice(-10)
    );

    // Handle compose session updates
    if (lastMessage.type === 'compose:session:update' && lastMessage.session) {
      console.log('📦 Compose session update:', JSON.parse(JSON.stringify(lastMessage.session)));
      setCurrentSession(lastMessage.session);

      // Update progress if provided
      if (lastMessage.progress !== undefined) {
        setJobProgress(lastMessage.progress);
      }

      if (lastMessage.session.status === 'running' || lastMessage.session.status === 'error') {
        setIsRunning(false);
        setJobProgress(100);
      }

      // Log service statuses
      const services = lastMessage.session.services;
      console.log(
        'Service statuses:',
        Object.entries(services).map(([name, s]: [string, any]) => ({
          name,
          status: s.status,
          error: s.error,
        }))
      );
    }

    // Handle compose down progress
    if (lastMessage.type === 'compose:down:progress') {
      console.log('🛑 Compose down progress:', lastMessage);
      setDownProgress(lastMessage.progress || 0);
      setDownStatus((lastMessage as any).message || '');

      if (lastMessage.progress === 100 || (lastMessage as any).status === 'completed') {
        setIsStopping(false);
        setCurrentSession(null);
        setDownProgress(0);
        setDownStatus('');
      }
    }

    // Handle queue job progress
    if (lastMessage.type === 'queue:job:progress' && lastMessage.queue === 'compose-up') {
      console.log(`📊 Compose progress: ${lastMessage.progress}%`);
      setJobProgress(lastMessage.progress || 0);
    }

    // Handle queue job completion for compose-up
    if (lastMessage.type === 'queue:job:completed' && lastMessage.queue === 'compose-up') {
      console.log('✅ Compose up completed!', lastMessage);
      setIsRunning(false);
      setJobProgress(100);

      // If session exists but not all services are running, show warning
      if (currentSession) {
        const allRunning = Object.values(currentSession.services).every(
          (s) => s.status === 'running'
        );
        if (!allRunning) {
          const failedServices = Object.entries(currentSession.services)
            .filter(([_, s]) => s.status === 'error')
            .map(([name, s]) => `${name}: ${s.error || '不明なエラー'}`)
            .join('\n');

          if (failedServices) {
            setDebugMessages((prev) => [
              ...prev,
              `⚠️ 一部のサービスが起動に失敗:\n${failedServices}`,
            ]);
          }
        }
      }
    }

    // Handle queue job failure
    if (lastMessage.type === 'queue:job:failed' && lastMessage.queue === 'compose-up') {
      console.error('❌ Compose up failed:', lastMessage.error);
      setIsRunning(false);
      alert(`Compose起動に失敗しました: ${lastMessage.error}`);
    }
  }, [lastMessage]);

  // Parse YAML to extract services
  useEffect(() => {
    try {
      const parsed = parseComposeYAML(compose);
      setServices(parsed.services || {});
    } catch (error) {
      console.error('Failed to parse compose file:', error);
    }
  }, [compose]);

  const parseComposeYAML = (yaml: string): ComposeConfig => {
    const lines = yaml.split('\n');
    const config: ComposeConfig = { version: '3.8', services: {} };
    let currentService: string | null = null;
    let currentSection: 'services' | 'networks' | 'volumes' | null = null;
    let indentLevel = 0;
    let currentSubSection: string | null = null;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S/);

      // Version
      if (trimmed.startsWith('version:')) {
        config.version = trimmed.split(':')[1].trim().replace(/['"]/g, '');
        continue;
      }

      // Top level sections
      if (trimmed === 'services:') {
        currentSection = 'services';
        indentLevel = indent;
        continue;
      }
      if (trimmed === 'networks:') {
        currentSection = 'networks';
        config.networks = {};
        continue;
      }
      if (trimmed === 'volumes:') {
        currentSection = 'volumes';
        config.volumes = {};
        continue;
      }

      if (currentSection === 'services') {
        // Service name
        if (indent === indentLevel + 2 && trimmed.endsWith(':')) {
          currentService = trimmed.slice(0, -1);
          config.services[currentService] = { name: currentService };
          currentSubSection = null;
          continue;
        }

        if (currentService && indent > indentLevel + 2) {
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
          if (currentSubSection === 'build') {
            if (trimmed.startsWith('context:')) {
              service.build!.context = trimmed.split(':')[1].trim();
            } else if (trimmed.startsWith('dockerfile:')) {
              service.build!.dockerfile = trimmed.split(':')[1].trim();
            }
          } else if (currentSubSection === 'environment') {
            if (trimmed.includes(':')) {
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
          } else if (trimmed.startsWith('image:')) {
            service.image = trimmed.split(':')[1].trim();
          }
        }
      }
    }

    return config;
  };

  const handleComposeUp = async () => {
    try {
      setIsRunning(true);
      setCurrentSession(null);
      setJobProgress(0);
      setDebugMessages([]);

      const response = await axios.post(`${API_URL}/api/compose/up`, {
        composeYaml: compose,
        projectName,
      });

      console.log('Compose up queued:', response.data);
      setDebugMessages((prev) => [...prev, `キューに追加: Job ID ${response.data.jobId}`]);
      // Response now contains jobId instead of session directly
      // Session updates will come via WebSocket
    } catch (error: any) {
      console.error('Failed to start compose:', error);
      setDebugMessages((prev) => [
        ...prev,
        `エラー: ${error.response?.data?.error || error.message}`,
      ]);
      alert(`Failed to start compose: ${error.response?.data?.error || error.message}`);
      setIsRunning(false);
    }
  };

  const handleComposeDown = async () => {
    try {
      setIsStopping(true);
      setDownProgress(0);
      setDownStatus('Stopping compose project...');

      const response = await axios.post(`${API_URL}/api/compose/down`, {
        projectName,
      });

      console.log('Compose down queued:', response.data);
      setDebugMessages((prev) => [...prev, `停止キューに追加: Job ID ${response.data.jobId}`]);
      // Progress updates will come via WebSocket
    } catch (error: any) {
      console.error('Failed to stop compose:', error);
      setDebugMessages((prev) => [
        ...prev,
        `エラー: ${error.response?.data?.error || error.message}`,
      ]);
      alert(`Failed to stop compose: ${error.response?.data?.error || error.message}`);
      setIsStopping(false);
      setDownProgress(0);
      setDownStatus('');
    }
  };

  return (
    <PageLayout>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center">
            <Layers className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Docker Compose
            </h1>
            <p className="text-muted-foreground">マルチコンテナアプリケーションの定義と実行</p>
          </div>
        </div>
      </motion.div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-border">
        {(['learn', 'editor', 'services', 'graph'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-3 font-medium transition-all ${
              activeTab === tab
                ? 'border-b-2 border-primary text-primary'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'learn' && (
              <>
                <BookOpen className="w-4 h-4 inline mr-2" />
                学習
              </>
            )}
            {tab === 'editor' && (
              <>
                <FileCode className="w-4 h-4 inline mr-2" />
                エディタ
              </>
            )}
            {tab === 'services' && (
              <>
                <Box className="w-4 h-4 inline mr-2" />
                サービス一覧
              </>
            )}
            {tab === 'graph' && (
              <>
                <Network className="w-4 h-4 inline mr-2" />
                依存関係グラフ
              </>
            )}
          </button>
        ))}
      </div>

      {/* Learn Tab */}
      {activeTab === 'learn' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          {/* What is Docker Compose */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              Docker Composeとは？
            </h3>
            <div className="space-y-4 text-muted-foreground">
              <p>
                <strong className="text-foreground">Docker Compose</strong>
                は、複数のDockerコンテナを定義・実行するためのツールです。
                YAMLファイルでアプリケーションのサービス、ネットワーク、ボリュームを設定し、単一のコマンドで全体を起動・停止できます。
              </p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="font-semibold text-foreground mb-2 flex items-center gap-2">
                  <Zap className="w-4 h-4 text-blue-500" />
                  主な利点
                </h4>
                <ul className="space-y-2 ml-4">
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>一括管理:</strong> 複数のコンテナを1つのファイルで定義
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>簡単な起動:</strong>{' '}
                      <code className="px-1.5 py-0.5 bg-secondary rounded text-xs">
                        docker-compose up
                      </code>
                      で全サービス起動
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>環境の再現性:</strong> 開発・本番で同じ構成を利用可能
                    </span>
                  </li>
                  <li className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>
                      <strong>依存関係管理:</strong> サービスの起動順序を自動制御
                    </span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* YAML Structure */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-purple-500" />
              YAMLファイルの構造
            </h3>
            <div className="space-y-4">
              <div className="bg-secondary/50 rounded-lg p-4 font-mono text-sm overflow-x-auto">
                <pre className="text-foreground">{`version: '3.8'    # Composeファイルのバージョン

services:           # サービス定義
  web:              # サービス名
    image: nginx:alpine         # 使用するイメージ
    ports:                      # ポートマッピング
      - "8080:80"              # ホスト:コンテナ
    depends_on:                 # 依存関係
      - api
    networks:                   # ネットワーク
      - app-network
  
  api:
    build: ./backend            # Dockerfileからビルド
    environment:                # 環境変数
      DB_HOST: database
    volumes:                    # ボリュームマウント
      - ./data:/app/data

networks:           # ネットワーク定義
  app-network:
    driver: bridge

volumes:            # ボリューム定義
  db-data:`}</pre>
              </div>
            </div>
          </div>

          {/* Common Use Cases */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Lightbulb className="w-5 h-5 text-yellow-500" />
              よくあるユースケース
            </h3>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Globe className="w-4 h-4 text-blue-500" />
                  Webアプリケーション
                </h4>
                <p className="text-sm text-muted-foreground">
                  フロントエンド + バックエンドAPI + データベース + キャッシュを一括起動
                </p>
                <code className="text-xs bg-secondary px-2 py-1 rounded mt-2 block">
                  nginx + node + postgres + redis
                </code>
              </div>

              <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Code className="w-4 h-4 text-green-500" />
                  マイクロサービス
                </h4>
                <p className="text-sm text-muted-foreground">
                  複数の独立したサービスを連携させて動作
                </p>
                <code className="text-xs bg-secondary px-2 py-1 rounded mt-2 block">
                  user-service + order-service + message-queue
                </code>
              </div>

              <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Database className="w-4 h-4 text-orange-500" />
                  開発環境
                </h4>
                <p className="text-sm text-muted-foreground">
                  ローカル開発に必要なすべてのサービスを統合管理
                </p>
                <code className="text-xs bg-secondary px-2 py-1 rounded mt-2 block">
                  app + db + mailserver + s3-mock
                </code>
              </div>

              <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Activity className="w-4 h-4 text-purple-500" />
                  CI/CDパイプライン
                </h4>
                <p className="text-sm text-muted-foreground">テスト環境を自動的にセットアップ</p>
                <code className="text-xs bg-secondary px-2 py-1 rounded mt-2 block">
                  test-runner + test-db + mock-api
                </code>
              </div>
            </div>
          </div>

          {/* Key Concepts */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-indigo-500" />
              重要な概念
            </h3>
            <div className="space-y-4">
              <div className="border-l-4 border-blue-500 pl-4 py-2">
                <h4 className="font-semibold text-foreground mb-1">Services (サービス)</h4>
                <p className="text-sm text-muted-foreground">
                  アプリケーションを構成する個々のコンテナ。それぞれが独立したプロセスとして動作します。
                </p>
              </div>

              <div className="border-l-4 border-green-500 pl-4 py-2">
                <h4 className="font-semibold text-foreground mb-1">Networks (ネットワーク)</h4>
                <p className="text-sm text-muted-foreground">
                  サービス間の通信を可能にする仮想ネットワーク。同じネットワーク内ではサービス名で通信できます。
                </p>
              </div>

              <div className="border-l-4 border-purple-500 pl-4 py-2">
                <h4 className="font-semibold text-foreground mb-1">Volumes (ボリューム)</h4>
                <p className="text-sm text-muted-foreground">
                  データを永続化するための仕組み。コンテナを削除してもデータは保持されます。
                </p>
              </div>

              <div className="border-l-4 border-orange-500 pl-4 py-2">
                <h4 className="font-semibold text-foreground mb-1">Depends On (依存関係)</h4>
                <p className="text-sm text-muted-foreground">
                  サービスの起動順序を定義。データベースを先に起動してからアプリを起動、などの制御が可能です。
                </p>
              </div>
            </div>
          </div>

          {/* Best Practices */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-green-500" />
              ベストプラクティス
            </h3>
            <div className="space-y-3">
              <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-foreground">環境変数の活用</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    パスワードなどの機密情報は
                    <code className="px-1 bg-secondary rounded">.env</code>ファイルで管理
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-foreground">ヘルスチェックの設定</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    <code className="px-1 bg-secondary rounded">healthcheck</code>
                    でサービスの正常性を監視
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-foreground">
                    ネームドボリュームの使用
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    データベースのデータは必ずボリュームで永続化
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-sm text-foreground">リソース制限の設定</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    CPUとメモリの上限を設定してシステムを保護
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Commands Reference */}
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Terminal className="w-5 h-5 text-cyan-500" />
              主要コマンドリファレンス
            </h3>
            <div className="space-y-3">
              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-sm font-mono text-cyan-400">docker-compose up -d</code>
                  <span className="text-xs text-muted-foreground">起動</span>
                </div>
                <p className="text-xs text-muted-foreground">全サービスをバックグラウンドで起動</p>
              </div>

              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-sm font-mono text-cyan-400">docker-compose down</code>
                  <span className="text-xs text-muted-foreground">停止</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  全サービスを停止し、ネットワークを削除
                </p>
              </div>

              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-sm font-mono text-cyan-400">docker-compose ps</code>
                  <span className="text-xs text-muted-foreground">状態確認</span>
                </div>
                <p className="text-xs text-muted-foreground">実行中のサービス一覧を表示</p>
              </div>

              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-sm font-mono text-cyan-400">docker-compose logs -f</code>
                  <span className="text-xs text-muted-foreground">ログ表示</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  全サービスのログをリアルタイムで表示
                </p>
              </div>

              <div className="bg-secondary/50 rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <code className="text-sm font-mono text-cyan-400">docker-compose restart</code>
                  <span className="text-xs text-muted-foreground">再起動</span>
                </div>
                <p className="text-xs text-muted-foreground">全サービスを再起動</p>
              </div>
            </div>
          </div>

          {/* Try It Out */}
          <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              実際に試してみよう！
            </h3>
            <p className="text-muted-foreground mb-4">
              「エディタ」タブに移動して、サンプルのDocker Compose設定を編集・実行してみましょう。
              フロントエンド、バックエンド、データベース、キャッシュの4層構成を一度に起動できます。
            </p>
            <button
              onClick={() => setActiveTab('editor')}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all flex items-center gap-2"
            >
              <Play className="w-4 h-4" />
              エディタで試す
            </button>
          </div>
        </motion.div>
      )}

      {/* Editor Tab */}
      {activeTab === 'editor' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowTemplateDialog(true)}
              className="px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              テンプレート
            </button>
            <button
              onClick={handleComposeUp}
              disabled={isRunning}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  起動中...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Compose Up
                </>
              )}
            </button>
            <button
              onClick={handleComposeDown}
              disabled={isStopping}
              className="px-4 py-2 rounded-xl border border-red-500 text-red-500 hover:bg-red-500/10 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isStopping ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  停止中...
                </>
              ) : (
                <>
                  <Square className="w-4 h-4" />
                  Compose Down
                </>
              )}
            </button>
          </div>

          <div className="bg-card border border-border rounded-2xl p-6">
            <label className="text-sm text-muted-foreground mb-2 block">docker-compose.yml</label>
            <textarea
              value={compose}
              onChange={(e) => setCompose(e.target.value)}
              className="w-full h-96 px-3 py-2 bg-muted border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              spellCheck={false}
            />

            {/* Session Status */}
            {(isRunning || isStopping || currentSession) && (
              <div className="mt-4 p-4 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-xl">
                <div className="flex items-center gap-2 mb-3">
                  {/* <Loader2 className={`w-4 h-4 ${isRunning || currentSession?.status === 'starting' ? 'animate-spin text-blue-500' : 'text-muted-foreground'}`} />
                    <span className="font-semibold">
                      {isRunning && !currentSession ? 'キュー処理中...' : 
                       currentSession?.status === 'starting' ? '起動中' : 
                       currentSession?.status === 'running' ? '実行中' : 
                       currentSession?.status === 'error' ? 'エラー' : '停止'}
                    </span> */}
                  {jobProgress > 0 && jobProgress < 100 && (
                    <span className="text-sm text-muted-foreground ml-auto">{jobProgress}%</span>
                  )}
                </div>

                {/* Down Progress */}
                {isStopping && (
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-red-500 flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        {downStatus || 'Stopping...'}
                      </span>
                      <span className="text-sm text-muted-foreground">{downProgress}%</span>
                    </div>
                    <div className="h-2 bg-muted rounded-full overflow-hidden">
                      <motion.div
                        className="h-full bg-gradient-to-r from-red-500 to-orange-500"
                        initial={{ width: '0%' }}
                        animate={{ width: `${downProgress}%` }}
                        transition={{ duration: 0.3 }}
                      />
                    </div>
                  </div>
                )}

                {currentSession && (
                  <>
                    <div className="space-y-2 mb-3">
                      {Object.entries(currentSession.services).map(([name, serviceStatus]) => {
                        // Calculate individual service progress
                        let progress = 0;
                        if (serviceStatus.status === 'running') progress = 100;
                        else if (serviceStatus.status === 'error') progress = 100;
                        else if (serviceStatus.status === 'starting') progress = 50;
                        else if (serviceStatus.status === 'pulling') progress = 30;

                        return (
                          <div key={name} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-2">
                                {serviceStatus.status === 'running' ? (
                                  <CheckCircle2 className="w-4 h-4 text-green-500" />
                                ) : serviceStatus.status === 'error' ? (
                                  <Terminal className="w-4 h-4 text-red-500" />
                                ) : (
                                  <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                                )}
                                <span className="font-medium">{name}</span>
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {serviceStatus.status === 'running'
                                  ? '実行中'
                                  : serviceStatus.status === 'error'
                                    ? 'エラー'
                                    : serviceStatus.status === 'starting'
                                      ? '起動中'
                                      : serviceStatus.status === 'pulling'
                                        ? 'Pull中'
                                        : serviceStatus.status}
                              </span>
                            </div>
                            {/* Progress bar for each service */}
                            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                              <motion.div
                                className={`h-full ${
                                  serviceStatus.status === 'running'
                                    ? 'bg-green-500'
                                    : serviceStatus.status === 'error'
                                      ? 'bg-red-500'
                                      : 'bg-blue-500'
                                }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${progress}%` }}
                                transition={{ duration: 0.3 }}
                              />
                            </div>
                            {serviceStatus.error && (
                              <div className="text-xs text-red-500 ml-6">{serviceStatus.error}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {currentSession.error && (
                      <div className="mt-2 text-sm text-red-500">
                        エラー: {currentSession.error}
                      </div>
                    )}
                  </>
                )}

                {/* Debug Messages */}
                {debugMessages.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border">
                    <div className="text-xs font-semibold text-muted-foreground mb-2">
                      デバッグログ:
                    </div>
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {debugMessages.map((msg, i) => (
                        <div key={i} className="text-xs font-mono text-muted-foreground">
                          {msg}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Services Tab */}
      {activeTab === 'services' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
          {Object.entries(services).length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              サービスが定義されていません
            </div>
          ) : (
            Object.entries(services).map(([name, service]) => (
              <motion.div
                key={name}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-card border border-border rounded-2xl p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                      <Box className="w-5 h-5 text-purple-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">{name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {service.image ||
                          (service.build ? `Build: ${service.build.context}` : 'No image')}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {service.ports && service.ports.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">Ports</h4>
                      <div className="space-y-1">
                        {service.ports.map((port, i) => (
                          <div key={i} className="text-sm font-mono bg-muted px-2 py-1 rounded">
                            {port}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {service.environment && Object.keys(service.environment).length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                        Environment
                      </h4>
                      <div className="space-y-1 max-h-32 overflow-auto">
                        {Object.entries(service.environment).map(([key, value], i) => (
                          <div key={i} className="text-xs font-mono bg-muted px-2 py-1 rounded">
                            {key}={value}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {service.depends_on && service.depends_on.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">
                        Depends On
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {service.depends_on.map((dep, i) => (
                          <span
                            key={i}
                            className="px-2 py-1 bg-blue-500/10 text-blue-600 dark:text-blue-400 text-xs rounded-lg border border-blue-500/20"
                          >
                            {dep}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {service.volumes && service.volumes.length > 0 && (
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground mb-2">Volumes</h4>
                      <div className="space-y-1">
                        {service.volumes.map((vol, i) => (
                          <div
                            key={i}
                            className="text-xs font-mono bg-muted px-2 py-1 rounded truncate"
                          >
                            {vol}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            ))
          )}
        </motion.div>
      )}

      {/* Graph Tab */}
      {activeTab === 'graph' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="bg-card border border-border rounded-2xl p-8"
        >
          <div className="space-y-8">
            {Object.entries(services).map(([name, service]) => {
              const hasDependencies = service.depends_on && service.depends_on.length > 0;
              return (
                <div key={name} className="relative">
                  <div className="flex items-center gap-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="w-48 p-4 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/30 rounded-xl"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <Box className="w-5 h-5 text-purple-500" />
                        <h3 className="font-bold">{name}</h3>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {service.image || 'Custom build'}
                      </p>
                    </motion.div>

                    {hasDependencies && (
                      <>
                        <div className="flex-1 flex items-center">
                          <GitBranch className="w-6 h-6 text-muted-foreground" />
                          <div className="flex-1 border-t-2 border-dashed border-muted-foreground/30" />
                        </div>
                        <div className="flex gap-2">
                          {service.depends_on!.map((dep) => (
                            <div
                              key={dep}
                              className="w-32 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg"
                            >
                              <div className="flex items-center gap-2">
                                <Box className="w-4 h-4 text-blue-500" />
                                <span className="text-sm font-medium">{dep}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              );
            })}

            {Object.keys(services).length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                サービス依存関係がありません
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Template Dialog */}
      <AnimatePresence>
        {showTemplateDialog && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
            onClick={() => setShowTemplateDialog(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-4xl mx-4 max-h-[85vh] overflow-auto"
            >
              <h3 className="text-2xl font-bold mb-4">Composeテンプレート</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {composeTemplates.map((template) => (
                  <button
                    key={template.name}
                    onClick={() => {
                      setCompose(template.compose);
                      setShowTemplateDialog(false);
                    }}
                    className="p-4 rounded-xl border-2 border-border hover:border-primary transition-colors text-left"
                  >
                    <h4 className="font-bold text-lg mb-1">{template.name}</h4>
                    <p className="text-sm text-muted-foreground">{template.description}</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setShowTemplateDialog(false)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </PageLayout>
  );
}
