# アーキテクチャ設計書: tespec CLI

**作成日**: 2026-03-24
**設計セッション**: tespec-cli-architecture
**採用パターン**: Layered Architecture（4層）

---

## 1. 概要

### 設計の目的

画面仕様 YAML の参照整合性チェックとテストスケルトン生成を行う CLI ツールのアーキテクチャを定義する。

### スコープ

**v1**: `validate` + `generate` の2コマンド
**v2 以降**: status, sync, diagram, .status.json, priority, AI プロンプト生成, GitHub Actions

### 技術スタック

| 用途 | ライブラリ | 理由 |
|------|-----------|------|
| CLI フレームワーク | **oclif** | Salesforce/Heroku 製。Command クラスベース、プラグイン拡張、自動ヘルプ生成。将来の拡張に有利 |
| YAML パーサー | **yaml** (eemeli) | 型定義内蔵、詳細エラー位置情報 |
| スキーマバリデーション | **zod v4** | TypeScript型推論、人間可読エラー |
| 色付け | **picocolors** | 軽量(7kB)、高速 |
| テーブル表示 | **cli-table3** | `tespec status` (v2) 用 |
| ビルド | **tsup** | ESM/CJS dual が簡単 |
| テスト | **Vitest** | ESM ネイティブ |

### Node.js / npm 配布

- `"type": "module"` — ESM ファースト
- `"engines": { "node": ">=18" }`
- `"bin": { "tespec": "./dist/cli.js" }` — `npx tespec` で利用可能
- tsup で ESM/CJS dual publishing、シェバン自動付与

---

## 2. アーキテクチャ概要

### 採用パターン: Layered Architecture（4層）

CLI → Commands → Core → Utils の4層構造。コマンドハンドラー（薄い層）とビジネスロジック（純粋関数）を明確に分離する。

### ディレクトリ構成

```
src/
├── cli.ts                 # oclif セットアップ・エントリーポイント
├── commands/
│   ├── validate.ts        # validate コマンドハンドラー
│   └── generate.ts        # generate コマンドハンドラー
├── core/
│   ├── schema.ts          # Zod スキーマ定義 + 型エクスポート
│   ├── parser.ts          # YAML → 型付きオブジェクト変換
│   ├── validator.ts       # 参照整合性チェック（クロスファイル）
│   └── generator.ts       # Playwright テストスケルトン生成
└── utils/
    └── output.ts          # picocolors 出力ユーティリティ
```

**ファイル数**: 9ファイル

### 全体構成図

```
┌─────────────────────────────────────────────┐
│  cli.ts (oclif セットアップ)                   │
│  ・class Validate extends Command { ... }     │
│  ・class Generate extends Command { ... }     │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  commands/ (コマンドハンドラー・薄い層)        │
│  ・validate.ts: parse → validate → 出力      │
│  ・generate.ts: parse → validate → 生成 → 書込│
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  core/ (ビジネスロジック・純粋関数)            │
│  ・schema.ts:    Zod スキーマ + 型定義        │
│  ・parser.ts:    YAML → Screen[] / Setup[]   │
│  ・validator.ts: 参照整合性チェック            │
│  ・generator.ts: Playwright スケルトン生成     │
└──────────────┬──────────────────────────────┘
               │
┌──────────────▼──────────────────────────────┐
│  utils/ (共通ユーティリティ)                   │
│  ・output.ts: picocolors ラッパー             │
└─────────────────────────────────────────────┘
```

---

## 3. モジュール構成

### モジュール一覧

