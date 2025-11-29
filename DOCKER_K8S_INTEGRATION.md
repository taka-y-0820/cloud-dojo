# Cloud Dojo - Docker/Kubernetes実装ガイド

## 現在の実装状態

### ✅ 実装済み（シミュレーション）
現在の実装は**学習用の可視化シミュレーション**です：

- **Docker Build**: モックデータでビルドプロセスを可視化
- **Kubernetes Deploy**: モックデータでデプロイメントを可視化
- **WebSocket**: リアルタイム通信（シミュレーション）

### 🚧 実際のDocker/K8s環境との統合

実際のDocker/Kubernetes環境で動作させるには、以下の実装が必要です：

## 実際のDocker統合

### 1. Go Workerの実装（推奨）

`backend/worker`ディレクトリにGoで実装：

```go
// backend/worker/internal/docker/builder.go
package docker

import (
    "context"
    "io"
    
    "github.com/docker/docker/api/types"
    "github.com/docker/docker/client"
)

type Builder struct {
    client *client.Client
}

func NewBuilder() (*Builder, error) {
    cli, err := client.NewClientWithOpts(client.FromEnv)
    if err != nil {
        return nil, err
    }
    
    return &Builder{client: cli}, nil
}

func (b *Builder) Build(ctx context.Context, dockerfile string, tag string) error {
    // 実際のDocker APIを使用してビルド
    buildContext := // tarアーカイブを作成
    
    resp, err := b.client.ImageBuild(ctx, buildContext, types.ImageBuildOptions{
        Tags: []string{tag},
        // ...
    })
    
    if err != nil {
        return err
    }
    
    defer resp.Body.Close()
    
    // ビルドログをWebSocketで送信
    io.Copy(os.Stdout, resp.Body)
    
    return nil
}
```

### 2. Node.js APIから直接Docker統合（代替案）

```typescript
// backend/api/src/services/docker.ts
import Docker from 'dockerode';

export class DockerService {
  private docker: Docker;
  
  constructor() {
    this.docker = new Docker();
  }
  
  async buildImage(dockerfile: string, tag: string) {
    const stream = await this.docker.buildImage({
      context: __dirname,
      src: ['Dockerfile', '.'],
    }, {
      t: tag,
    });
    
    return new Promise((resolve, reject) => {
      this.docker.modem.followProgress(stream, (err, res) => 
        err ? reject(err) : resolve(res)
      );
    });
  }
}
```

必要なパッケージ：
```bash
cd backend/api
pnpm add dockerode @types/dockerode
```

## 実際のKubernetes統合

### 1. Go Workerの実装

```go
// backend/worker/internal/k8s/deployer.go
package k8s

import (
    "context"
    
    metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
    "k8s.io/client-go/kubernetes"
    "k8s.io/client-go/tools/clientcmd"
)

type Deployer struct {
    clientset *kubernetes.Clientset
}

func NewDeployer(kubeconfig string) (*Deployer, error) {
    config, err := clientcmd.BuildConfigFromFlags("", kubeconfig)
    if err != nil {
        return nil, err
    }
    
    clientset, err := kubernetes.NewForConfig(config)
    if err != nil {
        return nil, err
    }
    
    return &Deployer{clientset: clientset}, nil
}

func (d *Deployer) Deploy(ctx context.Context, manifest string) error {
    // YAMLマニフェストをパースしてデプロイ
    // イベントをWebSocketで送信
    return nil
}
```

### 2. Node.js APIから直接K8s統合（代替案）

```typescript
// backend/api/src/services/kubernetes.ts
import * as k8s from '@kubernetes/client-node';

export class KubernetesService {
  private k8sApi: k8s.AppsV1Api;
  private coreApi: k8s.CoreV1Api;
  
  constructor() {
    const kc = new k8s.KubeConfig();
    kc.loadFromDefault();
    
    this.k8sApi = kc.makeApiClient(k8s.AppsV1Api);
    this.coreApi = kc.makeApiClient(k8s.CoreV1Api);
  }
  
  async createDeployment(name: string, image: string, replicas: number) {
    const deployment = {
      metadata: { name },
      spec: {
        replicas,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            containers: [{
              name,
              image,
              ports: [{ containerPort: 3000 }],
            }],
          },
        },
      },
    };
    
    return this.k8sApi.createNamespacedDeployment('default', deployment);
  }
}
```

必要なパッケージ：
```bash
cd backend/api
pnpm add @kubernetes/client-node
```

## 環境セットアップ

### 必要な環境

1. **Docker Desktop**
   - Windows/Mac: Docker Desktop インストール
   - Linux: Docker Engine + Docker Compose

2. **Kubernetes (ローカル開発)**
   - Docker Desktop の Kubernetes 機能を有効化
   - または minikube をインストール：
     ```bash
     # Windows
     choco install minikube
     
     # Mac
     brew install minikube
     
     # 起動
     minikube start
     ```

3. **kubectl**
   ```bash
   # Windows
   choco install kubernetes-cli
   
   # Mac
   brew install kubectl
   ```

### セキュリティ考慮事項

**⚠️ 重要**: 実際のDocker/K8s環境との統合には以下のリスクがあります：

1. **コンテナエスケープ**: 悪意のあるDockerfileでホストを侵害される可能性
2. **リソース枯渇**: 無制限のビルドでシステムリソースを使い果たす
3. **クラスター破壊**: 不適切なK8sマニフェストでクラスターを破壊

### 推奨アーキテクチャ

```
┌─────────────┐
│  Frontend   │ ← ユーザーインターフェース
└──────┬──────┘
       │ WebSocket/HTTP
┌──────┴──────┐
│ API Server  │ ← リクエスト検証、認証
└──────┬──────┘
       │ gRPC/Message Queue
┌──────┴──────┐
│ Go Worker   │ ← 実際のDocker/K8s操作（サンドボックス化）
└──────┬──────┘
       │
┌──────┴──────┐
│ Docker/K8s  │ ← 隔離された環境（VM、別クラスタ推奨）
└─────────────┘
```

### サンドボックス化の実装

実際の環境では、以下の対策が必須：

1. **専用VM/コンテナでWorkerを実行**
2. **リソース制限（CPU、メモリ、ディスク）**
3. **ネットワーク隔離**
4. **タイムアウト設定**
5. **Dockerfileのスキャンと検証**

```typescript
// 例: リソース制限
const buildOptions = {
  memory: 512 * 1024 * 1024, // 512MB
  memoryswap: 1024 * 1024 * 1024, // 1GB
  cpuperiod: 100000,
  cpuquota: 50000, // 50% CPU
};
```

## 現在のシミュレーション実装を維持する理由

学習プラットフォームとしては、現在のシミュレーション実装が適切です：

✅ **安全**: セキュリティリスクなし
✅ **高速**: 即座にフィードバック
✅ **予測可能**: 一貫した結果
✅ **低コスト**: インフラ不要

実際のDocker/K8s環境は、高度な学習や本番用途でのみ必要です。

## まとめ

- **現在**: 安全な学習用シミュレーション ✅
- **実装可能**: 実際のDocker/K8s統合（セキュリティ対策必須）
- **推奨**: まずシミュレーションで完成させ、必要に応じて段階的に実環境統合
