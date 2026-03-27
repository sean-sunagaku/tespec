# E2E Workflow 機能 — 最終アーキテクチャ設計書

> 作成: 2026-03-27
> 採用パターン: 案1+2（ミラー縦割り + ValidationIssue 型共通化）
> Devil's Advocate 修正: `generators/workflow/types.ts` 削除・`onNavigate` 型強化・generate.ts 排他制御テスト補完

---

## 1. 概要

### 何を追加するか

tespec に **Workflow** という 4 番目の spec タイプを追加する。

```yaml
workflow: user_registration
title: "新規ユーザー登録フロー"
steps:
  - screen: login
    action: "新規登録リンクをタップ"
  - screen: signup
    action: "必要事項を入力して登録"
  - screen: home
    expect: "ようこそメッセージが表示される"
```

Workflow は「複数画面をまたいだユーザー操作の流れ」を定義する。各ステップが既存の Screen を参照し、全ステップを順次実行する**単一のテスト関数**を生成する。

### なぜか

既存の Screen spec はあくまで「1 画面内の操作とテストケース」を定義するものであり、画面をまたいだ E2E フローを自然に表現できない。Workflow spec を追加することで、ユーザー登録・購入フローなどの画面横断シナリオを YAML で宣言的に表現し、Playwright テストのスケルトンを自動生成できる。

---

## 2. 採用パターン・ADR

### 採用: 案1+2（ミラー縦割り + ValidationIssue 型共通化）

**総合スコア: 22/25（全 10 案中 1 位）**

| 評価軸 | スコア | 根拠 |
|--------|--------|------|
| 保守性・拡張性 | 3/5 | コマンドへの分岐蓄積があるが新ファイルが主体で制御可能 |
| テスト容易性 | 5/5 | 独立純粋関数・独立ファイル。単体テストが最も書きやすい |
| 依存関係の健全性 | 5/5 | 単方向依存を完全維持。循環依存リスクゼロ |
| TypeScript 適合性 | 5/5 | 既存パターンと完全同一。Zod/strict モード問題なし |
| 学習コスト | 4/5 | 新概念ゼロ。既存コントリビューターが即座に理解可能 |

**棄却した主要代替案**:
- 案6（サブドメインモジュール / 18pt）: 現規模では過剰。Screen/Unit との非対称性が保守コストになる
- 案3（SpecType レジストリ / 13pt）: 拡張性最高だが spec タイプ 3 種では YAGNI
- 案4・案8（底点）: スキーマ汚染・意味論のミスマッチで除外確定

**全エージェント（5/5）合意**。

---

## 3. ファイル構成

### 新設ファイル（4本）

| ファイル | 責務 |
|---------|------|
| `src/core/validation-types.ts` | `ValidationIssue` / `ValidationResult` の共通型定義のみ |
| `src/core/workflow-validator.ts` | Workflow の参照整合性・構造バリデーション |
| `src/core/generators/workflow/playwright.ts` | Workflow → Playwright テストスケルトン生成 |
| `src/core/viewer/components/WorkflowDetail.tsx` | Workflow 詳細表示 Preact コンポーネント |

> **Devil's Advocate 修正**: `generators/workflow/types.ts` は削除。`WorkflowGenerator` / `WorkflowTarget` は既存の `generators/types.ts` に統合する（Screen/Unit と同パターン）。

### 変更ファイル（11本）

| ファイル | 変更内容 | 変更量 |
|---------|---------|-------|
| `src/core/schema.ts` | `WorkflowStepSchema` / `WorkflowSchema` / 型エクスポート追加。`ConfigSchema` に `workflows_dir` 追加 | +25行 |
| `src/core/parser.ts` | `ParsedProject.workflows` 追加。`parseProject` に workflow パース追加 | +15行 |
| `src/core/validator.ts` | `ValidationIssue` / `ValidationResult` を `validation-types.ts` から import に変更 | -10行 +1行 |
| `src/core/unit-validator.ts` | 同上 | -10行 +1行 |
| `src/core/generators/types.ts` | `WorkflowTarget` / `WorkflowGenerator` インターフェース追加 | +10行 |
| `src/core/generators/registry.ts` | `WORKFLOW_REGISTRY` / `getWorkflowGenerator` / `isWorkflowTarget` / `WORKFLOW_TARGETS` 追加 | +15行 |
| `src/commands/validate.ts` | `validateWorkflows` 呼び出し追加。`--file` 単体バリデーションに `WorkflowSchema` 追加 | +20行 |
| `src/commands/generate.ts` | `--workflow` / `--workflow-target` フラグ追加。`anySpecified` ベースの排他制御に変更 | +30行 |
| `src/commands/view.ts` | `workflows_dir` を watcher 対象ディレクトリに追加 | +4行 |
| `src/core/viewer/server.ts` | `/api/specs` レスポンスに `workflows` 追加 | +1行 |
| `src/core/viewer/client-entry.tsx` | `SpecsData` 型に `workflows` 追加。`View` 型に `workflow` 追加。サイドバー + ダッシュボード + WorkflowDetail 追加 | +20行 |

