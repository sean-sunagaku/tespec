# モジュール設計提案 (module-designer)

**作成日**: 2026-03-24
**ベース**: step4-output/architecture.md（Layered 4層確定版）

---

## 1. 各モジュールの詳細定義

---

### `core/schema.ts`

**責務**: YAML スキーマを Zod で宣言し、TypeScript 型を唯一の場所でエクスポートする。

**変化の理由**: YAML 仕様の追加・変更時のみ（例: case に新フィールドが増えた時）。

**devils-advocate [致命1] への回答**: `schema.ts` を `parser.ts` に統合すると、`validator.ts` と `generator.ts` が `parser.ts` に依存する構造になる。これは「YAML パース処理」に依存しているわけではなく「型定義」だけのために import する形になり、依存の意味が不明確になる。`schema.ts` を独立ファイルとして置くことで「型定義だけに依存している」という意図が明確になる。ファイル数 +1 のコストに対してこの明確さは正当であると判断し、独立ファイルを維持する。

**公開インターフェース**:

```typescript
import { z } from 'zod';

// --- スキーマ ---
export const CaseSchema = z.object({
  action:       z.string(),
  expect:       z.union([z.string(), z.array(z.string())]),
  given:        z.union([z.string(), z.array(z.string())]).optional(),
  target:       z.string().optional(),
  type:         z.enum(['normal', 'error', 'boundary']).default('normal'),
  not_expect:   z.array(z.string()).optional(),
  navigates_to: z.string().optional(),
});

export const ScreenSchema = z.object({
  screen: z.string(),
  route:  z.string(),
  title:  z.string(),
  cases:  z.array(CaseSchema).min(0),
});

export const SetupSchema = z.object({
  setup: z.string(),
  title: z.string(),
  steps: z.array(z.string()),
});

export const ConfigSchema = z.object({
  version:     z.number(),
  project:     z.string(),
  screens_dir: z.string().default('./screens'),
  setups_dir:  z.string().default('./setups'),
});

// --- 型（スキーマから自動導出）---
export type Case   = z.infer<typeof CaseSchema>;
export type Screen = z.infer<typeof ScreenSchema>;
export type Setup  = z.infer<typeof SetupSchema>;
export type Config = z.infer<typeof ConfigSchema>;
```

**非公開（内部実装）**: なし。このモジュールは宣言のみ。

**依存先**: `zod` のみ（外部ライブラリ）。プロジェクト内モジュールへの依存なし。

**テスト方針**:
- `CaseSchema.parse()` で必須フィールド欠落がエラーになることを確認
- `type` フィールドのデフォルト値 `'normal'` が補完されることを確認
- `given`/`expect` の string | string[] 両形式が受け入れられることを確認
- スナップショットテストは不要（Zod スキーマ自体は自己文書化されている）

---

### `core/parser.ts`

**責務**: ファイルシステムから YAML を読み込み、Zod で構造検証して型付きオブジェクトを返す。

**変化の理由**: YAML ライブラリの差し替え時、ファイル探索ロジックの変更時（glob 対応等）。

**公開インターフェース**:

```typescript
export interface ParsedProject {
  config:  Config;
  screens: Screen[];
  setups:  Setup[];
}

export interface ParseError {
  file:    string;   // 相対パス（config.yaml, screens/home.yaml 等）
  message: string;   // 人間可読エラー
}

/**
 * config.yaml を起点にプロジェクト全体をパースする。
 * @param configPath  config.yaml の絶対パス
 * @returns errors が空なら result が確定している。errors がある場合は result が undefined になることがある。
 */
export async function parseProject(configPath: string): Promise<{
  result?: ParsedProject;
  errors: ParseError[];
}>;
```

**非公開（内部実装）**: 実装時に自然に切り出す。設計時に宣言しない（実装詳細）。

**依存先**:
- `node:fs/promises` — ファイル読み込み
- `node:path` — パス操作
- `yaml` (eemeli) — YAML パース
- `./schema.js` — Zod スキーマ・型定義

**テスト方針**:
- `tests/fixtures/` に正常・異常の YAML ファイル群を用意
- 正常系: 全フィールドあり、最小フィールドのみの2パターン
- 異常系: 必須フィールド欠落、型不一致、存在しないディレクトリ
- エラーを全件収集することの確認（1ファイルエラーでも他ファイルの処理を続行）

