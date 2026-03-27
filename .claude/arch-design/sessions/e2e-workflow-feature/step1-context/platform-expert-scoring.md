# Platform Expert スコアリング — スタック適合性 × 学習コスト

## 評価軸の定義

- **スタック適合性（1-5）**: TypeScript/oclif/Zod/Hono/Preact/Vitest との相性の高さ。既存パターンを自然に踏襲できるか、スタックの制約と衝突しないか。
- **学習コスト（1-5）**: パターン習得・保守の容易さ。1 = 習得コスト高い / 保守難 、5 = 習得コスト低い / 保守容易。

---

## スコアリング表

| # | パターン名 | スタック適合性 | 学習コスト | 合計 | 短評 |
|---|-----------|:-----------:|:--------:|:----:|------|
| 1 | 完全ミラー縦割り | 5 | 5 | 10 | 既存の screen/unit を完全に踏襲。Zod/oclif/Vitest すべて慣習どおり |
| 2 | 共通バリデーター基盤抽出 | 5 | 4 | 9 | 案1 + 型共通化。リファクタリング範囲がわずかに増えるが恩恵は明確 |
| 3 | SpecType レジストリ（プラグイン型） | 2 | 2 | 4 | TypeScript ジェネリクスが複雑化。既存コードの大改造が必要 |
| 4 | Workflow-as-Screen 拡張 | 2 | 3 | 5 | ScreenSchema が汚染される。Zod スキーマの意味論が崩れる |
| 5 | 水平レイヤー追記（最小変更） | 3 | 4 | 7 | ファイル増加は抑えられるが既存ファイルの肥大化で保守性が下がる |
| 6 | Workflow サブドメインモジュール | 4 | 3 | 7 | ドメイン境界は明確だが、既存 screen/unit との非対称性が残る |
| 7 | Composite Spec（統合スキーマ） | 2 | 2 | 4 | Zod discriminatedUnion のためスキーマ改造が大規模。既存 YAML 破壊の恐れ |
| 8 | Workflow → Screen 変換パイプライン | 2 | 2 | 4 | Workflow と Screen の意味論が根本的に違う。変換で情報損失が発生 |
| 9 | ParsedProject の汎用 SpecCollection 化 | 1 | 1 | 2 | TypeScript 型安全維持が極めて困難。明らかなオーバーエンジニアリング |
| 10 | Workflow-only CLI コマンド分離 | 3 | 3 | 6 | oclif サブコマンドは対応可能だが、UX 分断と viewer 統合の問題が残る |

---

## 各案の詳細評価根拠

### 案1: 完全ミラー縦割り ★ スタック適合性 5 / 学習コスト 5

**スタック適合性 5**
- `WorkflowSchema` = `z.object` + `z.enum` + `z.union` の組み合わせ。既存 CaseSchema と完全に同じ Zod パターン
- `workflow-validator.ts` = `unit-validator.ts` と同一構造。既存の ValidationIssue 型をコピー
- `generators/workflow/playwright.ts` = `generators/screen/playwright.ts` と同一インターフェース
- oclif フラグ追加は `Flags.string` のみ。`generate.ts` の `shouldGenerateScreens / shouldGenerateUnits` パターンをそのまま踏襲
- tsup.config.ts 変更不要。`WorkflowDetail.tsx` を `client-entry.tsx` から import するだけ
- `ConfigSchema` への `workflows_dir: z.string().optional()` 追加は `units_dir` と完全に同一

**学習コスト 5**
- 「screen を unit に読み替えたのと同じ手順」で全作業が完結する
- 既存コードを読めば実装方法が自明
- テストパターンも fixture + inline snapshot で既存と同一

---

### 案2: 共通バリデーター基盤抽出 ★ スタック適合性 5 / 学習コスト 4

**スタック適合性 5**
- 案1 と同じ適合性。`validation-types.ts` の追加は TypeScript の `interface` export のみで、スタックに何も新しい依存を加えない
- Zod/oclif/Hono/Preact すべて案1 と同一

**学習コスト 4**（案1 より -1）
- 既存 `validator.ts` / `unit-validator.ts` を `validation-types.ts` を import するように変更する必要がある
- このリファクタリング自体は小さいが、既存テストが壊れないことの確認コストが発生する
- 将来の保守コストは案1 より低くなるが、初期変更量はわずかに多い

