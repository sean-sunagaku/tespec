# e2e-spec 実装設計書

E2E の仕様を YAML で定義し、テストスケルトンを生成し、全テストが通るまで作り切るためのツール。

---

## 1. コンセプト

### 1.1 解決する課題

| 課題 | e2e-spec の解決策 |
|---|---|
| テストを後付けで書くと漏れが出る | YAML で先に仕様を定義してからコードを書く |
| 何がテスト済みで何が未実装か分からない | YAML の `status` フィールドで機械的に追跡 |
| E2E で全部テストすると遅い・壊れやすい | 3 層ピラミッド (unit/integration/e2e) に分離 |
| テストコードのスケルトンを毎回手で書くのが面倒 | YAML から自動生成 |
| AI にテストを書かせると仕様の全体像が見えない | YAML が正本なので AI は「何を書くべきか」が明確 |

### 1.2 ワークフロー

```
1. npx e2e-spec init          → test-plan.yaml を生成
2. YAML にケースを書く          → 仕様定義 (人間 or AI)
3. npx e2e-spec generate      → テストスケルトン生成
4. スケルトンの TODO を埋める    → テスト実装 (人間 or AI)
5. テスト実行                   → pnpm test / pnpm e2e
6. npx e2e-spec sync          → 結果を YAML に反映
7. npx e2e-spec status        → 未実装・失敗を確認
8. 4 に戻る (全 pass まで)
```

### 1.3 設計原則

- **YAML が正本**: テストコードは YAML から導出される。YAML にないテストは管理対象外
- **既存を壊さない**: 既存のテストファイルに追記するときは既存コードを一切変更しない
- **フレームワーク非依存**: テンプレートを差し替えれば vitest/jest/playwright/cypress に対応
- **AI フレンドリー**: AI が YAML を読んで「次に何を実装すべきか」を判断できる構造

---

## 2. CLI コマンド詳細

### 2.1 `e2e-spec init`

プロジェクトに `e2e-spec.config.yaml` と `test-plan.yaml` のテンプレートを生成する。

```bash
npx e2e-spec init [--dir <path>] [--framework <vitest|jest>] [--e2e <playwright|cypress>]
```

**引数:**

| フラグ | デフォルト | 説明 |
|---|---|---|
| `--dir` | `docs/test-plan` | YAML ファイルの出力先 |
| `--framework` | `vitest` | 単体/結合テストフレームワーク |
| `--e2e` | `playwright` | E2E テストフレームワーク |

**生成されるファイル:**

```
docs/test-plan/
├── e2e-spec.config.yaml     # 設定ファイル
└── test-plan.yaml            # テスト計画テンプレート
```

**e2e-spec.config.yaml:**

```yaml
version: 1
project: "my-project"

layers:
  unit:
    framework: "vitest"
    command: "pnpm test"
    file_pattern: "**/*.test.ts"
    spec_dir: "{source}/__tests__"
    spec_suffix: ".test.ts"
  integration:
    framework: "vitest"
    command: "pnpm test:integration"
    file_pattern: "**/*.integration.test.ts"
    spec_dir: "{source}/__tests__"
    spec_suffix: ".integration.test.ts"
  e2e:
    framework: "playwright"
    command: "pnpm e2e"
    file_pattern: "e2e/**/*.spec.ts"
    spec_dir: "e2e"
    spec_suffix: ".spec.ts"

# テスト計画ファイルのパス (複数可)
plans:
  - "docs/test-plan/test-plan.yaml"
```

**動作:**
1. `--dir` にディレクトリが存在しなければ作成
2. `e2e-spec.config.yaml` が既に存在すれば上書きしない (エラー or `--force`)
3. `test-plan.yaml` にサンプルケースを 3 件入れる (unit/integration/e2e 各 1 件)
4. 設定ファイルのパスを stdout に出力

---

### 2.2 `e2e-spec generate`

YAML の `status: not_implemented` のケースからテストスケルトンを生成する。

```bash
npx e2e-spec generate [--config <path>] [--dry-run] [--layer <unit|integration|e2e>]
```

**引数:**

| フラグ | デフォルト | 説明 |
|---|---|---|
| `--config` | `docs/test-plan/e2e-spec.config.yaml` | 設定ファイル |
| `--dry-run` | `false` | 生成内容を stdout に出力するだけで書き込まない |
| `--layer` | 全層 | 特定の層だけ生成 |

