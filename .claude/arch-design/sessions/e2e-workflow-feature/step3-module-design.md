# Step 3: モジュール設計

採用パターン: **案1+2（ミラー縦割り + ValidationIssue 型共通化）**

---

## [Module Designer] モジュール詳細設計

### 1. 全モジュール一覧（新設 + 変更ファイル）

#### 新設ファイル（4本）

| ファイル | 責務 | 公開インターフェース |
|---------|------|-------------------|
| `src/core/validation-types.ts` | `ValidationIssue` / `ValidationResult` の共通型定義 | `ValidationIssue`, `ValidationResult` |
| `src/core/workflow-validator.ts` | Workflow の参照整合性・構造バリデーション | `validateWorkflows(workflows, screens)` |
| `src/core/generators/workflow/playwright.ts` | Workflow → Playwright E2E テストコード生成 | `playwright: WorkflowGenerator` |
| `src/core/viewer/components/WorkflowDetail.tsx` | Workflow 詳細表示 Preact コンポーネント | named export `WorkflowDetail` |

> **Platform Expert 指摘 #1 反映**: `generators/workflow/types.ts` は作成しない。`WorkflowTarget` / `WorkflowGenerator` は既存の `src/core/generators/types.ts` のみで定義する。`generators/screen/playwright.ts` が `generators/types.ts` から `ScreenGenerator` を import しているパターンと対称性を保つ。

#### 変更ファイル（10本）

| ファイル | 変更内容 | 変更量 |
|---------|---------|-------|
| `src/core/schema.ts` | `WorkflowStepSchema`, `WorkflowSchema`, 型エクスポート追加; `ConfigSchema` に `workflows_dir` 追加 | +25行 |
| `src/core/parser.ts` | `ParsedProject.workflows` 追加; `parseProject` に workflow パース追加 | +15行 |
| `src/core/validator.ts` | `ValidationIssue` / `ValidationResult` を `validation-types.ts` から import | -10行+1行 |
| `src/core/unit-validator.ts` | 同上 | -10行+1行 |
| `src/core/generators/types.ts` | `WorkflowTarget`, `WorkflowGenerator` インターフェース追加 | +10行 |
| `src/core/generators/registry.ts` | `WORKFLOW_REGISTRY`, `getWorkflowGenerator`, `isWorkflowTarget`, `WORKFLOW_TARGETS` 追加 | +15行 |
| `src/commands/validate.ts` | `validateWorkflows` 呼び出し追加; `--file` 単体バリデーションに `WorkflowSchema` 追加 | +20行 |
| `src/commands/generate.ts` | `--workflow`, `--workflow-target` フラグ追加; workflow 生成ロジック追加 | +30行 |
| `src/commands/view.ts` | `workflows_dir` を watcher 対象に追加 | +4行 |
| `src/core/viewer/server.ts` | `/api/specs` レスポンスに `workflows` 追加 | +1行 |
| `src/core/viewer/template.ts` | `initialData` に `workflows` 追加 | +1行 |
| `src/core/viewer/components/App.tsx` | `View` 型に `workflow` 追加; サイドバーと main に Workflows セクション追加 | +20行 |

---

### 2. Zod スキーマ詳細

#### `WorkflowStepSchema`

```typescript
export const WorkflowStepSchema = z.object({
  screen: z.string(),            // 既存 screen ID への参照（必須）
  action: z.string().optional(), // このステップで行う操作（任意）
  expect: z.string().optional(), // このステップで期待する状態（任意）
});
```

設計根拠:
- `screen` 必須: 参照チェックの対象であり、どの画面で実行するかを必ず示す
- `action` / `expect` は任意: 最終ステップで `expect` だけ書くユースケースを許容（YAML 例のとおり）
- `expect` は `z.string().optional()` のみ（`z.union([z.string(), z.array(z.string())])` にしない）: ワークフローの expect はフロー全体のゴール記述が 1 文で済む想定

#### `WorkflowSchema`

```typescript
export const WorkflowSchema = z.object({
  workflow: z.string(),                       // Workflow ID（ファイル識別子）
  title: z.string(),                          // 表示用タイトル
  steps: z.array(WorkflowStepSchema).min(1),  // 最低 1 ステップ必須
});
```

#### 型エクスポート追加

```typescript
export type WorkflowStep = z.infer<typeof WorkflowStepSchema>;
export type Workflow = z.infer<typeof WorkflowSchema>;
```

