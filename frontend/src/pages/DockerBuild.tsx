import { motion, AnimatePresence } from 'framer-motion';
import { Container, Play, Layers, FileCode, CheckCircle2, Loader2, Terminal, Trash2, RefreshCw, Package, PlayCircle, Square, Eye, FileText, HelpCircle, BookOpen, Lightbulb } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import axios from 'axios';

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:4000/ws';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

interface BuildStep {
  step: number;
  status: 'pending' | 'running' | 'completed' | 'error';
  command: string;
  output: string;
  timestamp: Date;
}

interface BuildSession {
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

interface QueueJobInfo {
  jobId: string;
  sessionId: string;
  queueName: string;
  status: string;
  progress?: number;
}

interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  status: string;
  state: string;
  created: Date;
  ports: Array<{ private: number; public?: number; type: string }>;
}

interface ImageInfo {
  id: string;
  tags: string[];
  size: number;
  created: Date;
}

const sampleDockerfile = `FROM node:18-alpine
WORKDIR /app
RUN echo "Hello from Cloud Dojo" > index.html
EXPOSE 3000
CMD ["sleep", "infinity"]`;

const dockerfileTemplates = {
  nodejs: {
    name: 'Node.js アプリケーション',
    description: 'Express.js などの Node.js アプリ',
    dockerfile: `FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]`,
  },
  python: {
    name: 'Python アプリケーション',
    description: 'Flask/Django などの Python アプリ',
    dockerfile: `FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 8000
CMD ["python", "app.py"]`,
  },
  go: {
    name: 'Go アプリケーション',
    description: 'マルチステージビルドで最適化',
    dockerfile: `FROM golang:1.21-alpine AS builder
WORKDIR /app
COPY go.* ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 go build -o main .

FROM alpine:latest
RUN apk --no-cache add ca-certificates
WORKDIR /root/
COPY --from=builder /app/main .
EXPOSE 8080
CMD ["./main"]`,
  },
  nginx: {
    name: 'Nginx 静的サイト',
    description: 'HTML/CSS/JS の静的ファイル配信',
    dockerfile: `FROM nginx:alpine
COPY nginx.conf /etc/nginx/nginx.conf
COPY dist/ /usr/share/nginx/html/
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]`,
  },
  java: {
    name: 'Java アプリケーション',
    description: 'Spring Boot などの Java アプリ',
    dockerfile: `FROM eclipse-temurin:17-jdk-alpine AS builder
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN ./mvnw package -DskipTests

FROM eclipse-temurin:17-jre-alpine
WORKDIR /app
COPY --from=builder /app/target/*.jar app.jar
EXPOSE 8080
CMD ["java", "-jar", "app.jar"]`,
  },
  simple: {
    name: 'シンプル (学習用)',
    description: '基本的な Dockerfile',
    dockerfile: sampleDockerfile,
  },
};

const dockerInstructions = {
  FROM: {
    title: 'ベースイメージの指定',
    description: 'Dockerイメージの基礎となるOSやランタイムを指定します',
    tips: [
      'alpine版は軽量でセキュリティリスクが低い',
      '特定のバージョンを指定すると再現性が高まる',
      'Docker Hubで公式イメージを探す',
    ],
    example: 'FROM node:18-alpine',
  },
  WORKDIR: {
    title: '作業ディレクトリの設定',
    description: '以降のコマンドを実行するディレクトリを指定します',
    tips: [
      '絶対パスで指定するのがベストプラクティス',
      'ディレクトリが存在しない場合は自動作成される',
      '/app が一般的な作業ディレクトリ',
    ],
    example: 'WORKDIR /app',
  },
  COPY: {
    title: 'ファイルのコピー',
    description: 'ホストマシンからコンテナにファイルをコピーします',
    tips: [
      '必要なファイルだけをコピーしてレイヤーを最小化',
      '.dockerignore で不要なファイルを除外',
      'package.jsonを先にコピーしてキャッシュを活用',
    ],
    example: 'COPY package*.json ./',
  },
  RUN: {
    title: 'コマンドの実行',
    description: 'イメージビルド時にコマンドを実行します',
    tips: [
      '複数コマンドは && で繋げてレイヤーを削減',
      'キャッシュを無効にするには --no-cache',
      '長いコマンドは \\ で改行して可読性向上',
    ],
    example: 'RUN npm ci --only=production',
  },
  EXPOSE: {
    title: 'ポートの公開',
    description: 'コンテナが使用するポートを宣言します',
    tips: [
      '実際のポート公開は docker run -p で行う',
      'ドキュメントとしての役割が大きい',
      '複数ポートを指定可能',
    ],
    example: 'EXPOSE 3000',
  },
  CMD: {
    title: 'デフォルトコマンド',
    description: 'コンテナ起動時に実行されるコマンドを指定します',
    tips: [
      'exec形式 ["cmd", "arg"] が推奨',
      'Dockerfileに1つだけ指定可能',
      'ENTRYPOINTと組み合わせて使うことも',
    ],
    example: 'CMD ["node", "index.js"]',
  },
  ENV: {
    title: '環境変数の設定',
    description: 'コンテナ内で使用する環境変数を定義します',
    tips: [
      '機密情報はビルド時ではなく実行時に渡す',
      'NODE_ENV=production などの設定に使う',
      '複数の変数を一度に設定可能',
    ],
    example: 'ENV NODE_ENV=production',
  },
  ARG: {
    title: 'ビルド引数',
    description: 'ビルド時に渡せる変数を定義します',
    tips: [
      'docker build --build-arg で値を渡す',
      'イメージには残らない(ENVと違う)',
      'バージョン指定などに便利',
    ],
    example: 'ARG NODE_VERSION=18',
  },
};

