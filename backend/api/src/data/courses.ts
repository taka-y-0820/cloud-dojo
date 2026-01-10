// 学習コース定義
export interface Course {
  id: string;
  title: string;
  description: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  duration: string;
  modules: Module[];
  prerequisites?: string[];
}

export interface Module {
  id: string;
  title: string;
  description: string;
  lessons: Lesson[];
  quiz?: Quiz;
}

export interface Lesson {
  id: string;
  title: string;
  type: 'theory' | 'hands-on' | 'quiz' | 'exercise';
  content: string;
  codeExample?: CodeExample;
  tasks?: Task[];
  estimatedTime: number; // minutes
}

export interface CodeExample {
  language: string;
  code: string;
  explanation: string;
}

export interface Task {
  id: string;
  instruction: string;
  validation?: ValidationRule;
  hint?: string;
}

export interface ValidationRule {
  type: 'command' | 'file' | 'api';
  expected: any;
}

export interface Quiz {
  id: string;
  questions: QuizQuestion[];
}

export interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

// ================================
// Docker 基礎コース
// ================================
export const dockerFundamentalsCourse: Course = {
  id: 'docker-fundamentals',
  title: 'Docker Fundamentals',
  description: 'コンテナ技術の基礎から実践まで、Dockerを完全マスター',
  level: 'Beginner',
  duration: '6 hours',
  modules: [
    {
      id: 'docker-intro',
      title: '1. Dockerとは何か',
      description: 'コンテナ技術の概念とDockerの基礎を学ぶ',
      lessons: [
        {
          id: 'docker-intro-1',
          title: 'コンテナ vs 仮想マシン',
          type: 'theory',
          estimatedTime: 15,
          content: `# コンテナと仮想マシンの違い

## 仮想マシン（VM）
- ハイパーバイザー上で完全なOSを実行
- 各VMが独自のカーネルを持つ
- リソース消費が大きい（GB単位）
- 起動に数分かかる

## コンテナ
- ホストOSのカーネルを共有
- プロセスレベルで隔離
- 軽量（MB単位）
- 起動が高速（数秒）

## なぜコンテナが重要か？
1. **移植性**: "It works on my machine"問題の解決
2. **効率性**: リソースの有効活用
3. **スケーラビリティ**: 素早くスケール
4. **一貫性**: 開発から本番まで同じ環境`,
        },
        {
          id: 'docker-intro-2',
          title: 'Docker Engineの仕組み',
          type: 'theory',
          estimatedTime: 20,
          content: `# Docker Engineアーキテクチャ

## 主要コンポーネント

### 1. Docker Daemon (dockerd)
- バックグラウンドで動作するサービス
- コンテナの作成・実行・監視を担当

### 2. Docker Client (docker)
- コマンドラインインターフェース
- REST API経由でDaemonと通信

### 3. Docker Registry
- イメージの保存・配布
- Docker Hub（公式レジストリ）

## イメージとコンテナ

\`\`\`
イメージ = 実行可能なパッケージ（設計図）
  ↓
コンテナ = イメージの実行インスタンス（実行中のプロセス）
\`\`\`

## レイヤーシステム
- イメージは複数のレイヤーで構成
- 各レイヤーは変更点のみを保持
- レイヤーの再利用でストレージ効率化`,
        },
        {
          id: 'docker-intro-3',
          title: 'はじめてのDocker実行',
          type: 'hands-on',
          estimatedTime: 30,
          content: `# 初めてのDockerコンテナ

実際にDockerコンテナを動かしてみましょう！`,
          codeExample: {
            language: 'bash',
            code: `# Hello Worldコンテナの実行
docker run hello-world

# Nginx Webサーバーの起動
docker run -d -p 8080:80 --name my-nginx nginx

# 実行中のコンテナ確認
docker ps

# コンテナのログ表示
docker logs my-nginx

# コンテナに入る
docker exec -it my-nginx bash

# コンテナの停止と削除
docker stop my-nginx
docker rm my-nginx`,
            explanation: `各コマンドの解説：
- \`docker run\`: イメージからコンテナを作成・起動
- \`-d\`: デタッチドモード（バックグラウンド実行）
- \`-p 8080:80\`: ポートマッピング（ホスト:コンテナ）
- \`--name\`: コンテナに名前をつける
- \`docker exec -it\`: 実行中のコンテナで対話的にコマンド実行`,
          },
          tasks: [
            {
              id: 'task-1',
              instruction:
                'nginx:alpine イメージを使ってコンテナを起動し、ポート3000でアクセスできるようにしてください',
              hint: 'docker run -d -p 3000:80 nginx:alpine',
            },
            {
              id: 'task-2',
              instruction: '実行中のコンテナの一覧を表示してください',
              hint: 'docker ps',
            },
          ],
        },
      ],
    },
    {
      id: 'dockerfile-basics',
      title: '2. Dockerfileの書き方',
      description: 'カスタムイメージの作成方法を学ぶ',
      lessons: [
        {
          id: 'dockerfile-1',
          title: 'Dockerfileの基本構文',
          type: 'theory',
          estimatedTime: 25,
          content: `# Dockerfile基本命令

## 必須命令

### FROM
ベースイメージの指定
\`\`\`dockerfile
FROM node:20-alpine
\`\`\`

### RUN
イメージビルド時にコマンド実行
\`\`\`dockerfile
RUN npm install
\`\`\`

### COPY / ADD
ファイルをイメージにコピー
\`\`\`dockerfile
COPY package.json .
ADD https://example.com/file.tar.gz /tmp/
\`\`\`

### CMD
コンテナ起動時のデフォルトコマンド
\`\`\`dockerfile
CMD ["node", "server.js"]
\`\`\`

### ENTRYPOINT
コンテナの実行可能ファイルを設定
\`\`\`dockerfile
ENTRYPOINT ["docker-entrypoint.sh"]
\`\`\`

## よく使う命令

### WORKDIR
作業ディレクトリの設定
\`\`\`dockerfile
WORKDIR /app
\`\`\`

### ENV
環境変数の設定
\`\`\`dockerfile
ENV NODE_ENV=production
\`\`\`

### EXPOSE
ポートの公開
\`\`\`dockerfile
EXPOSE 3000
\`\`\``,
        },
        {
          id: 'dockerfile-2',
          title: 'マルチステージビルド',
          type: 'hands-on',
          estimatedTime: 35,
          content: `# マルチステージビルドで最適化

本番環境用の軽量イメージを作成する技術`,
          codeExample: {
            language: 'dockerfile',
            code: `# ビルドステージ
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 本番ステージ
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY package*.json ./
ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/server.js"]`,
            explanation: `マルチステージビルドの利点：
1. **サイズ削減**: ビルドツールを本番イメージに含めない
2. **セキュリティ**: 不要なツールを排除
3. **効率**: ビルドキャッシュの活用

この例では：
- builderステージでアプリをビルド
- 本番ステージでビルド成果物のみをコピー
- 結果として数百MB削減可能`,
          },
          tasks: [
            {
              id: 'task-dockerfile-1',
              instruction: 'Python Flaskアプリのマルチステージビルドを作成してください',
              hint: 'ビルドステージで依存関係をインストールし、本番ステージで必要なファイルのみコピー',
            },
          ],
        },
      ],
    },
    {
      id: 'docker-compose',
      title: '3. Docker Composeで複数コンテナ管理',
      description: 'マイクロサービスアーキテクチャの基礎',
      lessons: [
        {
          id: 'compose-1',
          title: 'Docker Compose基礎',
          type: 'theory',
          estimatedTime: 20,
          content: `# Docker Composeとは

複数のコンテナを定義・実行するツール

## なぜCompose？
- 複数コンテナの一括管理
- 依存関係の定義
- 環境変数の管理
- ネットワークの自動構成

## docker-compose.yml基本構造

\`\`\`yaml
version: '3.8'

services:
  web:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
    depends_on:
      - db
  
  db:
    image: postgres:15
    environment:
      - POSTGRES_PASSWORD=secret
    volumes:
      - db-data:/var/lib/postgresql/data

volumes:
  db-data:
\`\`\``,
        },
        {
          id: 'compose-2',
          title: 'Full Stack アプリの構築',
          type: 'hands-on',
          estimatedTime: 45,
          content: `# React + Node.js + PostgreSQL構成を作る`,
          codeExample: {
            language: 'yaml',
            code: `version: '3.8'

services:
  frontend:
    build:
      context: ./frontend
      dockerfile: Dockerfile.dev
    ports:
      - "3000:3000"
    volumes:
      - ./frontend:/app
      - /app/node_modules
    environment:
      - REACT_APP_API_URL=http://localhost:4000
    depends_on:
      - backend

  backend:
    build:
      context: ./backend
      dockerfile: Dockerfile.dev
    ports:
      - "4000:4000"
    environment:
      - DATABASE_URL=postgresql://user:pass@db:5432/myapp
      - NODE_ENV=development
    volumes:
      - ./backend:/app
      - /app/node_modules
    depends_on:
      - db

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
      - POSTGRES_DB=myapp
    volumes:
      - postgres-data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

volumes:
  postgres-data:`,
            explanation: `この構成のポイント：
1. **Hot Reload**: ボリュームマウントで開発効率化
2. **依存関係**: depends_onで起動順序制御
3. **ネットワーク**: サービス名でアクセス可能
4. **データ永続化**: Named Volumeでデータ保持`,
          },
        },
      ],
    },
  ],
};

