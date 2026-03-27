# アーキテクチャパターン候補

## Phase 2a: 候補案一覧（10案）

| # | パターン名 | 概要 |
|---|-----------|------|
| 1 | 完全ミラー縦割り | Screen/Unit と完全に同じ縦割り構造を Workflow に追加 |
| 2 | 共通バリデーター基盤抽出 | ValidationIssue / ValidationResult を共通モジュールに切り出しつつ各 validator は独立 |
| 3 | SpecType レジストリ（プラグイン型） | spec タイプをデータ駆動で登録する汎用 registry を導入 |
| 4 | Workflow-as-Screen 拡張 | Workflow を Screen の派生概念として既存 ScreenSchema に追記する |
| 5 | 水平レイヤー追記（最小変更） | 既存ファイル（schema.ts / parser.ts / validator.ts 等）に直接追記して新ファイルを最小化 |
| 6 | Workflow サブドメインモジュール | `src/core/workflow/` ディレクトリにパイプライン全体を自己完結させる |
| 7 | Composite Spec（統合スキーマ） | ScreenSchema と WorkflowSchema を Union 型で統合し、パーサーが判別する |
| 8 | Workflow → Screen 変換パイプライン | Workflow を「Screen リストへの展開」として処理し、既存 Screen ジェネレーターを再利用 |
| 9 | ParsedProject の汎用 SpecCollection 化 | `screens: Screen[]` / `units: UnitSpec[]` を `specs: SpecCollection` に汎用化 |
| 10 | Workflow-only CLI コマンド分離 | `tespec workflow validate` / `tespec workflow generate` という独立サブコマンドを追加 |

---

## 各案の詳細

### 案1: 完全ミラー縦割り

**概要**: Screen タイプが辿ってきたのと同じ道を Workflow でも繰り返す。新ファイルを追加し、既存ファイルへの変更は `ParsedProject` / コマンド / Viewer の必要最小限に留める。

**ディレクトリ構成イメージ**:
```
src/core/
  schema.ts                    ← WorkflowStepSchema / WorkflowSchema を追加
  parser.ts                    ← ParsedProject に workflows 追加、parseProject 更新
  validator.ts                 ← 変更なし
  unit-validator.ts            ← 変更なし
  workflow-validator.ts        ← 新設（重複ID / screen参照 / 空steps チェック）
  generators/
    types.ts                   ← WorkflowGenerator インターフェース追加
    registry.ts                ← workflow レジストリ追加
    screen/playwright.ts       ← 変更なし
    workflow/playwright.ts     ← 新設（単一テスト関数生成）
src/commands/
  validate.ts                  ← workflow バリデーション呼び出し追加
  generate.ts                  ← --workflow フラグ + 分岐追加
```

**メリット**:
- 既存コードの慣習を完全踏襲するため読み手に驚きがない
- 各ファイルの責務が明確で、単体テストが書きやすい
- 変更の影響範囲が予測しやすい（新ファイルが主体）
- コードレビューが容易（diff が局所的）

**デメリット**:
- `ParsedProject` インターフェースが肥大化し続ける
- `validate.ts` / `generate.ts` に spec タイプごとの分岐が増殖する
- `ValidationIssue` の独立コピーが 3 箇所になり、将来的な型変更時に同期漏れリスク

---

### 案2: 共通バリデーター基盤抽出

**概要**: 案1 をベースに、`ValidationIssue` / `ValidationResult` インターフェースを `src/core/validation-types.ts` に切り出して全バリデーターが import する。ロジックは各 validator に残す。

**ディレクトリ構成イメージ**:
```
src/core/
  validation-types.ts          ← 新設: ValidationIssue / ValidationResult 共通定義
  validator.ts                 ← validation-types.ts を import
  unit-validator.ts            ← validation-types.ts を import
  workflow-validator.ts        ← 新設: validation-types.ts を import
```

**メリット**:
- 型の重複コピーを排除できる
- `ValidationIssue` に将来フィールド追加（例: `column`）した場合の変更点が 1 箇所
- 案1 との差分が小さく、リファクタリングコストが低い