---

### 案3: SpecType レジストリ（プラグイン型） ★ スタック適合性 2 / 学習コスト 2

**スタック適合性 2**
- レジストリ型は TypeScript の `interface SpecTypeEntry<TSchema, TValidationResult, TGenerator>` のような複雑なジェネリクスが必要
- Zod 4 の `ZodType<T>` を generics で渡す場合、`ZodType<unknown>` への型ロストが起きやすい
- oclif の `options` 推論も registry ドリブンに変更すると型安全が失われる
- Vitest でレジストリのモックが複雑になる

**学習コスト 2**
- レジストリパターンは既存コードに一切存在しない新概念
- 新規参画者が全体を把握するのに時間がかかる
- 既存 screen/unit の大規模リファクタリングが必要で、デグレリスクが高い

---

### 案4: Workflow-as-Screen 拡張 ★ スタック適合性 2 / 学習コスト 3

**スタック適合性 2**
- `ScreenSchema` に `type?: 'screen' | 'workflow'` を追加すると、`screen.route` が workflow では無意味なフィールドになる
- Zod で `route` を `optional` にすると既存テストの `z.string()` 前提が崩れる
- `z.discriminatedUnion` を使うなら `ScreenSchema` の大改造が必要
- `cases` フィールドが workflow には意味論的に合わない

**学習コスト 3**
- ファイル数は増えないため一見シンプルに見える
- しかし「Screen なのか Workflow なのか」の暗黙的な型ガードが至る所に現れ、保守コストが高い
- 新機能追加時に「これは screen として扱うべきか workflow として扱うべきか」の判断コストが毎回発生する

---

### 案5: 水平レイヤー追記（最小変更） ★ スタック適合性 3 / 学習コスト 4

**スタック適合性 3**
- 技術的には可能。Zod スキーマを同一ファイルに追記するだけで動く
- `schema.ts` がすべての spec タイプを管理するモノリシックファイルになり、現在 59 行が倍増する予測
- `validator.ts` に screen / workflow の混在関数が同居するため、責務境界が曖昧になる

**学習コスト 4**
- 既存ファイルへの追記なので import 変更が少なく、短期的には覚えることが少ない
- ただしファイルが肥大化するにつれ保守コストが上昇する（技術的負債）

---

### 案6: Workflow サブドメインモジュール ★ スタック適合性 4 / 学習コスト 3

**スタック適合性 4**
- `src/core/workflow/` ディレクトリの作成は tsup/TypeScript/Vitest のどれとも問題なし
- `index.ts` の barrel export は tree-shaking に影響しないが、circular import に注意が必要
- 既存 screen/unit が同じサブドメイン構造でないため非対称性が残る（将来的に screen/ unit/ も同構造にするならコストが増える）

**学習コスト 3**
- `src/core/workflow/validator.ts` と `src/core/validator.ts` の同名衝突で混乱しやすい
- `index.ts` barrel export の使い方を理解する必要がある（既存コードにない概念）
- ディレクトリネストが深くなりファイルパス把握が難しくなる

---

### 案7: Composite Spec（統合スキーマ） ★ スタック適合性 2 / 学習コスト 2

**スタック適合性 2**
- 現行の `ScreenSchema` は `screen: z.string()`（文字列型）。`z.discriminatedUnion` は判別子がリテラル型でなければならないため、全スキーマの `screen`/`unit`/`workflow` フィールドを `z.literal(...)` に変更する大改造が必要
- 既存 YAML ファイル形式が変わる可能性がある（破壊的変更）
- Zod 4 の `discriminatedUnion` のエラーメッセージは複合型で難解になる

**学習コスト 2**
- パーサーのロジックが複雑化。「どの型か判別してから処理する」という新しい認知モデルが必要
- 既存ファイルへの変更量が最大級

---

### 案8: Workflow → Screen 変換パイプライン ★ スタック適合性 2 / 学習コスト 2