**動作:**

1. 設定ファイルを読む
2. `plans` に指定された YAML を全て読み込む
3. `status: not_implemented` のケースを抽出
4. `spec_file` ごとにグループ化
5. 各 `spec_file` について:
   a. ファイルが存在しない → 新規作成 (import + describe + test スケルトン)
   b. ファイルが存在する → 既存の case ID をスキャンし、未実装分だけ追記
6. 結果サマリを stdout に出力

**出力例:**

```
e2e-spec generate

  Found 12 not_implemented cases across 4 files.

  [NEW]    src/core/__tests__/prompt.test.ts         (3 cases)
  [NEW]    src/core/__tests__/layout.test.ts         (4 cases)
  [APPEND] src/routes/__tests__/gen.integration.test.ts (2 cases)
  [SKIP]   e2e/ui-flows.spec.ts                     (3 cases already present)

  Generated: 9 skeletons
  Skipped:   3 (already in code)
```

**スケルトン生成ルール:**

| ルール | 説明 |
|---|---|
| case ID プレフィックス | テスト名に必ず `U-PROMPT-001:` のようなプレフィックスを付ける |
| 1 assertion = 1 test | assertions 配列の各項目が独別の `test()` になる |
| describe グループ | 同じ `target.symbol` は同じ `describe` にまとめる |
| TODO マーカー | テスト本体は `// TODO: implement` のみ |
| import 自動推定 | `target.file` と `spec_file` から相対パスを計算 |
| depends_on コメント | 依存する case ID をコメントで明記 |

---

### 2.3 `e2e-spec status`

YAML とテストコードの実装状況を突き合わせて表示する。

```bash
npx e2e-spec status [--config <path>] [--format <table|json|yaml>]
```

**引数:**

| フラグ | デフォルト | 説明 |
|---|---|---|
| `--config` | `docs/test-plan/e2e-spec.config.yaml` | 設定ファイル |
| `--format` | `table` | 出力形式 |

**動作:**

1. YAML の全ケースを読む
2. 各ケースの `spec_file` を読み、case ID の存在を正規表現でチェック
3. 以下の 4 状態に分類:
   - **not_implemented**: YAML にあるがコードに case ID がない
   - **implemented**: コードに case ID があるが `// TODO` が残っている
   - **pass**: YAML の status が `pass`
   - **fail**: YAML の status が `fail`
4. 層別のサマリを表示

**出力例 (table):**

```
e2e-spec status

  Layer         Total  Pass  Fail  Impl  Not Impl
  ─────────────────────────────────────────────────
  unit           18    12     1     3      2
  integration    14     8     0     4      2
  e2e             5     3     0     1      1
  ─────────────────────────────────────────────────
  Total          37    23     1     8      5

  Failed:
    U-HTML-005  src/core/__tests__/html.test.ts  "sanitizeHtml: script タグ除去"

  Not implemented:
    U-GEN-005   src/core/__tests__/generation.test.ts
    U-GEN-006   src/core/__tests__/generation.test.ts
    I-RETRY-002 src/routes/__tests__/cards.integration.test.ts
    I-SS-006    src/routes/__tests__/screenshots.integration.test.ts
    E-FLOW-005  e2e/ui-flows.spec.ts
```

**出力例 (json):**

```json
{
  "summary": {
    "total": 37,
    "pass": 23,
    "fail": 1,
    "implemented": 8,
    "not_implemented": 5
  },
  "by_layer": {
    "unit": { "total": 18, "pass": 12, "fail": 1, "implemented": 3, "not_implemented": 2 },
    "integration": { "total": 14, "pass": 8, "fail": 0, "implemented": 4, "not_implemented": 2 },
    "e2e": { "total": 5, "pass": 3, "fail": 0, "implemented": 1, "not_implemented": 1 }
  },
  "cases": [...]
}
```

---

### 2.4 `e2e-spec sync`

テスト実行結果を読み取り、YAML の `status` を更新する。

```bash
npx e2e-spec sync [--config <path>] [--result <path>]
```

**引数:**

| フラグ | デフォルト | 説明 |
|---|---|---|
| `--config` | `docs/test-plan/e2e-spec.config.yaml` | 設定ファイル |
| `--result` | 自動検出 | テスト結果 JSON のパス |