#### `ConfigSchema` への追加

```typescript
workflows_dir: z.string().optional(),  // 追加（.default('./workflows') は使わない）
```

`.default('./workflows')` にしない理由: `units_dir` と同じパターンで、未定義なら `parseProject` が `workflows: []` を返す。デフォルト値があると workflows ディレクトリが存在しない既存プロジェクトでエラーになる。

---

### 3. `validation-types.ts` の内容と移行方法

#### ファイル内容

```typescript
// src/core/validation-types.ts
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

#### 既存ファイルの移行（最小変更）

`validator.ts` と `unit-validator.ts` それぞれでローカル定義している `ValidationIssue` / `ValidationResult` を削除し、import に置き換える:

```typescript
// 削除: ファイル先頭の interface 定義 2 つ（計 10 行）
// 追加:
import type { ValidationIssue, ValidationResult } from './validation-types.js';
```

ロジック・関数シグネチャへの変更はゼロ。既存テストはそのまま GREEN のまま。

---

### 4. `workflow-validator.ts` のバリデーションルール一覧

#### シグネチャ

Dependency Analyst の Rule 3 より `screens: Screen[]` を受け取る。これにより validator は parser.ts に依存しない純粋関数として保てる。

```typescript
import type { Screen, Workflow } from './schema.js';
import type { ValidationIssue, ValidationResult } from './validation-types.js';

export function validateWorkflows(
  workflows: Workflow[],
  screens: Screen[],
): ValidationResult
```

#### バリデーションルール

| チェック関数 | level | 条件 | メッセージ例 |
|------------|-------|------|------------|
| `checkDuplicateWorkflowIds` | error | 同一 `workflow` ID が複数存在 | `workflow ID "user_registration" が重複しています` |
| `checkScreenReferences` | error | `step.screen` が既存 screenIds に存在しない | `steps[1].screen "dashboard" → screen が見つかりません` |
| `checkEmptySteps` | warning | 全ステップに `action` も `expect` も未記述 | `全ステップに action/expect が未記述です` |

error/warning の判断基準:
- `error`: 参照不整合・ID 重複 → テスト生成が不可能または誤ったコードになる
- `warning`: `action`/`expect` 全未記述 → テスト生成は可能だが有用性が低いコードになる

`checkEmptySteps` は steps が空の場合は Zod の `.min(1)` がパース段階で弾くため、ここでは「全ステップが action/expect ともに空」のケースを対象にする。

ファイルパス生成:

```typescript
function toWorkflowFile(workflowId: string): string {
  return `workflows/${workflowId}.yaml`;
}
```

---

### 5. `WorkflowGenerator` インターフェース

Dependency Analyst の Rule 5 に従い、`generate` は `Workflow` のみ受け取る（`Screen[]` 不要）。

> **Platform Expert 指摘 #1 反映**: `generators/workflow/types.ts` は作成しない。定義は `generators/types.ts` 1 箇所のみ。

#### `src/core/generators/types.ts` への追加のみ

```typescript
// 既存の import に Workflow を追加
import type { Screen, Setup, UnitSpec, Workflow } from '../schema.js';

// 追加
export type WorkflowTarget = 'playwright';

export interface WorkflowGenerator {
  generate(workflow: Workflow): string;
  fileNameFor(workflowId: string): string;
}
```

`generators/workflow/playwright.ts` からは `generators/types.ts` を import する:

```typescript
import type { WorkflowGenerator } from '../types.js';
```

#### `registry.ts` への追加

```typescript
import { playwright as workflowPlaywright } from './workflow/playwright.js';
import type { WorkflowGenerator, WorkflowTarget } from './types.js';

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

---

### 6. `generators/workflow/playwright.ts` — 生成コード例

#### 入力 YAML

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

#### 生成されるテストコード

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

#### 生成ルール

- `test.describe` を使わない: ワークフロー全体が単一テスト関数
- ステップコメント: `// Step N: <screen_id> — <action>`（action がある場合）
- action がない場合: `// Step N: <screen_id>`（ダッシュなし）
- expect がある場合: `// expect: <expect>` をその下の行に追加
- `// TODO: implement` を毎ステップ末尾に追加
- `fileNameFor`: `(workflowId) => \`${workflowId}.spec.ts\``

#### 実装スケルトン

