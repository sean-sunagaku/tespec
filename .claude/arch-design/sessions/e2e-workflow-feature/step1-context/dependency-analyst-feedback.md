# Dependency Analyst フィードバック
## E2E Workflow 機能追加の依存関係分析

---

## 1. 現状の import グラフ（実コード確認済み）

```
zod（外部）
  ↑
schema.ts
  ├─ parser.ts          （Config, Screen, Setup, UnitSpec を import）
  │    └─ ParsedProject  （screens, setups, units を持つ）
  ├─ validator.ts        （Screen, Setup を import）
  ├─ unit-validator.ts   （UnitSpec を import）
  ├─ generators/types.ts （Screen, Setup, UnitSpec を import）
  │    └─ generators/screen/playwright.ts
  │    └─ generators/screen/vitest.ts
  │    └─ generators/screen/xctest.ts
  │    └─ generators/unit/vitest.ts
  │    └─ generators/unit/xctest.ts
  │    └─ generators/registry.ts（全 generator を集約）
  └─ viewer/components/*.tsx（Screen, Setup を直接 import）
       └─ viewer/server.ts   （ParsedProject を import）
       └─ viewer/template.ts （ParsedProject を import）

commands/validate.ts → parser, schema, validator, unit-validator
commands/generate.ts → parser, validator, unit-validator, generators/registry
commands/view.ts     → parser, viewer/server, viewer/watcher
cli.ts              → @oclif/core（コマンドをプラグイン経由で登録）
```

---

## 2. Workflow 追加による依存方向の変化

### 追加コンポーネントと依存方向

| 追加コンポーネント | 依存先 | 方向 |
|---|---|---|
| `WorkflowSchema` in schema.ts | zod（既存） | 変化なし |
| `workflows` in `ParsedProject` | schema.ts | 変化なし（既存構造に追加） |
| `workflow-validator.ts` | schema.ts（Workflow, Screen） | **新規依存** |
| `generators/workflow/` | schema.ts（Workflow） | **新規依存** |
| `viewer/components/WorkflowDetail.tsx` | schema.ts（Workflow, Screen） | **新規依存** |
| `commands/validate.ts` | workflow-validator | 新規 import |
| `commands/generate.ts` | generators/workflow/registry | 新規 import |

**依存方向は全て既存の単方向（下位モジュール → schema.ts）を維持する。逆流なし。**

---

## 3. 循環依存のリスク評価

### Workflow → Screen 参照の構造

`WorkflowSchema` が `screen_id` フィールドで Screen を参照するケースを想定。

- **schema.ts レベル**：`WorkflowSchema` に `screen_id: z.string()` を持つだけ。Screen オブジェクトを直接 import しない。循環なし。
- **workflow-validator.ts レベル**：`validateWorkflows(workflows, screens)` のように引数で受け取るパターン。既存の `validator.ts` が `validate(screens, setups)` で setups を受け取るのと同じ設計。循環依存は発生しない。
- **viewer/WorkflowDetail.tsx レベル**：`Workflow` と `Screen` 両方を schema.ts から import。schema.ts は単一依存先なので循環なし。

**循環依存リスク：なし**

---

## 4. ParsedProject 拡張の波及範囲

`ParsedProject`（`parser.ts:17-22`）に `workflows: Workflow[]` を追加すると、以下が影響を受ける：

### 直接影響（型変更のコンパイルエラーが出る箇所）

1. **`viewer/server.ts:47-53`** — `/api/specs` エンドポイントで `currentData.workflows` を JSON に含める必要がある
2. **`viewer/template.ts:4-9`** — `renderHtml` 内の `initialData` オブジェクトに `workflows` を追加する必要がある
3. **`viewer/components/App.tsx:31`** — `const { screens, units, setups } = data;` に `workflows` を追加
4. **`commands/view.ts:43-48`** — `directories` に `workflows_dir` を追加する必要がある（`config` 側も拡張）
5. **`commands/validate.ts:49-51`** — `validateWorkflows` 呼び出しを追加
6. **`commands/generate.ts:84-85`** — `workflow-generator` 呼び出しを追加

### 間接影響（型推論で自動対応されるが確認要）

- テストファイル群 (`__test__/`) — `ParsedProject` を直接構築しているテストは修正が必要

### 波及規模の評価

