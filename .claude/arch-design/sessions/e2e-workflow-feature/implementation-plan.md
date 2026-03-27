# E2E Workflow 機能 — 実装計画書

> 設計書: `step4-architecture.md`
> 作成: 2026-03-27

---

## 実装概要

| 項目 | 内容 |
|------|------|
| 新設ファイル | 4 本 |
| 変更ファイル | 11 本 |
| 新規テスト | 2 本 |
| 既存テスト追記 | 3 本 |
| テスト fixture | 2 セット（valid + invalid） |
| 実装 Wave | 7 Wave |

**鉄則**: 各 Wave 完了時に `pnpm typecheck && pnpm test` で GREEN を維持すること。

---

## Wave 1: 型基盤（validation-types.ts 抽出）

**目的**: ValidationIssue/ValidationResult を共通化し、3 重定義を防ぐ

### 1-1. `src/core/validation-types.ts` を新設

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

### 1-2. `src/core/validator.ts` の import 切替

- ローカル `ValidationIssue` / `ValidationResult` 定義（約 10 行）を削除
- `import type { ValidationIssue, ValidationResult } from './validation-types.js';` を追加
- **ロジック変更ゼロ**

### 1-3. `src/core/unit-validator.ts` の import 切替

- 同上（validator.ts と同じ作業）

### 検証

```bash
pnpm typecheck && pnpm test
```

既存テスト全て GREEN のまま。ロジック変更がないため。

---

## Wave 2: スキーマ追加

**目的**: Workflow の Zod スキーマと Config 拡張を追加

### 2-1. `src/core/schema.ts` に追加

```typescript
// --- Workflow ---

export const WorkflowStepSchema = z.object({
  screen: z.string(),
  action: z.string().optional(),
  expect: z.string().optional(),
});

export const WorkflowSchema = z.object({
  workflow: z.string(),
  title: z.string(),
  steps: z.array(WorkflowStepSchema).min(1),
});

export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
```

### 2-2. `src/core/schema.ts` の ConfigSchema 拡張

```typescript
export const ConfigSchema = z.object({
  version: z.number(),
  project: z.string(),
  screens_dir: z.string().default('./screens'),
  setups_dir: z.string().default('./setups'),
  units_dir: z.string().optional(),
  workflows_dir: z.string().optional(),  // 追加
});
```

### 2-3. テスト追記: `src/core/__test__/schema.test.ts`

- WorkflowStepSchema の valid/invalid パース
- WorkflowSchema の `steps: []` は失敗すること
- ConfigSchema に `workflows_dir` あり/なしのパース

### 検証

```bash
pnpm typecheck && pnpm test
```

---

## Wave 3: パーサー拡張

**目的**: ParsedProject に workflows を追加し、YAML パースを実装

### 3-1. `src/core/parser.ts` を変更

```typescript
export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];
  workflows: Workflow[];  // 追加（必須、空配列デフォルト）
}
```

`parseProject` に workflow パース処理を追加:

```typescript
const workflowsDir = configResult.data.workflows_dir
  ? path.resolve(configDir, configResult.data.workflows_dir)
  : undefined;

// Promise.all に追加
const workflowsResult = workflowsDir
  ? await parseYamlDirectory(workflowsDir, WorkflowSchema)
  : { items: [] as Workflow[], errors: [] as ParseError[] };

// return に追加
workflows: workflowsResult.items,
```

### 3-2. コンパイラ波及箇所の修正

`ParsedProject.workflows` 追加で TypeScript コンパイラが以下を検出:
- `src/core/viewer/server.ts` — `/api/specs` に `workflows` 追加
- `src/core/viewer/template.ts` — `initialData` に `workflows` 追加
- `src/core/viewer/client-entry.tsx` — `SpecsData` に `workflows` 追加（型エラー解消のみ）

最小限の修正で型エラーを解消する（表示ロジックは Wave 7 で追加）。

### 3-3. テスト fixture 作成

`tests/fixtures/workflow-valid/`:
```
config.yaml          # workflows_dir: ./workflows を追加
screens/login.yaml   # 既存パターン
screens/home.yaml
setups/auth.yaml
workflows/user_registration.yaml
```

`tests/fixtures/workflow-invalid/`:
```
config.yaml
screens/login.yaml
workflows/bad_ref.yaml   # 存在しない screen 参照
workflows/duplicate.yaml # 重複 ID（同じ workflow ID）
```

### 3-4. テスト追記: `src/core/__test__/parser.test.ts`

- `workflows_dir` あり: `ParsedProject.workflows` にアイテムが含まれる
- `workflows_dir` なし: `ParsedProject.workflows` が空配列
- workflow YAML パースエラー時: `errors` に含まれる

### 検証

```bash
pnpm typecheck && pnpm test
```

---

## Wave 4: バリデーター新設

**目的**: Workflow の参照整合性チェックを実装

### 4-1. `src/core/workflow-validator.ts` を新設