---

## 4. スキーマ詳細

### `WorkflowStepSchema`

```typescript
export const WorkflowStepSchema = z.object({
  screen: z.string(),             // 既存 screen ID への参照（必須）
  action: z.string().optional(),  // このステップで行う操作（任意）
  expect: z.string().optional(),  // このステップで期待する状態（任意）
});
```

設計根拠:
- `screen` 必須: 参照チェックの対象。どの画面で実行するかを必ず示す
- `action` / `expect` は任意: 最終ステップで `expect` だけ書くユースケースを許容
- `expect` は `z.string().optional()` のみ（Union 配列にしない）: ワークフロー全体のゴール記述は 1 文で済む想定

### `WorkflowSchema`

```typescript
export const WorkflowSchema = z.object({
  workflow: z.string(),                        // Workflow ID（ファイル識別子）
  title: z.string(),                           // 表示用タイトル
  steps: z.array(WorkflowStepSchema).min(1),   // 最低 1 ステップ必須
});
```

`steps` の空配列は Zod の `.min(1)` でパース段階に弾く（バリデーターに届かない）。

### 型エクスポート

```typescript
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
```

### `ConfigSchema` への追加

```typescript
workflows_dir: z.string().optional(),  // .default('./workflows') は使わない
```

`.default()` を使わない理由: `units_dir` と同パターンで、未設定なら `parseProject` が `workflows: []`（空配列）を返す。デフォルト値があると `./workflows` ディレクトリが存在しない既存プロジェクトでパースエラーになる。

---

## 5. モジュール一覧

### `src/core/validation-types.ts`（新設）

```typescript
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
```

**制約**: 型定義のみ。関数・定数・ロジックは一切含めない。`validators の共通基盤` に肥大化させない。

**移行**: `validator.ts` / `unit-validator.ts` のローカル interface 定義（各 10 行）を削除し、`import type { ValidationIssue, ValidationResult } from './validation-types.js';` を追加する。ロジック変更ゼロ。

### `src/core/workflow-validator.ts`（新設）

公開インターフェース:
```typescript
export function validateWorkflows(
  workflows: Workflow[],
  screens: Screen[],
): ValidationResult
```

**シグネチャ選定根拠**: `screens: Screen[]` を受け取ることで、内部で `screenIds = new Set(screens.map(s => s.screen))` を生成する。`validator.ts` の既存パターンとの一貫性を優先した。純粋関数として `parser.ts` に依存しない。

### `src/core/generators/types.ts`（変更）

追加内容:
```typescript
export type WorkflowTarget = 'playwright';

export interface WorkflowGenerator {
  generate(workflow: Workflow): string;
  fileNameFor(workflowId: string): string;
}
```

`generate(workflow: Workflow): string`（Screen[] 不要）の根拠: 生成コードは `step.screen` の ID をそのままコメントに埋め込むだけであり、Screen オブジェクトの `title` / `route` を参照しない。依存を最小化する。

### `src/core/generators/registry.ts`（変更）

追加内容:
```typescript
import { playwright as workflowPlaywright } from './workflow/playwright.js';

const WORKFLOW_REGISTRY: Record<WorkflowTarget, WorkflowGenerator> = {
  playwright: workflowPlaywright,
};

export function getWorkflowGenerator(target: WorkflowTarget): WorkflowGenerator {
  return WORKFLOW_REGISTRY[target];
}

export const WORKFLOW_TARGETS: readonly WorkflowTarget[] = Object.keys(
  WORKFLOW_REGISTRY,
) as WorkflowTarget[];

export function isWorkflowTarget(value: string): value is WorkflowTarget {
  return (WORKFLOW_TARGETS as readonly string[]).includes(value);
}
```