**動作:**

1. テスト結果を読み込む (対応形式は下記)
2. テスト名から case ID を正規表現 `/(U|I|E)-[A-Z]+-\d{3}/` で抽出
3. YAML の該当ケースの `status` を更新:
   - テスト pass → `status: pass`
   - テスト fail → `status: fail`
   - case ID がテスト結果に存在しない → 変更しない
4. YAML を書き戻す (コメントは preserveするよう yaml ライブラリの設定で対応)

**対応テスト結果形式:**

| フレームワーク | 結果ファイル | 取得方法 |
|---|---|---|
| vitest | `vitest.json` | `vitest --reporter=json --outputFile=vitest.json` |
| jest | `jest.json` | `jest --json --outputFile=jest.json` |
| playwright | `playwright.json` | `playwright test --reporter=json` |

**結果ファイルの自動検出:**

`--result` を省略した場合、以下の順で探す:
1. `vitest.json` (cwd)
2. `test-results/results.json` (playwright デフォルト)
3. `jest.json` (cwd)

---

### 2.5 `e2e-spec validate`

YAML のフォーマットを検証する。CI で使う想定。

```bash
npx e2e-spec validate [--config <path>]
```

**チェック項目:**

| チェック | エラーレベル |
|---|---|
| case ID の形式が正しいか | error |
| case ID が重複していないか | error |
| layer が `unit` / `integration` / `e2e` のいずれかか | error |
| spec_file のパスが存在するか (status が not_implemented 以外の場合) | warning |
| depends_on の参照先が存在するか | error |
| assertions が空でないか | warning |
| status の値が有効か | error |
| 循環依存がないか | error |

**exit code:**
- `0`: エラーなし
- `1`: error が 1 件以上

---

## 3. YAML スキーマ詳細

### 3.1 test-plan.yaml

```yaml
version: 1  # スキーマバージョン

cases:
  - id: "U-PROMPT-001"              # 必須: ユニーク ID
    layer: "unit"                    # 必須: "unit" | "integration" | "e2e"
    title: "空文字はエラー"           # 必須: 人間向け説明
    target:                          # 任意: テスト対象
      file: "src/core/prompt.ts"     #   ソースファイル
      symbol: "buildPrompt"          #   関数名 / route パス
    spec_file: "src/core/__tests__/prompt.test.ts"  # 必須: テストファイルパス
    depends_on: []                   # 任意: 前提 case ID
    status: "not_implemented"        # 必須: テスト状態
    procedures: []                   # 任意: 共通手順 ID (e2e 用)
    assertions:                      # 必須: 検証項目 (1 つ以上)
      - "空文字 → err(VALIDATION)"
```

### 3.2 case ID 命名規則

```
{層プレフィックス}-{ドメイン}-{連番3桁}

層プレフィックス:
  U = unit
  I = integration
  E = e2e

ドメイン:
  自由だが、プロジェクトのモジュール名に対応させる
  例: PROMPT, LAYOUT, CARD, HTML, GEN, PROJ, FLOW
```

### 3.3 status

| 値 | 意味 | 遷移元 |
|---|---|---|
| `not_implemented` | YAML に書いたがテストコードがない | (初期値) |
| `implemented` | テストコードはあるが実行未確認 | `not_implemented` |
| `pass` | 最後の実行で成功 | `implemented`, `fail` |
| `fail` | 最後の実行で失敗 | `implemented`, `pass` |
| `skip` | 意図的にスキップ | どこからでも |

### 3.4 Zod スキーマ定義

```typescript
import { z } from "zod";

const CaseIdPattern = /^(U|I|E)-[A-Z]+-\d{3}$/;

const LayerEnum = z.enum(["unit", "integration", "e2e"]);

const StatusEnum = z.enum([
  "not_implemented",
  "implemented",
  "pass",
  "fail",
  "skip",
]);

const TargetSchema = z.object({
  file: z.string(),
  symbol: z.string(),
}).optional();

const TestCaseSchema = z.object({
  id: z.string().regex(CaseIdPattern, "Invalid case ID format"),
  layer: LayerEnum,
  title: z.string().min(1),
  target: TargetSchema,
  spec_file: z.string().min(1),
  depends_on: z.array(z.string()).default([]),
  status: StatusEnum.default("not_implemented"),
  procedures: z.array(z.string()).default([]),
  assertions: z.array(z.string()).min(1),
});

const TestPlanSchema = z.object({
  version: z.literal(1),
  cases: z.array(TestCaseSchema),
});
```

