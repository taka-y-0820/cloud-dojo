# Database

このディレクトリにはデータベース関連のファイルが含まれています。

## ファイル

- `schema.sql`: データベーススキーマの参照用SQL（実際のスキーマはPrismaで管理）
- `seed.sql`: 開発用のシードデータ

## Prisma を使用したデータベース管理

実際のデータベーススキーマは Prisma を使用して管理されます。

### マイグレーション

```bash
cd backend/api
npm run prisma:migrate
```

### Prisma Studio (GUI)

```bash
cd backend/api
npm run prisma:studio
```

### スキーマの再生成

```bash
cd backend/api
npm run prisma:generate
```