```typescript
import type { Workflow, WorkflowStep } from '../../schema.js';
import type { WorkflowGenerator } from './types.js';

export const playwright: WorkflowGenerator = {
  generate: generateWorkflowTestFile,
  fileNameFor: (workflowId) => `${workflowId}.spec.ts`,
};

function generateWorkflowTestFile(workflow: Workflow): string {
  const stepLines = workflow.steps.flatMap((step, index) =>
    renderStep(step, index + 1),
  );

  const lines = [
    'import { test, expect } from "@playwright/test";',
    '',
    `test(${quote(workflow.title)}, async ({ page }) => {`,
    ...stepLines,
    '});',
  ];

  return `${lines.join('\n')}\n`;
}

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

function quote(value: string): string {
  return JSON.stringify(value);
}
```

---

### 7. `WorkflowDetail.tsx` — Viewer コンポーネント表示仕様

Dependency Analyst の Rule 5・Rule 6 に従い、`workflow: Workflow` + `onNavigate` のみを props に受け取る（Screen[] は渡さない）。

#### Props

```typescript
interface WorkflowDetailProps {
  workflow: Workflow;
  onNavigate: (type: string, id: string) => void;
}
```

#### 表示レイアウト

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

- 各ステップはカード形式で縦に並ぶ
- `step.screen` バッジクリック → `onNavigate('screen', step.screen)` で ScreenDetail に遷移
- `action` / `expect` は存在するときのみ表示（条件付きレンダリング）
- Tailwind 配色は `ScreenDetail.tsx` のカードスタイルを踏襲（`bg-white rounded-xl border border-gray-200 shadow-sm`）
- ステップ番号の見出し: `// Step 1` のテキストを `text-xs font-semibold text-gray-400` で表示

#### `App.tsx` への変更

```typescript
// 1. View 型に追加
type View =
  | { type: 'dashboard' }
  | { type: 'screen'; id: string }
  | { type: 'unit'; id: string }
  | { type: 'setup'; id: string }
  | { type: 'workflow'; id: string };  // 追加

// 2. destructure に workflows 追加
const { screens, units, setups, workflows } = data;

// 3. isEmpty 判定に workflows.length を追加
const isEmpty = screens.length === 0 && units.length === 0
  && setups.length === 0 && workflows.length === 0;

// 4. サイドバーに Workflows セクション追加（Setups の後）
{workflows.length > 0 && (
  <div>
    <h3>Workflows</h3>
    {workflows.map((w) => (
      <div
        key={w.workflow}
        data-testid={`sidebar-workflow-${w.workflow}`}
        {...clickable(() => navigate('workflow', w.workflow))}
      >
        {w.workflow}
      </div>
    ))}
  </div>
)}

// 5. main のレンダリングに追加
{view.type === 'workflow' &&
  (() => {
    const w = workflows.find((wf) => wf.workflow === view.id);
    return w ? <WorkflowDetail workflow={w} onNavigate={navigate} /> : null;
  })()}
```

---

### 8. `ParsedProject` 拡張 — `workflows: Workflow[]`（必須）

Dependency Analyst の Rule 4 で確定済み。

```typescript
export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];
  workflows: Workflow[];  // 追加（必須・空配列が基底値）
}
```

`parseProject` 内の変更:

```typescript
const workflowsDir = configResult.data.workflows_dir
  ? path.resolve(configDir, configResult.data.workflows_dir)
  : undefined;

const [screensResult, setupsResult, unitsResult, workflowsResult] = await Promise.all([
  parseYamlDirectory(screensDir, ScreenSchema),
  parseYamlDirectory(setupsDir, SetupSchema),
  unitsDir
    ? parseYamlDirectory(unitsDir, UnitSpecSchema)
    : Promise.resolve({ items: [] as UnitSpec[], errors: [] as ParseError[] }),
  workflowsDir
    ? parseYamlDirectory(workflowsDir, WorkflowSchema)
    : Promise.resolve({ items: [] as Workflow[], errors: [] as ParseError[] }),
]);

// エラー集約・返却
return {
  result: {
    config: configResult.data,
    screens: screensResult.items,
    setups: setupsResult.items,
    units: unitsResult.items,
    workflows: workflowsResult.items,  // 追加
  },
  errors: [],
};
```

---

### 9. CLI フラグ設計

#### `generate.ts` への追加フラグ

```typescript
workflow: Flags.string({
  description: 'Generate only a specific workflow id',
}),
'workflow-target': Flags.string({
  description: 'Target test framework for workflow specs',
  options: [...WORKFLOW_TARGETS],
  default: 'playwright',
}),
```

#### 生成対象の排他制御ロジック

現在の 2 変数ロジック（`shouldGenerateScreens` / `shouldGenerateUnits`）を 3 変数に拡張する。

```typescript
const hasScreenFlag   = typeof flags.screen !== 'undefined';
const hasUnitFlag     = typeof flags.unit !== 'undefined';
const hasWorkflowFlag = typeof flags.workflow !== 'undefined';
const anySpecified    = hasScreenFlag || hasUnitFlag || hasWorkflowFlag;

const shouldGenerateScreens   = !anySpecified || hasScreenFlag;
const shouldGenerateUnits     = !anySpecified || hasUnitFlag;
const shouldGenerateWorkflows = !anySpecified || hasWorkflowFlag;
```

挙動表:

| 指定フラグ | screens | units | workflows |
|-----------|---------|-------|-----------|
| (なし) | 生成 | 生成 | 生成 |
| `--screen foo` | foo のみ | 生成しない | 生成しない |
| `--unit bar` | 生成しない | bar のみ | 生成しない |
| `--workflow baz` | 生成しない | 生成しない | baz のみ |
| `--screen foo --workflow baz` | foo のみ | 生成しない | baz のみ |

**注意**: 既存の `shouldGenerateScreens` / `shouldGenerateUnits` のロジック式が変わるため、`generate.ts` の既存テストで挙動確認が必要。

#### `validate.ts` への変更

```typescript
// 1. validateWorkflows 呼び出し追加
const workflowValidation = validateWorkflows(
  parsed.result.workflows,
  parsed.result.screens,
);
const issues = [
  ...screenValidation.issues,
  ...unitValidation.issues,
  ...workflowValidation.issues,
];

// 2. hasErrors 判定に workflowValidation 追加
if (screenValidation.hasErrors || unitValidation.hasErrors || workflowValidation.hasErrors) {
  this.exit(1);
}

// 3. printOk の対象に workflow ファイルを追加
for (const workflow of parsed.result.workflows) {
  const workflowFile = `workflows/${workflow.workflow}.yaml`;
  if (!errorFiles.has(workflowFile)) {
    printOk(workflowFile);
  }
}

// 4. --file 単体バリデーション: WorkflowSchema の試行追加
const workflowResult = await parseYamlFile(filePath, WorkflowSchema);
if (workflowResult.data) {
  printOk(toDisplayPath(filePath));
  return;
}
// selectSingleFileErrors に '/workflows/' パス判定を追加
```

#### `view.ts` への変更

```typescript
const directories = [
  path.resolve(configDir, parsed.result.config.screens_dir),
  path.resolve(configDir, parsed.result.config.setups_dir),
  ...(parsed.result.config.units_dir
    ? [path.resolve(configDir, parsed.result.config.units_dir)]
    : []),
  ...(parsed.result.config.workflows_dir          // 追加
    ? [path.resolve(configDir, parsed.result.config.workflows_dir)]
    : []),
];
```

---

### 10. 実装順序の推奨（依存グラフに基づく）

1. `validation-types.ts` 新設 → `validator.ts` / `unit-validator.ts` の import 切替（既存テスト GREEN 確認）
2. `schema.ts` に `WorkflowStepSchema` / `WorkflowSchema` / `ConfigSchema` 追加
3. `parser.ts` の `ParsedProject` + `parseProject` 拡張（コンパイルエラーで波及箇所を一括把握）
4. `workflow-validator.ts` 新設
5. `generators/types.ts` に `WorkflowTarget` / `WorkflowGenerator` 追加 → `generators/workflow/playwright.ts` 新設
6. `generators/registry.ts` に workflow レジストリ追加
7. `commands/validate.ts` / `commands/generate.ts` / `commands/view.ts` 更新
8. `viewer/server.ts` / `viewer/template.ts` 更新
9. `viewer/components/WorkflowDetail.tsx` 新設 → `App.tsx` 更新

---

## [Platform Expert] 実装時の注意事項

### #1. `generators/workflow/types.ts` は作成しない（確定）

`WorkflowTarget` / `WorkflowGenerator` は `src/core/generators/types.ts` のみで定義する。
`generators/workflow/playwright.ts` の import は以下のとおり:

```typescript
import type { WorkflowGenerator } from '../types.js';   // generators/types.ts を参照
import type { Workflow, WorkflowStep } from '../../schema.js';
```

既存の `generators/screen/playwright.ts` も `generators/types.ts` から `ScreenGenerator` を import しており、完全に対称的なパターンになる。

### #2. Biome lint 対象（実装時注意）

`biome.json` の除外設定:
```json
"includes": ["**", "!!**/dist", "!!src/core/viewer/client-entry.tsx"]
```

除外されるのは `client-entry.tsx` のみ。以下のファイルは lint 対象:
- `App.tsx`（変更ファイル）
- `WorkflowDetail.tsx`（新設ファイル）

JSX の `class=` 属性は Biome の `recommended: true` ルールでは問題ない（`noSvgWithoutTitle` が `off`、`noUnusedFunctionParameters` が `off` のみのカスタマイズ）。ただし実装後に `pnpm lint` を実行して確認すること。

### #3. Vitest の `.tsx` 対応（コンポーネントテストを書く場合のみ）

現在の `vitest.config.ts`:
```typescript
include: ['src/**/*.test.ts', 'tests/**/*.test.ts']
```

`WorkflowDetail.tsx` のコンポーネントテストを `*.test.tsx` で書く場合、以下の変更が必要:
```typescript
include: ['src/**/*.test.{ts,tsx}', 'tests/**/*.test.{ts,tsx}']
```

さらに `@testing-library/preact` を使う場合は `environment: 'jsdom'` も追加が必要。

**現時点の推奨**: `WorkflowDetail.tsx` のコンポーネントテストは Phase 1 スコープ外とし、`vitest.config.ts` は変更しない。`workflow-validator.ts` / `generators/workflow/playwright.ts` の純粋関数テストは既存の `*.test.ts` で書ける。

---

---

## [Dependency Analyst] 依存グラフ設計

### 凡例
- `→` : import 依存（矢印の向きが「依存する側 → 依存される側」）
- `[NEW]` : 新設ファイル
- `[MOD]` : 既存ファイルの変更
- `[UNCHANGED]` : 変更なし

---

### 完全依存グラフ（Workflow 追加後）

```
外部ライブラリ
  zod ←────────────────────────── schema.ts [MOD]
  yaml ←───────────────────────── parser.ts [MOD]
  chokidar ←───────────────────── viewer/watcher.ts [UNCHANGED]
  hono ←───────────────────────── viewer/server.ts [MOD]
  @oclif/core ←────────────────── commands/*.ts, cli.ts

Layer 0: 型定義・スキーマ（被依存のみ、他への依存なし）
─────────────────────────────────────────────────────
  validation-types.ts [NEW]       ← 依存元なし（純粋な型定義）

  schema.ts [MOD]
    ← validation-types.ts は参照しない（型のみの独立層）
    内容: CaseSchema, ScreenSchema, SetupSchema,
          UnitSpecSchema, WorkflowStepSchema [NEW], WorkflowSchema [NEW],
          ConfigSchema（workflows_dir 追加）

Layer 1: パーサー（schema.ts にのみ依存）
─────────────────────────────────────────
  parser.ts [MOD]
    → schema.ts
    公開: ParsedProject（workflows: Workflow[] 追加）

Layer 2: バリデーター（schema.ts + validation-types.ts に依存）
─────────────────────────────────────────────────────────────
  validator.ts [MOD]
    → schema.ts（Screen, Setup）
    → validation-types.ts [NEW]（ValidationIssue, ValidationResult）
    シグネチャ: validate(screens: Screen[], setups: Setup[]): ValidationResult

  unit-validator.ts [MOD]
    → schema.ts（UnitSpec）
    → validation-types.ts [NEW]（ValidationIssue, ValidationResult）
    シグネチャ: validateUnits(units: UnitSpec[]): ValidationResult

  workflow-validator.ts [NEW]
    → schema.ts（Workflow, Screen）
    → validation-types.ts [NEW]（ValidationIssue, ValidationResult）
    シグネチャ: validateWorkflows(workflows: Workflow[], screens: Screen[]): ValidationResult

Layer 3: ジェネレーター（schema.ts にのみ依存）
─────────────────────────────────────────────
  generators/types.ts [MOD]
    → schema.ts（Screen, Setup, UnitSpec, Workflow）
    公開: ScreenGenerator, UnitGenerator, WorkflowGenerator [NEW]

  generators/screen/playwright.ts [UNCHANGED]
    → schema.ts（Case, Screen, Setup）
    → generators/types.ts（ScreenGenerator）

  generators/screen/vitest.ts [UNCHANGED]
    → schema.ts
    → generators/types.ts

  generators/screen/xctest.ts [UNCHANGED]
    → schema.ts
    → generators/types.ts

  generators/unit/vitest.ts [UNCHANGED]
    → schema.ts（UnitSpec）
    → generators/types.ts（UnitGenerator）

  generators/unit/xctest.ts [UNCHANGED]
    → schema.ts
    → generators/types.ts

  generators/workflow/playwright.ts [NEW]
    → schema.ts（Workflow, WorkflowStep）
    → generators/types.ts（WorkflowGenerator）
    ※ Screen[] を参照するかどうかは後述「Issue: generators/workflow の Screen 依存」参照

  generators/registry.ts [MOD]
    → generators/types.ts（ScreenGenerator, UnitGenerator, WorkflowGenerator）
    → generators/screen/playwright.ts, vitest.ts, xctest.ts
    → generators/unit/vitest.ts, xctest.ts
    → generators/workflow/playwright.ts [NEW]
    公開: getWorkflowGenerator(), isWorkflowTarget(), WORKFLOW_TARGETS

Layer 4: Viewer（parser.ts + schema.ts に依存）
───────────────────────────────────────────────
  viewer/template.ts [MOD]
    → parser.ts（ParsedProject）
    変更: initialData に workflows を追加

  viewer/server.ts [MOD]
    → parser.ts（ParsedProject）
    変更: /api/specs レスポンスに workflows を追加

  viewer/watcher.ts [UNCHANGED]
    → chokidar のみ

  viewer/client-entry.tsx [MOD]
    → viewer/components/App.tsx

  viewer/components/App.tsx [MOD]
    → parser.ts（ParsedProject — 型のみ）
    → viewer/components/ScreenDetail.tsx
    → viewer/components/SetupDetail.tsx
    → viewer/components/UnitDetail.tsx
    → viewer/components/WorkflowDetail.tsx [NEW]
    変更: workflows を destructure、Workflows セクション追加

  viewer/components/ScreenDetail.tsx [UNCHANGED]
    → schema.ts（Screen, Setup）

  viewer/components/SetupDetail.tsx [UNCHANGED]
    → schema.ts

  viewer/components/UnitDetail.tsx [UNCHANGED]
    → schema.ts

  viewer/components/WorkflowDetail.tsx [NEW]
    → schema.ts（Workflow, WorkflowStep, Screen）

Layer 5: コマンド（全レイヤーの集約点）
───────────────────────────────────────
  commands/validate.ts [MOD]
    → parser.ts
    → schema.ts（ScreenSchema, SetupSchema, UnitSpecSchema, WorkflowSchema）
    → validator.ts
    → unit-validator.ts
    → workflow-validator.ts [NEW]
    → utils/output.ts

  commands/generate.ts [MOD]
    → parser.ts
    → generators/registry.ts
    → validator.ts
    → unit-validator.ts
    → workflow-validator.ts [NEW]
    → utils/output.ts

  commands/view.ts [MOD]
    → parser.ts
    → viewer/server.ts
    → viewer/watcher.ts
    → utils/output.ts
    変更: workflows_dir の watch 追加

  cli.ts [UNCHANGED]
    → @oclif/core
```

---

### 依存方向の変化サマリー

| モジュール | 変化 | 詳細 |
|---|---|---|
| `validation-types.ts` | 新設 | 何も import しない純粋な型定義ファイル |
| `validator.ts` | import 変更 | 内部の `ValidationIssue` 定義を削除し `validation-types.ts` から import |
| `unit-validator.ts` | import 変更 | 同上 |
| `workflow-validator.ts` | 新設 | `schema.ts` + `validation-types.ts` のみに依存 |
| `generators/workflow/playwright.ts` | 新設 | `schema.ts` + `generators/types.ts` のみ（Screen[] 不要、後述） |
| `viewer/components/WorkflowDetail.tsx` | 新設 | `schema.ts` のみ（parser.ts への依存なし） |
| `commands/validate.ts` | import 追加 | `workflow-validator.ts` を新規 import |
| `commands/generate.ts` | import 追加 | `generators/registry.ts` 経由で workflow generator を利用 |

---

## [Dependency Analyst] 依存ルール

### Rule 1: 単方向依存の強制（最重要）

各レイヤーは「上位レイヤーを import してはならない」。

```
禁止:
  schema.ts       → parser.ts      ✗
  schema.ts       → validator.ts   ✗
  validation-types.ts → schema.ts  ✗（型定義層は完全に孤立）
  validator.ts    → parser.ts      ✗
  generators/**   → validator.ts   ✗
  generators/**   → parser.ts      ✗
  viewer/**       → commands/**    ✗
```

### Rule 2: validation-types.ts は何も import しない

`validation-types.ts` は TypeScript の `interface` のみを定義する純粋な型ファイル。外部ライブラリ（zod 含む）への依存も禁止。`import type` の使用は許可するが、実行時依存（`import`）は禁止。

### Rule 3: workflow-validator.ts は screens を引数で受け取る

```typescript
// 正しいシグネチャ（validator.ts の validate() と対称）
export function validateWorkflows(
  workflows: Workflow[],
  screens: Screen[],
): ValidationResult

// 禁止: parser.ts を import して ParsedProject から screens を取り出す
import { parseProject } from './parser.js'; // ✗ validator は parser に依存しない
```

**理由**: 既存の `validate(screens, setups)` と `validateUnits(units)` パターンと一貫。バリデーター関数は純粋関数（入力 → 出力）として保つことでテストが容易になる。

### Rule 4: ParsedProject の workflows フィールドの方針

**決定: 必須フィールド（`workflows: Workflow[]`）として追加する**

```typescript
// parser.ts での定義
export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];
  workflows: Workflow[];  // 必須（空配列が基底値）
}
```

**オプショナル (`workflows?: Workflow[]`) を採用しない理由**:
- `workflows` が undefined になるケースを各呼び出し元（server.ts, template.ts, App.tsx）で `?? []` でフォールバックする記述が散らばる
- TypeScript コンパイラが「workflows を追加し忘れているファイル」を検出してくれるのはオプショナルでも必須でも同様（型エラーが出る）
- `config.workflows_dir` が未設定の場合は `parseProject` 内で `[]` を返すことで対応し、`ParsedProject` 型は常に `workflows: Workflow[]` を保証する

**波及検出戦略**:
`ParsedProject` を `required` で拡張するとコンパイル時に以下の箇所でエラーが出るため一括修正できる:
1. `viewer/server.ts:48` — `/api/specs` の JSON 構築オブジェクト
2. `viewer/template.ts:5` — `initialData` の JSON 構築オブジェクト
3. `viewer/components/App.tsx:31` — destructure
4. テストファイル内の `ParsedProject` を直接構築している箇所

### Rule 5: generators/workflow/ は Screen[] を参照しない

```typescript
// WorkflowGenerator のシグネチャ（generators/types.ts）
export interface WorkflowGenerator {
  generate(workflow: Workflow): string;      // Screen[] は不要
  fileNameFor(workflowId: string): string;
}

// 比較: ScreenGenerator
export interface ScreenGenerator {
  generate(screen: Screen, setups: Setup[]): string;  // setups を受け取る
  fileNameFor(screenId: string): string;
}
```

**理由**: Workflow テストは「ワークフロー全体を 1 つのテスト関数」で表現する。Screen の `route` や `title` を使ってテストコードを生成する必要はない。Workflow の `steps[].screen_id` は文字列として保持し、テストコード内にコメントとして出力するだけでよい（Screen オブジェクトの詳細情報は不要）。

もし将来 Screen の `route` を参照したい場合は `generate(workflow: Workflow, screens: Screen[])` に変更するが、現時点では YAGNI により Screen 依存を避ける。

### Rule 6: viewer/components/WorkflowDetail.tsx は parser.ts を import しない

```typescript
// 正しい
import type { Workflow, WorkflowStep, Screen } from '../../schema.js';

// 禁止
import type { ParsedProject } from '../../parser.js';  // ✗
```

**理由**: 他の Detail コンポーネント（`ScreenDetail.tsx`, `UnitDetail.tsx`）が `schema.ts` から型を import しているパターンと一貫させる。`App.tsx` が `ParsedProject` を受け取り、各 Detail コンポーネントには必要なデータだけを props として渡す。

### Rule 7: viewer/ から commands/ への依存禁止

Viewer はデータを表示するだけであり、CLI コマンドのロジックを import してはならない。

---

## 循環依存チェック

全 import パスを DAG（有向非巡回グラフ）として検証:

```
validation-types.ts  ← 依存元なし（ルートノード）
schema.ts            ← validation-types.ts は参照しない（独立ルート）
parser.ts            → schema.ts のみ
validator.ts         → schema.ts, validation-types.ts
unit-validator.ts    → schema.ts, validation-types.ts
workflow-validator.ts → schema.ts, validation-types.ts
generators/types.ts  → schema.ts
generators/**        → schema.ts, generators/types.ts
generators/registry.ts → generators/**（下位のみ）
viewer/template.ts   → parser.ts → schema.ts（上流方向に閉じる）
viewer/server.ts     → parser.ts → schema.ts
viewer/components/** → schema.ts（parser.ts への依存は App.tsx のみ）
commands/**          → parser.ts, validator.ts, generators/registry.ts, viewer/server.ts など
cli.ts               → @oclif/core のみ
```

**循環経路の探索結果: 循環依存なし**

最長経路（依存チェーン）:
```
cli.ts → commands/generate.ts → generators/registry.ts
       → generators/workflow/playwright.ts → generators/types.ts → schema.ts
```
深さ 5、全て単方向。

---

## Module Designer への連携事項

Module Designer がモジュール仕様を設計する際、以下の制約を適用してください:

1. **`validation-types.ts` のエクスポート**: `ValidationIssue` と `ValidationResult` の 2 インターフェースのみ。関数・クラス・定数はエクスポートしない。
2. **`WorkflowSchema` のフィールド設計**: `workflow` (ID)、`title`、`steps` (WorkflowStep[]) を必須とする。各 `WorkflowStep` に `screen_id: string`（Screen への参照は文字列 ID のみ）、`action: string`、`expect: string | string[]` を持たせる設計を推奨。
3. **`ConfigSchema` の `workflows_dir`**: `setups_dir` と同様に `z.string().optional()` で定義し、未設定時は `parseProject` が `workflows: []` を返す。
4. **`generators/workflow/playwright.ts` の出力形式**: 1 ワークフロー = 1 `test()` 関数（`test.describe` でなく単一テスト）。各ステップを `// Step N: screen_id — action` コメントで出力する形式を推奨。
5. **`WorkflowDetail.tsx` の Props**: `workflow: Workflow` + `onNavigate: (type: string, id: string) => void` のみ。Screen オブジェクトは渡さない（screen_id から画面に遷移するナビゲーションは ID だけで可能）。

---

## [Dependency Analyst] 整合性確認（Module Designer 設計レビュー）

Module Designer の詳細設計を依存関係の観点から検証した。**全ての依存ルールと整合している。**

### 確認済み事項

| Rule | 確認結果 |
|------|---------|
| Rule 1（単方向依存） | workflow-validator.ts は parser.ts を import しない。generators/workflow/ は validator.ts を import しない。問題なし |
| Rule 2（validation-types.ts は何も import しない） | 設計通り interface 2 つのみ。外部依存なし |
| Rule 3（validator は screens を引数で受け取る） | `validateWorkflows(workflows: Workflow[], screens: Screen[])` で確定。§4 の一覧表の `screenIds` 表記は実装シグネチャ（`Screen[]`）と異なるが、本文が正 |
| Rule 4（ParsedProject.workflows は必須） | §8 で `workflows: Workflow[]` 必須として確定 |
| Rule 5（generators/workflow は Screen[] 不要） | `generate(workflow: Workflow): string` で確定 |
| Rule 6（WorkflowDetail は parser.ts を import しない） | §7 で `schema.ts` からのみ import と明示 |

### 補足: generators/workflow/types.ts の独立ファイル化

Module Designer は `generators/workflow/types.ts` を独立ファイルとして新設する設計を採用した。独立ファイルにすることで `generators/workflow/playwright.ts` が screen/unit generator から完全に分離されるため、依存関係的により疎結合であり問題なし。

ただし `generators/types.ts` にも `WorkflowGenerator` / `WorkflowTarget` を再エクスポートする場合（§5 に記載あり）、`generators/registry.ts` の import 先を `generators/types.ts` に統一することを推奨する（import 先の分散を防ぐ）。

### 1点の懸念: generate.ts の既存テスト影響

§9 の注意に記載の通り、`shouldGenerateScreens` / `shouldGenerateUnits` の算出式が変わる。実装前に既存の generate.ts テストを確認し、テスト修正と実装を同時に行うことで GREEN を保てる。
