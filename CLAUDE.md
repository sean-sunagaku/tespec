# tespec

YAML で画面仕様を定義し、テストスケルトンを生成する CLI ツール。

## コマンド

```bash
pnpm test          # テスト実行
pnpm build         # ビルド
pnpm lint          # lint
pnpm check         # lint + format
```

## Skill

tespec の YAML 仕様を AI が自動生成・検証するための Claude Code Skill を同梱しています。

### インストール・更新

```bash
# 外部ユーザー
npx skills add https://github.com/sean-sunagaku/tespec/tree/main/skills/tespec-yaml-gen

# リポジトリ開発者（スキーマから再生成 + インストール）
pnpm skill:install
```

### Skill の更新タイミング

`src/core/schema.ts` を変更した場合は `pnpm skill:sync` でルールファイルを再生成すること。