**スタック適合性 2**
- Workflow の意味論（フロー全体を 1 テスト関数）と Screen の意味論（各画面を独立テスト）は根本的に異なる
- `workflow-expander.ts` の変換ロジックは Zod スキーマ外の「型変換」で、型安全性が保証できない
- `ParsedProject.screens` に展開後の workflow 由来 Screen が混在すると `/api/specs` のレスポンスも汚染される
- viewer での表示が意図しない動作になる可能性が高い

**学習コスト 2**
- 「workflow を書いたのに screen のエラーが出る」というデバッグ体験が最悪
- 変換レイヤーの存在を把握していないと全体を理解できない

---

### 案9: ParsedProject の汎用 SpecCollection 化 ★ スタック適合性 1 / 学習コスト 1

**スタック適合性 1**
- `specs: Map<SpecType, unknown[]>` では TypeScript の型安全が完全に失われる
- 型安全を維持するには `specs: { screen: Screen[]; unit: UnitSpec[]; workflow: WorkflowSpec[] }` という形になり、結局フィールド追加と変わらない
- あるいは高度な conditional types / mapped types が必要で、TypeScript 6 でも複雑
- Hono の `/api/specs` レスポンス型定義も崩れる
- Preact コンポーネントが `data.screens` と書けなくなる（`data.specs.get('screen')` 等）

**学習コスト 1**
- 既存の `parsed.result.screens` というシンプルなアクセスパターンが消える
- SpecCollection の型定義を理解しないとどこにも触れない
- 現時点では完全なオーバーエンジニアリング

---

### 案10: Workflow-only CLI コマンド分離 ★ スタック適合性 3 / 学習コスト 3

**スタック適合性 3**
- oclif でのサブコマンド（`src/commands/workflow/` ディレクトリ）は技術的に可能
- `tespec view` での統合表示に対応するには `ParsedProject` に `workflows` を追加する必要があり、結局案1 との差分が小さくなる
- `tespec validate`（既存）と `tespec workflow validate`（新設）の UX 分断が発生

**学習コスト 3**
- コマンド構造が増えてドキュメント・ヘルプの管理コストが上昇
- 「なぜ workflow だけ別コマンドなのか」という疑問が毎回発生する
- 段階的リリース目的なら有効だが、最終的には案1 に統合することになりそう

---

## 総合ランキング（合計スコア順）

| 順位 | # | パターン名 | スタック適合性 | 学習コスト | 合計 |
|:---:|---|-----------|:-----------:|:--------:|:----:|
| 1 | 1 | 完全ミラー縦割り | 5 | 5 | **10** |
| 2 | 2 | 共通バリデーター基盤抽出 | 5 | 4 | **9** |
| 3 | 5 | 水平レイヤー追記（最小変更） | 3 | 4 | **7** |
| 3 | 6 | Workflow サブドメインモジュール | 4 | 3 | **7** |
| 5 | 10 | Workflow-only CLI コマンド分離 | 3 | 3 | **6** |
| 6 | 4 | Workflow-as-Screen 拡張 | 2 | 3 | **5** |
| 7 | 3 | SpecType レジストリ（プラグイン型） | 2 | 2 | **4** |
| 7 | 7 | Composite Spec（統合スキーマ） | 2 | 2 | **4** |
| 7 | 8 | Workflow → Screen 変換パイプライン | 2 | 2 | **4** |
| 10 | 9 | ParsedProject の汎用 SpecCollection 化 | 1 | 1 | **2** |

---

## Platform Expert 推奨

**第 1 推奨: 案1（完全ミラー縦割り）**
既存の screen/unit パターンを完全踏襲。すべてのスタック制約と整合し、実装者の認知負荷が最も低い。`tsup.config.ts` 変更不要、`biome.json` 除外設定も既存のまま機能する。

**第 2 推奨: 案2（共通バリデーター基盤抽出）**
案1 を採用しつつ、`validation-types.ts` への型共通化を同時に行う選択肢。実装コストは僅かに増えるが、将来の `ValidationIssue` 変更コストが 1 箇所に収まる。案1 と組み合わせ可能。

**除外推奨: 案7/案8/案9**
スタックとの相性が悪く、既存コードへの破壊的変更が大きすぎる。現在の spec 数（3 タイプ）では投資対効果が低すぎる。