---

## 4. Generator エンジン詳細

### 4.1 全体フロー

```
YAML cases
  ↓ filter (status === "not_implemented")
  ↓ groupBy (spec_file)
  ↓ for each group:
      ↓ spec_file exists?
      ├── NO  → createNewFile(cases, config)
      └── YES → extractExistingIds(file)
               ↓ filter (新規 case のみ)
               ↓ appendToFile(file, newCases, config)
```

### 4.2 テンプレートシステム

テンプレートは TypeScript の関数として実装する。
設定ファイルの `framework` / `e2e` に応じて使い分ける。

```typescript
interface TemplateContext {
  cases: TestCase[];
  importPath: string;       // target.file → spec_file の相対パス
  symbols: string[];        // import する関数名
  framework: string;        // "vitest" | "jest"
}

interface Template {
  /** ファイル全体を新規生成 */
  createFile(ctx: TemplateContext): string;

  /** 既存ファイルに追記するスニペット */
  appendSnippet(cases: TestCase[]): string;
}
```

### 4.3 ビルトインテンプレート

**vitest (unit/integration):**

```typescript
// 新規ファイル
import { describe, expect, test } from "vitest";
import { buildPrompt } from "../prompt";

describe("buildPrompt", () => {
  // U-PROMPT-001: 空文字 prompt はバリデーションエラー
  test("U-PROMPT-001: 空文字 → err(VALIDATION)", () => {
    // TODO: implement
  });
});
```

**playwright (e2e):**

```typescript
import { expect, test } from "@playwright/test";

test.describe("UI 操作フロー", () => {
  // E-FLOW-001: 生成してカードが表示される
  // procedures: PROC-01, PROC-02
  test("E-FLOW-001: 生成 → カード表示", async ({ page, request }) => {
    // TODO: implement
  });
});
```

### 4.4 カスタムテンプレート

ユーザーが独自テンプレートを指定できる。

```yaml
# e2e-spec.config.yaml
layers:
  unit:
    framework: "vitest"
    template: "./templates/my-unit-template.ts"  # カスタム
```

カスタムテンプレートは `Template` インターフェースを実装した default export:

```typescript
// templates/my-unit-template.ts
import type { Template, TemplateContext } from "e2e-spec";

export default {
  createFile(ctx) { return "..."; },
  appendSnippet(cases) { return "..."; },
} satisfies Template;
```

---

## 5. Analyzer 詳細

### 5.1 Coverage Analyzer

case ID とテストコードの突き合わせを行う。

```typescript
interface CoverageResult {
  caseId: string;
  layer: string;
  yamlStatus: Status;
  codeStatus: "missing" | "has_todo" | "implemented";
  specFile: string;
  lineNumber: number | null;  // コード上の行番号
}
```

**判定ロジック:**

```
spec_file が存在しない → codeStatus = "missing"
spec_file に case ID がない → codeStatus = "missing"
spec_file に case ID があるが "// TODO" が同ブロックにある → codeStatus = "has_todo"
spec_file に case ID があり "// TODO" がない → codeStatus = "implemented"
```

### 5.2 Status Updater

テストランナーの JSON 出力を読み取り、YAML を更新する。

**vitest JSON の構造:**

```json
{
  "testResults": [
    {
      "name": "/abs/path/to/prompt.test.ts",
      "assertionResults": [
        {
          "fullName": "buildPrompt > U-PROMPT-001: 空文字 → err(VALIDATION)",
          "status": "passed"
        }
      ]
    }
  ]
}
```

**playwright JSON の構造:**

```json
{
  "suites": [
    {
      "specs": [
        {
          "title": "E-FLOW-001: 生成 → カード表示",
          "ok": true
        }
      ]
    }
  ]
}
```

**パーサー:**

各フレームワークの JSON 構造から case ID と pass/fail を抽出するアダプタを持つ。

```typescript
interface TestResult {
  caseId: string;
  passed: boolean;
  duration?: number;
  errorMessage?: string;
}

interface ResultParser {
  parse(jsonPath: string): TestResult[];
}
```

---

