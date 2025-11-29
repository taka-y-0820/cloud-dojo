# Cloud Dojo - セットアップガイド

## 🚀 クイックスタート

### 前提条件

以下がインストールされていることを確認してください:

- **Docker Desktop** (Windows/Mac) または **Docker Engine** (Linux)
- **Docker Compose** v2.0+
- **Node.js** 20+
- **pnpm** 8+ (`npm install -g pnpm`)
- **Go** 1.21+
- **Git**

### 1. リポジトリのクローン

```bash
git clone https://github.com/yourusername/cloud-dojo.git
cd cloud-dojo
```

### 2. 環境変数の設定

```bash
# .env ファイルを作成
cp .env.example .env

# .env を編集して必要な値を設定
# 特に ANTHROPIC_API_KEY は必須です
```

### 3. Docker Compose で起動

```bash
# すべてのサービスを起動
docker-compose up -d

# ログを確認
docker-compose logs -f
```

### 4. アクセス

- **Frontend**: http://localhost:3000
- **API**: http://localhost:4000
- **Worker**: http://localhost:5000
- **Prisma Studio**: `cd backend/api && npm run prisma:studio`

## 📦 個別セットアップ

### すべての依存関係をインストール

```bash
# ルートディレクトリで
pnpm install
```

### Frontend

```bash
pnpm --filter frontend dev
```

### Backend API

```bash
# データベースマイグレーション
pnpm db:migrate

# 開発サーバー起動
pnpm --filter cloud-dojo-api dev
```

### Worker

```bash
cd backend/worker
go mod download
go run cmd/server/main.go
```

## 🧪 テスト実行

```bash
# すべてのテストを実行
pnpm test

# Frontend のみ
pnpm --filter frontend test

# Backend API のみ
pnpm --filter cloud-dojo-api test

# Worker のみ
cd backend/worker && go test ./...
```

## 🏗️ ビルド

```bash
# すべてをビルド
pnpm build

# Docker イメージをビルド
docker-compose build
```

## 📝 開発ワークフロー

1. **新しい機能の開発**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **変更をコミット**
   ```bash
   git add .
   git commit -m "feat: your feature description"
   ```

3. **テストを実行**
   ```bash
   npm test
   ```

4. **プルリクエストを作成**
   ```bash
   git push origin feature/your-feature-name
   ```

## 🐛 トラブルシューティング

### Docker が起動しない

```bash
# コンテナを削除して再起動
docker-compose down
docker-compose up -d --force-recreate
```

### データベース接続エラー

```bash
# PostgreSQL が起動しているか確認
docker-compose ps postgres

# データベースをリセット
docker-compose down -v
docker-compose up -d
```

### ポートが使用中

```bash
# 使用中のポートを確認
netstat -ano | findstr :3000
netstat -ano | findstr :4000
netstat -ano | findstr :5000

# .env でポートを変更
API_PORT=4001
```

## 📚 次のステップ

- [Architecture Guide](./docs/ARCHITECTURE.md) - システムアーキテクチャの詳細
- [API Documentation](./docs/API.md) - API エンドポイント一覧
- [Contributing Guide](./CONTRIBUTING.md) - 貢献方法

## 💡 ヒント

- **ホットリロード**: コードを変更すると自動的に再読み込みされます
- **Prisma Studio**: データベースを GUI で確認・編集できます
- **Docker ログ**: `docker-compose logs -f [service-name]` で特定のサービスのログを確認