**デメリット**:
- 既存の「独立コピー慣習」を破るため、既存 2 ファイルへのリファクタリングが必要
- 実際のロジックは分散したまま。共通化の恩恵が型定義のみに限定される
- 将来第 4 の validator を追加するときも同じ作業が要る（根本解決ではない）

---

### 案3: SpecType レジストリ（プラグイン型）

**概要**: spec タイプ（screen / unit / workflow）を動的に登録できる `SpecTypeRegistry` を導入。各タイプが「スキーマ・バリデーター・ジェネレーター」をセットで登録し、コアのコマンドはレジストリを通じて処理する。

**ディレクトリ構成イメージ**:
```
src/core/
  spec-registry.ts             ← 新設: SpecTypeRegistry インターフェース + 登録機構
  spec-types/
    screen.ts                  ← ScreenSchema / validate / generate をセットで定義
    unit.ts                    ← UnitSchema / validateUnits / generate をセットで定義
    workflow.ts                ← WorkflowSchema / validateWorkflows / generate をセットで定義
src/commands/
  validate.ts                  ← レジストリをループするだけ（タイプ固有ロジック不要）
  generate.ts                  ← レジストリをループするだけ
```

**メリット**:
- 第 4 以降の spec タイプを `src/core/spec-types/` にファイルを置くだけで追加できる
- `validate.ts` / `generate.ts` のコマンドが spec タイプ数に依存しない
- 仕組みとして美しく、拡張性が非常に高い

**デメリット**:
- 既存 screen / unit の大規模リファクタリングが必要（移行コストが高い）
- レジストリの抽象化が複雑になりがち（TypeScript の型パラメーターが煩雑）
- 現時点で spec タイプが 3 つ程度なら YAGNI（You Ain't Gonna Need It）に該当
- 既存のシンプルな慣習が崩れるため、コードを読む人の学習コストが上がる

---

### 案4: Workflow-as-Screen 拡張

**概要**: Workflow を「Screen の特殊ケース」として扱い、`ScreenSchema` に `workflow_steps` フィールドを optional で追加するか、専用フラグ（`type: workflow`）を立てる。既存のパースおよびバリデーション機構を最大限流用する。

**ディレクトリ構成イメージ**:
```
src/core/
  schema.ts                    ← ScreenSchema に type?: 'screen' | 'workflow' 追加
                               ← WorkflowStep フィールドを optional で追加
  validator.ts                 ← workflow タイプの場合の分岐を追加
  generators/
    screen/playwright.ts       ← workflow タイプの分岐を追加
```

**メリット**:
- 新ファイルが最小（0 または 1 ファイル）
- `ParsedProject` に新フィールドを追加しなくてよい（screens の中に含まれる）
- 既存の viewer がほぼそのまま動作する可能性がある

**デメリット**:
- `ScreenSchema` が「画面でも workflow でもある」汚染された Union 型になる
- `screen.route` フィールドが workflow には無意味（required のまま残る）
- `cases` が workflow には不要でスキーマの意味論が崩れる
- バリデーターに「if workflow then...」という分岐が入り込む
- 型安全性が低下する（`screen.type === 'workflow'` の型ガードが必要）

---

### 案5: 水平レイヤー追記（最小変更）

**概要**: 新ファイルをほとんど作らず、既存ファイルの末尾に Workflow 用のコードを追記する。`schema.ts` に WorkflowSchema を追記、`validator.ts` に `validateWorkflows` 関数を追記、`parser.ts` の `parseProject` に workflow 処理を追記する。

**ディレクトリ構成イメージ**:
```
src/core/
  schema.ts                    ← WorkflowSchema / Workflow 型を追記（既存ファイルに追記）
  parser.ts                    ← parseProject に workflow パース追記
  validator.ts                 ← validateWorkflows 関数を追記
  generators/screen/playwright.ts ← generateWorkflowTestFile を追記
src/commands/
  validate.ts                  ← validateWorkflows 呼び出し追記
  generate.ts                  ← workflow 分岐追記
```

**メリット**:
- ファイル数の増加が最小（0〜1 ファイル増）
- `import` の変更が少ない
- 差分が局所的に見えるが実は既存ファイルに分散する

