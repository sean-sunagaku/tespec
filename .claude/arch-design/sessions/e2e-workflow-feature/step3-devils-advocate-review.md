# Devil's Advocate Review: Step 3 モジュール設計

採用パターン: 案1+2（ミラー縦割り + ValidationIssue 型共通化）

---

## 総評

全体的に堅実な設計。既存パターンの踏襲が徹底されており、読み手に驚きがない。
以下、5つの観点で批判的にレビューする。

---

## 1. 過剰分割チェック

### `generators/workflow/types.ts` は削除できる

**指摘**: `WorkflowGenerator` インターフェースと `WorkflowTarget` 型が **2箇所に定義されている**。

現設計では:
- `src/core/generators/workflow/types.ts`（新設）
- `src/core/generators/types.ts`（変更）

の両方に同じ定義が書かれている（設計ドキュメント 5節より）。

既存パターンを確認すると:
- Screen 用は `generators/screen/playwright.ts` / `xctest.ts` が直接 `generators/types.ts` の `ScreenGenerator` を import している
- Screen 専用の `generators/screen/types.ts` は **存在しない**

Workflow だけ専用 `types.ts` を持つ理由がない。`generators/workflow/types.ts` を削除し、`generators/types.ts` に一元化すれば1ファイル減らせる。

**推奨**: `generators/workflow/types.ts` を削除。`WorkflowGenerator` / `WorkflowTarget` は `generators/types.ts` のみに定義し、`workflow/playwright.ts` が直接 import する。

**削減効果**: 新設ファイルが 5 本→4 本になる。

---

## 2. WorkflowGenerator インターフェースの必要性

**指摘**: `WorkflowTarget = 'playwright'` が現状1種類しか存在しないため、`WorkflowGenerator` インターフェース + registry パターンは YAGNI の疑いがある。

ただし、以下の理由から **現設計を受け入れる**：

- 既存の `ScreenGenerator` / `UnitGenerator` も同じパターンを踏襲しており、コードベースの一貫性がある
- registry への登録コストは `registry.ts` に15行追加するだけで低い
- 将来 XCTest 対応が来た場合（Screen/Unit で実績あり）、インターフェースがないと registry に登録できない

**ただし1点注意**: `WorkflowTarget = 'playwright'` という型エイリアスが `generators/types.ts` と `generators/workflow/types.ts` の2箇所に書かれている問題（前項と同じ重複）は修正が必要。

**判定**: インターフェース自体は妥当。重複定義の問題を解消すれば問題なし。

---

## 3. `validation-types.ts` の必要性再確認

**指摘**: 現状 `ValidationIssue` / `ValidationResult` は `validator.ts` と `unit-validator.ts` の2箇所に定義されている。Workflow 追加で `workflow-validator.ts` が3箇所目になる。これで共通化するコストに見合うか？

**判定: 見合う。今がタイミングとして適切。**

根拠:
1. **変更コストは最小**: `validator.ts` / `unit-validator.ts` から interface 定義10行を削除し、import 1行を追加するだけ。ロジック変更ゼロ。既存テストは GREEN のまま。
2. **3箇所になった時点での共通化は遅すぎない**: Rule of Three（3つ以上で抽象化する）に合致している
3. **将来の変更耐性**: `ValidationIssue` に `column` フィールドや `code` フィールドを追加する際の変更箇所が1箇所になる

**ただし注意点が1つ**: `validation-types.ts` の内容が `ValidationIssue` / `ValidationResult` の2インターフェースのみ（10行程度）であることを守る。関数や定数を追加しない。ファイル名通り「型定義のみ」を徹底すること。型定義以外が混入すると「validators の共通基盤」に肥大化するリスクがある。

---

## 4. Viewer の複雑化チェック

### `WorkflowDetail.tsx` は最小限で合格

表示レイアウトは番号付きステップリスト（カード形式）のみ。フロー図（矢印グラフ）は含まれていない。Step 1 で指摘した最大の複雑化リスクが回避されている点を評価する。

### `onNavigate` の型が緩すぎる

**指摘**: `onNavigate: (type: string, id: string) => void` の第1引数が `string` のまま。

