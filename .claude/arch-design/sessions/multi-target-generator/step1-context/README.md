# Step 1: コンテキスト分析結果

## 機能要件

- **既存機能**: tespec YAML から Playwright (TypeScript) のテストスケルトンを生成する
  - `generateTestFile(screen, setups)` が Screen + Setup[] を受け取り、`.spec.ts` 文字列を返す
  - テストは normal / error / boundary の3タイプに分類され、`test.describe` でネスト構造になる
  - `given` / `steps` / `not_expect` などのメタデータをコメントとして埋め込む
  - `use:<setupId>` 記法でセットアップ参照を解決する
  - `--screen` フラグで特定画面のみ生成可能
  - `--dry-run` フラグで stdout 出力のみ（ファイル書き込みなし）
  - `--out-dir` フラグで出力ディレクトリを変更可能

- **追加する機能**: XCUITest (Swift) や他のテストフレームワーク向けの生成にも対応
  - 将来的に任意のフレームワーク向けジェネレーターを追加できる拡張性が必要
  - 新フレームワーク追加時にコア（CLI・スキーマ・パーサー）の変更が不要であること

## 非機能要件

- **保守性**: 新フレームワーク追加時の変更箇所を局所化する（registry/plugin パターン）
- **拡張性**: フレームワークごとの差異（ファイル拡張子・import 構文・テスト構造）を吸収できる抽象化レイヤー
- **テスト容易性**: 各フレームワークのジェネレーターは純粋関数 `(Screen, Setup[]) => string` の形を維持
- **後方互換性**: 既存の Playwright 生成フローを破壊しない

## 技術スタック

| カテゴリ | 使用技術 |
|---------|---------|
| 言語 | TypeScript 6.x |
| CLI フレームワーク | @oclif/core ^4.10.2 |
| YAML パース | yaml ^2.8.1 |
| スキーマ検証 | zod ^4.1.12 |
| ビルド | tsup ^8.5.1（ESM only） |
| テスト | vitest ^4.1.1 |
| Lint/Format | Biome ^2.4.8 |
| パッケージマネージャー | pnpm 10.28.0 |
| Node.js 要件 | >=18 |

## 制約条件

- **ESM only**: `"type": "module"` が設定されており、CommonJS 出力は不可。import には `.js` 拡張子が必要
- **oclif の commands ディスカバリー**: `dist/commands/*.ts` が自動スキャンされる。新コマンドはここに配置
- **tsup エントリーポイント**: `src/cli.ts` と `src/commands/*.ts` のみがバンドル対象
- **既存 API の後方互換性**: `generateTestFile` のシグネチャ `(screen: Screen, setups: Setup[]) => string` は変えない
- **純粋 Node.js**: 外部ランタイム（Deno, Bun）は使用しない

## 既存 generator の構造分析

### `generateTestFile` の入出力

| 項目 | 内容 |
|-----|-----|
| 入力 | `screen: Screen`, `setups: Setup[]` |
| 出力 | Playwright `.spec.ts` ファイルの文字列 (`\n` 終端) |

### 内部関数の構成

```
generateTestFile(screen, setups)
├── renderNestedGroup(title, cases, setupTitles, depth)  ← 異常系/境界値のグループ化
│   └── renderCaseGroup(cases, setupTitles, depth)
│       └── renderCase(testCase, setupTitles, depth)
│           ├── buildTestName(testCase)                  ← テスト名の組み立て
│           └── buildComments(testCase, setupTitles, depth)  ← Given/Steps/not_expect コメント生成
├── indentOf(depth)                                       ← インデント生成ユーティリティ
└── quote(value)                                          ← JSON.stringify によるクォート
```

### 共通化できる部分（フレームワーク非依存ロジック）

- **テストケース分類**: normal / error / boundary への分類 (`filter` ロジック)
- **テスト名生成**: `buildTestName` のロジック（action + expect + given の組み立て）
- **コメント生成**: `buildComments` のロジック（given / steps / not_expect の解決・整形）
- **セットアップ参照解決**: `use:<id>` を `setupTitles` Map で解決するロジック
- **インデントユーティリティ**: `indentOf`

### フレームワーク依存部分（generator ごとに差し替え必要）

- import 文の形式（Playwright vs Swift の `import XCTest`）
- テスト構造の記法（`test.describe` / `test()` vs `class` / `func testXxx()`）
- ファイル拡張子（`.spec.ts` vs `.swift`）
- async/await の有無

## 設計上のキーポイント

1. **Registry パターンの導入**: `Map<frameworkId, GeneratorFn>` を持つ registry を `src/core/` に配置し、generate コマンドが `--framework` フラグで選択できるようにする

2. **Generator インターフェースの定義**: 各フレームワーク generator は共通の型 `FrameworkGenerator` を実装する（module-designer フィードバック反映: `fileNameFor` を追加）
   ```ts
   export interface FrameworkGenerator {
     generate(screen: Screen, setups: Setup[]): string;
     fileExtension: string;              // ".spec.ts" | ".swift"
     fileNameFor(screenId: string): string;  // "login.spec.ts" | "LoginTests.swift"
   }
   ```
   `fileNameFor` を interface に含めることで、generate コマンドがフレームワーク固有のファイル名規則を知らなくて済む。

