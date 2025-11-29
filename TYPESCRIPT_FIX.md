# 型エラーを解消する手順

TypeScriptがnode_modulesを認識していない場合、以下の手順を実行してください：

## 手順 1: TypeScript Language Server を再起動

1. **Ctrl + Shift + P** (Mac: Cmd + Shift + P) を押す
2. `TypeScript: Restart TS Server` と入力して実行

## 手順 2: VS Code ウィンドウをリロード

1. **Ctrl + Shift + P** を押す
2. `Developer: Reload Window` と入力して実行

## 手順 3: それでも解決しない場合

PowerShellで以下を実行：

```powershell
cd c:\Projects\cloud-dojo

# TypeScriptキャッシュをクリア
Remove-Item -Path .vscode -Recurse -Force -ErrorAction SilentlyContinue

# pnpm再インストール
pnpm install --force

# VS Codeを完全に閉じて再起動
```

その後、VS Codeを開き直してください。

## 確認方法

エラーが解消されたか確認：
- `frontend/src/App.tsx` を開く
- インポート文にエラーがないことを確認
- `import React from 'react'` が赤線なしで表示されるはず

## それでも解決しない場合

1. VS Codeを完全に閉じる
2. PowerShellから `code c:\Projects\cloud-dojo` で開き直す
3. **Ctrl + Shift + P** → `TypeScript: Restart TS Server`