**デメリット**:
- `validator.ts` が screen / workflow の混在ファイルになり、責務が不明瞭
- ファイルが肥大化するにつれて可読性が低下する
- `schema.ts` が全 spec タイプのスキーマを持つモノリシックファイルになる（現状でも肥大化の予兆がある）
- テストが難しくなる（ファイルを丸ごと import する必要がある）

---

### 案6: Workflow サブドメインモジュール

**概要**: `src/core/workflow/` ディレクトリを作り、Workflow に関する Schema / Parser / Validator / Generator を全てその中に自己完結させる。既存の `src/core/` と並列な独立ドメインとして扱う。

**ディレクトリ構成イメージ**:
```
src/core/
  workflow/
    schema.ts                  ← WorkflowStepSchema / WorkflowSchema / Workflow 型
    validator.ts               ← validateWorkflows（独立した ValidationIssue 定義）
    generators/
      playwright.ts            ← generateWorkflowTestFile
      types.ts                 ← WorkflowGenerator インターフェース
    index.ts                   ← 公開 API をまとめる barrel export
  schema.ts                    ← 変更なし（ConfigSchema の workflows_dir 追加のみ）
  parser.ts                    ← ParsedProject に workflows 追加、workflow/ を呼び出す
src/commands/
  validate.ts                  ← workflow/index から呼び出す
  generate.ts                  ← workflow/index から呼び出す
```

**メリット**:
- Workflow 機能全体が `src/core/workflow/` に自己完結するため、削除・差し替えが容易
- 既存コードへの変更が `ConfigSchema` / `ParsedProject` / コマンドの呼び出し部分のみ
- ドメインの境界が明確でチームで並列開発しやすい
- 将来的にサブドメインごとのテストカバレッジが計測しやすい

**デメリット**:
- ディレクトリのネストが深くなる（`src/core/workflow/generators/playwright.ts`）
- `src/core/workflow/validator.ts` と `src/core/validator.ts` が同名になりわかりにくい
- `barrel export`（index.ts）を導入すると tree-shaking や circular import に注意が必要
- 既存の screen / unit が同じ構造になっていないため非対称性が残る

---

### 案7: Composite Spec（統合スキーマ）

**概要**: `ScreenSchema` / `UnitSpecSchema` / `WorkflowSchema` を Zod の `z.discriminatedUnion` で束ね、パーサーがファイルを読む際に判別タグ（`screen:` / `unit:` / `workflow:` キーの存在）で自動的に型を特定する。

**ディレクトリ構成イメージ**:
```
src/core/
  schema.ts                    ← AnySpecSchema = z.discriminatedUnion('type', [...]) 追加
  parser.ts                    ← parseAnySpec を追加し、タイプ判別を自動化
  spec-validator.ts            ← 全 spec タイプを統合バリデーション
  generators/
    types.ts                   ← AnySpecGenerator Union 型追加
    registry.ts                ← 汎用 getGenerator(spec: AnySpec) を追加
```

**メリット**:
- パーサーが「何の spec か知らなくても」ファイルを処理できる
- YAML ファイルの拡張子や配置ディレクトリに縛られない柔軟なパス構成が可能
- Zod の `discriminatedUnion` で型安全な判別ができる

**デメリット**:
- Zod の `discriminatedUnion` は第 1 フィールドがリテラル型である必要があり、現行スキーマの改造コストが高い（`screen: z.literal(...)` などへの変更が必要）
- 既存の YAML ファイル形式が変わる可能性がある
- `z.discriminatedUnion` のエラーメッセージが難解になりやすい
- テストが複雑になる

---

### 案8: Workflow → Screen 変換パイプライン

**概要**: Workflow spec を「複数 Screen の順序付きリスト」として解釈し、パース後に `Workflow` → `Screen[]` 展開変換を行う。生成フェーズでは既存の `ScreenGenerator` を流用し、新しいジェネレーターを作らない。

**ディレクトリ構成イメージ**:
```
src/core/
  schema.ts                    ← WorkflowSchema 追加
  workflow-expander.ts         ← 新設: Workflow → Screen[] 変換ロジック
  parser.ts                    ← ParsedProject は変更なし（workflows は expand 後 screens に含める）
src/commands/
  generate.ts                  ← workflow ファイルを expand してから generate
```

