# Module Designer: 10案評価フィードバック

## 評価軸（モジュール設計の観点）

1. **凝集度** - 各ファイル・モジュールの責務が明確か
2. **結合度** - 既存モジュールとの不要な依存が生まれないか
3. **型安全性** - TypeScript の型システムを正しく使えるか
4. **変更コスト** - 既存ファイルへの変更量と影響範囲
5. **保守性** - 新規参入者が構造を把握しやすいか

---

## 各案の評価

### 案1: 完全ミラー縦割り ★★★★☆

**評価**: 推奨（ベースライン）

- 凝集度: 高。各ファイルが単一責務を維持できる
- 結合度: 低。`workflow-validator.ts` が `screenIds: Set<string>` のみを受け取れば Screen への依存は最小
- 変更コスト: `ParsedProject` + コマンド 2 ファイル + Viewer 2 ファイルの計 5 ファイル変更
- 懸念: `ValidationIssue` の 3 重複定義。案2 との組み合わせで解消すべき

### 案2: 共通バリデーター基盤抽出 ★★★★★

**評価**: 案1 の必須補完。単体では不十分だが案1 と組み合わせると最良

- `validation-types.ts` の追加コストは小さく、メリットが大きい
- 「独立コピー慣習を破る」デメリットが挙げられているが、これはリファクタリングではなく正当な修正
- 既存 2 ファイルへの変更は import 1 行の追加のみ（ロジック変更なし）

**推奨**: 案1 + 案2 を組み合わせた「案1+2 ハイブリッド」が最も堅牢

### 案3: SpecType レジストリ（プラグイン型） ★★☆☆☆

**評価**: 時期尚早

- 現在 spec タイプは screen / unit / workflow の 3 種類。第 4 タイプの予定が具体的にないなら YAGNI
- TypeScript のジェネリクスが複雑化するリスクが高い
- 既存 screen / unit の大規模リファクタリングが必要で、spec タイプごとにテストを書き直す必要がある
- **もし将来必要になったとき**: 案1+2 から案3 への移行は可能。逆は難しい

### 案4: Workflow-as-Screen 拡張 ★☆☆☆☆

**評価**: 採用不可

- `ScreenSchema` に `route` (required) があるが、Workflow には route が存在しない
- `cases` フィールドが Workflow には無意味
- 型汚染が最も深刻。`if (screen.type === 'workflow')` の分岐が全コードに波及する
- 「スキーマの意味論の破綻」は保守コストを指数的に増やす

### 案5: 水平レイヤー追記（最小変更） ★★☆☆☆

**評価**: 短期的には低コストだが技術的負債を積み上げる

- `validator.ts` に Screen と Workflow のロジックが混在すると、単体テストが困難になる
- `schema.ts` の肥大化は将来の分割リファクタリングコストを高める
- 「差分が局所的に見える」が実際には分散している点が最も危険

### 案6: Workflow サブドメインモジュール ★★★☆☆

**評価**: 将来性はあるが現時点では過剰

- `src/core/workflow/` の自己完結性は理想的だが、ネストの深さ（`src/core/workflow/generators/playwright.ts`）が読みにくい
- 既存 screen / unit との非対称性が生まれる（既存コードのリファクタリングなしには統一感がない）
- **適切な判断ポイント**: workflow 関連ファイルが 5〜7 本を超えたら案6 に移行する価値が出る

### 案7: Composite Spec（統合スキーマ） ★★☆☆☆

**評価**: 技術的に興味深いが実装コストが過大

- 既存スキーマの `z.literal()` 対応変更が必要。YAML の `screen: login` という書き方が `type: screen` に変わる可能性がある
- 既存 YAML ファイルの書き換えはユーザー影響大
- `discriminatedUnion` のエラーメッセージ品質が低い問題は、ユーザー体験を損なう

### 案8: Workflow → Screen 変換パイプライン ★★☆☆☆

**評価**: アイデアとしては興味深いが意味論のミスマッチが致命的

- Workflow テスト = 「ユーザー登録フロー全体を 1 テスト関数として実行する」
- Screen テスト = 「ログイン画面の各ケースを独立して検証する」
- この 2 つは根本的に異なる。`Workflow → Screen[]` 変換はユーザーが期待する生成物を作れない
- エラーメッセージの逆転（`workflow.yaml` を書いたのに `screens/login.yaml` のエラーが出る）はデバッグ体験を壊す