---

### `core/validator.ts`

**責務**: パース済みオブジェクト間のクロスファイル参照整合性をチェックし、issue リストを返す。

**変化の理由**: バリデーションルールの追加・変更時のみ（given 参照チェック、navigates_to チェック等）。

**公開インターフェース**:

```typescript
export interface ValidationIssue {
  level:   'error' | 'warning';
  file:    string;   // 問題のある YAML ファイルのパス
  field:   string;   // 問題のあるフィールド名（例: "given", "navigates_to"）
  message: string;   // 人間可読メッセージ（OSS 品質）
}

export interface ValidationResult {
  issues:    ValidationIssue[];
  hasErrors: boolean;   // issues に error が1件でもあれば true
}

/**
 * パース済みデータのクロスファイル参照整合性をチェックする。
 * 純粋関数。副作用なし。
 */
export function validate(screens: Screen[], setups: Setup[]): ValidationResult;
```

**非公開（内部実装）**: 実装時に自然に切り出す。設計時に宣言しない（実装詳細）。

**依存先**:
- `./schema.js` — Screen・Setup 型定義のみ

**テスト方針**:
- 全て純粋関数なのでオブジェクトを直接渡してユニットテスト可能
- チェックルールごとに独立したテストケースを作成
- 「全件収集」の確認：複数エラーが同時に存在する fixture で、全て issue に含まれることを確認
- 正常パス（エラーなし）も必ずテスト

**v1 バリデーションルール一覧**:

| チェック | レベル | 実装メモ |
|---------|--------|---------|
| `given` の参照先 setup が存在するか | error | `Set<string>` で O(1) ルックアップ |
| `navigates_to` の参照先 screen が存在するか | error | 同上 |
| `screen` ID が重複していないか | error | 読み込み時に出現回数をカウント |
| `cases` が空でないか | warning | `screen.cases.length === 0` |
| `type: error` のケースが 0 件 | warning | `cases.filter(c => c.type === 'error').length === 0` |
| `type: boundary` のケースが 0 件 | warning | `cases.filter(c => c.type === 'boundary').length === 0` |

---

### `core/generator.ts`

**責務**: Screen 定義から Playwright テストスケルトン文字列を生成する。

**変化の理由**: テストフレームワーク変更時（Playwright → Vitest 等）、出力フォーマット変更時（describe の構造等）。

**公開インターフェース**:

```typescript
/**
 * 1画面分の Playwright テストファイルを文字列として生成する。
 * 純粋関数。副作用なし。
 * @param screen   対象画面の定義
 * @param setups   全 setup リスト（given のコメント展開に使用）
 * @returns        TypeScript テストファイルの文字列
 */
export function generateTestFile(screen: Screen, setups: Setup[]): string;
```

**非公開（内部実装）**: 実装時に自然に切り出す。設計時に宣言しない（実装詳細）。

**依存先**:
- `./schema.js` — Screen・Setup・Case 型定義のみ

**テスト方針**:
- スナップショットテスト（Vitest の `toMatchSnapshot()`）で生成文字列を固定
- 正常系・異常系・境界ケースを混在させた fixture Screen を用意
- `given` が string 単体 / string[] の両パターンをカバー
- `not_expect` が存在する場合のコメント出力を確認

**出力フォーマット例**:

```typescript
import { test, expect } from "@playwright/test";

// Given: logged_in（ログイン済み状態）
test.describe("ホーム画面", () => {
  test("画面を開く → プロジェクト一覧が表示される", async ({ page }) => {
    // TODO: implement
  });

  test.describe("異常系", () => {
    test("[offline] 画面を開く → エラーメッセージが表示される", async ({ page }) => {
      // not_expect: 空の一覧が表示される
      // TODO: implement
    });
  });

  test.describe("境界値", () => {
    test("[0件] 画面を開く → 空状態メッセージが表示される", async ({ page }) => {
      // TODO: implement
    });
  });
});
```

---

### `commands/validate.ts`

**責務**: parse → validate → 結果出力のオーケストレーションのみ。ビジネスロジックを持たない。

