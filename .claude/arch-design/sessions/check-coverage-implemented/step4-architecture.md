# アーキテクチャ設計書: check-coverage & check-implemented

## 概要

tespec CLI に 2 つの新コマンドを追加する。既存の validate/generate パターンを踏襲し、最小限のモジュールで実現する。

---

## 新規ファイル一覧

```
src/
├── commands/
│   ├── check-coverage.ts       # テストファイル存在 + case 数チェック
│   └── check-implemented.ts    # テスト実装状況チェック
└── core/
    ├── coverage-checker.ts     # check-coverage のコアロジック
    └── impl-checker.ts         # check-implemented のコアロジック

tests/
├── integration/
│   ├── check-coverage.test.ts
│   └── check-implemented.test.ts
├── fixtures/
│   ├── check-coverage-ok/      # YAML + テストファイルが揃った fixture
│   ├── check-coverage-missing/ # テストファイルが不足した fixture
│   └── check-impl-todo/        # TODO マーカーが残った fixture
└── core/__test__/              # 既存の core テストディレクトリ
    ├── coverage-checker.test.ts
    └── impl-checker.test.ts
```

---

## 依存グラフ

```
commands/check-coverage.ts
  → core/parser.ts             (parseProject)
  → core/coverage-checker.ts   (新規)
  → utils/output.ts            (printOk, printWarning, printError)

commands/check-implemented.ts
  → core/impl-checker.ts       (新規)
  → utils/output.ts

core/coverage-checker.ts
  → core/schema.ts             (Screen, UnitSpec 型参照)
  → node:fs/promises           (readdir, readFile, access)

core/impl-checker.ts
  → node:fs/promises           (readdir, readFile)
```

循環依存: なし
外部依存追加: なし

---

## コマンド設計

### tespec check-coverage

```
tespec check-coverage -c docs/tespec/config.yaml --tests-dir tests/
```

**フラグ:**
| フラグ | 短縮 | 型 | デフォルト | 説明 |
|--------|------|-----|-----------|------|
| `--config` | `-c` | string | `./docs/tespec/config.yaml` | config.yaml パス |
| `--tests-dir` | `-d` | string | `./tests` | テストディレクトリ |

**処理フロー:**
1. `parseProject(configPath)` で YAML 仕様を取得
2. `checkCoverage(screens, units, testsDir)` を呼び出し
3. 結果を printOk/printWarning/printError で出力
4. エラーがあれば `this.exit(1)`

**出力例:**
```
OK:    screens/login.yaml → login.spec.ts (5/5 cases)
WARN:  screens/dashboard.yaml → dashboard.test.ts (3/5 cases)
ERROR: screens/signup.yaml → テストファイルが見つかりません
```

**exit code:** 0=全カバー / 1=ERROR あり

### tespec check-implemented

```
tespec check-implemented --tests-dir tests/
```

**フラグ:**
| フラグ | 短縮 | 型 | デフォルト | 説明 |
|--------|------|-----|-----------|------|
| `--tests-dir` | `-d` | string | `./tests` | テストディレクトリ |

**処理フロー:**
1. `checkImplemented(testsDir)` を呼び出し
2. テストファイルを走査して未実装テストを検出
3. 結果を printOk/printWarning で出力
4. 未実装があれば `this.exit(1)`

**出力例:**
```
OK:    login.spec.ts (5/5 implemented)
WARN:  dashboard.test.ts (2/5 implemented, 3 todo)
```

**exit code:** 0=全実装 / 1=未実装あり

---

## コアモジュール設計

### coverage-checker.ts

```typescript
// --- 型定義 ---
export interface CoverageIssue {
  level: 'ok' | 'warn' | 'error';
  specFile: string;       // "screens/login.yaml"
  testFile?: string;      // "login.spec.ts" (存在する場合)
  message: string;
}

export interface CoverageResult {
  issues: CoverageIssue[];
  hasErrors: boolean;
}

// --- メイン関数 ---
export async function checkCoverage(
  screens: Screen[],
  units: UnitSpec[],
  testsDir: string,
): Promise<CoverageResult>
```

**テストファイル探索ロジック (glob 全探索):**
```typescript
// テストファイルのパターン
const TEST_PATTERNS = /\.(spec|test)\.(ts|tsx|js|jsx)$|Tests\.swift$/;

// testsDir 配下を走査して全テストファイルを収集
// ファイル名の stem (login.spec.ts → login) で YAML ID とマッチ
async function collectTestFiles(testsDir: string): Promise<Map<string, string>>
// key: stem (例: "login"), value: フルパス

// Screen/Unit case 数のカウント
function countYamlCases(screen: Screen): number
// screen.cases.length を返す

function countYamlUnitCases(unit: UnitSpec): number
// unit.methods.flatMap(m => m.cases).length を返す

// テストファイル内の it()/test() カウント (正規表現)
async function countTestCases(filePath: string): Promise<number>
// /^\s*(it|test)\s*\(/gm でマッチ数をカウント
```

### impl-checker.ts

```typescript
// --- 型定義 ---
export interface ImplIssue {
  level: 'ok' | 'warn';
  file: string;           // "login.spec.ts"
  total: number;          // テスト総数
  implemented: number;    // 実装済み数
  message: string;
}

export interface ImplResult {
  issues: ImplIssue[];
  hasUnimplemented: boolean;
}

// --- メイン関数 ---
export async function checkImplemented(
  testsDir: string,
): Promise<ImplResult>
```

**未実装テスト検出 (正規表現):**
```typescript
// 未実装マーカー検出パターン
const TODO_MARKER = /\/\/\s*TODO:\s*implement/g;         // generate が埋めるマーカー
const TODO_TEST = /^\s*(it|test)\.todo\s*\(/gm;          // it.todo() / test.todo()
const SKIP_TEST = /^\s*(it|test)\.skip\s*\(/gm;          // it.skip() / test.skip()

// テストファイルを読んで未実装数をカウント
async function countUnimplemented(filePath: string): Promise<{total: number, unimplemented: number}>
```

---

## ADR (Architecture Decision Record)

### ADR-1: テストファイル探索方式

- **状況**: check-coverage がテストファイルを探す方法の選定
- **決定**: glob 全探索（ファイル名 stem で YAML ID とマッチ）
- **根拠**: --target フラグ不要でシンプル、generators/registry 依存ゼロ、複数 target 混在プロジェクトでも動作
- **棄却**: fileNameFor 経由（registry 依存 + --target フラグ重複が UX として冗長）

### ADR-2: JSON 出力

- **状況**: CI 連携のための出力フォーマット
- **決定**: 初回実装では省略
- **根拠**: 既存3コマンドに前例なし、YAGNI。具体的な CI 要求が来てから追加
- **影響**: exit code のみで CI 判定（0/1）

### ADR-3: コマンド分離

- **状況**: 1コマンド統合 vs 2コマンド分離
- **決定**: 2コマンド分離（check-coverage + check-implemented）
- **根拠**: 責務が明確に異なる（ファイル存在確認 vs 実装状況確認）、CI で独立した exit code を取得可能
- **棄却**: 1コマンド統合（入力データが異なるため結合の利点が薄い）

### ADR-4: 型共有化

- **状況**: CoverageIssue / ImplIssue を共通型にするか
- **決定**: 各ファイルに独立定義（共有化しない）
- **根拠**: 既存の validator.ts / unit-validator.ts が同一型を独立定義しているパターンを踏襲。3箇所程度の重複は許容範囲
