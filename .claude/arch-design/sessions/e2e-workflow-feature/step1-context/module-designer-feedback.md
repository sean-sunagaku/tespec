# Module Designer Feedback: E2E Workflow 機能追加

## 分析対象
- `src/core/schema.ts` - Zod スキーマ
- `src/core/parser.ts` - YAML パース・ParsedProject
- `src/core/validator.ts` - Screen バリデーション
- `src/core/unit-validator.ts` - Unit バリデーション
- `src/core/generators/types.ts` - Generator インターフェース
- `src/core/generators/registry.ts` - ジェネレータレジストリ
- `src/core/generators/screen/playwright.ts` - ScreenGenerator 実装例
- `src/core/viewer/server.ts` / `template.ts` - Viewer
- `src/commands/generate.ts` / `validate.ts` - CLI コマンド

---

## 論点 1: Workflow モジュールの凝集度と既存モジュールとの境界

### 観察
- 現在のモジュール境界は「データ種別」で明確に分かれている
  - Screen: screens/ → schema → parser → validator → generators/screen/
  - Unit: units/ → schema → parser → unit-validator → generators/unit/
  - Setup: setups/ → schema → parser（バリデータなし）

### 推奨方針
Workflow は **同じ縦割り境界** で独立させる。

```
workflows/ → WorkflowSchema → parser(拡張) → workflow-validator → generators/workflow/
```

- Screen・Unit と **参照関係** があるため（steps[].screen が既存 screen ID を参照）、バリデーション時のみ `Screen[]` を受け取る依存が発生する
- それ以外（パース・生成）は独立を維持できる

### リスク
- Workflow は Screen と **意味的に強結合**（steps が screen ID を参照）だが、コードの結合は最小化できる
- バリデーション依存は「参照チェック時に screenIds を渡す」だけで十分（Screen オブジェクト全体は不要）

---

## 論点 2: schema.ts に追加する型と既存型との関係

### 観察
`schema.ts` はすでに Screen・Setup・Unit・Config の 4 種を収容しており、ファイルは 59 行と小さい。
型の関係を見ると：
- `CaseSchema` は `ScreenSchema` から参照される（内包関係）
- `UnitCaseSchema` / `UnitMethodSchema` / `UnitSpecSchema` は Unit 系で独立
- Workflow の `WorkflowStepSchema` は screen ID（string）と action/expect（string）のみ

### 推奨方針
**schema.ts に追加する**（分割しない）。

理由：
- 全スキーマが Zod で統一管理されており、インポートの分散を防ぐことで `parser.ts` や `commands/validate.ts` の `import from './schema'` を一本化できる
- 59 行のファイルに 20〜25 行追加しても可読性は維持できる
- Workflow の型が増えるときは型の数でなく依存関係を見て判断すべき

追加する型（案）：

```typescript
export const WorkflowStepSchema = z.object({
  screen: z.string(),           // 既存 screen ID を参照
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

---

## 論点 3: WorkflowValidator は独立ファイルか validator.ts に統合か

### 観察
- `validator.ts` は Screen と Setup の参照チェック専用
- `unit-validator.ts` は Unit 専用として独立している（ValidationIssue・ValidationResult の型定義が **重複している**点が問題）
- 現在 validator.ts と unit-validator.ts は同一の `ValidationIssue` / `ValidationResult` インターフェースを別々に定義している

### 推奨方針
**独立ファイル `workflow-validator.ts` として作成する**。

理由：
- `unit-validator.ts` の前例に倣う（一貫性）
- Workflow 固有のチェック（steps が空、参照 screen が存在しない等）は Screen のチェックと性質が異なる
- `validator.ts` は Screen/Setup の参照整合性を担当しており、Workflow を追加すると関心が広がりすぎる

ただし **型の重複問題を解消する機会** としても捉えるべき：

```
src/core/validation-types.ts  ← ValidationIssue / ValidationResult を一元化
src/core/validator.ts          ← import from './validation-types.js'
src/core/unit-validator.ts     ← import from './validation-types.js'
src/core/workflow-validator.ts ← import from './validation-types.js'
```

この整理は小さいが、後でさらに型が増えたときのデグレを防ぐ。

---

## 論点 4: WorkflowGenerator の配置

### 観察
- `generators/screen/` は Screen 1 件 → テストファイル 1 件の変換
- `generators/unit/` は Unit 1 件 → テストファイル 1 件の変換
- Workflow は「複数 Screen をまたぐシナリオテスト」という性質

### 推奨方針
**`generators/workflow/` を新設して独立させる**。

理由：
- Workflow は Screen とは異なるシグネチャが必要
  ```typescript
  export interface WorkflowGenerator {
    generate(workflow: Workflow, screens: Screen[]): string;
    fileNameFor(workflowId: string): string;
  }
  ```
- `generators/screen/` に統合すると `ScreenGenerator` インターフェースを汚染する
- `registry.ts` に `WORKFLOW_REGISTRY` を追加する形で既存パターンを踏襲できる

実装対象（初期）：
- `generators/workflow/playwright.ts` - E2E シナリオテスト（最も需要が高い）

---

## 論点 5: Viewer コンポーネントの分割方針

### 観察
- `server.ts` の `/api/specs` エンドポイントは `{ project, screens, setups, units }` を返す
- `template.ts` は `window.__TESPEC_DATA__` に同構造を埋め込む
- Viewer の Preact コンポーネントは `src/core/viewer/` に配置（viewer-client はビルド成果物）

### Viewer への Workflow 追加時の影響
1. **`/api/specs` レスポンスへの `workflows` 追加** - 後方互換性あり（追加のみ）
2. **`window.__TESPEC_DATA__` の拡張** - 同上
3. **Preact コンポーネント**: 既存の Screen・Unit タブと同列に Workflow タブを追加

### 推奨方針
- `server.ts` と `template.ts` は `ParsedProject.workflows` が追加されれば **最小変更で対応可能**
- Viewer コンポーネントは Screen/Unit の表示パターンと同じ構造で実装する（タブ追加）
- コンポーネントファイルが大きければ `WorkflowPanel.tsx` として分割、小さければ既存ファイルに追記

---

## 論点 6: ParsedProject への workflow 追加の影響範囲

### 観察
`ParsedProject` は parser.ts で定義されており、以下のファイルが直接参照している：

1. `src/core/viewer/server.ts` - `currentData: ParsedProject`
2. `src/core/viewer/template.ts` - `renderHtml(project: ParsedProject)`
3. `src/commands/generate.ts` - `parsed.result` から screens/setups/units を取り出す
4. `src/commands/validate.ts` - `parsed.result.screens` / `.units`
5. `src/commands/view.ts` - おそらく ParsedProject を ServerHandle に渡す

### 影響評価

```typescript
// 現在
export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];
}

