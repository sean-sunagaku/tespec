# Step 4: 最終設計成果物 — E2E Workflow 機能

設計完了日: 2026-03-27  
採用パターン: **案1+2（ミラー縦割り + ValidationIssue 型共通化）**  
全エージェント承認済み（Architecture Lead / Module Designer / Dependency Analyst / Platform Expert / Devil's Advocate）

---

## 実装チェックリスト（順序どおりに実施）

### Wave 1: 型基盤

- [ ] `src/core/validation-types.ts` 新設（`ValidationIssue` / `ValidationResult` のみ）
- [ ] `src/core/validator.ts` — ローカル interface 定義を削除し `validation-types.ts` から import
- [ ] `src/core/unit-validator.ts` — 同上
- [ ] 既存テスト全 GREEN 確認（`pnpm test`）

### Wave 2: スキーマ + パーサー

- [ ] `src/core/schema.ts` に追加:
  - `WorkflowStepSchema` / `WorkflowSchema`
  - `WorkflowStep` / `Workflow` 型エクスポート
  - `ConfigSchema` に `workflows_dir: z.string().optional()`
- [ ] `src/core/parser.ts` に追加:
  - `ParsedProject.workflows: Workflow[]`（必須フィールド）
  - `parseProject` に `workflowsDir` 解決 + `parseYamlDirectory(workflowsDir, WorkflowSchema)` 追加
- [ ] TypeScript コンパイルエラーで波及箇所を一括把握・修正

### Wave 3: バリデーター

- [ ] `src/core/workflow-validator.ts` 新設:
  - `validateWorkflows(workflows: Workflow[], screens: Screen[]): ValidationResult`
  - `checkDuplicateWorkflowIds`（error）
  - `checkScreenReferences`（error）
  - `checkEmptySteps`（warning）
- [ ] `tests/workflow-validator.test.ts` 新設してテスト作成

### Wave 4: ジェネレーター

- [ ] `src/core/generators/types.ts` に追加:
  - `WorkflowTarget = 'playwright'`
  - `WorkflowGenerator` インターフェース（`generate(workflow: Workflow): string`）
  - import に `Workflow` 追加
- [ ] `src/core/generators/workflow/` ディレクトリ新設
- [ ] `src/core/generators/workflow/playwright.ts` 新設（Screen[] 不要）
- [ ] `src/core/generators/registry.ts` に `WORKFLOW_REGISTRY` / `getWorkflowGenerator` / `isWorkflowTarget` / `WORKFLOW_TARGETS` 追加
- [ ] `tests/generator-workflow-playwright.test.ts` 新設してテスト作成

### Wave 5: CLI コマンド

- [ ] `src/commands/validate.ts`:
  - `WorkflowSchema` の import 追加
  - `validateWorkflows` 呼び出し追加
  - `--file` 単体バリデーションに `WorkflowSchema` 試行追加
  - `selectSingleFileErrors` に `/workflows/` パス判定追加
  - `printOk` ループに workflow ファイル追加
- [ ] `src/commands/generate.ts`:
  - `--workflow` / `--workflow-target` フラグ追加
  - 排他制御を `anySpecified` ベースに変更
  - **注意**: 既存の `shouldGenerateScreens` / `shouldGenerateUnits` 挙動テストを事前確認
  - workflow 生成ループ追加
- [ ] `src/commands/view.ts`:
  - `workflows_dir` の watch 対象追加
- [ ] `pnpm test` で既存テスト GREEN 確認
- [ ] `pnpm lint`（Biome）確認

### Wave 6: Viewer

- [ ] `src/core/viewer/server.ts` — `/api/specs` に `workflows: currentData.workflows` 追加
- [ ] `src/core/viewer/template.ts` — `initialData` に `workflows: project.workflows` 追加
- [ ] `src/core/viewer/components/WorkflowDetail.tsx` 新設:
  - Props: `{ workflow: Workflow; onNavigate: (type: ViewType, id: string) => void }`
  - ステップカードを縦に並べる
  - `step.screen` バッジクリック → `onNavigate('screen', step.screen)`