## 6. ライブラリ API

CLI とは別にプログラムから呼べる API を export する。
AI エージェントがスクリプトとして組み込む用途を想定。

```typescript
// e2e-spec のパブリック API

export { TestPlanSchema, TestCaseSchema } from "./schema/test-plan";
export type { TestCase, TestPlan, Status, Layer } from "./schema/types";

/** YAML を読んでバリデーション済みの TestPlan を返す */
export function loadPlan(yamlPath: string): TestPlan;

/** 設定ファイルを読む */
export function loadConfig(configPath?: string): Config;

/** not_implemented のケースからスケルトンを生成 (ファイル書き込みなし) */
export function generateSkeletons(plan: TestPlan, config: Config): GeneratedFile[];

/** スケルトンをファイルに書き出す */
export function writeSkeletons(files: GeneratedFile[]): WriteResult;

/** YAML とコードの突き合わせ */
export function analyzeCoverage(plan: TestPlan, config: Config): CoverageResult[];

/** テスト結果を YAML に反映 */
export function syncResults(plan: TestPlan, results: TestResult[]): TestPlan;

/** YAML をバリデーション */
export function validatePlan(plan: TestPlan): ValidationResult;
```

---

## 7. エラーハンドリング

### 7.1 CLI のエラー

| 状況 | 動作 |
|---|---|
| 設定ファイルが見つからない | エラーメッセージ + `e2e-spec init` を提案 |
| YAML パースエラー | 行番号付きのエラーメッセージ |
| Zod バリデーションエラー | フィールド名 + 期待値 + 実際の値 |
| case ID 重複 | 重複 ID と出現箇所を全て表示 |
| depends_on の参照先が不在 | 不在の case ID とそれを参照しているケースを表示 |
| spec_file のディレクトリが存在しない | 自動作成 (mkdir -p 相当) |

### 7.2 exit code

| code | 意味 |
|---|---|
| 0 | 成功 |
| 1 | バリデーションエラー / テスト失敗 |
| 2 | 設定ファイルが見つからない |

---

## 8. 将来の拡張 (v2 以降)

### 8.1 `e2e-spec scan`

ソースコードを静的解析して、テスト対象を自動で洗い出し YAML に追記する。

```bash
npx e2e-spec scan --src src/core
```

- export されている関数 → unit ケース候補
- route 定義 → integration ケース候補
- `assertions` は空 (人間が埋める)

### 8.2 `e2e-spec watch`

テスト実行を watch し、リアルタイムで YAML の status を更新する。

### 8.3 プラグインシステム

テンプレートだけでなく、パーサーや analyzer もプラグインとして差し替え可能にする。

```yaml
# e2e-spec.config.yaml
plugins:
  - "e2e-spec-plugin-cypress"
  - "e2e-spec-plugin-jest"
```

### 8.4 GitHub Actions 連携

PR に「テスト実装状況」をコメントする GitHub Action。

```yaml
# .github/workflows/e2e-spec.yaml
- run: npx e2e-spec status --format json > status.json
- uses: e2e-spec/action@v1
  with:
    status-file: status.json
```

### 8.5 AI エージェント向け指示生成

```bash
npx e2e-spec next --format prompt
```

次に実装すべきケースを、AI へのプロンプト形式で出力する:

```
次の 3 ケースを実装してください。

## U-PROMPT-001: 空文字 prompt はバリデーションエラー
- ファイル: src/core/__tests__/prompt.test.ts
- 対象: src/core/prompt.ts の buildPrompt
- assertions:
  - 空文字 → err(VALIDATION)
  - 空白のみ → err(VALIDATION)
```

---

## 9. テスト戦略 (e2e-spec 自体のテスト)

### 9.1 Unit テスト

| 対象 | テスト内容 |
|---|---|
| `yaml-parser.ts` | YAML → TestPlan パース + バリデーション |
| `test-plan.ts` (Zod) | 正常/異常入力のスキーマ検証 |
| `unit.ts` (generator) | YAML → vitest スケルトン文字列 |
| `integration.ts` (generator) | YAML → vitest integration スケルトン文字列 |
| `e2e.ts` (generator) | YAML → playwright スケルトン文字列 |
| `coverage.ts` | case ID 突き合わせロジック |
| `status-updater.ts` | vitest/playwright JSON → status 更新 |

