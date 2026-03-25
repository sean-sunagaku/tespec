# アーキテクチャ設計書: tespec 複数テストフレームワーク対応

作成日: 2026-03-25
セッション: multi-target-generator
採用パターン: P02 静的 Record Registry

---

## 1. 概要

tespec CLI の `generate` コマンドを、Playwright (TS) のみから複数テストフレームワーク（Playwright / XCUITest / 将来追加）に対応させる。`--target` フラグで切り替え、新フレームワーク追加時に `generate.ts`（コマンド側）の変更が不要な設計。

### 背景
- 現在: `generateTestFile(screen, setups) => string` が Playwright 固定
- `generator-swift.ts` が実装済みだが `generate.ts` から未接続
- タスクの本質は「新規実装」ではなく「既存 generator の接続」

---

## 2. ADR (Architecture Decision Record)

### ADR-001: 静的 Record Registry パターンの採用

**状況**: tespec generate を複数テストフレームワーク対応にする。ユーザーは拡張性重視を選択。

**決定**: `Record<Target, FrameworkGenerator>` による静的 Registry パターン (P02) を採用。

**根拠**:
- 10案比較でスコア最高（23/25点）
- `Record<Target, ...>` の網羅性チェックで登録漏れをコンパイルエラー検出
- 実装コスト最小（新規約45行 + 変更12行）
- generate コマンドがフレームワーク知識ゼロ（OCP 準拠）
- チーム全員合意（architecture-lead, module-designer, dependency-analyst, platform-expert, devils-advocate）

**棄却した代替案**:

| 案 | 棄却理由 |
|----|---------|
| P01 内部分岐 | `renderNestedGroup` / `renderCase` / `generateTestFile` の3〜4関数に `if` が散在。実態は15行ではなく40〜60行の分岐追加。3案目で読解不能になる |
| P05 関数 Registry | `Record<Target, ...>` の網羅性チェックがない。`fileExtension` / `fileNameFor` を別 Map で管理するため整合性リスクあり。P02 を選べる状況で選ぶ理由がない |
| P03 Strategy（クラス） | 2フレームワークにクラス設計は過剰。将来フレームワーク数が5以上になった場合の移行先候補として記録 |
| P04 Template Method | BaseGenerator の骨格変更が全サブクラスに影響する。`BaseGenerator` 自体が「不安定な安定モジュール」になる矛盾が生じる |
| P06 Builder | 出力オプションが複雑化した場合に再検討。現時点では不要な抽象化 |
| P07 Pipes & Filters | 変換ステージが5以上になった場合に再検討。depth 管理等ステートフルな処理があり現状と相性が悪い |
| P08 dynamic import | tsup バンドル後の動的 path 解決に未検証リスク。依存グラフが静的解析ツールで追跡できなくなる |
| P09 テンプレートエンジン | 外部依存追加 + dist へのテンプレートファイル同梱が必要。型安全性ゼロ |
| P10 AST/CodeWriter | 実装コストが桁違い。oclif CLI の規模には明確に過剰 |

**ADR-002: 既存 generator を generators/ に移動・削除**

状態: 採用

- `generator.ts` → `generators/playwright.ts` に実装を移動（ロジック変更なし）
- `generator-swift.ts` → `generators/xctest.ts` に実装を移動（ロジック変更なし）
- 旧ファイルは削除。ラップではなく直接移動でファイル数を抑える
- テストの import パスは `generators/playwright.js` に更新

**ADR-003: generator-helpers.ts 抽出を別 PR にする**

状態: 採用（devils-advocate 提言）

- `buildComments` 等の重複コードの解消は PR2 として分離
- registry 接続とリファクタリングを同一 PR に混在させると diff が読みにくくなる
- 重複の存在は既知であり、PR1 のコードレビュー時に明示する

---

## 3. ファイル構成

```
src/core/
  schema.ts                ← 変更なし
  parser.ts                ← 変更なし
  validator.ts             ← 変更なし
  generator.ts             ← 削除（実装を generators/playwright.ts に移動）
  generator-swift.ts       ← 削除（実装を generators/xctest.ts に移動）
  generators/
    types.ts               ← 新規: Target 型 + FrameworkGenerator interface
    playwright.ts          ← 新規: generator.ts の実装を移動 + FrameworkGenerator export
    xctest.ts              ← 新規: generator-swift.ts の実装を移動 + FrameworkGenerator export
    registry.ts            ← 新規: Record<Target, FrameworkGenerator> + getGenerator()
src/commands/
  generate.ts              ← 変更: --target フラグ追加、registry 経由に変更
```

**旧 `generator.ts` / `generator-swift.ts` は削除。実装はそのまま `generators/` に移動。**

---

## 4. モジュール一覧