現在の `App.tsx` 設計では `View.type` が `'dashboard' | 'screen' | 'unit' | 'setup' | 'workflow'` というリテラル型で管理されている。`onNavigate` の `type` 引数も同じリテラル型を使うべきであり、`string` のままだと `onNavigate('screeen', id)` のような typo をコンパイル時に検出できない。

**推奨**:
```typescript
type ViewType = 'dashboard' | 'screen' | 'unit' | 'setup' | 'workflow';
interface WorkflowDetailProps {
  workflow: Workflow;
  onNavigate: (type: ViewType, id: string) => void;
}
```

これは1行の型定義変更で済む。既存 `ScreenDetail.tsx` の `onNavigate` 定義も同様に修正すれば一貫性が保てる。

### `step.screen` クリックで ScreenDetail へ遷移する機能

**指摘**: `step.screen` バッジクリックで `onNavigate('screen', step.screen)` を呼ぶ機能は有用だが、対象 screen が存在しない場合（バリデーションエラーがあるプロジェクト）に UI がどう振る舞うかが設計に明記されていない。

`App.tsx` 側の実装では `workflows.find(...)` が `undefined` を返した場合は `null` をレンダリングしているが、Screen 側の同様の guard が必要。これは実装時の注意事項として記録すれば十分（設計変更は不要）。

---

## 5. テスト負荷の妥当性

### 新規テストファイルの数

設計ドキュメントには明示的なテストファイル一覧がないため、追加されるテストファイルを推定する:

| テストファイル（推定） | 対象 | 妥当性 |
|----------------------|------|-------|
| `__test__/schema.test.ts`（既存拡張） | WorkflowSchema / WorkflowStepSchema | 既存ファイルへの追記で済む |
| `__test__/parser.test.ts`（既存拡張） | workflows パース | 既存ファイルへの追記 |
| `__test__/workflow-validator.test.ts`（新設） | validateWorkflows | 必須 |
| `__test__/generator-workflow-playwright.test.ts`（新設） | generateWorkflowTestFile | 必須 |
| `__test__/validator.test.ts`（既存 GREEN 確認） | 変更なしのはず | import 変更後の確認 |

**評価**: 新設テストファイルは2本（workflow-validator + generator-workflow-playwright）。既存テストへの追記が中心。これは許容範囲。

### `generate.ts` の排他制御ロジック変更によるテスト追加

**指摘**: `shouldGenerateScreens` / `shouldGenerateUnits` のロジックが `anySpecified` ベースに変わるため、**既存テストが壊れる可能性がある**。設計ドキュメントにも「既存テストで挙動確認が必要」と注記されている。

現行の generate.ts ロジック（`src/commands/generate.ts:103-106`）:
```typescript
const shouldGenerateScreens =
  typeof flags.unit === 'undefined' || typeof flags.screen !== 'undefined';
const shouldGenerateUnits =
  typeof flags.screen === 'undefined' || typeof flags.unit !== 'undefined';
```

新ロジック:
```typescript
const anySpecified = hasScreenFlag || hasUnitFlag || hasWorkflowFlag;
const shouldGenerateScreens = !anySpecified || hasScreenFlag;
const shouldGenerateUnits   = !anySpecified || hasUnitFlag;
```

フラグ組み合わせが増えるため、**既存の generate コマンドテストが想定外の組み合わせをカバーしていない可能性がある**。実装前に既存テストのカバレッジを確認し、不足しているフラグ組み合わせのテストを追加することを強く推奨する。

---

## 総括

| 観点 | 評価 | アクション |
|------|------|-----------|
| 過剰分割 | 軽微な問題あり | `generators/workflow/types.ts` を削除し `generators/types.ts` に一元化 |
| WorkflowGenerator インターフェース | 妥当 | 重複定義の解消のみ |
| validation-types.ts | 妥当・タイミング適切 | ファイル内容を型定義のみに限定すること |
| Viewer の複雑化 | 合格（フロー図なし）| `onNavigate` の型を `ViewType` リテラルに強化 |
| テスト負荷 | 許容範囲 | generate.ts のフラグ排他制御テストを事前に補完 |

**最重要アクション**: `generators/workflow/types.ts` の削除と `onNavigate` 型強化。どちらも小さな変更で大きな品質向上になる。
