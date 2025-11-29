# Contributing to Cloud Dojo

Cloud Dojo への貢献に興味を持っていただき、ありがとうございます!

## 開発プロセス

1. **Issue の作成**: 新機能やバグ修正の前に Issue を作成してください
2. **ブランチの作成**: `feature/`, `fix/`, `docs/` などの接頭辞を使用
3. **コーディング**: コーディング規約に従ってください
4. **テスト**: 変更に対するテストを追加
5. **コミット**: 明確なコミットメッセージを書く
6. **プルリクエスト**: レビューのために PR を作成

## コミット規約

Conventional Commits を使用してください:

- `feat:` 新機能
- `fix:` バグ修正
- `docs:` ドキュメント
- `style:` フォーマット
- `refactor:` リファクタリング
- `test:` テスト追加
- `chore:` その他

例:
```
feat: Docker ビルド進捗のリアルタイム表示を追加
fix: WebSocket 接続エラーを修正
docs: API ドキュメントを更新
```

## コーディング規約

### TypeScript/JavaScript
- ESLint と Prettier の設定に従う
- 型定義を明示的に書く
- 関数にはコメントを追加

### Go
- `gofmt` でフォーマット
- `golangci-lint` でリント
- エラーハンドリングを適切に行う

## テストガイドライン

- すべての新機能にテストを追加
- カバレッジ 80% 以上を目指す
- E2E テストも考慮する

## 質問やサポート

- GitHub Issues で質問してください
- Discussions で議論に参加してください