```typescript
import type { Screen, Workflow } from './schema.js';
import type { ValidationIssue, ValidationResult } from './validation-types.js';

export function validateWorkflows(
  workflows: Workflow[],
  screens: Screen[],
): ValidationResult {
  const issues: ValidationIssue[] = [];
  checkDuplicateWorkflowIds(workflows, issues);
  checkScreenReferences(workflows, screens, issues);
  checkEmptySteps(workflows, issues);
  return { issues, hasErrors: issues.some((i) => i.level === 'error') };
}
```

バリデーションルール:

| 関数 | level | 条件 |
|------|-------|------|
| `checkDuplicateWorkflowIds` | error | 同一 workflow ID が複数存在 |
| `checkScreenReferences` | error | step.screen が既存 screen に存在しない |
| `checkEmptySteps` | warning | 全ステップが action/expect ともに未記述 |

### 4-2. テスト新設: `src/core/__test__/workflow-validator.test.ts`

| テストケース | 期待結果 |
|------------|---------|
| 有効な workflows | `hasErrors: false`, `issues: []` |
| 重複 workflow ID | error: `重複しています` |
| 存在しない screen 参照 | error: `screen が見つかりません` |
| 全ステップ action/expect 空 | warning: `未記述です` |
| 複数エラー同時発生 | 全 issues が列挙される |
| workflows 空配列 | `hasErrors: false`, `issues: []` |

### 検証

```bash
pnpm typecheck && pnpm test
```

---

## Wave 5: ジェネレーター新設

**目的**: Workflow から Playwright テストスケルトンを生成

### 5-1. `src/core/generators/types.ts` に追加

```typescript
import type { Workflow } from '../schema.js';

export type WorkflowTarget = 'playwright';

export interface WorkflowGenerator {
  generate(workflow: Workflow): string;
  fileNameFor(workflowId: string): string;
}
```

### 5-2. `src/core/generators/workflow/playwright.ts` を新設

生成ルール:
- `test.describe` なし。単一 `test()` 関数
- action あり: `// Step N: screen_id — action`
- action なし: `// Step N: screen_id`
- expect あり: `// expect: expect_text`
- 各ステップ末尾: `// TODO: implement`
- ステップ間は空行

### 5-3. `src/core/generators/registry.ts` に追加

```typescript
import { playwright as workflowPlaywright } from './workflow/playwright.js';

const WORKFLOW_REGISTRY: Record<WorkflowTarget, WorkflowGenerator> = {
  playwright: workflowPlaywright,
};

export function getWorkflowGenerator(target: WorkflowTarget): WorkflowGenerator { ... }
export const WORKFLOW_TARGETS: readonly WorkflowTarget[] = ...;
export function isWorkflowTarget(value: string): value is WorkflowTarget { ... }
```

### 5-4. テスト新設: `src/core/__test__/generator-workflow-playwright.test.ts`

| テストケース | 期待結果 |
|------------|---------|
| action あり / expect なし | `// Step N: screen — action` |
| action なし / expect あり | `// Step N: screen` + `// expect: ...` |
| action + expect 両方あり | 両方のコメント |
| 3 ステップのワークフロー | 単一テスト関数・3 ステップ |
| `fileNameFor` | `user_registration.spec.ts` |

### 検証

```bash
pnpm typecheck && pnpm test
```

---

## Wave 6: CLI コマンド変更

**目的**: validate / generate / view コマンドに Workflow サポートを追加

### 6-1. `src/commands/validate.ts`

- `validateWorkflows(parsed.result.workflows, parsed.result.screens)` 呼び出し追加
- `--file` 単体バリデーション: `WorkflowSchema` を試行対象に追加

### 6-2. `src/commands/generate.ts`（重要: テストファースト）

**Step A**: 既存のフラグ組み合わせテストの確認・補完

以下のフラグ組み合わせテストを**先に**追記:

| --screen | --unit | --workflow | screens | units | workflows |
|---------|--------|-----------|---------|-------|-----------|
| なし | なし | なし | ✓ | ✓ | ✓ |
| 指定 | なし | なし | ✓ | - | - |
| なし | 指定 | なし | - | ✓ | - |
| なし | なし | 指定 | - | - | ✓ |
| 指定 | 指定 | なし | ✓ | ✓ | - |
| 指定 | なし | 指定 | ✓ | - | ✓ |
| なし | 指定 | 指定 | - | ✓ | ✓ |

**Step B**: フラグ追加と排他制御ロジック変更

```typescript
// 新フラグ
workflow: Flags.string({ description: 'Generate only a specific workflow id' }),
'workflow-target': Flags.string({
  options: [...WORKFLOW_TARGETS],
  default: 'playwright',
}),

// 排他制御
const hasScreenFlag = typeof flags.screen !== 'undefined';
const hasUnitFlag = typeof flags.unit !== 'undefined';
const hasWorkflowFlag = typeof flags.workflow !== 'undefined';
const anySpecified = hasScreenFlag || hasUnitFlag || hasWorkflowFlag;

const shouldGenerateScreens   = !anySpecified || hasScreenFlag;
const shouldGenerateUnits     = !anySpecified || hasUnitFlag;
const shouldGenerateWorkflows = !anySpecified || hasWorkflowFlag;
```