| モジュール | 責務 | 安定度 | 依存先 |
|-----------|------|:------:|-------|
| `core/schema.ts` | Zod スキーマ定義 + 型エクスポート | **最高** | なし |
| `core/parser.ts` | YAML ファイル読み込み → 型付きオブジェクト | 高 | schema |
| `core/validator.ts` | 参照整合性チェック（given→setup, navigates_to→screen） | 高 | schema |
| `core/generator.ts` | Playwright テストスケルトン生成 | 中 | schema |
| `commands/validate.ts` | validate コマンドのオーケストレーション | 低 | parser, validator, output |
| `commands/generate.ts` | generate コマンドのオーケストレーション | 低 | parser, validator, generator, output |
| `utils/output.ts` | 色付きエラー・成功メッセージ出力 | 高 | なし |
| `cli.ts` | oclif セットアップ・エントリーポイント | 低 | commands/* |

### 依存グラフ

```
cli.ts
  ├── commands/validate.ts ──→ core/parser.ts ──→ core/schema.ts
  │                        ──→ core/validator.ts ──→ core/schema.ts
  │                        ──→ utils/output.ts
  │
  └── commands/generate.ts ──→ core/parser.ts ──→ core/schema.ts
                           ──→ core/validator.ts ──→ core/schema.ts
                           ──→ core/generator.ts ──→ core/schema.ts
                           ──→ utils/output.ts
```

---

## 4. 各モジュール詳細

### core/schema.ts — Zod スキーマ + 型定義

**責務**: YAML の構造を Zod スキーマで定義し、TypeScript 型をエクスポートする。
**変化の理由**: YAML スキーマの仕様変更時のみ。

```typescript
import { z } from 'zod';

export const CaseSchema = z.object({
  action: z.string(),
  expect: z.union([z.string(), z.array(z.string())]),
  given: z.union([z.string(), z.array(z.string())]).optional(),
  target: z.string().optional(),
  type: z.enum(['normal', 'error', 'boundary']).default('normal'),
  not_expect: z.array(z.string()).optional(),
  navigates_to: z.string().optional(),
});

export const ScreenSchema = z.object({
  screen: z.string(),
  route: z.string(),
  title: z.string(),
  cases: z.array(CaseSchema),
});

export const SetupSchema = z.object({
  setup: z.string(),
  title: z.string(),
  steps: z.array(z.string()),
});

export const ConfigSchema = z.object({
  version: z.number(),
  project: z.string(),
  screens_dir: z.string().default('./screens'),
  setups_dir: z.string().default('./setups'),
});

export type Case = z.infer<typeof CaseSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type Setup = z.infer<typeof SetupSchema>;
export type Config = z.infer<typeof ConfigSchema>;
```

**設計ポイント**: Zod スキーマと TypeScript 型が単一定義源。型とバリデーションの乖離が起きない。

---

### core/parser.ts — YAML パース

**責務**: YAML ファイルを読み込み、Zod で構造検証して型付きオブジェクトを返す。
**変化の理由**: YAML ライブラリの差し替え時、ファイル読み込み方式の変更時。

```typescript
import { parse } from 'yaml';
import { Config, ConfigSchema, Screen, ScreenSchema, Setup, SetupSchema } from './schema.js';

export interface ParseResult {
  config: Config;
  screens: Screen[];
  setups: Setup[];
}

export interface ParseError {
  file: string;
  message: string;
}

export async function parseProject(configPath: string): Promise<{
  result?: ParseResult;
  errors: ParseError[];
}>;
```

**設計ポイント**:
- Zod でシングルファイルの構造検証（必須フィールド欠落、型チェック）
- パースエラーは全件収集して返す（早期終了しない）
- ファイルシステムアクセスはこのモジュールに集約

---

### core/validator.ts — 参照整合性チェック（核心的価値）

**責務**: パース済みオブジェクト間のクロスファイル参照整合性をチェックする。
**変化の理由**: バリデーションルールの追加・変更時のみ。

```typescript
import { Screen, Setup } from './schema.js';

export interface ValidationIssue {
  level: 'error' | 'warning';
  file: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  hasErrors: boolean;
}

export function validate(screens: Screen[], setups: Setup[]): ValidationResult;
```

**バリデーションルール (v1)**:

| チェック | レベル | 実装方針 |
|---------|--------|---------|
| `given` の参照先 setup が存在するか | error | setup ID の Set を構築 → 全 case の given を走査 |
| `navigates_to` の参照先 screen が存在するか | error | screen ID の Set を構築 → 全 case の navigates_to を走査 |
| `screen` ID が重複していないか | error | 読み込み時に Set で重複検出 |
| `cases` が空でないか | warning | screen.cases.length === 0 |

**設計ポイント**:
- **全ファイルを読み込んでから一括チェック**（早期終了しない → 「見逃しゼロ」を実現）
- 純粋関数。ファイルシステムに依存しない（パース済みオブジェクトを受け取る）
- ルール追加は関数追加のみ。既存コードの修正不要

---

### core/generator.ts — テストスケルトン生成

**責務**: Screen 定義から Playwright テストスケルトンを文字列として生成する。
**変化の理由**: テストフレームワーク変更時、出力フォーマット変更時。

```typescript
import { Screen, Setup } from './schema.js';

export function generateTestFile(screen: Screen, setups: Setup[]): string;
```

**出力例**:
```typescript
import { test, expect } from "@playwright/test";

test.describe("ホーム画面", () => {
  test("画面を開く → プロジェクト一覧が表示される", async ({ page }) => {
    // TODO: implement
  });

  test.describe("異常系", () => {
    test("[offline] 画面を開く → エラーメッセージが表示される", async ({ page }) => {
      // TODO: implement
    });
  });
});
```

**設計ポイント**:
- 純粋関数。文字列を返すだけ。ファイル書き込みは commands/ 層の責務
- `type` (normal/error/boundary) に応じてネスト構造を生成
- Playwright 固有の知識をこのモジュールに局所化

---

### commands/validate.ts — validate コマンド（oclif Command クラス）

**責務**: parse → validate → 結果出力のオーケストレーション。

```typescript
import { Command, Flags } from '@oclif/core';

export default class Validate extends Command {
  static override description = 'YAML の参照整合性をチェック';

  static override flags = {
    config: Flags.string({ char: 'c', description: '設定ファイルパス' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Validate);
    // parse → validate → 出力
  }
}
```

**処理フロー**:
1. `parser.parseProject()` で YAML を読み込み・パース
2. パースエラーがあれば出力して exit(1)
3. `validator.validate()` で参照整合性チェック
4. エラー/警告を `output.ts` で色付き出力
5. エラーがあれば exit(1)、警告のみなら exit(0)

---

### commands/generate.ts — generate コマンド（oclif Command クラス）

**責務**: parse → validate → generate → ファイル書き込みのオーケストレーション。

```typescript
import { Command, Flags } from '@oclif/core';

export default class Generate extends Command {
  static override description = 'YAML からテストスケルトンを生成';

  static override flags = {
    config: Flags.string({ char: 'c', description: '設定ファイルパス' }),
    screen: Flags.string({ char: 's', description: '特定画面のみ生成' }),
    'dry-run': Flags.boolean({ description: '生成結果を stdout に出力' }),
  };

  async run(): Promise<void> {
    const { flags } = await this.parse(Generate);
    // parse → validate → generate → 書込
  }
}
```

**処理フロー**:
1. `parser.parseProject()` で YAML を読み込み
2. `validator.validate()` で参照整合性チェック → エラーがあれば停止
3. `generator.generateTestFile()` で各画面のスケルトンを生成
4. `--dry-run` なら stdout に出力、そうでなければファイル書き込み
5. `--screen` 指定があれば該当画面のみ生成

---

### utils/output.ts — 出力ユーティリティ

**責務**: エラー・警告・成功メッセージの色付きフォーマット。

```typescript
import pc from 'picocolors';

export function printError(file: string, message: string): void;
export function printWarning(file: string, message: string): void;
export function printSuccess(message: string): void;
```

---

### cli.ts — エントリーポイント（oclif）

**責務**: oclif の `run()` 呼び出しのみ。ロジックは持たない。

```typescript
#!/usr/bin/env node
import { run } from '@oclif/core';

run().catch(require('@oclif/core/handle'));
```

oclif はディレクトリ規約で `commands/` 配下の Command クラスを自動検出する。

---

## 5. 依存関係ルール

### 許可される依存

| From | To | 理由 |
|------|----|------|
| cli.ts | commands/* | コマンドルーティング |
| commands/* | core/* | ビジネスロジック呼び出し |
| commands/* | utils/output | 結果の出力 |
| core/parser | core/schema | Zod スキーマで検証 |
| core/validator | core/schema | 型定義の参照 |
| core/generator | core/schema | 型定義の参照 |

### 禁止される依存

| From | To | 理由 |
|------|----|------|
| core/* | commands/* | 内側から外側への依存。レイヤー違反 |
| core/* | utils/output | core は副作用を持たない純粋関数層 |
| core/validator | core/generator | Feature Module 間の横依存禁止 |
| core/generator | core/validator | Feature Module 間の横依存禁止 |
| core/* | cli.ts | 内側から最外層への依存 |

---

## 6. データフロー

### validate コマンド

```
1. ユーザー: npx tespec validate
2. cli.ts → commands/validate.ts
3. commands/validate.ts → core/parser.parseProject(configPath)
4.   core/parser.ts: config.yaml 読み込み → screens/*.yaml 読み込み → setups/*.yaml 読み込み
5.   core/parser.ts: 各ファイルを Zod でバリデーション → Screen[] / Setup[] を返す
6. commands/validate.ts → core/validator.validate(screens, setups)
7.   core/validator.ts: screen ID 重複チェック → given 参照チェック → navigates_to 参照チェック
8.   core/validator.ts: ValidationResult { issues, hasErrors } を返す
9. commands/validate.ts → utils/output で結果を色付き出力
10. エラーあり → process.exit(1) / エラーなし → process.exit(0)
```

### generate コマンド

```
1. ユーザー: npx tespec generate [--screen home] [--dry-run]
2. cli.ts → commands/generate.ts
3. commands/generate.ts → core/parser.parseProject(configPath)
4. commands/generate.ts → core/validator.validate(screens, setups)
5.   エラーあり → エラー出力して exit(1)
6.   警告あり → 警告出力して続行
7. commands/generate.ts → core/generator.generateTestFile(screen, setups)
8.   core/generator.ts: Screen の cases を Playwright test.describe/test 構造に変換
9.   → 文字列を返す
10. --dry-run → stdout に出力 / otherwise → ファイル書き込み
```

---

## 7. ADR（Architecture Decision Records）

### ADR-001: Layered 4層を採用

- **状況**: v1 は2コマンドのみの小規模 CLI だが、v2 で5コマンドに拡張予定
- **決定**: Layered Architecture（cli → commands → core → utils）を採用
- **根拠**: テスト容易性が最高（core/ が純粋関数）、v2 コマンド追加が新ファイル追加のみ、Node.js CLI の標準構成
- **影響**: commands/ 層は v1 では薄い（parse→validate→出力 のみ）が、v2 で価値が増す
- **棄却した代替案**:
  - 3層構造: cli.ts が肥大化リスク。コマンドハンドラーの個別テストが困難
  - Feature Module: v1 の2コマンドには過剰。parser 重複リスク
  - Clean Architecture / Hexagonal: CLI ツールには学習コストが高すぎる

### ADR-002: Zod でシングルファイル検証 + 別関数でクロスファイル検証

- **状況**: バリデーションの信頼性が核心的価値。YAML の構造検証と参照整合性チェックの2段階が必要
- **決定**: Zod で各 YAML ファイルの構造を検証 → validator.ts で参照整合性をチェック（2段階分離）
- **根拠**: Zod の責務を明確に（シングルファイル構造のみ）。クロスファイルチェックは全ファイル読み込み後に一括実行
- **影響**: parser.ts と validator.ts の責務が明確に分離

### ADR-003: v1 スコープの限定

- **状況**: 設計書には5コマンド定義されているが、シンプル最優先の方針
- **決定**: v1 は `validate` + `generate` のみ。status/sync/diagram/.status.json は v2
- **根拠**: 最小限で価値を届け、使われ方を見てから拡張。YAGNI
- **影響**: v1 の YAML スキーマには navigates_to/not_expect を含むがコマンドでは未使用

### ADR-004: oclif を CLI フレームワークに採用（commander から変更）

- **状況**: 当初 commander を想定していたが、将来的な拡張（プラグイン、AI Skill 配布）を考慮
- **決定**: oclif（Salesforce/Heroku 製）を採用
- **根拠**: Command クラスベースで拡張性が高い、自動ヘルプ・エラーハンドリング、プラグインシステム内蔵。Layered 4層の commands/ ディレクトリ規約と完全一致
- **影響**: commands/*.ts が関数 → Command クラスに変更。cli.ts は oclif の `run()` のみ
- **棄却した代替案**:
  - commander: 軽量だが将来の拡張時にプラグインシステムを自作する必要あり

### ADR-005: schema.ts を独立ファイルとして維持

- **状況**: Devil's Advocate が「parser.ts に統合すべき」と指摘
- **決定**: schema.ts を独立維持
- **根拠**: 将来の AI Skill 配布時に Zod スキーマだけを参照したいユースケースがある。型定義の「単一定義源」として明確
- **影響**: ファイル数が1つ多い（8ファイル）が、責務の明確さを優先

### ADR-006: process.exit() はトップレベルのみ

- **状況**: CLI ツールはエラー時に exit(1) が必要だが、テスト容易性を損なう
- **決定**: core/ では例外を throw し、cli.ts の main().catch() で process.exit() する
- **根拠**: core/ が純粋関数のまま保たれ、Vitest でテスト可能

---

## 8. 実装ガイドライン

### 命名規則

- ファイル名: kebab-case（例外: 既存の `cli.ts`）→ 実際は schema.ts, parser.ts 等の単語
- 型名: PascalCase（`Screen`, `Setup`, `ValidationResult`）
- 関数名: camelCase（`parseProject`, `validate`, `generateTestFile`）
- Zod スキーマ: PascalCase + Schema（`ScreenSchema`, `CaseSchema`）

### 新しいコマンドを追加する時（v2）

1. `commands/<command-name>.ts` を作成
2. 必要なら `core/<module>.ts` を追加
3. `cli.ts` に `program.command(...)` を1行追加
4. 既存ファイルの変更は cli.ts の1行のみ

### エラーメッセージの規則（OSS 品質）

```
ERROR: <ファイル名>: <フィールド名> "<値>" → <問題の説明>
WARN:  <ファイル名>: <問題の説明>
```

例:
```
ERROR: home.yaml: given "logged_in" → setup が見つからない
ERROR: home.yaml: navigates_to "settings" → screen が見つからない
WARN:  detail.yaml: 異常系 (type: error) が 0 件
```

---

## 9. テスト戦略

| 層 | テスト種別 | 方法 |
|----|----------|------|
| core/schema.ts | ユニットテスト | 正常/異常 YAML のパース結果を検証 |
| core/parser.ts | ユニットテスト | fixture YAML ファイルを用意してパース |
| core/validator.ts | ユニットテスト | 型付きオブジェクトを直接渡してチェック |
| core/generator.ts | スナップショットテスト | 生成されたテストコードの文字列を比較 |
| commands/* | 統合テスト | fixture ディレクトリを用意して stdout をキャプチャ |

---

## 10. 制約と今後の課題

### 意図的に除外したもの（YAGNI）

- プラグインシステム
- テストフレームワークの抽象化（Playwright 固定）
- 設定ファイルの自動探索（cosmiconfig 等）
- `.status.json` / ステータス管理全般
- 遷移図生成

### 再検討のトリガー

- v2 でコマンドが5つに増えた時 → commands/ のパターンが適切か確認
- テストフレームワーク対応の要望が増えた時 → generator.ts の抽象化を検討
- バリデーションルールが20個を超えた時 → validator.ts の分割を検討