export function DockerBuild() {
  const [buildSession, setBuildSession] = useState<BuildSession | null>(null);
  const [queueJob, setQueueJob] = useState<QueueJobInfo | null>(null);
  const [isBuilding, setIsBuilding] = useState(false);
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [images, setImages] = useState<ImageInfo[]>([]);
  const [activeTab, setActiveTab] = useState<'learn' | 'build' | 'containers' | 'images'>('learn');
  const [dockerfile, setDockerfile] = useState(sampleDockerfile);
  const [imageName, setImageName] = useState('cloud-dojo-app');
  const [imageTag, setImageTag] = useState('latest');
  const [showRunDialog, setShowRunDialog] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [containerName, setContainerName] = useState('');
  const [hostPort, setHostPort] = useState('8080');
  const [containerPort, setContainerPort] = useState('3000');
  const [selectedContainerLogs, setSelectedContainerLogs] = useState<string | null>(null);
  const [containerLogs, setContainerLogs] = useState('');
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [showHelpDialog, setShowHelpDialog] = useState(false);
  const [selectedInstruction, setSelectedInstruction] = useState<string>('');
  const [activeHints, setActiveHints] = useState<Array<{line: number, instruction: string}>>([]);
  const { lastMessage } = useWebSocket(WS_URL);

  // Listen for WebSocket updates
  useEffect(() => {
    if (!lastMessage) return;

    // Legacy docker:build:update events
    if (lastMessage.type === 'docker:build:update') {
      setBuildSession(lastMessage.data);
      setIsBuilding(lastMessage.data.status === 'building' || lastMessage.data.status === 'preparing');
    }

    // Queue job events
    if (lastMessage.type === 'queue:job:progress' && queueJob?.jobId === lastMessage.jobId) {
      setQueueJob(prev => prev ? { ...prev, progress: lastMessage.progress } : null);
      console.log(`📊 Build progress: ${lastMessage.progress}%`);
    }

    if (lastMessage.type === 'queue:job:completed' && queueJob?.jobId === lastMessage.jobId) {
      console.log('✅ Build completed!', lastMessage);
      setIsBuilding(false);
      // Reload images list
      loadImages();
      // Fetch final build session
      if (queueJob?.sessionId) {
        axios.get(`${API_URL}/api/docker/build/${queueJob.sessionId}`)
          .then(res => setBuildSession(res.data))
          .catch(err => console.error('Failed to fetch build session:', err));
      }
    }

    if (lastMessage.type === 'queue:job:failed' && queueJob?.jobId === lastMessage.jobId) {
      console.error('❌ Build failed:', lastMessage.error);
      setIsBuilding(false);
      alert(`ビルドに失敗しました: ${lastMessage.error}`);
    }
  }, [lastMessage, queueJob]);

  // Load containers and images
  useEffect(() => {
    loadContainers();
    loadImages();
  }, []);

  const loadContainers = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/docker/containers?all=true`);
      setContainers(response.data.containers);
    } catch (error) {
      console.error('Failed to load containers:', error);
    }
  };

  const loadImages = async () => {
    try {
      const response = await axios.get(`${API_URL}/api/docker/images`);
      setImages(response.data.images);
    } catch (error) {
      console.error('Failed to load images:', error);
    }
  };

  const startBuild = async () => {
    try {
      setIsBuilding(true);
      const response = await axios.post(`${API_URL}/api/docker/build`, {
        dockerfile,
        imageName,
        imageTag,
      });
      
      console.log('Build queued:', response.data);
      setQueueJob({
        jobId: response.data.jobId,
        sessionId: response.data.sessionId,
        queueName: response.data.queueName,
        status: response.data.status,
      });
      setBuildSession(null); // Clear previous session
    } catch (error) {
      console.error('Failed to start build:', error);
      setIsBuilding(false);
      alert('ビルドの開始に失敗しました');
    }
  };

  const deleteContainer = async (id: string) => {
    if (!confirm('このコンテナを削除してもよろしいですか?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/docker/containers/${id}?force=true`);
      await loadContainers();
    } catch (error) {
      console.error('Failed to delete container:', error);
      alert('コンテナの削除に失敗しました');
    }
  };

  const deleteImage = async (id: string) => {
    if (!confirm('このイメージを削除してもよろしいですか?')) return;
    
    try {
      await axios.delete(`${API_URL}/api/docker/images/${id}?force=true`);
      await loadImages();
    } catch (error) {
      console.error('Failed to delete image:', error);
      alert('イメージの削除に失敗しました');
    }
  };

  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString('ja-JP');
  };

  const runContainer = async (imageTag: string) => {
    setSelectedImage(imageTag);
    setShowRunDialog(true);
  };

  const executeRunContainer = async () => {
    try {
      const ports = hostPort && containerPort ? [{
        container: parseInt(containerPort),
        host: parseInt(hostPort),
      }] : undefined;

      await axios.post(`${API_URL}/api/docker/containers/run`, {
        imageName: selectedImage,
        containerName: containerName || undefined,
        ports,
      });

      setShowRunDialog(false);
      setContainerName('');
      setHostPort('8080');
      setContainerPort('3000');
      await loadContainers();
      alert('コンテナが起動しました!');
    } catch (error: any) {
      console.error('Failed to run container:', error);
      const errorMessage = error.response?.data?.error || error.message || 'コンテナの起動に失敗しました';
      
      // Check if it's a port conflict error
      if (errorMessage.includes('bind:') || errorMessage.includes('port') || errorMessage.includes('address already in use')) {
        alert(`ポート競合エラー: ホストポート${hostPort}は既に使用されています。\n別のポート番号（例: 8080, 8081, 9000など）を試してください。`);
      } else {
        alert(`コンテナの起動に失敗しました: ${errorMessage}`);
      }
    }
  };

  const viewContainerLogs = async (containerId: string) => {
    try {
      const response = await axios.get(`${API_URL}/api/docker/containers/${containerId}/logs`);
      setContainerLogs(response.data.logs);
      setSelectedContainerLogs(containerId);
    } catch (error) {
      console.error('Failed to get container logs:', error);
      alert('ログの取得に失敗しました');
    }
  };

  const stopContainer = async (id: string) => {
    try {
      await axios.post(`${API_URL}/api/docker/containers/${id}/stop`);
      await loadContainers();
    } catch (error) {
      console.error('Failed to stop container:', error);
      alert('コンテナの停止に失敗しました');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
            Docker Build Visualization
          </h1>
          <p className="text-muted-foreground">実際のDocker環境でコンテナをビルド・管理</p>
        </div>
        <button 
          onClick={() => { loadContainers(); loadImages(); }}
          className="px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          更新
        </button>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('learn')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'learn'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <BookOpen className="w-4 h-4 inline mr-2" />
          学習
          {activeTab === 'learn' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('build')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'build'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          ビルド
          {activeTab === 'build' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('containers')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'containers'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          コンテナ ({containers.length})
          {activeTab === 'containers' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
            />
          )}
        </button>
        <button
          onClick={() => setActiveTab('images')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'images'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          イメージ ({images.length})
          {activeTab === 'images' && (
            <motion.div
              layoutId="activeTab"
              className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary"
            />
          )}
        </button>
      </div>

      {/* Learn Tab */}
      {activeTab === 'learn' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-blue-500" />
              Docker Buildとは？
            </h3>
            <div className="space-y-4 text-muted-foreground">
              <p><strong className="text-foreground">Docker Build</strong>は、Dockerfileという設計図を基にDockerイメージを作成するプロセスです。イメージは、アプリケーションとその実行環境をパッケージ化したもので、どこでも同じように動作することが保証されます。</p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-sm">1</div>
                  <div><strong className="text-foreground">Dockerfile作成</strong><p className="text-xs">ベースイメージ、コマンド、設定を記述</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-sm">2</div>
                  <div><strong className="text-foreground">ビルド実行</strong><p className="text-xs">各命令を順次実行してレイヤーを作成</p></div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500 font-bold text-sm">3</div>
                  <div><strong className="text-foreground">イメージ生成</strong><p className="text-xs">全レイヤーを結合して完成</p></div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <FileCode className="w-5 h-5 text-purple-500" />
              Dockerfileの主要命令
            </h3>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="bg-secondary/50 rounded-lg p-3">
                <code className="px-2 py-1 bg-purple-500/20 text-purple-400 rounded text-sm font-bold">FROM</code>
                <p className="text-sm mt-1">ベースイメージの指定</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <code className="px-2 py-1 bg-blue-500/20 text-blue-400 rounded text-sm font-bold">WORKDIR</code>
                <p className="text-sm mt-1">作業ディレクトリの設定</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <code className="px-2 py-1 bg-green-500/20 text-green-400 rounded text-sm font-bold">COPY</code>
                <p className="text-sm mt-1">ファイルのコピー</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <code className="px-2 py-1 bg-yellow-500/20 text-yellow-400 rounded text-sm font-bold">RUN</code>
                <p className="text-sm mt-1">コマンドの実行</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <code className="px-2 py-1 bg-orange-500/20 text-orange-400 rounded text-sm font-bold">EXPOSE</code>
                <p className="text-sm mt-1">ポートの公開</p>
              </div>
              <div className="bg-secondary/50 rounded-lg p-3">
                <code className="px-2 py-1 bg-red-500/20 text-red-400 rounded text-sm font-bold">CMD</code>
                <p className="text-sm mt-1">デフォルトコマンド</p>
              </div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-500" />
              レイヤーの概念
            </h3>
            <p className="text-muted-foreground mb-4">Dockerイメージは複数のレイヤー（層）で構成されています。各Dockerfile命令が1つのレイヤーを作成し、これらが積み重なってイメージが完成します。</p>
            <div className="bg-gradient-to-b from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 rounded-lg p-4 space-y-2">
              <div className="bg-card border rounded p-3"><code className="text-xs">CMD ["node", "index.js"]</code><span className="text-xs text-muted-foreground ml-2">← レイヤー4</span></div>
              <div className="bg-card border rounded p-3"><code className="text-xs">COPY . .</code><span className="text-xs text-muted-foreground ml-2">← レイヤー3</span></div>
              <div className="bg-card border rounded p-3"><code className="text-xs">RUN npm install</code><span className="text-xs text-muted-foreground ml-2">← レイヤー2</span></div>
              <div className="bg-card border rounded p-3"><code className="text-xs">FROM node:18-alpine</code><span className="text-xs text-muted-foreground ml-2">← レイヤー1</span></div>
            </div>
          </div>

          <div className="bg-card rounded-2xl p-6 border border-border">
            <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              ベストプラクティス
            </h3>
            <div className="space-y-2">
              <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div><h4 className="font-semibold text-sm">軽量なベースイメージを使用</h4><p className="text-xs text-muted-foreground">alpine版でサイズ削減</p></div>
              </div>
              <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div><h4 className="font-semibold text-sm">レイヤーの順序を最適化</h4><p className="text-xs text-muted-foreground">変更頻度の低いものを先に配置</p></div>
              </div>
              <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div><h4 className="font-semibold text-sm">.dockerignoreの活用</h4><p className="text-xs text-muted-foreground">不要ファイルを除外</p></div>
              </div>
              <div className="flex items-start gap-2 bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                <div><h4 className="font-semibold text-sm">マルチステージビルド</h4><p className="text-xs text-muted-foreground">最終イメージを軽量化</p></div>
              </div>
            </div>
          </div>

          <div className="bg-gradient-to-r from-blue-500/10 via-purple-500/10 to-pink-500/10 border border-blue-500/20 rounded-2xl p-6">
            <h3 className="text-xl font-bold mb-3 flex items-center gap-2">
              <Play className="w-5 h-5 text-blue-500" />
              実際に試してみよう！
            </h3>
            <p className="text-muted-foreground mb-4">「ビルド」タブに移動して、実際にDockerfileを編集してイメージをビルドしてみましょう。ビルドプロセスをリアルタイムで確認できます。</p>
            <button onClick={() => setActiveTab('build')} className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white font-medium hover:shadow-lg transition-all flex items-center gap-2">
              <Play className="w-4 h-4" />
              ビルドタブで試す
            </button>
          </div>
        </motion.div>
      )}

      {/* Build Tab */}
      {activeTab === 'build' && (
        <div className="space-y-6">
          {/* Build Actions */}
          <div className="flex gap-3 justify-end">
            <button 
              onClick={() => setShowTemplateDialog(true)}
              className="px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              テンプレート
            </button>
            <button 
              onClick={startBuild}
              disabled={isBuilding}
              className="px-6 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 text-white hover:shadow-lg transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isBuilding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
              {isBuilding ? 'ビルド中...' : 'ビルド開始'}
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">{/* Build Steps */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 border rounded-2xl p-6 bg-card"
        >
          <div className="flex items-center gap-2 mb-6">
            <Layers className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">ビルドステップ</h2>
            {buildSession && (
              <span className="ml-auto text-sm text-muted-foreground">
                {buildSession.imageName}:{buildSession.imageTag}
              </span>
            )}
          </div>

          {!buildSession ? (
            <div className="text-center py-12 text-muted-foreground">
              <Terminal className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>「ビルド開始」をクリックして実際のDockerイメージをビルド</p>
            </div>
          ) : (
            <div className="space-y-4">
              {buildSession.steps.map((step, index) => (
                <motion.div
                  key={step.step}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.05 * index }}
                  className={`relative p-4 rounded-xl border-2 transition-all ${
                    step.status === 'running'
                      ? 'border-blue-500 bg-blue-500/5'
                      : step.status === 'completed'
                      ? 'border-green-500/30 bg-green-500/5'
                      : step.status === 'error'
                      ? 'border-red-500/30 bg-red-500/5'
                      : 'border-border bg-muted/30'
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                      step.status === 'running'
                        ? 'bg-blue-500/20'
                        : step.status === 'completed'
                        ? 'bg-green-500/20'
                        : step.status === 'error'
                        ? 'bg-red-500/20'
                        : 'bg-muted'
                    }`}>
                      {step.status === 'running' ? (
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                      ) : step.status === 'completed' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                      ) : (
                        <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold">Step {step.step}</h3>
                      </div>
                      <code className="text-xs text-muted-foreground block mb-2">{step.command}</code>
                      {step.output && (
                        <div className="mt-2 p-2 bg-black/50 rounded text-xs font-mono text-green-400 max-h-24 overflow-y-auto whitespace-pre-wrap">
                          {step.output}
                        </div>
                      )}
                      {step.status === 'running' && (
                        <div className="flex-1 max-w-xs mt-2">
                          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                              initial={{ width: '0%' }}
                              animate={{ width: '100%' }}
                              transition={{ duration: 2, repeat: Infinity }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Build Info */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
          className="space-y-6"
        >
          {/* Status Card */}
          <div className="border rounded-2xl p-6 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <Container className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">ビルド状態</h3>
            </div>
            <div className="space-y-3">
              {queueJob && (
                <>
                  <div className="flex justify-between items-center pb-3 border-b border-border">
                    <span className="text-sm text-muted-foreground">Job ID</span>
                    <span className="text-xs font-mono text-primary">{queueJob.jobId}</span>
                  </div>
                  {queueJob.progress !== undefined && (
                    <div className="pb-3 border-b border-border">
                      <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-muted-foreground">進捗</span>
                        <span className="text-sm font-medium">{queueJob.progress}%</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <motion.div
                          className="h-full bg-gradient-to-r from-blue-500 to-cyan-500"
                          initial={{ width: '0%' }}
                          animate={{ width: `${queueJob.progress}%` }}
                          transition={{ duration: 0.3 }}
                        />
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">ステータス</span>
                <span className="flex items-center gap-2 text-sm font-medium">
                  {isBuilding ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                      {queueJob?.status === 'queued' ? 'キュー待機中' : 'ビルド中'}
                    </>
                  ) : !buildSession ? (
                    '待機中'
                  ) : buildSession.status === 'completed' ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 text-green-500" />
                      完了
                    </>
                  ) : buildSession.status === 'error' ? (
                    'エラー'
                  ) : (
                    buildSession.status
                  )}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">イメージサイズ</span>
                <span className="text-sm font-medium">
                  {buildSession?.imageSize ? formatBytes(buildSession.imageSize) : '-'}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">レイヤー数</span>
                <span className="text-sm font-medium">
                  {buildSession?.steps.length || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Dockerfile Preview */}
          <div className="border rounded-2xl p-6 bg-card">
            <div className="flex items-center gap-2 mb-4">
              <FileCode className="w-5 h-5 text-primary" />
              <h3 className="font-semibold">Dockerfile</h3>
            </div>
            <div className="space-y-4">
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">イメージ名</label>
                <input
                  type="text"
                  value={imageName}
                  onChange={(e) => setImageName(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="cloud-dojo-app"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">タグ</label>
                <input
                  type="text"
                  value={imageTag}
                  onChange={(e) => setImageTag(e.target.value)}
                  className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="latest"
                />
              </div>
              <div>
                <label className="text-sm text-muted-foreground mb-2 block">Dockerfile内容</label>
                <textarea
                  value={dockerfile}
                  onChange={(e) => {
                    const value = e.target.value;
                    setDockerfile(value);
                    
                    // Dockerfile内の命令を検出してヒントを生成
                    const lines = value.split('\n');
                    const hints: Array<{line: number, instruction: string}> = [];
                    
                    lines.forEach((line, index) => {
                      const trimmed = line.trim();
                      // コメント行は除外
                      if (trimmed.startsWith('#')) return;
                      
                      // Docker命令を検出
                      const match = trimmed.match(/^(FROM|WORKDIR|COPY|RUN|EXPOSE|CMD|ENV|ARG)\s/);
                      if (match && dockerInstructions[match[1] as keyof typeof dockerInstructions]) {
                        hints.push({ line: index + 1, instruction: match[1] });
                      }
                    });
                    
                    setActiveHints(hints);
                  }}
                  className="w-full h-64 px-3 py-2 bg-muted border border-border rounded-lg text-xs font-mono focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                  spellCheck={false}
                />
                
                {/* Learning Hints */}
                {activeHints.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
                      <Lightbulb className="w-4 h-4" />
                      <span>検出された命令のヒント</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {activeHints.slice(0, 5).map((hint, index) => {
                        const instruction = dockerInstructions[hint.instruction as keyof typeof dockerInstructions];
                        return (
                          <button
                            key={index}
                            onClick={() => {
                              setSelectedInstruction(hint.instruction);
                              setShowHelpDialog(true);
                            }}
                            className="px-3 py-2 rounded-lg bg-blue-500/10 border border-blue-500/20 hover:border-blue-500/40 transition-colors text-left group"
                          >
                            <div className="flex items-center gap-2">
                              <code className="text-xs font-mono text-blue-600 dark:text-blue-400 font-bold">
                                {hint.instruction}
                              </code>
                              <span className="text-xs text-muted-foreground">L{hint.line}</span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-1 group-hover:text-foreground transition-colors">
                              {instruction?.tips[0]}
                            </p>
                          </button>
                        );
                      })}
                      {activeHints.length > 5 && (
                        <button
                          onClick={() => setShowHelpDialog(true)}
                          className="px-3 py-2 rounded-lg border border-border hover:border-primary transition-colors text-xs text-muted-foreground hover:text-foreground"
                        >
                          +{activeHints.length - 5}件のヒント
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </div>
        </div>
      )}

      {/* Containers Tab */}
      {activeTab === 'containers' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border rounded-2xl p-6 bg-card"
        >
          <div className="flex items-center gap-2 mb-6">
            <Container className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">コンテナ一覧</h2>
          </div>
          
          {containers.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Container className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>コンテナがありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {containers.map((container) => (
                <div
                  key={container.id}
                  className="p-4 rounded-xl border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold">{container.name}</h3>
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          container.state === 'running'
                            ? 'bg-green-500/20 text-green-500'
                            : 'bg-gray-500/20 text-gray-500'
                        }`}>
                          {container.state}
                        </span>
                      </div>
                      <p className="text-sm text-muted-foreground mb-1">
                        <span className="font-mono">{container.image}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ID: {container.id.substring(0, 12)} | 作成: {formatDate(container.created)}
                      </p>
                      {container.ports.length > 0 && (
                        <div className="mt-2 flex gap-2 flex-wrap">
                          {container.ports.map((port, i) => (
                            <span key={i} className="text-xs bg-muted px-2 py-1 rounded">
                              {port.public ? `${port.public}→` : ''}{port.private}/{port.type}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => deleteContainer(container.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-3">
                    {container.state === 'running' && (
                      <button
                        onClick={() => stopContainer(container.id)}
                        className="px-3 py-1 text-xs rounded-lg bg-orange-500/20 text-orange-500 hover:bg-orange-500/30 transition-colors flex items-center gap-1"
                      >
                        <Square className="w-3 h-3" />
                        停止
                      </button>
                    )}
                    <button
                      onClick={() => viewContainerLogs(container.id)}
                      className="px-3 py-1 text-xs rounded-lg bg-blue-500/20 text-blue-500 hover:bg-blue-500/30 transition-colors flex items-center gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      ログ表示
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Images Tab */}
      {activeTab === 'images' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="border rounded-2xl p-6 bg-card"
        >
          <div className="flex items-center gap-2 mb-6">
            <Package className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-bold">イメージ一覧</h2>
          </div>
          
          {images.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Package className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>イメージがありません</p>
            </div>
          ) : (
            <div className="space-y-3">
              {images.map((image) => (
                <div
                  key={image.id}
                  className="p-4 rounded-xl border border-border hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="font-semibold font-mono text-sm">
                          {image.tags.length > 0 ? image.tags[0] : '<none>'}
                        </h3>
                        <span className="text-xs text-muted-foreground">
                          {formatBytes(image.size)}
                        </span>
                      </div>
                      {image.tags.length > 1 && (
                        <p className="text-xs text-muted-foreground mb-1">
                          他のタグ: {image.tags.slice(1).join(', ')}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        ID: {image.id.substring(7, 19)} | 作成: {formatDate(image.created)}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => runContainer(image.tags[0] || image.id)}
                        className="p-2 rounded-lg hover:bg-green-500/20 text-green-500 transition-colors"
                        title="実行"
                      >
                        <PlayCircle className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => deleteImage(image.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-red-500 transition-colors"
                        title="削除"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Run Container Dialog */}
      <AnimatePresence>
        {showRunDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowRunDialog(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-md mx-4"
            >
              <h3 className="text-xl font-bold mb-4">コンテナを実行</h3>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">イメージ</label>
                  <input
                    type="text"
                    value={selectedImage}
                    disabled
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm"
                  />
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">コンテナ名 (任意)</label>
                  <input
                    type="text"
                    value={containerName}
                    onChange={(e) => setContainerName(e.target.value)}
                    className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    placeholder="my-container"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">ホストポート</label>
                    <input
                      type="number"
                      value={hostPort}
                      onChange={(e) => setHostPort(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                      placeholder="8080"
                    />
                    <p className="text-xs text-muted-foreground mt-1">※ポート3000-3003は開発サーバーが使用中です</p>
                  </div>
                  <div>
                    <label className="text-sm text-muted-foreground mb-2 block">コンテナポート</label>
                    <input
                      type="number"
                      value={containerPort}
                      onChange={(e) => setContainerPort(e.target.value)}
                      className="w-full px-3 py-2 bg-muted border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                  </div>
                </div>
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={() => setShowRunDialog(false)}
                    className="flex-1 px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors"
                  >
                    キャンセル
                  </button>
                  <button
                    onClick={executeRunContainer}
                    className="flex-1 px-4 py-2 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:shadow-lg transition-all"
                  >
                    実行
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Container Logs Dialog */}
      <AnimatePresence>
        {selectedContainerLogs && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setSelectedContainerLogs(null)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-3xl mx-4 max-h-[80vh] flex flex-col"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold">コンテナログ</h3>
                <button
                  onClick={() => setSelectedContainerLogs(null)}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors"
                >
                  閉じる
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-black/50 rounded-lg p-4 font-mono text-xs text-green-400 whitespace-pre-wrap">
                {containerLogs || 'ログがありません'}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Template Dialog */}
      <AnimatePresence>
        {showTemplateDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowTemplateDialog(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-4xl mx-4 max-h-[80vh] overflow-auto"
            >
              <h3 className="text-xl font-bold mb-4">Dockerfile テンプレート</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Object.entries(dockerfileTemplates).map(([key, template]) => (
                  <button
                    key={key}
                    onClick={() => {
                      setDockerfile(template.dockerfile);
                      setShowTemplateDialog(false);
                    }}
                    className="p-4 rounded-xl border-2 border-border hover:border-primary transition-colors text-left group"
                  >
                    <h4 className="font-semibold text-lg mb-2 group-hover:text-primary transition-colors">
                      {template.name}
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      {template.description}
                    </p>
                    <pre className="text-xs bg-muted p-3 rounded-lg overflow-x-auto font-mono">
                      {template.dockerfile.split('\n').slice(0, 4).join('\n')}
                      {template.dockerfile.split('\n').length > 4 && '\n...'}
                    </pre>
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

      {/* Learning Guide Dialog */}
      <AnimatePresence>
        {showHelpDialog && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowHelpDialog(false)}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card border border-border rounded-2xl p-6 w-full max-w-4xl mx-4 max-h-[85vh] overflow-auto"
            >
              <div className="flex items-center gap-3 mb-6">
                <BookOpen className="w-6 h-6 text-primary" />
                <h3 className="text-2xl font-bold">Docker学習ガイド</h3>
              </div>

              {selectedInstruction ? (
                <div>
                  <button
                    onClick={() => setSelectedInstruction('')}
                    className="text-sm text-muted-foreground hover:text-foreground mb-4"
                  >
                    ← 一覧に戻る
                  </button>
                  {dockerInstructions[selectedInstruction as keyof typeof dockerInstructions] && (
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-xl font-bold mb-2">
                          {dockerInstructions[selectedInstruction as keyof typeof dockerInstructions].title}
                        </h4>
                        <p className="text-muted-foreground">
                          {dockerInstructions[selectedInstruction as keyof typeof dockerInstructions].description}
                        </p>
                      </div>

                      <div className="bg-muted p-4 rounded-xl">
                        <h5 className="font-semibold mb-2 flex items-center gap-2">
                          <Terminal className="w-4 h-4" />
                          使用例
                        </h5>
                        <code className="text-sm font-mono text-primary">
                          {dockerInstructions[selectedInstruction as keyof typeof dockerInstructions].example}
                        </code>
                      </div>

                      <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl">
                        <h5 className="font-semibold mb-3 flex items-center gap-2 text-blue-600 dark:text-blue-400">
                          <Lightbulb className="w-4 h-4" />
                          ベストプラクティス
                        </h5>
                        <ul className="space-y-2">
                          {dockerInstructions[selectedInstruction as keyof typeof dockerInstructions].tips.map((tip, i) => (
                            <li key={i} className="flex items-start gap-2 text-sm">
                              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
                              <span>{tip}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <p className="text-muted-foreground mb-6">
                    Dockerfileでよく使用される命令について学びましょう
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(dockerInstructions).map(([key, instruction]) => (
                      <button
                        key={key}
                        onClick={() => setSelectedInstruction(key)}
                        className="p-4 rounded-xl border-2 border-border hover:border-primary transition-colors text-left group"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-bold text-lg group-hover:text-primary transition-colors">
                            {key}
                          </h4>
                          <HelpCircle className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {instruction.description}
                        </p>
                      </button>
                    ))}
                  </div>

                  <div className="mt-8 p-6 bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-xl">
                    <h4 className="font-bold text-lg mb-3 flex items-center gap-2">
                      <BookOpen className="w-5 h-5" />
                      学習のポイント
                    </h4>
                    <ul className="space-y-2 text-sm">
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 mt-1">1.</span>
                        <span>レイヤーキャッシュを活用して、ビルド時間を短縮しましょう</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 mt-1">2.</span>
                        <span>マルチステージビルドで、本番イメージのサイズを最小化しましょう</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 mt-1">3.</span>
                        <span>.dockerignoreファイルで不要なファイルを除外しましょう</span>
                      </li>
                      <li className="flex items-start gap-2">
                        <span className="text-purple-600 dark:text-purple-400 mt-1">4.</span>
                        <span>セキュリティのため、alpine版のイメージを使用しましょう</span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => {
                    setShowHelpDialog(false);
                    setSelectedInstruction('');
                  }}
                  className="px-4 py-2 rounded-xl border border-border hover:bg-accent transition-colors"
                >
                  閉じる
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