// ================================
// Kubernetes基礎コース
// ================================
export const kubernetesCourse: Course = {
  id: 'kubernetes-basics',
  title: 'Kubernetes Basics',
  description: 'コンテナオーケストレーションの決定版を学ぶ',
  level: 'Intermediate',
  duration: '8 hours',
  prerequisites: ['docker-fundamentals'],
  modules: [
    {
      id: 'k8s-intro',
      title: '1. Kubernetesの基礎概念',
      description: 'K8sアーキテクチャとコアリソースを理解する',
      lessons: [
        {
          id: 'k8s-intro-1',
          title: 'なぜKubernetesが必要か',
          type: 'theory',
          estimatedTime: 20,
          content: `# Kubernetesの必要性

## コンテナ運用の課題
- 数百〜数千のコンテナの管理
- 自動スケーリング
- 障害時の自動復旧
- ローリングアップデート
- サービスディスカバリー

## Kubernetesの解決策
1. **自動配置**: 最適なノードにコンテナを配置
2. **自己修復**: 障害コンテナの自動再起動
3. **水平スケーリング**: 負荷に応じた自動スケール
4. **サービス検出**: 自動的なロードバランシング
5. **宣言的管理**: "あるべき姿"を記述するだけ

## アーキテクチャ概要

\`\`\`
Control Plane (Master Node)
├── API Server: 全てのリクエストを受付
├── Scheduler: Podの配置先を決定
├── Controller Manager: 状態を監視・調整
└── etcd: クラスタ状態を保存

Worker Nodes
├── kubelet: Podの実行・監視
├── kube-proxy: ネットワーキング
└── Container Runtime: コンテナ実行（Docker/containerd）
\`\`\``,
        },
        {
          id: 'k8s-intro-2',
          title: 'Pod: 最小デプロイ単位',
          type: 'hands-on',
          estimatedTime: 30,
          content: `# Podの作成と管理`,
          codeExample: {
            language: 'yaml',
            code: `apiVersion: v1
kind: Pod
metadata:
  name: nginx-pod
  labels:
    app: nginx
spec:
  containers:
  - name: nginx
    image: nginx:1.25
    ports:
    - containerPort: 80
    resources:
      requests:
        memory: "64Mi"
        cpu: "250m"
      limits:
        memory: "128Mi"
        cpu: "500m"
    livenessProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 3
      periodSeconds: 3
    readinessProbe:
      httpGet:
        path: /
        port: 80
      initialDelaySeconds: 3
      periodSeconds: 3`,
            explanation: `Podの重要要素：
- **labels**: リソースの分類・選択に使用
- **resources**: CPU/メモリのリクエストと制限
- **probes**: ヘルスチェック
  - liveness: 動作確認（失敗で再起動）
  - readiness: トラフィック受付可能か確認`,
          },
          tasks: [
            {
              id: 'k8s-task-1',
              instruction: 'redis Podを作成し、ラベル app=cache をつけてください',
              hint: 'kubectl run redis --image=redis --labels=app=cache',
            },
          ],
        },
      ],
    },
    {
      id: 'k8s-deployments',
      title: '2. Deployment と Service',
      description: 'アプリケーションのデプロイと公開',
      lessons: [
        {
          id: 'k8s-deploy-1',
          title: 'Deploymentによる宣言的管理',
          type: 'hands-on',
          estimatedTime: 40,
          content: `# Deploymentでアプリを管理`,
          codeExample: {
            language: 'yaml',
            code: `apiVersion: apps/v1
kind: Deployment
metadata:
  name: webapp
  labels:
    app: webapp
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 1
  selector:
    matchLabels:
      app: webapp
  template:
    metadata:
      labels:
        app: webapp
    spec:
      containers:
      - name: webapp
        image: myapp:v1.0
        ports:
        - containerPort: 8080
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-secret
              key: url
        resources:
          requests:
            memory: "128Mi"
            cpu: "100m"
          limits:
            memory: "256Mi"
            cpu: "200m"
---
apiVersion: v1
kind: Service
metadata:
  name: webapp-service
spec:
  type: LoadBalancer
  selector:
    app: webapp
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8080`,
            explanation: `Deploymentの利点：
- **レプリカ管理**: 指定数のPodを自動維持
- **ローリングアップデート**: ゼロダウンタイムデプロイ
- **ロールバック**: 簡単に前バージョンに戻せる
- **スケーリング**: kubectl scale で簡単拡張

Serviceの役割：
- 複数Podへのロードバランシング
- 安定したエンドポイント提供
- サービスディスカバリー`,
          },
        },
      ],
    },
  ],
};

// 全コース一覧
export const allCourses: Course[] = [dockerFundamentalsCourse, kubernetesCourse];