| ファイル | 種別 | 規模 | 責務 |
|---------|------|------|------|
| `generators/types.ts` | 新規 | ~15行 | Target 型 + FrameworkGenerator interface |
| `generators/playwright.ts` | 新規 | generator.ts から移動 | Playwright generator 実装 + FrameworkGenerator export |
| `generators/xctest.ts` | 新規 | generator-swift.ts から移動 | XCUITest generator 実装 + FrameworkGenerator export |
| `generator.ts` | 削除 | — | 実装を generators/playwright.ts に移動 |
| `generator-swift.ts` | 削除 | — | 実装を generators/xctest.ts に移動 |
| `generators/registry.ts` | 新規 | ~20行 | Target → FrameworkGenerator 解決 |
| `commands/generate.ts` | 変更 | +12/-3行 | `--target` フラグ追加、registry 経由で generator 取得 |

**合計: 新規4ファイル (~60行) + 変更1ファイル (+12行)**

---

## 5. 各モジュール実装

### 5-1. `generators/types.ts`

```ts
import type { Screen, Setup } from '../schema.js';

export type Target = 'playwright' | 'xctest';

export interface FrameworkGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}
```

### 5-2. `generators/playwright.ts`

generator.ts の実装をそのまま移動し、FrameworkGenerator を追加 export する。

```ts
import type { Case, Screen, Setup } from '../schema.js';
import type { FrameworkGenerator } from './types.js';

// --- generator.ts から移動した実装（変更なし） ---
export function generateTestFile(screen: Screen, setups: Setup[]): string { ... }
// renderNestedGroup, renderCaseGroup, renderCase, buildTestName,
// buildComments, indentOf, quote もそのまま移動

// --- FrameworkGenerator export ---
export const playwright: FrameworkGenerator = {
  generate: generateTestFile,
  fileNameFor: (screenId) => `${screenId}.spec.ts`,
};
```

### 5-3. `generators/xctest.ts`

generator-swift.ts の実装をそのまま移動し、FrameworkGenerator を追加 export する。

```ts
import type { Case, Screen, Setup } from '../schema.js';
import type { FrameworkGenerator } from './types.js';

// --- generator-swift.ts から移動した実装（変更なし） ---
export function generateSwiftTestFile(screen: Screen, setups: Setup[]): string { ... }
// renderMarkedGroup, renderCaseGroup, renderCase, buildFuncName,
// buildComments, toSwiftClassName, sanitize, indentOf もそのまま移動

// --- FrameworkGenerator export ---
export const xctest: FrameworkGenerator = {
  generate: generateSwiftTestFile,
  fileNameFor: (screenId) => `${toSwiftClassName(screenId)}Tests.swift`,
};
```

### 5-4. `generators/registry.ts`

```ts
import type { Target, FrameworkGenerator } from './types.js';
import { playwright } from './playwright.js';
import { xctest } from './xctest.js';

const REGISTRY: Record<Target, FrameworkGenerator> = { playwright, xctest };

export function getGenerator(target: Target): FrameworkGenerator {
  return REGISTRY[target];
}

export const AVAILABLE_TARGETS: readonly Target[] = Object.keys(REGISTRY) as Target[];

export function isTarget(value: string): value is Target {
  return (AVAILABLE_TARGETS as readonly string[]).includes(value);
}
```

---

## 6. generate.ts の変更

```ts
// import 差し替え
import { getGenerator, AVAILABLE_TARGETS, isTarget } from '../core/generators/registry.js';

// --target フラグ追加
static flags = {
  // ...既存フラグ...
  target: Flags.string({
    char: 't',
    description: 'Target test framework',
    options: [...AVAILABLE_TARGETS],
    default: 'playwright',
  }),
};

// run() 内: generator 解決
if (!isTarget(flags.target)) {
  printError('target', `Unknown target: ${flags.target}`);
  this.exit(1);
}
const generator = getGenerator(flags.target);

// generate 呼び出し
const outputs = selectedScreens.map((screen) => ({
  screenId: screen.screen,
  content: generator.generate(screen, setups),
}));
// ファイル名
generator.fileNameFor(output.screenId)
```

---

## 7. 依存グラフ

```
commands/generate.ts
  └── core/generators/registry.ts
        ├── core/generators/types.ts
        │     └── core/schema.ts
        ├── core/generators/playwright.ts
        │     ├── core/generators/types.ts
        │     └── core/schema.ts
        └── core/generators/xctest.ts
              ├── core/generators/types.ts
              └── core/schema.ts
```

循環依存: **なし**

### 禁止 import ルール
- `generators/types.ts` → `generators/registry.ts` 禁止（型が実装に依存する逆転）
- `core/*` → `commands/*` 禁止（レイヤー逆転）
- `parser.ts` / `validator.ts` → `generators/*` 禁止（フレームワーク非依存維持）