### `src/core/generators/workflow/playwright.ts`（新設）

```typescript
import type { Workflow, WorkflowStep } from '../../schema.js';
import type { WorkflowGenerator } from '../types.js';

export const playwright: WorkflowGenerator = {
  generate: generateWorkflowTestFile,
  fileNameFor: (workflowId) => `${workflowId}.spec.ts`,
};

function generateWorkflowTestFile(workflow: Workflow): string { ... }
function renderStep(step: WorkflowStep, stepNumber: number): string[] { ... }
function quote(value: string): string { return JSON.stringify(value); }
```

### `src/core/viewer/components/WorkflowDetail.tsx`（新設）

```typescript
type ViewType = 'dashboard' | 'screen' | 'unit' | 'setup' | 'workflow';

interface WorkflowDetailProps {
  workflow: Workflow;
  onNavigate: (type: ViewType, id: string) => void;
}
```

**Devil's Advocate 修正**: `onNavigate` の第 1 引数を `string` から `ViewType` リテラル型に強化。typo（`'screeen'` 等）をコンパイル時に検出できる。既存 `ScreenDetail.tsx` の `onNavigate` も同様に修正する。

---

## 6. 依存グラフ

```
Layer 0: 型定義（他に依存しない）
  validation-types.ts
  schema.ts

Layer 1: パース（Layer 0 に依存）
  parser.ts → schema.ts

Layer 2: バリデーション（Layer 0・1 に依存）
  validator.ts        → validation-types.ts, schema.ts
  unit-validator.ts   → validation-types.ts, schema.ts
  workflow-validator.ts → validation-types.ts, schema.ts  ← 新設

Layer 3: ジェネレーター（Layer 0 に依存）
  generators/types.ts → schema.ts
  generators/registry.ts → generators/types.ts, screen/*, unit/*, workflow/*
  generators/screen/playwright.ts → generators/types.ts, schema.ts
  generators/workflow/playwright.ts → generators/types.ts, schema.ts  ← 新設

Layer 4: CLI コマンド（全 Layer に依存）
  validate.ts  → parser.ts, validator.ts, unit-validator.ts, workflow-validator.ts
  generate.ts  → parser.ts, validator.ts, unit-validator.ts, workflow-validator.ts, registry.ts
  view.ts      → parser.ts, viewer/server.ts, viewer/watcher.ts

Layer 5: Viewer（Layer 0・1 に依存）
  viewer/server.ts → parser.ts（ParsedProject 型）
  viewer/client-entry.tsx → schema.ts（型のみ）
  viewer/components/WorkflowDetail.tsx → schema.ts（型のみ）  ← 新設

禁止される依存:
  workflow-validator.ts → parser.ts（循環リスク）
  generators/workflow/playwright.ts → parser.ts（不要な依存）
  viewer/client-entry.tsx → validators / generators（クライアントに不要）
```

---

## 7. バリデーションルール

### `workflow-validator.ts` のチェック一覧

| チェック関数 | level | 条件 | メッセージ例 |
|------------|-------|------|------------|
| `checkDuplicateWorkflowIds` | error | 同一 `workflow` ID が複数存在 | `workflow ID "user_registration" が重複しています` |
| `checkScreenReferences` | error | `step.screen` が既存 screenIds に存在しない | `steps[1].screen "dashboard" → screen が見つかりません` |
| `checkEmptySteps` | warning | 全ステップに `action` も `expect` も未記述 | `全ステップに action/expect が未記述です` |

**error / warning の判断基準**:
- `error`: 参照不整合・ID 重複 → テスト生成が不可能または誤ったコードになる
- `warning`: 全ステップが action/expect 空 → テスト生成は可能だが有用性が低い

**責務分担**:
- 空 `steps` 配列（`steps: []`）は Zod の `.min(1)` がパース段階で弾く（validator に届かない）
- `checkEmptySteps` は「全ステップの action と expect が両方とも未記述」のケースを対象とする

**ファイルパス生成**:
```typescript
function toWorkflowFile(workflowId: string): string {
  return `workflows/${workflowId}.yaml`;
}
```

---

## 8. 生成テストコード例

### 入力 YAML

```yaml
workflow: user_registration
title: "新規ユーザー登録フロー"
steps:
  - screen: login
    action: "新規登録リンクをタップ"
  - screen: signup
    action: "必要事項を入力して登録"
  - screen: home
    expect: "ようこそメッセージが表示される"
```