3. **共通ロジックの抽出**: 以下を `src/core/generator-helpers.ts` に移動し全 generator から再利用可能にする
   - **確定**: `buildTestName`, `buildComments`, `classifyCase`, `resolveSetupTitles`
   - **要検討**: `indentOf` — インデント幅がフレームワーク依存（TS: 2スペース、Swift: 4スペース慣習）。`indentOf(depth, size = 2)` とデフォルト引数化か各 generator 独自で持つか判断が必要
   - **各 generator に留める**: `quote` — Swift では `JSON.stringify` が使えないためフレームワーク依存

4. **ディレクトリ構造**（module-designer + dependency-analyst フィードバック反映）:
   ```
   src/core/
     generator-types.ts     ← FrameworkGenerator interface + FrameworkId type のみ（schema.ts にのみ依存）
     generator-helpers.ts   ← buildTestName, buildComments, classifyCase, resolveSetupTitles（schema.ts にのみ依存）
     generator-registry.ts  ← Record<FrameworkId, FrameworkGenerator> + getGenerator()
     generators/
       playwright.ts        ← generator-types.ts + generator-helpers.ts のみ import（registry を知らない）
       xcuitest.ts          ← 同上
     generator.ts           ← 後方互換 re-export のみ（移行完了後削除予定）
   ```
   依存グラフ（すべて「不安定 → 安定」の一方向）:
   ```
   commands/generate.ts
     └── core/generator-registry.ts
           ├── core/generator-types.ts → core/schema.ts
           └── core/generators/playwright.ts
                 ├── core/generator-types.ts
                 └── core/generator-helpers.ts → core/schema.ts
   ```
   ※ `generators/*.ts` は `generator-registry.ts` を import してはならない（循環依存防止）

5. **Playwright generator のリネーム**: 現在の `generator.ts` を `generators/playwright.ts` に移動し、`generator.ts` は `export { generateTestFile } from './generators/playwright.js'` の後方互換 re-export として残す

6. **`--target` フラグ（platform-expert 推奨: `--framework` → `--target` に変更）**: oclif 慣例では `--target` / `-t` が多く使われる。`Flags.option()` で `default: 'playwright'` を指定すると `flags.target` は `string`（undefined なし）になる（oclif v4 型推論）

7. **テストの整理**: 現在の `generator.test.ts` は Playwright 固有のテストとして `generators/playwright.test.ts` に移動。各 generator が独立してテスト可能な構造にする

8. **過剰設計のリスク**: XCUITest 1件追加のためにプラグインシステムを実装するのは過剰かもしれない。まず「フレームワーク別ファイル分割 + 静的 registry」のシンプルな形で始め、動的ロード（`.js` ファイルとして外部注入）は後回しにするのが現実的

## チームフィードバック（2026-03-25）

### module-designer
- `fileNameFor(screenId: string): string` を `FrameworkGenerator` interface に追加 → generate コマンドがファイル名規則を知らなくて済む
- `classifyCase` と `resolveSetupTitles` を generator-helpers に追加（明示的な関数化）
- `indentOf`: デフォルト引数 `size = 2` で共通化するか各 generator 独自で持つか要判断
- `quote`: フレームワーク依存のため generator-helpers に含めない

### platform-expert（Step 3 向け補足）
- フラグ名: `--framework` → **`--target` / `-t`** に変更（oclif 慣例）
- `generators/playwright.ts` に移動後、import パスの `.js` 拡張子を更新し忘れるとビルドエラー（`moduleResolution: NodeNext` 制約）
  - 変更前: `import { generateTestFile } from '../core/generator.js'`
  - 変更後: `import { generateTestFile } from '../core/generators/playwright.js'`
- 後方互換 re-export: `export { generateTestFile } from './generators/playwright.js'`
- `Flags.option({ default: 'playwright' })` を指定すると `flags.target` は `string` 型（`undefined` チェック不要）
- `generator-swift.ts` の `buildComments` / `renderCaseGroup` は `generator.ts` からの完全コピー → `generator-helpers.ts` 抽出は正当だが別 PR 推奨

### dependency-analyst
- `FrameworkGenerator` 型は `generators/types.ts` ではなく `core/generator-types.ts` に分離する → generator 側が registry を import せずに型だけに依存できる
- `generator-helpers.ts` は `schema.ts` のみに依存させること（registry や commands を import すると循環依存が生じる）
- `generators/*.ts` は `generator-types.ts` と `generator-helpers.ts` のみ import する（registry を知らない）
- 後方互換 re-export（`generator.ts`）は移行完了後に削除する
- CI に `madge` 等の循環依存検出ツール導入を推奨（ESM 静的 import は循環でもビルドエラーにならないケースがある）
