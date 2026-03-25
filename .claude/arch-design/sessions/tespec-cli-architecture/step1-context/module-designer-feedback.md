# モジュール設計フィードバック

**作成者**: module-designer
**タスク**: Step 1 - モジュール設計観点でのフィードバック
**日付**: 2026-03-24

---

## 1. 機能の責務分類

仕様書を読んで、tespec の機能を責務の観点で以下のように分類した。

| 機能 | 責務 | 入力 | 出力 |
|------|------|------|------|
| YAML パース | ファイル読み込み・構造変換 | `.yaml` ファイル | 型付きオブジェクト (Screen / Setup / Config) |
| バリデーション | 参照整合性チェック・警告生成 | 型付きオブジェクト群 | エラー/警告リスト |
| テスト生成 | スケルトンコード出力 | Screen オブジェクト群 | `.spec.ts` ファイル群 |
| 遷移図生成 | PlantUML ソース生成 | Screen オブジェクト群 | PlantUML テキスト |
| ステータス管理 | `.status.json` の読み書き・集計 | Screen オブジェクト群 + テスト結果 | `.status.json` |
| CLI | コマンドルーティング・出力フォーマット | ユーザー入力 (argv) | stdout / stderr |

---

## 2. モジュール分割案

以下の 6 モジュールに分割することを提案する。

### 2.1 `parser` モジュール

**責務**: YAML ファイルを読み込み、型付き内部表現に変換する。

- `config.yaml` → `Config` 型
- `screens/*.yaml` → `Screen` 型
- `setups/*.yaml` → `Setup` 型
- ファイル I/O とパースのみ。バリデーションは行わない

**公開インターフェース候補**:
```typescript
parseConfig(configPath: string): Config
parseScreens(screensDir: string): Screen[]
parseSetups(setupsDir: string): Setup[]
```

**凝集性のポイント**: 3 種類の YAML はスキーマが異なるが、「ファイルを構造化データに変換する」という責務は一つ。同じモジュールに置くことで、YAML ライブラリの差し替えが 1 箇所で済む。

---

### 2.2 `validator` モジュール

**責務**: 型付きオブジェクト間の参照整合性をチェックし、エラー/警告を返す。

- `given` の setup ID が実在するか
- `navigates_to` の screen ID が実在するか
- `screen` ID の重複チェック
- `cases` 空チェック、`type: error/boundary` の有無チェック

**公開インターフェース候補**:
```typescript
interface ValidationResult {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}
interface ValidationIssue {
  file: string
  message: string
}
validate(config: Config, screens: Screen[], setups: Setup[]): ValidationResult
```

**凝集性のポイント**: このモジュールだけが「整合性ルール」の知識を持つ。ルールの追加・変更がこのモジュールに閉じる。核心的価値（バリデーションの信頼性）を担う最重要モジュール。

---

### 2.3 `generator` モジュール

**責務**: Screen 定義からテストスケルトンコードを生成する。

- Playwright の `test.describe` / `test` 構造に変換
- `type` に応じてネスト（`test.describe("異常系", ...)` 等）
- `--dry-run` オプション対応は CLI 層の責務（このモジュールは文字列を返すだけ）

**公開インターフェース候補**:
```typescript
generateTestFile(screen: Screen, setups: Setup[]): string
```

**凝集性のポイント**: テストフレームワーク（Playwright）の知識をここに集約。将来的に他フレームワーク対応が必要になっても、このモジュールの差し替えで対応できる。

---

### 2.4 `diagram` モジュール

**責務**: Screen の `navigates_to` から PlantUML ソースを生成する。

- state として各画面を定義
- 遷移エッジを `navigates_to` + `action` から抽出
- guard 条件（`given` + `type: error`）の注釈を付与

**公開インターフェース候補**:
```typescript
generateDiagram(screens: Screen[]): string
```

**凝集性のポイント**: PlantUML 形式の知識をここだけに閉じる。出力形式が変わっても（例: Mermaid 対応）、このモジュールだけ変更すればよい。

---

### 2.5 `status` モジュール

**責務**: `.status.json` の読み書きとステータス集計。

- Screen 定義から初期 `.status.json` を生成（全ケースを `not_implemented`）
- テスト実行結果を受け取り `.status.json` を更新（`sync` コマンド用）
- summary の集計

**公開インターフェース候補**:
```typescript
readStatus(statusPath: string): StatusData | null
writeStatus(statusPath: string, data: StatusData): void
buildInitialStatus(screens: Screen[]): StatusData
mergeTestResults(current: StatusData, results: TestResult[]): StatusData
```