### 9.2 Integration テスト

| 対象 | テスト内容 |
|---|---|
| `generate` コマンド | fixture YAML → 実ファイル生成 → 内容検証 |
| `status` コマンド | fixture YAML + fixture spec → 正しい集計 |
| `sync` コマンド | fixture YAML + fixture 結果 JSON → YAML 更新検証 |
| `validate` コマンド | 正常/異常 YAML → exit code 検証 |

### 9.3 E2E テスト (dogfooding)

**e2e-spec 自体の test-plan.yaml を e2e-spec で管理する。**

```bash
# e2e-spec 自体のテスト計画を生成
npx tsx src/cli.ts init --dir test/fixtures/dogfood
npx tsx src/cli.ts generate --config test/fixtures/dogfood/e2e-spec.config.yaml
npx tsx src/cli.ts status --config test/fixtures/dogfood/e2e-spec.config.yaml
```

---

## 10. パッケージ構成 (最終)

```
e2e-spec/
├── package.json
├── tsconfig.json
├── tsup.config.ts              # ビルド設定
├── README.md
├── LICENSE (MIT)
│
├── src/
│   ├── index.ts                # ライブラリ API エクスポート
│   ├── cli.ts                  # bin エントリ (commander)
│   │
│   ├── schema/
│   │   ├── test-plan.ts        # Zod スキーマ
│   │   ├── config.ts           # 設定ファイル Zod スキーマ
│   │   └── types.ts            # 型定義
│   │
│   ├── parser/
│   │   ├── yaml-parser.ts      # YAML 読み込み + バリデーション
│   │   └── result-parser/
│   │       ├── index.ts        # パーサー振り分け
│   │       ├── vitest.ts       # vitest JSON パーサー
│   │       ├── jest.ts         # jest JSON パーサー
│   │       └── playwright.ts   # playwright JSON パーサー
│   │
│   ├── generator/
│   │   ├── index.ts            # 層に応じた振り分け
│   │   ├── skeleton.ts         # 共通スケルトン生成ロジック
│   │   └── file-writer.ts      # ファイル書き出し (新規/追記)
│   │
│   ├── analyzer/
│   │   ├── coverage.ts         # case ID ↔ コード突き合わせ
│   │   └── status-updater.ts   # 結果 → YAML status 更新
│   │
│   └── templates/
│       ├── types.ts            # Template インターフェース
│       ├── vitest.ts           # vitest テンプレート
│       ├── playwright.ts       # playwright テンプレート
│       └── jest.ts             # jest テンプレート
│
├── templates/
│   ├── test-plan.yaml          # init 用テンプレート
│   └── config.yaml             # init 用設定テンプレート
│
└── test/
    ├── schema/
    │   └── test-plan.test.ts
    ├── parser/
    │   ├── yaml-parser.test.ts
    │   └── result-parser.test.ts
    ├── generator/
    │   ├── skeleton.test.ts
    │   └── file-writer.test.ts
    ├── analyzer/
    │   ├── coverage.test.ts
    │   └── status-updater.test.ts
    └── fixtures/
        ├── sample-plan.yaml
        ├── vitest-result.json
        └── playwright-result.json
```

---

## 11. 依存パッケージ

| パッケージ | 用途 | バージョン |
|---|---|---|
| `yaml` | YAML パース (コメント保持対応) | ^2.x |
| `zod` | スキーマバリデーション | ^3.x |
| `commander` | CLI フレームワーク | ^12.x |
| `picocolors` | ターミナル色付き出力 | ^1.x |

devDependencies:

| パッケージ | 用途 |
|---|---|
| `tsup` | ビルド (ESM + CJS) |
| `vitest` | テスト |
| `typescript` | 型チェック |

---

## 12. npm publish 設定

```json
{
  "name": "e2e-spec",
  "version": "0.1.0",
  "description": "Define E2E specs in YAML. Generate test skeletons. Build until all pass.",
  "keywords": ["testing", "e2e", "yaml", "test-plan", "skeleton", "tdd", "spec"],
  "license": "MIT",
  "bin": {
    "e2e-spec": "./dist/cli.js"
  },
  "main": "./dist/index.js",
  "module": "./dist/index.mjs",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "files": [
    "dist",
    "templates"
  ],
  "engines": {
    "node": ">=18"
  }
}
```