- [ ] `src/core/viewer/components/App.tsx`:
  - `View` 型に `{ type: 'workflow'; id: string }` 追加
  - `ViewType` リテラル型を定義し `onNavigate` の型に使用（Devil's Advocate 指摘）
  - `const { screens, units, setups, workflows } = data`
  - `isEmpty` 判定に `workflows.length === 0` 追加
  - サイドバーに Workflows セクション追加
  - `main` に WorkflowDetail レンダリング追加
- [ ] Preact バンドル再ビルド（`pnpm build`）
- [ ] `pnpm lint` 確認

---

## 確定スキーマ（YAML 書式）

```yaml
workflow: user_registration          # 必須: Workflow ID
title: "新規ユーザー登録フロー"       # 必須: 表示用タイトル
steps:                               # 必須: 最低 1 ステップ
  - screen: login                    # 必須: 既存 screen ID
    action: "新規登録リンクをタップ"   # 任意: 操作内容
  - screen: signup
    action: "必要事項を入力して登録"
  - screen: home
    expect: "ようこそメッセージが表示される"  # 任意: 期待する状態
```

---

## 確定ファイル一覧

### 新設（4本）

```
src/core/validation-types.ts
src/core/workflow-validator.ts
src/core/generators/workflow/playwright.ts
src/core/viewer/components/WorkflowDetail.tsx
```

### 変更（10本）

```
src/core/schema.ts                          +25行
src/core/parser.ts                          +15行
src/core/validator.ts                       import 変更のみ
src/core/unit-validator.ts                  import 変更のみ
src/core/generators/types.ts                +10行
src/core/generators/registry.ts             +15行
src/commands/validate.ts                    +20行
src/commands/generate.ts                    +30行
src/commands/view.ts                        +4行
src/core/viewer/server.ts                   +1行
src/core/viewer/template.ts                 +1行
src/core/viewer/components/App.tsx          +20行
```

---

## 主要インターフェース（コピペ用）

```typescript
// validation-types.ts
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

// schema.ts 追加分
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

// generators/types.ts 追加分
export type WorkflowTarget = 'playwright';
export interface WorkflowGenerator {
  generate(workflow: Workflow): string;
  fileNameFor(workflowId: string): string;
}

// workflow-validator.ts
export function validateWorkflows(
  workflows: Workflow[],
  screens: Screen[],
): ValidationResult

// WorkflowDetail.tsx (Props)
type ViewType = 'dashboard' | 'screen' | 'unit' | 'setup' | 'workflow';
interface WorkflowDetailProps {
  workflow: Workflow;
  onNavigate: (type: ViewType, id: string) => void;
}
```

---

## 生成テストコード例

入力:
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

出力 (`user_registration.spec.ts`):
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

---

## 設計上の重要決定事項（変えない）

| 決定 | 根拠 |
|------|------|
| `WorkflowGenerator.generate(workflow)` — Screen[] 不要 | テストコードに screen ID をコメントとして出力するだけで十分。Screen オブジェクトへの依存を避ける |
| `ParsedProject.workflows: Workflow[]` — 必須フィールド | `undefined` を許容すると全参照箇所で `?.` が必要になる。`units` と同パターン |
| `workflows_dir: z.string().optional()` — `.default()` なし | 既存 config.yaml が壊れない後方互換性 |
| `generators/workflow/types.ts` は作らない | `generators/types.ts` 1 箇所に集約。Screen の前例と対称 |
| Phase 1 でコンポーネントテストなし | `vitest.config.ts` を変更するリスクを避ける。純粋関数テストで十分 |

---

## 実装時の注意事項

1. **generate.ts 排他制御の変更**: 既存の `shouldGenerateScreens` / `shouldGenerateUnits` ロジックが `anySpecified` ベースに変わる。実装前に既存の generate テストのフラグ組み合わせカバレッジを確認すること（Devil's Advocate 指摘）
2. **Biome lint**: `App.tsx` / `WorkflowDetail.tsx` は lint 対象。実装後に `pnpm lint` を必ず実行
3. **validation-types.ts の純粋性**: 型定義 2 つのみを保つ。関数・定数・実行時コードを追加しない
4. **onNavigate の型強化**: `App.tsx` に `ViewType` リテラル型を定義し、全 Detail コンポーネントの `onNavigate` 型に使用する（Devil's Advocate 指摘）