### 生成される Playwright テスト（`user_registration.spec.ts`）

```typescript
import { test, expect } from "@playwright/test";

test("新規ユーザー登録フロー", async ({ page }) => {
  // Step 1: login — 新規登録リンクをタップ
  // TODO: implement

  // Step 2: signup — 必要事項を入力して登録
  // TODO: implement

  // Step 3: home
  // expect: ようこそメッセージが表示される
  // TODO: implement
});
```

### 生成ルール

- `test.describe` を使わない: ワークフロー全体が単一テスト関数（既存 Screen テストとの意味論的区別）
- action あり: `// Step N: <screen_id> — <action>`
- action なし: `// Step N: <screen_id>`（ダッシュなし）
- expect あり: `// expect: <expect>` を action コメントの次行に追加
- 毎ステップ末尾: `// TODO: implement`
- ステップ間は空行で区切る
- `fileNameFor`: `(workflowId) => \`${workflowId}.spec.ts\``

### 生成実装スケルトン

```typescript
function renderStep(step: WorkflowStep, stepNumber: number): string[] {
  const indent = '  ';
  const lines: string[] = [];

  if (step.action) {
    lines.push(`${indent}// Step ${stepNumber}: ${step.screen} — ${step.action}`);
  } else {
    lines.push(`${indent}// Step ${stepNumber}: ${step.screen}`);
  }

  if (step.expect) {
    lines.push(`${indent}// expect: ${step.expect}`);
  }

  lines.push(`${indent}// TODO: implement`);
  lines.push('');

  return lines;
}
```

---

## 9. Viewer 仕様

### `WorkflowDetail.tsx` の表示レイアウト

```
┌──────────────────────────────────────┐
│ 新規ユーザー登録フロー              [h2]│
│ ID: user_registration · 3 steps     │
├──────────────────────────────────────┤
│ Step 1                               │
│ [screen: login] ← クリックで遷移      │
│ action: 新規登録リンクをタップ          │
├──────────────────────────────────────┤
│ Step 2                               │
│ [screen: signup]                     │
│ action: 必要事項を入力して登録         │
├──────────────────────────────────────┤
│ Step 3                               │
│ [screen: home]                       │
│ expect: ようこそメッセージが表示される  │
└──────────────────────────────────────┘
```

### 表示仕様

- 各ステップはカード形式で縦に並ぶ（フロー図・矢印グラフは含めない）
- `step.screen` バッジクリック → `onNavigate('screen', step.screen)` で ScreenDetail に遷移
- `action` / `expect` は存在するときのみ表示（条件付きレンダリング）
- Tailwind 配色は `ScreenDetail.tsx` のカードスタイルを踏襲（`bg-white rounded-xl border border-gray-200 shadow-sm`）
- `step.screen` が存在しない画面を参照している場合（バリデーションエラー状態）: バッジはレンダリングするが遷移先が見つからない場合は `null` を返す（`screens.find(...)` の `undefined` guard）

### `client-entry.tsx` への変更

```typescript
// SpecsData に workflows 追加
interface SpecsData {
  project: string;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];
  workflows: Workflow[];  // 追加
}

// View 型に workflow 追加
type View =
  | { type: 'dashboard' }
  | { type: 'screen'; id: string }
  | { type: 'unit'; id: string }
  | { type: 'setup'; id: string }
  | { type: 'workflow'; id: string };  // 追加

// ViewType リテラル型（Devil's Advocate 修正）
type ViewType = 'dashboard' | 'screen' | 'unit' | 'setup' | 'workflow';
```

### サイドバーへの追加

Screens / Units / Setups セクションと同パターンで Workflows セクションを追加。`data-testid="sidebar-workflow-{id}"` を付与。

---

## 10. CLI フラグ

### `tespec validate`

```
--file オプション: WorkflowSchema を試行対象に追加
```

単一ファイルバリデーション時、`ScreenSchema` → `SetupSchema` → `UnitSpecSchema` → `WorkflowSchema` の順で試行。ファイルパスに `/workflows/` が含まれる場合は `workflowErrors` を優先表示。

### `tespec generate`

新規フラグ:
```
--workflow <id>         特定の workflow ID のみ生成
--workflow-target <t>   生成ターゲット（options: playwright）デフォルト: playwright
```

**排他制御ロジックの変更（Devil's Advocate 修正）**:

変更前:
```typescript
const shouldGenerateScreens =
  typeof flags.unit === 'undefined' || typeof flags.screen !== 'undefined';