**凝集性のポイント**: `.status.json` の構造知識をここに集約。仕様（YAML）と結果（.status.json）の分離という設計原則をモジュール境界で表現する。

---

### 2.6 `cli` モジュール

**責務**: コマンドルーティング・引数解析・出力フォーマット。

- `tespec validate` → parser + validator を呼び出し、エラーを人間向けテキストで出力
- `tespec generate` → parser + validator + generator を呼び出し、ファイル書き込み
- `tespec diagram` → parser + diagram を呼び出し、ファイル書き込みまたは stdout 出力
- `tespec status` → parser + status を呼び出し、テーブル形式で出力
- `tespec sync` → parser + status を呼び出し、`.status.json` を更新

**凝集性のポイント**: I/O（stdout/stderr/ファイル書き込み）と副作用を CLI 層に集約する。他のモジュールは純粋関数的に保つことができ、テストしやすくなる。

---

## 3. 依存関係の方向

```
cli
├── parser
├── validator  (parser の出力を受け取る)
├── generator  (parser の出力を受け取る)
├── diagram    (parser の出力を受け取る)
└── status     (parser の出力を受け取る)

validator → parser の型定義のみに依存
generator → parser の型定義のみに依存
diagram   → parser の型定義のみに依存
status    → parser の型定義のみに依存
```

**重要な原則**: `validator`, `generator`, `diagram`, `status` の各モジュールは互いに依存しない。型定義は `parser` モジュール（または別途 `types` ファイル）に集約する。

---

## 4. 初期論点（アーキテクチャ設計への問い）

### 論点 A: `types` を独立モジュールに分離すべきか？

`Screen`, `Setup`, `Config`, `StatusData` などの型定義を `parser` モジュール内に置くか、`types.ts` として独立させるかは設計上の分岐点。

- **`parser` 内に置く場合**: `validator` 等は `parser` モジュールに型依存する。「パースされた型を使う」という意味では自然
- **`types.ts` を独立させる場合**: 循環依存のリスクがなく、型定義の変更の影響範囲が明確になる。OSS として公開する場合、外部からも型を参照しやすい

**YAGNI 観点からの推奨**: 当初は `parser/types.ts` として `parser` モジュール内に置き、必要になれば分離する。

---

### 論点 B: `validate` は `generate` の前提条件か？

`tespec generate` 実行時に validate を自動的に走らせるべきか（バリデーションエラーがある場合は生成しない）、それとも独立したコマンドとして分離するか。

- **自動実行の場合**: 壊れた YAML からの生成を防げる。ユーザーが validate を忘れても安全
- **分離の場合**: 各コマンドが独立して動作し、ユーザーが制御できる。`--skip-validate` フラグで回避も可能

**核心的価値（バリデーションの信頼性）の観点からの推奨**: `generate`, `diagram`, `status` コマンドはすべて `validate` を先行実行し、error レベルの問題がある場合は処理を止める。warning は表示して続行。

---

### 論点 C: `status` モジュールの sync 機能をどう実装するか？

`tespec sync` は「テスト実行結果を `.status.json` に反映」するが、テスト実行結果の入力形式が未定義。

- Playwright のレポート JSON を解析する？
- テスト実行後に自動フックで呼ばれる想定？
- 最初は手動で status を更新する簡易コマンドにとどめる？

**YAGNI 観点からの推奨**: MVP では `not_implemented` → `pass` / `fail` の手動更新 CLI として実装し、CI 連携は future-plans として扱う。

---

## 5. モジュール境界のリスク

| リスク | 対応策 |
|--------|--------|
| `parser` と `validator` の責務が滲みやすい（パース時にバリデーションしたくなる）| パースは「形式的な型変換のみ」と明確化。参照の有無チェックは必ず `validator` で行う |
| `cli` が肥大化しやすい | 出力フォーマットを `formatters/` として分離する余地を設計段階で確保しておく |
| `generator` がフレームワーク固有ロジックを持ち過ぎる | 現状は Playwright のみ想定。拡張は future-plans として扱い、抽象化は YAGNI で後回しにする |

---

## 6. まとめ

tespec は機能数が少なく、責務が明確に分離されているため、6 モジュール構成は過剰でなく適切と判断する。各モジュールの境界は「何を知っているか（知識の局所化）」で引いており、高凝集・低結合の原則に従っている。

最優先で設計を固めるべきは `validator` モジュール。核心的価値を担うため、バリデーションルールの網羅性と拡張性（ルール追加コスト）を重点的に議論することを推奨する。
