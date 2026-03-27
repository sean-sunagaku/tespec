# コンテキスト分析

## 機能要件

- Workflow YAML を定義できる（`workflows/*.yaml`）
- `workflow` ID と `title` フィールドを持つ
- `steps` 配列で複数の操作ステップを順次記述できる
  - 各ステップは `screen` (screen ID への参照) と `action`（任意文字列）を持つ
  - 末尾ステップには `expect`（任意文字列）を付与できる
- `tespec validate` でワークフロー YAML を検証できる
  - 重複 workflow ID のエラー
  - 参照する `screen` ID が存在しないエラー
  - 空 `steps` のエラー
- `tespec generate` でワークフロー用テストスケルトンを生成できる
  - 全ステップを順次実行する単一テスト関数として出力
  - 対象フレームワーク: playwright（最低限）
- `tespec view` でワークフロー一覧をブラウザで確認できる（将来的・任意）
- `ConfigSchema` に `workflows_dir` フィールドを追加し、省略時は `./workflows` をデフォルトとする

## 非機能要件

| 観点 | 要件 | 優先度 |
|------|------|--------|
| 型安全性 | WorkflowSchema は Zod で定義し、`z.infer<>` で型を生成する | 必須 |
| バリデーション | screen ID の参照整合性チェックを既存パターン通り実装する | 必須 |
| エラーハンドリング | ParseError / ValidationIssue の既存インターフェースに準拠する | 必須 |
| 拡張性 | WorkflowGenerator インターフェースを types.ts に追加し、Registry パターンを踏襲する | 推奨 |
| テスト容易性 | Vitest でユニットテストを書けるように副作用なし純粋関数で設計する | 必須 |
| 後方互換性 | `workflows_dir` が未設定のプロジェクト（既存）でも正常動作する | 必須 |
| CI | 既存 ESLint / TypeScript strict モードをパスする | 必須 |

## 技術スタック

| レイヤー | 技術 |
|----------|------|
| 言語 | TypeScript 6（strict モード） |
| スキーマ定義 | Zod 4（`z.infer<>` で型派生） |
| YAML パース | `yaml` パッケージ（`parseDocument`） |
| CLI フレームワーク | oclif（`Command` / `Flags`） |
| ビルド | tsup（esbuild ベース、ESM 出力） |
| テスト | Vitest |
| Web サーバー | Hono（API + SSE） |
| Web クライアント | Preact + Tailwind CSS |
| ランタイム | Node.js 18+ |

## 既存アーキテクチャの特徴

### パイプライン構造

```
YAML ファイル群
  → parseYamlFile / parseYamlDirectory（parser.ts）
  → ParsedProject（schema.ts の型を保持）
  → validate / validateUnits（validator.ts / unit-validator.ts）
  → ValidationResult（issues: ValidationIssue[]）
  → generate（generators/screen/*.ts / generators/unit/*.ts）
  → テストスケルトンファイル
  → startServer（viewer/server.ts）
  → ブラウザ表示
```

### コーディングパターン・慣習

1. **Schema → 型の自動生成**: `z.object({...})` で定義したスキーマから `z.infer<>` で TypeScript 型を導出。型とスキーマが常に一致する。

2. **ParsedProject への集約**: `parser.ts` の `parseProject` は `ParsedProject`（config + screens + setups + units）を返す。新しい spec タイプを追加する場合、このインターフェースにフィールドを追加する必要がある。

3. **ParseError の統一**: ファイル読み込み失敗・YAML パースエラー・Zod バリデーション失敗すべてを `{ file: string; message: string }` 形式に正規化している。

4. **ValidationIssue の `level` 区分**: `'error'` と `'warning'` の 2 レベル。`hasErrors` フラグで exit(1) 判定。`validator.ts` と `unit-validator.ts` で同一インターフェースを独立定義（`import` 共有なし）。

5. **Generator インターフェース**: `ScreenGenerator` / `UnitGenerator` を `generators/types.ts` で定義。`generate()` と `fileNameFor()` の 2 メソッド。Registry パターンで `getXxxGenerator(target)` を提供。

6. **ConfigSchema のオプショナルディレクトリ**: `screens_dir` と `setups_dir` は `default()` で省略可能。`units_dir` のみ `optional()`（デフォルト値なし・未設定で無効化）。