const shouldGenerateUnits =
  typeof flags.screen === 'undefined' || typeof flags.unit !== 'undefined';
```

変更後:
```typescript
const hasScreenFlag   = typeof flags.screen !== 'undefined';
const hasUnitFlag     = typeof flags.unit !== 'undefined';
const hasWorkflowFlag = typeof flags.workflow !== 'undefined';
const anySpecified    = hasScreenFlag || hasUnitFlag || hasWorkflowFlag;

const shouldGenerateScreens   = !anySpecified || hasScreenFlag;
const shouldGenerateUnits     = !anySpecified || hasUnitFlag;
const shouldGenerateWorkflows = !anySpecified || hasWorkflowFlag;
```

**フラグ組み合わせの期待動作**:

| --screen | --unit | --workflow | screens | units | workflows |
|---------|--------|-----------|---------|-------|-----------|
| なし | なし | なし | ✓ | ✓ | ✓ |
| 指定 | なし | なし | ✓ | - | - |
| なし | 指定 | なし | - | ✓ | - |
| なし | なし | 指定 | - | - | ✓ |
| 指定 | 指定 | なし | ✓ | ✓ | - |
| 指定 | なし | 指定 | ✓ | - | ✓ |
| なし | 指定 | 指定 | - | ✓ | ✓ |

### `tespec view`

```
view.ts の watcher 対象ディレクトリに workflows_dir を追加
```

`parsed.result.config.workflows_dir` が存在する場合のみ watcher ディレクトリに追加（`units_dir` と同パターン）。

---

## 11. 実装手順

依存関係の順序で実装する。各ステップで `pnpm typecheck && pnpm test` を実行して GREEN を維持すること。

### Step 1: 型基盤（依存なし）

**`src/core/validation-types.ts` を新設**

```typescript
export interface ValidationIssue { ... }
export interface ValidationResult { ... }
```

**`validator.ts` と `unit-validator.ts` の import を切替**

- ローカル interface 定義（10 行）を削除
- `import type { ValidationIssue, ValidationResult } from './validation-types.js';` を追加
- ロジック変更なし

`pnpm typecheck && pnpm test` → 全テスト GREEN を確認。

### Step 2: スキーマ追加

**`src/core/schema.ts` に追加**

- `WorkflowStepSchema` / `WorkflowSchema` を追加
- `WorkflowStep` / `Workflow` 型をエクスポート
- `ConfigSchema` に `workflows_dir: z.string().optional()` を追加

`pnpm typecheck` でコンパイルエラーを確認（`ParsedProject` の波及箇所が列挙される）。

### Step 3: パーサー拡張

**`src/core/parser.ts` を変更**

- `ParsedProject` インターフェースに `workflows: Workflow[]` を追加
- `parseProject` 関数に workflow パース処理を追加（`units_dir` のパターンをそのまま踏襲）

```typescript
const workflowsResult = configResult.data.workflows_dir
  ? await parseYamlDirectory(workflowsDir, WorkflowSchema)
  : Promise.resolve({ items: [] as Workflow[], errors: [] as ParseError[] });