### 6-3. `src/commands/view.ts`

- `workflows_dir` を watcher 対象ディレクトリに追加（4 行）

### 検証

```bash
pnpm typecheck && pnpm test
```

---

## Wave 7: Viewer 変更

**目的**: Web UI に Workflows セクションを追加

### 7-1. `src/core/viewer/components/WorkflowDetail.tsx` を新設

```typescript
type ViewType = 'dashboard' | 'screen' | 'unit' | 'setup' | 'workflow';

interface WorkflowDetailProps {
  workflow: Workflow;
  onNavigate: (type: ViewType, id: string) => void;
}
```

表示仕様:
- ステップカードを縦に並べる（フロー図なし）
- `step.screen` バッジクリック → `onNavigate('screen', step.screen)`
- action/expect は存在時のみ表示
- Tailwind 配色は ScreenDetail のカードスタイル踏襲

### 7-2. `src/core/viewer/client-entry.tsx` の変更

- `SpecsData` に `workflows: Workflow[]` 追加
- `View` 型に `{ type: 'workflow'; id: string }` 追加
- `ViewType` リテラル型定義
- **既存の `ScreenDetail.tsx` の `onNavigate` 型も `ViewType` に修正**
- サイドバーに Workflows セクション追加
- ダッシュボードに Workflows カードグリッド追加
- `WorkflowDetail` の条件レンダリング追加

### 7-3. テスト fixture 追加

`docs/tespec/` の example specs に workflow サンプルを追加:
```yaml
# docs/tespec/workflows/user_registration.yaml
workflow: user_registration
title: "新規ユーザー登録フロー"
steps:
  - screen: login
    action: "新規登録リンクをタップ"
  - screen: home
    expect: "ホーム画面が表示される"
```

`docs/tespec/config.yaml` に `workflows_dir: ./workflows` を追加。

### 検証

```bash
pnpm typecheck && pnpm test && pnpm build
```

ビルド後 `tespec view` で実際にブラウザ確認。

---

## 実装対象ファイル一覧（全 15 本）

### 新設（4 本）

| # | ファイルパス | Wave |
|---|------------|------|
| 1 | `src/core/validation-types.ts` | 1 |
| 2 | `src/core/workflow-validator.ts` | 4 |
| 3 | `src/core/generators/workflow/playwright.ts` | 5 |
| 4 | `src/core/viewer/components/WorkflowDetail.tsx` | 7 |

### 変更（11 本）

| # | ファイルパス | Wave | 変更量 |
|---|------------|------|-------|
| 5 | `src/core/schema.ts` | 2 | +25行 |
| 6 | `src/core/parser.ts` | 3 | +15行 |
| 7 | `src/core/validator.ts` | 1 | -10行 +1行 |
| 8 | `src/core/unit-validator.ts` | 1 | -10行 +1行 |
| 9 | `src/core/generators/types.ts` | 5 | +10行 |
| 10 | `src/core/generators/registry.ts` | 5 | +15行 |
| 11 | `src/commands/validate.ts` | 6 | +20行 |
| 12 | `src/commands/generate.ts` | 6 | +30行 |
| 13 | `src/commands/view.ts` | 6 | +4行 |
| 14 | `src/core/viewer/server.ts` | 3 | +1行 |
| 15 | `src/core/viewer/client-entry.tsx` | 7 | +40行 |

### テスト（5 本）

| # | ファイルパス | Wave | 種別 |
|---|------------|------|------|
| T1 | `src/core/__test__/workflow-validator.test.ts` | 4 | 新設 |
| T2 | `src/core/__test__/generator-workflow-playwright.test.ts` | 5 | 新設 |
| T3 | `src/core/__test__/schema.test.ts` | 2 | 追記 |
| T4 | `src/core/__test__/parser.test.ts` | 3 | 追記 |
| T5 | `src/commands/generate.test.ts` or 相当 | 6 | 追記 |

### Fixture（2 セット）

| # | ディレクトリ | Wave |
|---|------------|------|
| F1 | `tests/fixtures/workflow-valid/` | 3 |
| F2 | `tests/fixtures/workflow-invalid/` | 3 |

---

## 設計上の絶対ルール（変えてはいけない決定）

1. `validation-types.ts` は型定義のみ。関数・定数・ロジックを含めない
2. `workflows_dir` は `.optional()` のみ。`.default()` を使わない
3. `ParsedProject.workflows` は `Workflow[]`（必須）。`undefined` にしない
4. `WorkflowGenerator.generate()` に `Screen[]` を渡さない
5. `onNavigate` の第 1 引数は `ViewType` リテラル型を使う
6. テスト生成は `test.describe` なしの単一 `test()` 関数