**変化の理由**: コマンドの引数・オプション変更時、出力フォーマットの調整時（ただし色付けは output.ts が担う）。

**公開インターフェース**:

```typescript
/**
 * commander の .action() に直接渡せるシグネチャ。
 * commander が options オブジェクトを渡してくる。
 */
export async function validateCommand(options: {
  config?: string;   // -c/--config オプション
}): Promise<void>;
```

**非公開（内部実装）**: なし。ハンドラー関数1つのみ。

**依存先**:
- `../core/parser.js`
- `../core/validator.js`
- `../utils/output.js`
- `node:process` — `process.exit()`

**処理フロー**:

```
1. configPath を解決（--config 指定があればそれを使用、なければ ./docs/tespec/config.yaml）
2. parseProject(configPath) → パースエラーがあれば printError × n して exit(1)
3. validate(screens, setups) → issues を種別ごとに出力
4. hasErrors → exit(1) / 警告のみ → exit(0)
```

**テスト方針**:
- fixture ディレクトリを用意した統合テスト
- stdout/stderr のキャプチャではなく `printError` / `printWarning` のモックで確認
- `process.exit` を vi.spyOn でキャプチャしてコードを検証

---

### `commands/generate.ts`

**責務**: parse → validate → generate → ファイル書き込みのオーケストレーションのみ。

**変化の理由**: コマンドの引数・オプション変更時、書き込み先のパス規則変更時。

**公開インターフェース**:

```typescript
export async function generateCommand(options: {
  config?:  string;   // -c/--config
  screen?:  string;   // -s/--screen（特定画面のみ）
  dryRun?:  boolean;  // --dry-run（stdout に出力）
}): Promise<void>;
```

**非公開（内部実装）**: なし。

**依存先**:
- `../core/parser.js`
- `../core/validator.js`
- `../core/generator.js`
- `../utils/output.js`
- `node:fs/promises` — テストファイルの書き込み
- `node:path`
- `node:process`

**処理フロー**:

```
1. configPath を解決
2. parseProject(configPath) → パースエラーがあれば exit(1)
3. validate(screens, setups) → エラーがあれば exit(1)（警告は出力して続行）
4. --screen 指定があれば該当 screen のみに絞り込む
5. 各 screen に対して generateTestFile(screen, setups) → 文字列取得
6. --dry-run → stdout 出力 / otherwise → tests/<screenId>.spec.ts に書き込み
7. 生成ファイル数を printSuccess で報告
```

**テスト方針**:
- `--dry-run` モードで統合テストを実施（ファイル書き込みなしで stdout を検証）
- 書き込みパスのロジックは `path.join` 周りのユニットテストで確認
- validate エラーで停止することの確認

---

### `utils/output.ts`

**責務**: picocolors を使って色付きメッセージを stdout/stderr に出力するラッパーを提供する。

**変化の理由**: 色付けライブラリの差し替え時、出力フォーマットの標準変更時。

**公開インターフェース**:

```typescript
/**
 * ERROR: home.yaml: given "logged_in" → setup が見つからない
 */
export function printError(file: string, message: string): void;

/**
 * WARN:  detail.yaml: 異常系 (type: error) が 0 件
 */
export function printWarning(file: string, message: string): void;

/**
 * OK:    login.yaml
 */
export function printOk(file: string): void;

/**
 * 成功サマリー（例: "3 files generated"）
 */
export function printSuccess(message: string): void;
```

**非公開（内部実装）**: なし（関数4つのみ）。

**依存先**:
- `picocolors` のみ