```

- `ParsedProject.workflows` の型エラーを起点に、コンパイラが示す全波及箇所を修正（`server.ts` / `client-entry.tsx` 等）

### Step 4: バリデーター新設

**`src/core/workflow-validator.ts` を新設**

```typescript
export function validateWorkflows(
  workflows: Workflow[],
  screens: Screen[],
): ValidationResult
```

バリデーションルール 3 つ（`checkDuplicateWorkflowIds` / `checkScreenReferences` / `checkEmptySteps`）を実装。

### Step 5: ジェネレーター新設

**`src/core/generators/types.ts` に追加**

`WorkflowTarget` / `WorkflowGenerator` インターフェースを追加。

**`src/core/generators/workflow/playwright.ts` を新設**

`generate(workflow: Workflow): string` を実装。生成ルールに従う。

**`src/core/generators/registry.ts` に追加**

`WORKFLOW_REGISTRY` / `getWorkflowGenerator` / `isWorkflowTarget` / `WORKFLOW_TARGETS` を追加。

### Step 6: CLI コマンド変更

**`src/commands/validate.ts`**

- `validateWorkflows` の呼び出しを追加
- `--file` 単体バリデーションに `WorkflowSchema` の試行を追加

**`src/commands/generate.ts`**

- `--workflow` / `--workflow-target` フラグを追加
- **実装前に既存の generate.ts テストのフラグ組み合わせカバレッジを確認する**
- 不足しているフラグ組み合わせのテストを先に追記してから排他制御ロジックを変更する（RED → GREEN）
- `anySpecified` ベースの排他制御に変更

**`src/commands/view.ts`**

- `workflows_dir` を watcher 対象ディレクトリに追加

### Step 7: Viewer 変更

**`src/core/viewer/server.ts`**

- `/api/specs` レスポンスに `workflows: currentData.workflows` を追加

**`src/core/viewer/client-entry.tsx`**

- `SpecsData` に `workflows: Workflow[]` を追加
- `View` 型に `{ type: 'workflow'; id: string }` を追加
- `ViewType` リテラル型を定義し、`onNavigate` の引数型として使用
- `ScreenDetail.tsx` の `onNavigate` 型も `ViewType` に修正（合わせて一貫化）
- サイドバーに Workflows セクションを追加
- ダッシュボードに Workflows カードグリッドを追加
- `WorkflowDetail` の import と条件レンダリングを追加

**`src/core/viewer/components/WorkflowDetail.tsx` を新設**

ステップカード一覧を実装。`step.screen` バッジは `onNavigate('screen', step.screen)` に接続。

---

## 12. テスト計画

### 新規テストファイル（2本）

#### `__test__/workflow-validator.test.ts`

| テストケース | 期待結果 |
|------------|---------|
| 有効な workflows（全ルール合格） | `hasErrors: false`, `issues: []` |
| 重複する workflow ID | `hasErrors: true`, error: `重複しています` |
| 存在しない screen 参照 | `hasErrors: true`, error: `screen が見つかりません` |
| 全ステップが action/expect 空 | `hasErrors: false`, warning: `未記述です` |
| 複数エラーが同時発生 | 全 issues が列挙される |
| workflows が空配列 | `hasErrors: false`, `issues: []` |

#### `__test__/generator-workflow-playwright.test.ts`

| テストケース | 期待結果 |
|------------|---------|
| action あり・expect なしステップ | `// Step N: screen — action` が生成 |
| action なし・expect あり | `// Step N: screen` + `// expect: ...` が生成 |
| action も expect も両方あり | 両方のコメントが生成 |
| 3 ステップのワークフロー | 単一テスト関数・3 ステップ |
| `fileNameFor` | `user_registration.spec.ts` を返す |

### 既存テストへの追記（3ファイル）

#### `__test__/schema.test.ts`（既存拡張）

- `WorkflowStepSchema` のパース（valid / invalid）
- `WorkflowSchema` のパース（`steps: []` は失敗すること）
- `ConfigSchema` に `workflows_dir` あり / なしのパース

#### `__test__/parser.test.ts`（既存拡張）

- `workflows_dir` あり: `ParsedProject.workflows` にアイテムが含まれる
- `workflows_dir` なし: `ParsedProject.workflows` が空配列
- workflow YAML パースエラー時: `errors` に含まれる

#### `__test__/generate.test.ts`（既存拡張・重要）

**Devil's Advocate 修正**: 排他制御ロジック変更前に以下のフラグ組み合わせテストを先に追加する。

| フラグ組み合わせ | screens生成 | units生成 | workflows生成 |
|---------------|------------|---------|-------------|
| フラグなし | ✓ | ✓ | ✓ |
| `--screen` のみ | ✓ | - | - |
| `--unit` のみ | - | ✓ | - |
| `--workflow` のみ | - | - | ✓ |
| `--screen --unit` | ✓ | ✓ | - |
| `--screen --workflow` | ✓ | - | ✓ |
| `--unit --workflow` | - | ✓ | ✓ |

### 既存テストへの影響確認

| ファイル | 影響 | 対処 |
|---------|------|------|
| `validator.test.ts` | import 変更後も GREEN のまま（ロジック変更なし） | 実行確認のみ |
| `unit-validator.test.ts` | 同上 | 実行確認のみ |
| `parser.test.ts` | `ParsedProject` に `workflows` フィールドが追加されるため、型アサーションを使っているテストは更新が必要な場合あり | 型エラーで検出可能 |
