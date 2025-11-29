# Cloud Dojo 🥋

**DevOps/インフラ学習プラットフォーム with AI 解説**

Cloud Dojo は、CI/CD、Docker、Kubernetes、クラウドインフラなどの体系的な理解を深めるための個人学習プラットフォームです。実際の操作をリアルタイムで可視化し、AI が状況を解説することで、インフラ技術の本質的な理解を促進します。

## 🎯 コンセプト

- **リアルタイム可視化**: Docker ビルドプロセス、Kubernetes デプロイメント、ログストリームを動的に表示
- **AI 解説**: 全ての操作と状態を AI が分析し、わかりやすく解説
- **実践的学習**: 実際に手を動かしながら、インフラの動作を体験
- **体系的知識**: AWS/GCP/Azure、CI/CD、コンテナ、オーケストレーションを網羅

## 🏗️ アーキテクチャ

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React + TS)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Build        │ │ K8s DAG      │ │ AI Chat              │ │
│  │ Animation    │ │ Visualizer   │ │ Assistant            │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  ┌──────────────────────────────────────────────────────────┤
│  │         Log Stream & Metrics Dashboard                   │
│  └──────────────────────────────────────────────────────────┘
└────────────────────────┬────────────────────────────────────┘
                         │ WebSocket / REST API
┌────────────────────────▼────────────────────────────────────┐
│              Backend API (Node.js + Fastify)                │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Auth &       │ │ WebSocket    │ │ AI API               │ │
│  │ User Mgmt    │ │ Manager      │ │ Integration          │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
└────────────────────────┬────────────────────────────────────┘
                         │ Task Queue / REST
┌────────────────────────▼────────────────────────────────────┐
│                Worker Layer (Go + Fiber)                    │
│  ┌──────────────┐ ┌──────────────┐ ┌──────────────────────┐ │
│  │ Docker API   │ │ Kubernetes   │ │ GitHub API           │ │
│  │ Operations   │ │ Operations   │ │ Operations           │ │
│  └──────────────┘ └──────────────┘ └──────────────────────┘ │
│  └──────────────────────────────────────────────────────────┤
│              Event Stream Generator                         │
└─────────────────────────────────────────────────────────────┘
                         │
┌────────────────────────▼────────────────────────────────────┐
│                Data Store Layer                             │
│  ┌──────────────────┐      ┌──────────────────────────────┐ │
│  │   PostgreSQL     │      │         Redis                │ │
│  │ - User data      │      │ - Event queue                │ │
│  │ - Exec history   │      │ - AI context cache           │ │
│  └──────────────────┘      └──────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 主要機能

### 1. Docker ビルドプロセス可視化

- レイヤーごとのビルド進捗をアニメーション表示
- キャッシュヒット/ミスの可視化
- ビルド時間の分析とボトルネック特定
- AI による Dockerfile 最適化提案

### 2. Kubernetes デプロイメント DAG

- Pod/Service/Deployment の依存関係を視覚的に表示
- リソースの状態変化をリアルタイム追跡
- ローリングアップデートの進行状況
- AI によるマニフェスト解説とベストプラクティス提案

### 3. ログストリーム & メトリクス

- 複数コンテナのログを統合表示
- リソース使用率のリアルタイムグラフ
- エラー/警告の自動検出とハイライト
- AI によるログ分析と問題診断

### 4. AI 学習アシスタント

- 現在実行中の処理をリアルタイム解説
- ユーザーの質問に文脈を理解して回答
- エラー原因の分析と解決策提案
- 関連する技術概念の説明

### 5. 学習トラック

- 段階的な学習パスの提供
- Docker 基礎 → CI/CD → Kubernetes → マルチクラウド
- ハンズオン課題と自動評価
- 進捗管理と成果の可視化

## 📦 技術スタック

### Frontend

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **UI Library**: Material-UI / shadcn/ui
- **Visualization**: D3.js, React Flow, Mermaid
- **State Management**: Zustand / Jotai
- **WebSocket**: Socket.io-client

