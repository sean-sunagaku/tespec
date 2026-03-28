# tespec

`tespec` は、YAML で定義した画面仕様とクラス単位の Unit 仕様を検証し、テストスケルトンを生成する TypeScript CLI です。画面ごとの操作と期待値、メソッドごとのユースケースを先に整理し、テスト漏れを減らすことを目的にしています。

## インストール

グローバルに使う場合:

```bash
npm install -g @sean-sunagaku/tespec
```

単発で使う場合:

```bash
npx @sean-sunagaku/tespec validate -c docs/tespec/config.yaml
```

## 使い方

YAML のサンプルは `docs/tespec/` にあります。

```bash
npx tespec validate -c docs/tespec/config.yaml
```

```bash
npx tespec generate -c docs/tespec/config.yaml --dry-run
```

### ビューアー（ノードグラフ付き）

```bash
npx tespec view -c docs/tespec/config.yaml
```

ブラウザで `http://localhost:3737` が開き、ダッシュボードに画面遷移のノードグラフが表示されます。
YAML を編集・保存すると、グラフがリアルタイムで更新されます。

開発時は `pnpm view` でビルド + 起動を一発で実行できます。

`generate` をファイル出力で使うと、既定では `tests/` 配下に Screen Spec 用の Playwright スケルトンと Unit Spec 用の Vitest スケルトンを生成します。

出力先を変えたい場合は `--out-dir` を使えます。

```bash
npx tespec generate -c docs/tespec/config.yaml --out-dir tests/generated
```

Unit Spec の生成ターゲットを切り替えたい場合は `--unit-target` を使えます。

```bash
npx tespec generate -c docs/tespec/config.yaml --unit-target xctest
```

## YAML の書き方

YAML の仕様と記述ガイドは [docs/tespec-design.md](docs/tespec-design.md) を参照してください。

## Claude Code Skill

Claude Code で tespec の YAML を自動生成・検証するための Skill を提供しています。

### インストール

```bash
npx skills add https://github.com/sean-sunagaku/tespec/tree/main/skills/tespec-yaml-gen
```

### リポジトリから直接インストール（開発者向け）

このリポジトリをクローンしている場合、スキーマから最新のルールを生成してインストールできます:

```bash
pnpm skill:install
```

これは以下を実行します:
1. `src/core/schema.ts` から最新の rules を生成
2. `~/.claude/skills/tespec-yaml-gen/` に同期

### 更新

```bash
npx skills add https://github.com/sean-sunagaku/tespec/tree/main/skills/tespec-yaml-gen
```

同じコマンドで最新版に上書きインストールされます。リポジトリ開発者は `pnpm skill:install` で最新化できます。

### 使い方

Claude Code で以下のように呼び出せます:

- 「画面仕様を作りたい」
- 「tespec YAML を書きたい」
- 「画面の操作を洗い出したい」

Skill が画面・操作・遷移の洗い出しをガイドし、正しいフォーマットの YAML を生成します。

## License

MIT
