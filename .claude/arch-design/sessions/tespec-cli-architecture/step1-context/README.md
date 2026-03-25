# Step 1: コンテキスト分析

**タスク ID**: 1
**担当**: architecture-lead
**ステータス**: in_progress → completed

---

## 概要

tespec は「画面仕様定義 → テスト生成 → ステータス管理」を行う TypeScript/Node.js CLI ツール。
OSS として npm 公開（npx tespec <command>）し、不特定多数の開発者が利用する。

---

## 機能要件

### CLI コマンド

| コマンド | 機能 | 備考 |
|---|---|---|
| `tespec status` | 全画面のテスト実装状況を表形式で表示 | `.status.json` を読んで集計 |
| `tespec validate` | YAML の参照整合性チェック | error / warning 二段階 |
| `tespec sync` | テスト実行結果を `.status.json` に反映 | 双方向同期 |
| `tespec generate` | YAML からテストスケルトンを生成 | `--screen`, `--dry-run` オプション |
| `tespec diagram` | navigates_to から PlantUML 遷移図を生成 | `--output` オプション |

### YAML パース対象

- **Screen ファイル** (`screens/*.yaml`): screen ID, route, title, cases[]
- **Case フィールド**: action(必須), expect(必須), given, target, type, not_expect, navigates_to
- **Setup ファイル** (`setups/*.yaml`): setup ID, title, steps[]
- **Config** (`config.yaml`): version, project, screens_dir, setups_dir

### バリデーションチェック項目

| チェック内容 | レベル |
|---|---|
| `given` 参照先の setup が存在するか | error |
| `navigates_to` 参照先の screen が存在するか | error |
| `screen` ID の重複 | error |
| `cases` が空でないか | warning |
| `type: error` のケースが 0 件 | warning |
| `type: boundary` のケースが 0 件 | warning |

### ステータス管理

- `.status.json` に `pass / fail / not_implemented` を記録
- YAML（仕様）と `.status.json`（状態）を完全分離する設計原則

### テスト生成

- Playwright 形式のスケルトンを生成（`test.describe` / `test()` / `// TODO: implement`）
- type (normal/error/boundary) に応じてネスト構造を生成

### 遷移図生成

- `navigates_to` + `action` + `given` から PlantUML を生成
- guard 条件（given + type:error）は `[条件名]` として注釈付与

---

## 非機能要件

### OSS 品質（エラーメッセージの丁寧さ・ドキュメント）

- エラーメッセージはファイル名・フィールド・参照先を明示する
  - 例: `ERROR: home.yaml: given "logged_in" → setup が見つからない`
- 不特定多数の開発者が初めて使う前提で、メッセージは自己説明的に
- `--dry-run` などで安全に動作確認できるオプションを提供

### バリデーション信頼性（核心的価値）

- 参照整合性チェックは「見逃しゼロ」が要件
  - `given` → setup ID の存在確認
  - `navigates_to` → screen ID の存在確認
  - `screen` ID の一意性確認
- YAML パースエラーとバリデーションエラーを明確に区別する
- 全ファイルをスキャンしてから一括エラー報告（早期終了しない）

### 拡張性（future-plans.md より）

将来的な拡張候補（現時点では実装しない、YAGNI）:

| 機能 | 概要 |
|---|---|
| `priority` フィールド | case に優先度を付与（critical 等） |
| `tespec next --format prompt` | 未実装ケースを AI プロンプト形式で出力 |
| GitHub Actions 連携 | PR へのテスト実装状況コメント |

これらを意識した設計は不要。ただしプラグインポイントを人為的に塞がないこと。

---

## 技術スタック

- **言語**: TypeScript
- **実行環境**: Node.js（CLI ツール）
- **配布形式**: npm パッケージ（`npx tespec` で利用）
- **YAML パース**: ライブラリ選定必要（js-yaml 等）
- **出力フォーマット**: PlantUML テキスト、Playwright TypeScript テスト

---

## 制約条件

### シンプル最優先・YAGNI

- 現在のコマンドセット（status/validate/sync/generate/diagram）のみを設計対象とする
- プラグインシステム・設定の動的読み込み・複数バックエンド対応等は不要
- 抽象化は必要最小限。インターフェースを増やすより、直接実装を優先する
- テストフレームワーク固定（Playwright 形式のみ）でよい

### ファイル構成の制約

- エントリポイントは `tespec <command>` の単一 CLI
- 設定ファイルは `docs/tespec/config.yaml`（または `--config` フラグ）
- `.status.json` は仕様外（自動生成物）→ gitignore 推奨

---

## アーキテクチャ上の注目点

### 参照整合性チェックの実装方針

validate コマンドは全ファイルを読み込んだ後に以下の順で処理する:
1. 全 screen ID を収集（重複チェック）
2. 全 setup ID を収集
3. 各 case の `given` → setup ID 存在確認
4. 各 case の `navigates_to` → screen ID 存在確認

この処理順序により「前半でエラーが出ても後半のエラーも全件報告」できる。

### YAML スキーマのバリデーション戦略

- 必須フィールド欠落: action/expect の欠落、screen/route/title の欠落
- 型チェック: expect は string | string[]、given は string | string[]
- 参照整合性: 上記のとおり

---

## 各エージェントへの質問

### module-designer へ

以下のモジュール分割が適切か確認してほしい:
- `parser/`: YAML 読み込み・スキーマ検証
- `validator/`: 参照整合性チェック
- `commands/`: CLI コマンド実装（status/validate/sync/generate/diagram）
- `generator/`: テストスケルトン生成
- `diagram/`: PlantUML 生成
- `status/`: .status.json 読み書き

シンプル最優先の観点から、これ以上細分化すべきか・統合すべきか意見を求む。

### dependency-analyst へ

以下の依存関係について確認してほしい:
- `js-yaml` vs `yaml` パッケージの選択（OSS としての安定性・メンテナンス性）
- PlantUML 生成はテキスト出力のみ（ライブラリ不要）で十分か
- Playwright テスト生成もテキストテンプレートで十分か
- Commander.js vs yargs 等の CLI フレームワーク選択
- `zod` 等によるスキーマ検証ライブラリは必要か（YAGNI 観点で）

### platform-expert へ

TypeScript/Node.js CLI として以下を確認してほしい:
- `npx tespec` の動作に必要な `package.json` の `bin` フィールド設定
- Node.js の最小対応バージョン（LTS 基準）
- TypeScript のビルド設定（tsup, tsc, esbuild の選択）
- `process.exit()` コードの慣例（validate エラー時は exit(1) など）
- Windows/macOS/Linux のパス互換性（path.join 等）

### devils-advocate へ

以下の設計判断に対して過剰でないか指摘してほしい:
- validate コマンドで warning を出す（casesが空/error系ゼロ）→ 煩わしくないか
- generate コマンドで Playwright 固定 → 他フレームワーク対応を求める声はあるか
- diagram コマンドで PlantUML 固定 → Mermaid の方が需要があるか
- `.status.json` を gitignore 推奨にする設計 → CI での利用シナリオを潰していないか
- 5 コマンドは多いか → MVP として status + validate だけで十分ではないか

---

## フィードバック統合メモ

（各エージェントからの返信を受けて更新）