`ParsedProject` は型インターフェースなので TypeScript がコンパイル時に全箇所を検出できる。**`workflows` をオプショナルフィールド（`workflows?: Workflow[]`）として追加すれば既存コードへの破壊的変更を最小化できる。**

---

## 5. workflow-validator が screens データに依存する構造

既存パターン（`validator.ts:15`）：
```typescript
export function validate(screens: Screen[], setups: Setup[]): ValidationResult
```

`workflow-validator.ts` の推奨インターフェース：
```typescript
export function validateWorkflows(workflows: Workflow[], screens: Screen[]): ValidationResult
```

**なぜ screens を引数で渡すか：**
- `workflow-validator.ts` は `validator.ts` と同様に、`parser.ts` の `ParsedProject` に直接依存させない
- 関数シグネチャが依存データを明示することで、テストが容易になる（モックの必要なし）
- `commands/validate.ts` と `commands/generate.ts` が `parsed.result.screens` と `parsed.result.workflows` を渡すだけでよい

**注意点：** `validator.ts` が既に `ValidationIssue` と `ValidationResult` インターフェースを定義しており、`unit-validator.ts` も同じ型を重複定義している（`validator.ts:3-13` と `unit-validator.ts:3-13` が同一）。`workflow-validator.ts` に3度目の重複を作るより、共通型を `schema.ts` または専用の `validation-types.ts` に抽出することを推奨する。

---

## 6. 結合度の評価

### Workflow と Screen の結合は適切か

**結合の種類：データ結合（疎）**

- Workflow は Screen の `screen_id` (文字列 ID) だけを保持する
- Screen オブジェクト全体への参照ではない
- `validator.ts:17` の `navigates_to` 参照（screen ID を文字列で保持）と同じパターン

**判定：適切。** ID による間接参照は既存の設計パターン（`navigates_to`, `given`, `use:` 参照）と一貫している。

### generators/workflow/ の結合度

- Screen generator が `ScreenGenerator.generate(screen, setups)` を受け取るように、Workflow generator は `WorkflowGenerator.generate(workflow, screens)` を受け取る設計が自然
- `generators/types.ts` に `WorkflowGenerator` インターフェースを追加し、`registry.ts` に `WorkflowRegistry` を追加する

---

## 7. リスクサマリーと推奨事項

| リスク | 深刻度 | 推奨対応 |
|---|---|---|
| `ValidationIssue`/`ValidationResult` の型重複 | 中 | 共通 `validation-types.ts` へ抽出（Workflow 追加のタイミングで解消） |
| `ParsedProject` 拡張の波及（6箇所） | 低 | `workflows?: Workflow[]` でオプショナル追加、TS コンパイラが全箇所を検出 |
| `ConfigSchema` の `workflows_dir` 追加漏れ | 低 | `config.ts` 側と `view.ts` の directory watch を同時更新するチェックリスト化 |
| `viewer/template.ts` の `initialData` 更新漏れ | 低 | SSE 経由のデータ送信（`server.ts:47-53`）と template の `initialData` をセットで更新するルール |
| 循環依存 | なし | — |

---

## 8. 依存グラフ（Workflow 追加後）

```
schema.ts（WorkflowSchema 追加）
  ├─ parser.ts（ParsedProject に workflows?: Workflow[] 追加）
  ├─ validator.ts
  ├─ unit-validator.ts
  ├─ workflow-validator.ts  ← NEW（Screen を引数で受け取る）
  ├─ generators/types.ts（WorkflowGenerator 追加）
  │    └─ generators/workflow/playwright.ts  ← NEW
  │    └─ generators/registry.ts（WorkflowRegistry 追加）
  └─ viewer/components/WorkflowDetail.tsx  ← NEW（Screen を schema.ts から import）
       └─ viewer/components/App.tsx（workflows を destructure）
       └─ viewer/server.ts（workflows を API レスポンスに含める）
       └─ viewer/template.ts（workflows を initialData に含める）

commands/validate.ts → workflow-validator  ← NEW import
commands/generate.ts → generators/registry（workflow generator）  ← 既存 registry に追加
commands/view.ts → （workflows_dir の watch 追加）
```

依存の方向はすべて `schema.ts` に向かう単方向を維持しており、アーキテクチャの整合性は保たれる。