### 案9: ParsedProject の汎用 SpecCollection 化 ★☆☆☆☆

**評価**: 採用不可（現時点では明確にオーバーエンジニアリング）

- `Map<SpecType, unknown[]>` では TypeScript の型推論が効かなくなる
- `parsed.result.screens` → `parsed.result.specs.get('screen') as Screen[]` の変換は可読性の著しい低下
- 案3（レジストリ型）と組み合わせてもその複雑性が 2 乗になるだけ

### 案10: Workflow-only CLI コマンド分離 ★★★☆☆

**評価**: ユーザー体験の視点では問題あり。内部実装への活用なら価値あり

- `tespec validate` + `tespec workflow validate` の 2 系統は混乱を招く
- `tespec view` での統合表示が困難になる（`ParsedProject` に `workflows` が入らないため）
- ただし「段階的リリース」としての価値は認める。`workflows` を `ParsedProject` に追加しつつ、generate コマンドの `--workflow` フラグを将来追加する形でも対応可能

---

## 推奨案: 案1 + 案2 ハイブリッド

### 採用理由

1. **既存パターンとの一貫性**: Screen/Unit が辿ったパスを踏襲するため、コードベース全体の読みやすさが維持される
2. **変更コストの予測可能性**: 新ファイルが主体で既存ファイルの変更が局所的
3. **型安全性の向上**: `validation-types.ts` による共通化で `ValidationIssue` の分岐同期漏れを防ぐ
4. **YAGNI 準拠**: 現時点で必要な拡張性のみを実装する

### 実装ファイル一覧

**新設ファイル（4本）**:
```
src/core/validation-types.ts        ← ValidationIssue / ValidationResult
src/core/workflow-validator.ts      ← validateWorkflows()
src/core/generators/workflow/playwright.ts ← WorkflowGenerator 実装
src/core/generators/workflow/types.ts      ← WorkflowGenerator インターフェース
```

**変更ファイル（6本）**:
```
src/core/schema.ts                  ← WorkflowStepSchema / WorkflowSchema / 型追加
                                    ← ConfigSchema に workflows_dir 追加
src/core/parser.ts                  ← ParsedProject に workflows: Workflow[] 追加
                                    ← parseProject に workflow パース追加
src/core/validator.ts               ← import ValidationIssue from './validation-types.js'
src/core/unit-validator.ts          ← import ValidationIssue from './validation-types.js'
src/core/generators/registry.ts    ← WORKFLOW_REGISTRY 追加
src/commands/validate.ts            ← validateWorkflows 呼び出し追加
src/commands/generate.ts            ← --workflow フラグ + 分岐追加
src/core/viewer/server.ts           ← /api/specs に workflows 追加
src/core/viewer/template.ts         ← initialData に workflows 追加
```

合計: 新設 4 本 + 変更 10 本（viewer/template 含む）

---

## 将来の移行パス

案1+2 から将来的に移行できる方向：

- **spec タイプが 5 以上になった場合** → 案3（SpecType レジストリ）へ段階的移行
- **workflow ファイルが 5 本超になった場合** → 案6（サブドメインモジュール）に一部移行
- **今はやらない**: 案4 / 案7 / 案8 / 案9（意味論的ミスマッチまたはオーバーエンジニアリング）

---

## 重要な設計上の注意事項

### `workflow-validator.ts` の Screen 参照依存

```typescript
// 推奨シグネチャ
export function validateWorkflows(
  workflows: Workflow[],
  screenIds: Set<string>,  // Screen[] ではなく Set<string> のみ渡す
): ValidationResult
```

`screenIds` だけ渡せば Screen への依存を最小化できる。`validator.ts` と `workflow-validator.ts` を `validate` コマンドが呼ぶ時も各 validator は独立して呼び出せる。

### `ConfigSchema` の後方互換性

```typescript
workflows_dir: z.string().optional()  // default は指定しない
```

`default('./workflows')` にすると、workflows ディレクトリが存在しない既存プロジェクトでエラーになる。`units_dir` と同様に optional で、未指定なら空配列を返すパターンが安全。