---

## 8. 新フレームワーク追加手順

例: Cypress 対応を追加する場合

1. `src/core/generators/cypress.ts` を作成（FrameworkGenerator オブジェクトを export）
2. `generators/types.ts` の `Target` に `'cypress'` を追加
3. `generators/registry.ts` に `import { cypress }` + REGISTRY に1行追加
4. **`commands/generate.ts` の変更は不要**（`AVAILABLE_TARGETS` が自動反映）

---

## 9. 実装順序（PR 分割）

### PR1: Registry 接続（今回のスコープ）
1. `generators/types.ts` 新規作成
2. `generators/playwright.ts` 新規作成
3. `generators/xctest.ts` 新規作成
4. `generators/registry.ts` 新規作成
5. `generate.ts` に `--target` フラグ追加 + registry 呼び出し
6. テスト追加
7. `README.md` / `package.json` / `SKILL.md` の説明文更新

### PR2: helpers 抽出（別 PR）
1. `generator-helpers.ts` 新規作成（`buildTestLabel`, `buildComments`, `classifyCase`, `resolveSetupTitles`）
2. 両 generator から共通コード削除
3. `toSwiftClassName` の重複解消

---

## 10. 検証方法

```bash
# ビルド
pnpm build

# 全テスト
pnpm test

# Playwright 出力（既存動作維持）
./dist/cli.js generate --dry-run
./dist/cli.js generate --target playwright --dry-run

# XCUITest 出力
./dist/cli.js generate --target xctest --dry-run

# ファイル書き出し確認
./dist/cli.js generate --target xctest --out-dir tests/generated
ls tests/generated/*.swift
```

---

## 11. データフロー

### `tespec generate --target xctest` の実行フロー

```
1. ユーザー: tespec generate --target xctest
2. generate.ts: parseProject(configPath) → YAML パース
3. generate.ts: validate(screens, setups) → 参照整合性チェック
4. generate.ts: isTarget('xctest') → true
5. generate.ts: getGenerator('xctest') → generator-registry.ts
6. generator-registry.ts: REGISTRY['xctest'] を返す
   = { generate: generateSwiftTestFile, fileNameFor: ... }
7. generate.ts: screens.map(screen => generator.generate(screen, setups))
   → generator-swift.ts: generateSwiftTestFile(screen, setups) → Swift 文字列
8. generate.ts: writeFile(generator.fileNameFor(screenId), content)
   → "LoginTests.swift" 等のファイルを tests/ に出力
```

---

## 12. 実装ガイドライン

### 新フレームワーク追加時の手順（Cypress を例に）

1. `src/core/generators/cypress.ts` を作成（FrameworkGenerator オブジェクトを export）
2. `src/core/generators/types.ts` の `Target` に `'cypress'` を追加（1行）
3. `src/core/generators/registry.ts` に import + REGISTRY に1行追加
4. **`commands/generate.ts` の変更は不要**（`AVAILABLE_TARGETS` が自動反映）

### よくある間違い

- **`.js` 拡張子の省略**: ESM + `moduleResolution: NodeNext` では `import from './foo'` はエラー。必ず `import from './foo.js'`
- **`generator.ts` / `generator-swift.ts` から `generators/*` を import**: 循環依存になる。既存 generator は registry を知ってはならない
- **`flags.target ?? 'playwright'` フォールバックの追加**: `default: 'playwright'` 指定済みのため不要。`flags.target` は常に `string`

---

## 13. platform-expert 実装メモ

- ESM `.js` 拡張子: 全 import パスに `.js` 必須（`moduleResolution: NodeNext`）
- `flags.target` は `default: 'playwright'` 指定で `string` 型（`undefined` なし）。`?? 'playwright'` フォールバック不要
- tsup entry points 変更不要（`src/core/` のファイルは依存として自動バンドル）
- `Flags.string({ options: [...AVAILABLE_TARGETS] })` で oclif が無効値を自動拒否

---

## 14. 設計の制約と今後の課題

### 現在の制約（意図的なトレードオフ）

- `buildComments` 等の重複コードが `generator.ts` と `generator-swift.ts` に存在 → PR2 で解消
- `toSwiftClassName` が `generators/xctest.ts` と `generator-swift.ts` に重複存在 → PR2 で統合

### 再検討のトリガー

| トリガー | 推奨アクション |
|---------|-------------|
| 各フレームワーク固有のフラグが必要 | oclif サブコマンド分割（`generate:playwright`, `generate:xctest`）を検討 |
| CI での循環依存検出を自動化したい | `madge --circular src/` を CI に追加 |