### Backend API

- **Runtime**: Node.js 20+
- **Framework**: Fastify
- **Language**: TypeScript
- **WebSocket**: Socket.io
- **ORM**: Prisma
- **Validation**: Zod
- **AI Integration**: Anthropic Claude API

### Worker

- **Language**: Go 1.21+
- **Framework**: Fiber
- **Docker SDK**: docker/docker
- **Kubernetes**: client-go
- **GitHub**: go-github

### Data Store

- **Database**: PostgreSQL 15
- **Cache**: Redis 7
- **Migration**: Prisma Migrate

### Infrastructure

- **Container**: Docker & Docker Compose
- **Orchestration**: Kubernetes (k3s for local)
- **CI/CD**: GitHub Actions
- **IaC**: Terraform (optional)

## 🛠️ セットアップ

### 前提条件

- Docker & Docker Compose
- Node.js 20+
- Go 1.21+
- Git

### クイックスタート

```bash
# リポジトリのクローン
git clone https://github.com/yourusername/cloud-dojo.git
cd cloud-dojo

# 環境変数の設定
cp .env.example .env
# .env を編集して必要な設定を追加

# 開発環境の起動
docker-compose up -d

# フロントエンドにアクセス
open http://localhost:3000
```

### 個別セットアップ

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

#### Backend API

```bash
cd backend/api
npm install
npm run dev
```

#### Worker

```bash
cd backend/worker
go mod download
go run cmd/server/main.go
```

## 📚 学習パス

### Level 1: コンテナ基礎

- Dockerfile の書き方
- イメージのビルドとレイヤー理解
- マルチステージビルド
- コンテナネットワーキング

### Level 2: CI/CD

- GitHub Actions による自動ビルド
- イメージのプッシュとバージョニング
- テスト自動化
- セキュリティスキャン

### Level 3: Kubernetes

- Pod/Deployment/Service の理解
- ConfigMap と Secret の管理
- Rolling Update と Canary Deploy
- リソース管理とオートスケーリング

### Level 4: クラウドプラットフォーム

- AWS (ECS/EKS)
- GCP (GKE/Cloud Run)
- Azure (AKS)
- マルチクラウド戦略

### Level 5: 可観測性と SRE

- Prometheus & Grafana
- 分散トレーシング
- ログ集約
- SLO/SLI 設定

## 🤝 開発

### プロジェクト構成

```
cloud-dojo/
├── frontend/              # React フロントエンド
│   ├── src/
│   │   ├── components/   # UIコンポーネント
│   │   ├── features/     # 機能別モジュール
│   │   ├── hooks/        # カスタムフック
│   │   ├── store/        # 状態管理
│   │   └── utils/        # ユーティリティ
│   └── package.json
├── backend/
│   ├── api/              # Node.js API サーバー
│   │   ├── src/
│   │   │   ├── routes/   # APIルート
│   │   │   ├── services/ # ビジネスロジック
│   │   │   ├── websocket/# WebSocket管理
│   │   │   └── ai/       # AI統合
│   │   └── package.json
│   └── worker/           # Go ワーカー
│       ├── cmd/
│       ├── internal/
│       │   ├── docker/   # Docker操作
│       │   ├── k8s/      # K8s操作
│       │   └── github/   # GitHub操作
│       └── go.mod
├── database/
│   ├── migrations/       # DBマイグレーション
│   └── schema.sql
├── docker-compose.yml    # 開発環境
├── docker-compose.prod.yml
└── .github/
    └── workflows/        # CI/CD設定
```

### テスト

```bash
# Frontend
cd frontend && npm test

# Backend API
cd backend/api && npm test

# Worker
cd backend/worker && go test ./...

# E2E
npm run test:e2e
```

## 📝 ライセンス

MIT License

## 🙏 謝辞

このプロジェクトは、DevOps/インフラ技術の学習をより効果的にするために作成されました。