// 追加後（オプショナル推奨 or 必須）
export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];
  workflows: Workflow[];  // 追加
}
```

**`workflows: Workflow[]`（必須・空配列デフォルト）を推奨する理由**：
- オプショナルにすると全参照箇所で `?.` が増える
- `units` が `units_dir` 未設定で空配列になる前例がある（parser.ts:61）
- `workflows_dir` が config に未定義なら `[]` で初期化する同じパターンを踏襲

影響ファイル一覧：
- `src/core/parser.ts` - `ParsedProject` 拡張 + parseProject に Workflow パース追加
- `src/core/schema.ts` - `ConfigSchema` に `workflows_dir` 追加
- `src/commands/generate.ts` - workflow 生成ロジック追加（既存パターン踏襲）
- `src/commands/validate.ts` - workflow バリデーション呼び出し追加
- `src/core/viewer/server.ts` - `/api/specs` レスポンスに workflows 追加
- `src/core/viewer/template.ts` - `initialData` に workflows 追加

---

## 総合評価: 設計の一貫性スコア

| 論点 | 推奨アクション | 既存パターンとの一貫性 |
|------|--------------|-------------------|
| モジュール境界 | 縦割り独立 | 高（Screen/Unit と同パターン） |
| schema.ts | 既存ファイルに追記 | 高（全スキーマ集約の方針維持） |
| WorkflowValidator | 独立ファイル新設 | 高（unit-validator.ts の前例） |
| WorkflowGenerator | generators/workflow/ 新設 | 高（generators/unit/ の前例） |
| Viewer | タブ追加 + 最小変更 | 高（既存 UI 構造維持） |
| ParsedProject | workflows: Workflow[] を必須追加 | 高（units の空配列パターン踏襲） |

---

## 懸念点・要注意事項

1. **ValidationIssue の重複定義**: `validator.ts` と `unit-validator.ts` で同一インターフェースが重複している。Workflow 追加時に 3 重複になる前に `validation-types.ts` を作って共通化するべき。

2. **ConfigSchema の workflows_dir 追加**: 既存の config.yaml がこのフィールドを持たない場合の後方互換性確保が必要（`.optional()` または `.default('./workflows')`）。

3. **validate コマンドの --file オプション**: 現在 `ScreenSchema` / `SetupSchema` / `UnitSpecSchema` を順番に試す実装になっている（validate.ts:88-118）。Workflow ファイルも同じパターンで追加できるが、ファイルが多いと O(n) の試行になる。実用上は問題ないが認識しておく。

4. **generate コマンドの workflow フラグ**: `--screen` / `--unit` と同様に `--workflow` フラグを追加する場合、フラグの組み合わせロジックが複雑化する可能性がある（現在すでに `shouldGenerateScreens` / `shouldGenerateUnits` の判定が少し複雑）。