**メリット**:
- ジェネレーターのコードを新規追加しなくてよい（最大の既存コード再利用）
- Viewer は screens を表示するだけで、workflow の表示が自動的にできる可能性がある
- `ParsedProject` の変更が最小

**デメリット**:
- Workflow の意味論（フロー全体を 1 テスト関数で表現）と Screen の意味論（各画面を独立テストで表現）が根本的に異なるため、変換が無理矢理になる
- 展開後の Screen が「元は Workflow だった」という情報が失われる
- バリデーターが展開後の Screen を検証しようとすると意味不明なエラーメッセージになる
- デバッグが難しい（ユーザーは `workflow.yaml` を書いたのに `screens/xxx.yaml` のエラーが出る）

---

### 案9: ParsedProject の汎用 SpecCollection 化

**概要**: `ParsedProject` の `screens: Screen[]` / `units: UnitSpec[]` / `workflows: Workflow[]` というフィールド列挙を廃止し、`specs: Map<SpecType, unknown[]>` または `specs: SpecCollection` という汎用構造に置き換える。

**ディレクトリ構成イメージ**:
```
src/core/
  parser.ts                    ← ParsedProject を SpecCollection ベースに変更
  spec-collection.ts           ← 新設: SpecCollection 型 + アクセサー
  schema.ts                    ← 各スキーマは変更なし
```

**メリット**:
- `ParsedProject` の型定義が spec タイプ数に依存しなくなる
- 案3（レジストリ型）との組み合わせで完全なプラグインアーキテクチャになる

**デメリット**:
- TypeScript の型安全性を維持しながら `SpecCollection` を定義するのが極めて難しい（ジェネリクスの複雑化）
- `parsed.result.screens` というシンプルなアクセスが `parsed.result.specs.get('screen') as Screen[]` のような形になり可読性が低下
- 既存コードの全面書き換えが必要
- 現時点では明らかなオーバーエンジニアリング

---

### 案10: Workflow-only CLI コマンド分離

**概要**: 既存の `validate` / `generate` コマンドには手を加えず、`tespec workflow` サブコマンド（`tespec workflow validate` / `tespec workflow generate`）を新設して Workflow 専用のエントリーポイントとする。

**ディレクトリ構成イメージ**:
```
src/commands/
  validate.ts                  ← 変更なし
  generate.ts                  ← 変更なし
  workflow/
    validate.ts                ← 新設: workflow 専用バリデートコマンド
    generate.ts                ← 新設: workflow 専用ジェネレートコマンド
src/core/
  schema.ts                    ← WorkflowSchema 追加
  workflow-validator.ts        ← 新設
  generators/workflow/playwright.ts ← 新設
  parser.ts                    ← 変更なし（workflow パースは workflow コマンド内で行う）
```

**メリット**:
- 既存コマンドへの変更がゼロ（`validate.ts` / `generate.ts` 無変更）
- Workflow 専用コマンドが独立しているため、workflow 固有の UX（ステップ可視化など）を将来追加しやすい
- 段階的リリースが可能（`tespec workflow` は beta として先行リリース）

**デメリット**:
- `tespec validate` と `tespec workflow validate` が別コマンドになり、ユーザーがどちらを使えばよいか混乱する
- `ParsedProject` に `workflows` を追加しないため、`tespec view` での統合表示が難しくなる
- コマンドが増えることでドキュメント・ヘルプの管理コストが増大
- 「すべての spec を一括 validate する」ユースケースに対応できない

---

## 付記: 各案の分類

| 軸 | 案番号 |
|---|--------|
| 既存慣習を踏襲する保守的なアプローチ | 1, 2 |
| 既存コードへの変更を最小化するアプローチ | 5, 10 |
| 抽象化・汎用化を目指すアプローチ | 3, 9 |
| Workflow を既存概念に同化させるアプローチ | 4, 8 |
| ドメイン境界を強化するアプローチ | 6 |
| スキーマレベルで統合するアプローチ | 7 |
