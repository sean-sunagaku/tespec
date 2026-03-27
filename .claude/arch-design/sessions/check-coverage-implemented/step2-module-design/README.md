# Step 2: モジュール設計 - 型定義と関数シグネチャ（確定版）

## 確定した前提

- **テストファイル探索**: glob 全探索（`*.spec.ts`, `*.test.ts`, `*Tests.swift`）
- **マッチング**: ファイル名 stem で YAML ID と照合（XCTest は `LoginTests` ↔ `login` 変換）
- **`--target` フラグ**: 不要（glob が全パターンを拾う）
- **registry 依存**: ゼロ

---

## coverage-checker.ts

### 公開型

```typescript
import type { ParsedProject } from './parser.js';

export interface CoverageIssue {
  type: 'missing-test' | 'count-mismatch' | 'orphan-test';
  specId: string;      // screen/unit ID（orphan-test 時はファイル stem）
  testFile: string;    // テストファイルのパス（missing-test 時は空文字）
  expected?: number;   // YAML case 数（count-mismatch 時のみ）
  actual?: number;     // テストファイル内 it()/test() 数（count-mismatch 時のみ）
}

export interface CoverageResult {
  issues: CoverageIssue[];
}
```

### 公開関数

```typescript
export async function checkCoverage(
  project: ParsedProject,
  testsDir: string,
): Promise<CoverageResult>
```

`--target` フラグ不要。glob で `*.spec.ts`, `*.test.ts`, `*Tests.swift` を全スキャン。

### マッチングロジック（内部）

```typescript
// stem 抽出: "login.spec.ts" → "login", "LoginTests.swift" → "LoginTests"
function extractStem(fileName: string): string {
  return fileName.replace(/\.(spec|test)\.tsx?$/, '').replace(/\.swift$/, '');
}

// XCTest 変換: "login-page" → "LoginPageTests"
function toSwiftStem(id: string): string {
  return id.split('-').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join('') + 'Tests';
}

// ID に対応する候補 stem 一覧（どれかが見つかれば OK）
function candidateStems(id: string): string[] {
  return [id, toSwiftStem(id)];
}
```

### it()/test() カウント（内部）

```typescript
// it.todo() / it.skip() も含めてカウント（実装状態は check-implemented が担当）
const TESTCASE_PATTERN = /^\s*(?:it|test)\s*[.(]/mg;

async function countTestCases(filePath: string): Promise<number>
```

### orphan-test 判定

```
全テストファイルの stem 集合 - マッチ済み stem 集合 = orphan
```

orphan は **warning 扱い**（exit code 影響なし）。orphan は YAML 管理漏れであり実装漏れではないため。

---

## impl-checker.ts

### 公開型

```typescript
export interface ImplIssue {
  testFile: string;
  line: number;
  type: 'todo-marker' | 'todo-call' | 'skip-call';
  text: string;  // 該当行の内容（trimmed）
}

export interface ImplResult {
  issues: ImplIssue[];
  totalTests: number;       // 全 it()/test() 数（todo/skip 含む）
  implementedTests: number; // totalTests - issues.length
}
```

### 公開関数

```typescript
export async function checkImplemented(
  testsDir: string,
): Promise<ImplResult>
```

`ParsedProject` 不要。テストディレクトリを直接スキャン。

### 検出パターン

| type | 正規表現 | 例 |
|------|----------|-----|
| `todo-marker` | `/\/\/\s*TODO:\s*implement/i` | `// TODO: implement` |
| `todo-call` | `/^\s*(?:it\|test)\.todo\s*\(/m` | `it.todo('...')` |
| `skip-call` | `/^\s*(?:it\|test)\.skip\s*\(\|^\s*x(?:it\|test)\s*\(/m` | `it.skip('...')`, `xit('...')` |

`totalTests` は `it()/test()` 全呼び出し（`/^\s*(?:it|test)\s*[.(]/mg`）でカウント。
`implementedTests = totalTests - issues.length`

---

## コマンドフラグ（確定版）

### check-coverage.ts

```typescript
static flags = {
  config: Flags.string({
    char: 'c',
    description: 'Path to tespec config.yaml',
  }),
  'tests-dir': Flags.string({
    description: 'Directory to scan for test files',
    default: './tests',
  }),
};
// --target フラグなし
```

### check-implemented.ts

```typescript
static flags = {
  'tests-dir': Flags.string({
    description: 'Directory to scan for test files',
    default: './tests',
  }),
};
```

---

## 依存グラフ（確定版）

```
commands/check-coverage.ts
  → core/parser.ts              (parseProject, ParsedProject)
  → core/coverage-checker.ts   (checkCoverage, CoverageResult, CoverageIssue)
  → utils/output.ts

commands/check-implemented.ts
  → core/impl-checker.ts        (checkImplemented, ImplResult, ImplIssue)
  → utils/output.ts

core/coverage-checker.ts
  → core/parser.ts              (ParsedProject 型のみ)
  → node:fs/promises
  → node:path

core/impl-checker.ts
  → node:fs/promises
  → node:path
```

registry 依存: **ゼロ**

---

## exit code セマンティクス

| コマンド | exit 0 | exit 1 |
|---------|--------|--------|
| check-coverage | issues が空（orphan は除く）| missing-test / count-mismatch が1件以上 |
| check-implemented | issues が空（全実装）| issues が1件以上 |

orphan-test は warning（exit code 影響なし）。

---

## 出力フォーマット例

### check-coverage（全カバー）
```
OK:    login.spec.ts (3 cases)
OK:    home.test.ts (5 cases)
All 2 specs covered.
```

### check-coverage（問題あり）
```
OK:    login.spec.ts (3 cases)
ERROR: home: テストファイルが見つかりません
WARN:  login.spec.ts: case 数不一致 (YAML: 3, test: 2)
WARN:  orphan.spec.ts: 対応する YAML spec がありません
1 missing, 1 mismatch, 1 orphan.
```

### check-implemented（全実装）
```
All 8 tests implemented (8/8).
```

### check-implemented（未実装あり）
```
ERROR: tests/login.spec.ts:15: // TODO: implement
ERROR: tests/home.test.ts:22: it.todo('should redirect')
2 unimplemented tests (6/8 implemented).
```