7. **並列 Promise.all パース**: screens / setups / units の各ディレクトリを並列パース。新 spec 追加時も同パターンを踏襲。

8. **`parseYamlDirectory` の null 対応**: ディレクトリが存在しない場合 `null` を返す。`units_dir` 未設定時は `{ items: [], errors: [] }` を即 resolve する。

9. **Viewer の SSE 更新**: `updateData()` で currentData を差し替えて全 SSE クライアントへ `reload` 通知。Viewer 側は `/api/specs` を再 fetch する。

10. **コマンド共通ロジック**: `validate.ts` と `generate.ts` は同じ「parseProject → validate → exit 1 on errors」のフローを持つ。

## 制約条件

- `ValidatonIssue` インターフェースは `validator.ts` と `unit-validator.ts` に独立コピーされているため、新しい `workflow-validator.ts` も独立定義が慣習。型の共有をしたい場合は別途 `types.ts` に切り出す判断が必要。
- `generate.ts` のフラグ（`--screen`, `--unit`）は spec タイプごとに個別追加されており、`--workflow` フラグも同様に追加が必要。フラグ増加による複雑性に注意。
- `ParsedProject` に `workflows` フィールドを追加すると `parser.ts`, `server.ts`（`/api/specs` レスポンス）, `client-entry.tsx`（`SpecsData` インターフェース）の複数箇所を更新する必要がある。
- `parseYamlDirectory` の `null` ハンドリング: ディレクトリが存在しない場合は parseError として返す設計。`workflows_dir` を `optional()` にする場合、`units_dir` と同様のパターンで扱う。
- Node.js 18+ / ESM 専用。`.js` 拡張子の import が必須（`tsup` の ESM 出力仕様）。
- Vitest strict モード: `any` キャストを避ける設計が求められる。

## 設計キーポイント

### 1. WorkflowStepSchema の `expect` オプショナル化

各ステップに `expect` を付けるかどうかは任意。ただしユーザー設計方針では「末尾ステップにのみ `expect` を付けられる」という意図があるため、スキーマレベルで強制するか（精緻・複雑）、全ステップ `optional` にするか（シンプル）の判断が必要。

**推奨**: 全ステップ `optional`（シンプル・型整合）。末尾限定はバリデーターで警告として実装可能。

### 2. `validator.ts` の分担

Screen バリデーターは screen ID 参照チェックを担う。Workflow バリデーターも同様に「steps の screen 参照チェック」「重複 ID チェック」「空ステップチェック」を独立ファイルで実装する。

**推奨**: `src/core/workflow-validator.ts` を新設（既存 2 ファイルと同パターン）。

### 3. `ParsedProject` への影響範囲

`workflows: Workflow[]` を追加すると以下を更新:
- `parser.ts`: `ParsedProject` インターフェース + `parseProject` 関数
- `validator.ts` は影響なし（screen バリデーション独立）
- `generate.ts`: workflow 用分岐追加
- `validate.ts`: workflow バリデーション呼び出し追加
- `server.ts`: `/api/specs` レスポンスに `workflows` 追加
- `client-entry.tsx`: `SpecsData` 型 + サイドバー + ダッシュボード更新

### 4. WorkflowGenerator の設計

`ScreenGenerator` が `generate(screen, setups): string` を持つように、`WorkflowGenerator` は `generate(workflow, screens): string` のシグネチャが自然（screen 参照情報を埋め込むため）。

### 5. `ConfigSchema` の `workflows_dir` 追加

`units_dir` 同様に `optional()` にして、未設定時はパースをスキップする設計が一貫性を保てる。デフォルトを `./workflows` にするか `undefined` にするかは `units_dir` の precedent（`optional()` = デフォルトなし）に合わせる。

### 6. テスト生成フォーマット

単一テスト関数として全ステップを順次コメントで記述する形式が既存の `playwright.ts` パターン（`// Steps:` コメント挿入）と整合する。

```ts
test("新規ユーザー登録フロー", async () => {
  // Step 1: [login] 新規登録リンクをタップ
  // Step 2: [signup] 必要事項を入力して登録
  // Step 3: [email_verify] 認証メールのリンクをクリック
  // Step 4: [home] expect: ようこそメッセージが表示される
  // TODO: implement
});
```