**テスト方針**:
- 直接テストは不要（picocolors のラッパーは自明）
- commands/* の統合テストで副次的にカバーされれば十分

---

### `cli.ts`

**責務**: commander のセットアップとエントリーポイントのみ。ビジネスロジックを一切持たない。

**変化の理由**: コマンド追加時（v2）、グローバルオプション変更時。

**公開インターフェース**: なし（エントリーポイントは export しない）。

**依存先**:
- `commander`
- `./commands/validate.js`
- `./commands/generate.js`

**テスト方針**: 自動テスト不要。CLI の統合テストは commands/* レベルで実施。

---

## 2. モジュール間の境界で注意すべき点

### parser と validator の責務境界

**ルール**: Zod は「1ファイルの構造」のみ検証する。クロスファイル参照は validator.ts の専管。

| チェックの種類 | 担当 | 理由 |
|--------------|------|------|
| 必須フィールドの欠落 | parser (Zod) | 単一ファイル内で完結 |
| 型の不一致（string が number 等） | parser (Zod) | 単一ファイル内で完結 |
| `given` 参照先 setup の存在確認 | validator | 全 setup を読み込んだ後でないと判定不可 |
| `navigates_to` 参照先 screen の存在確認 | validator | 全 screen を読み込んだ後でないと判定不可 |
| `screen` ID の重複 | validator | 複数ファイルにまたがる |

**注意点**: parser が Zod エラーを返した場合、validator を呼ぶ前に処理を停止する。Zod エラーがある状態でクロスファイルチェックを実行すると、型が不完全なオブジェクトを渡すことになりノイズが増える。

### commands/ 層の薄さの基準

**「commands/ に置く」もの**:
- `configPath` のデフォルト値解決（コマンドの文脈知識）
- `--screen` オプションによる Screen の絞り込み
- `--dry-run` の条件分岐（stdout か ファイル書き込みか）
- `process.exit()` の呼び出し
- core 関数の呼び出し順序

**「commands/ に置かない」もの**:
- YAML 構造の知識（→ schema.ts）
- 参照整合性チェックのロジック（→ validator.ts）
- テストコード文字列の生成（→ generator.ts）
- 出力フォーマット（→ output.ts）
- ファイル探索（→ parser.ts）

**判断基準**: 「このコードを見て、コマンドのオーケストレーション以外のことが分かるか？」— 分かるなら core に移す。

### core/ の純粋性（副作用禁止のルール）

**禁止される副作用**:

| 副作用の種類 | 禁止理由 | 例外 |
|------------|---------|------|
| `process.exit()` の呼び出し | テスト時に Vitest プロセスが終了する | なし |
| `console.log/error` への直接出力 | テストの stdout が汚染される | なし |
| ファイル書き込み | generator.ts は文字列を返すだけ | parser.ts はファイル読み込みは許可（I/O は不可避） |
| グローバル状態の変更 | テストの独立性が損なわれる | なし |

**parser.ts の扱い**: `core/parser.ts` はファイル読み込みという副作用を持つが、これは許容する。理由は、ファイルシステムアクセスの責務が parser 以外にはなく、commands/ 層に置くと commands/* が肥大化するため。テストは fixture ディレクトリを用いて副作用をコントロールする。

**generator.ts・validator.ts**: 純粋関数のみ。Vitest で `import` して直接呼び出せる。

---

## 3. 依存関係サマリー

```
cli.ts
  └─ commands/validate.ts
       ├─ core/parser.ts ──► core/schema.ts
       ├─ core/validator.ts ──► core/schema.ts
       └─ utils/output.ts

  └─ commands/generate.ts
       ├─ core/parser.ts ──► core/schema.ts
       ├─ core/validator.ts ──► core/schema.ts
       ├─ core/generator.ts ──► core/schema.ts
       └─ utils/output.ts
```

**禁止される依存**:
- `core/*` → `commands/*`（レイヤー逆転）
- `core/*` → `utils/output.ts`（core に副作用を持ち込む）
- `core/validator.ts` ↔ `core/generator.ts`（Feature 間の横依存）

---

## 4. テスト戦略サマリー

| モジュール | テスト種別 | 重点確認事項 |
|-----------|----------|------------|
| `core/schema.ts` | ユニット | デフォルト値補完、string/string[] 両形式 |
| `core/parser.ts` | ユニット（fixture 使用） | エラー全件収集、存在しないディレクトリ |
| `core/validator.ts` | ユニット（純粋関数） | ルールごとの独立検証、エラー全件収集 |
| `core/generator.ts` | スナップショット | type 別の出力構造、not_expect コメント |
| `commands/validate.ts` | 統合（fixture ディレクトリ） | exit コード、エラー/警告の出力 |
| `commands/generate.ts` | 統合（--dry-run） | 生成ファイル数、--screen 絞り込み |
| `utils/output.ts` | 不要（自明） | commands テストで副次的にカバー |
| `cli.ts` | 不要 | commander の E2E は commands/* でカバー |
