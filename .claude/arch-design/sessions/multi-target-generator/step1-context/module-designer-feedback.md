# Module Designer フィードバック
# 既存コード分析: モジュール分割観点

分析対象:
- `src/core/generator.ts`
- `src/core/schema.ts`
- `src/commands/generate.ts`

---

## 1. generator.ts の関数分類

### フレームワーク固有（Playwright 依存）

| 関数 | 理由 |
|------|------|
| `generateTestFile` (インポート行) | `import { test, expect } from "@playwright/test"` がハードコード |
| `renderNestedGroup` | `test.describe(...)` という Playwright API を直接出力 |
| `renderCaseGroup` | `renderCase` を呼び出すだけだが、Playwright 固有の Case 構造を前提 |
| `renderCase` | `test(...)`, `async () => {}` は Playwright のテスト記法 |

### 共通（フレームワーク非依存）

| 関数 | 理由 |
|------|------|
| `buildTestName` | テスト名文字列を構築するロジック。フレームワーク無関係 |
| `buildComments` | `given`, `steps`, `not_expect` からコメント行を生成。構造は汎用 |
| `indentOf` | インデント文字列生成。完全汎用 |
| `quote` | `JSON.stringify` によるクォート。完全汎用 |

---

## 2. generateTestFile のシグネチャは共通インターフェースとして使えるか

**使える。ただし型の扱いに注意。**

```ts
// 推奨する共通インターフェース
export interface FrameworkGenerator {
  generateTestFile(screen: Screen, setups: Setup[]): string;
  fileExtension: string; // ".spec.ts" | ".swift" など
}
```

`(screen: Screen, setups: Setup[]) => string` のシグネチャ自体は各フレームワーク generator が実装すべき共通契約として適切。`Screen` と `Setup` は `schema.ts` で定義されており、フレームワーク非依存なので引数型の変更は不要。

---

## 3. ユーティリティの配置

### 推奨配置: `src/core/generator-utils.ts`（新規）

対象: `buildTestName`, `buildComments`, `indentOf`, `quote`

**理由:**
- `buildTestName` / `buildComments` は XCUITest でも「テスト名」「コメント行」の概念は共通で再利用可能
- `indentOf` / `quote` は純粋ユーティリティで複数 generator から参照される
- `src/utils/` はすでに `output.ts` があるが、generator 固有のビルドロジックを汎用 utils に置くのは責務が混ざるため避ける

### 代替案: `src/core/generators/shared.ts`

generators/ ディレクトリを作るなら `shared.ts` に置くのも自然。どちらでも可。

---

## 4. generate.ts のフレームワーク固有部分

### フレームワーク固有

| 箇所 | 内容 |
|------|------|
| L82: ファイル名生成 | `${output.screenId}.spec.ts` — 拡張子 `.spec.ts` は Playwright 慣習 |
| L90: writeFile のパス | 同上 |
| L6: import | `generateTestFile` を直接 import（特定 generator に固定） |
| `static summary` | `'Generate Playwright skeletons from tespec YAML'` という説明文 |

### 共通のままでよい部分

- `--out-dir`, `--screen`, `--dry-run`, `--config` フラグ
- `parseProject`, `validate` の呼び出しフロー
- dry-run 時の `this.log` 出力
- `printError` / `printWarning` / `printSuccess` の使い方

---

## 5. 推奨モジュール構成（registry/plugin パターン）

```
src/
  core/
    schema.ts             (変更なし)
    parser.ts             (変更なし)
    validator.ts          (変更なし)
    generator-utils.ts    (新規: buildTestName, buildComments, indentOf, quote)
    generators/
      types.ts            (新規: FrameworkGenerator インターフェース定義)
      registry.ts         (新規: フレームワーク名 → generator のマップ)
      playwright.ts       (既存 generator.ts をリネーム・分離)
      xcuitest.ts         (新規)
  commands/
    generate.ts           (修正: --framework フラグ追加, registry 経由で generator を解決)
```

### types.ts の核心

```ts
export interface FrameworkGenerator {
  generateTestFile(screen: Screen, setups: Setup[]): string;
  fileExtension: string;   // e.g. ".spec.ts", ".swift"
  fileNameFor(screenId: string): string; // e.g. "login.spec.ts", "LoginTests.swift"
}
```

`fileNameFor` を interface に含めることで、generate.ts 側はフレームワーク固有のファイル名規則を知らなくて済む。

### registry.ts のシンプルな実装例

```ts
import type { FrameworkGenerator } from './types.js';
import { PlaywrightGenerator } from './playwright.js';
import { XCUITestGenerator } from './xcuitest.js';

const registry = new Map<string, FrameworkGenerator>([
  ['playwright', new PlaywrightGenerator()],
  ['xcuitest', new XCUITestGenerator()],
]);

export function getGenerator(framework: string): FrameworkGenerator {
  const gen = registry.get(framework);
  if (!gen) throw new Error(`Unknown framework: ${framework}`);
  return gen;
}

export const availableFrameworks = [...registry.keys()];
```

新フレームワーク追加時は registry.ts に1エントリ追加するだけでコア変更不要。

---

## 6. generate.ts の修正方針

```ts
// 追加するフラグ
'framework': Flags.string({
  char: 'f',
  description: 'Target test framework',
  options: availableFrameworks,
  default: 'playwright',
}),
```

ファイル名生成部分:
```ts
// Before
`${output.screenId}.spec.ts`

// After
generator.fileNameFor(output.screenId)
```

---

## 7. 懸念点・要確認事項

1. **XCUITest のネスト構造**: Playwright は `test.describe` のネストだが、XCUITest は Swift の class/func 構造。`renderNestedGroup` 相当のロジックは各 generator 内で独自実装になる。共通化しすぎると無理が生じる。
2. **インデント幅**: Swift は4スペース慣習。`indentOf` を共通化する場合、インデント文字列をパラメータ化するか、generator ごとにオーバーライドできる設計にする必要がある。
3. **`--framework` のデフォルト値**: 既存ユーザーへの後方互換性を考えると `default: 'playwright'` が安全。

---

## 8. 追加分析（team-lead からの依頼）

### 8-1. buildTestName は本当に共通化できるか

**結論: 部分的にしか共通化できない。分割を推奨する。**

現在の `buildTestName` が行っていること:
- `action → expect[0]` の文字列結合
- `given` が存在する場合の `[given1, given2] action → expect` 形式

これは「テスト名の _意味論_」であり、フレームワーク非依存。ただし XCUITest で問題になるのは **Swift のメソッド名制約**:

```swift
// Swift: func 名に使えない文字
func testログイン → 成功() {}  // コンパイルエラー
```

Swift のテストメソッド名は `[a-zA-Z0-9_]` のみ使用可能（XCTest の命名規約）。
そのため XCUITest generator では以下の sanitize が追加で必要:
- 日本語・記号を除去またはローマ字変換
- スペースや `→` を `_` に置換
- 先頭に `test` プレフィックスを付加

**推奨設計:**

```ts
// generator-helpers.ts に残すもの（フレームワーク非依存のロジック）
export function buildTestLabel(testCase: Case): string {
  // action + expect + given の意味論的な組み立てのみ
  const expectation = Array.isArray(testCase.expect) ? testCase.expect[0] : testCase.expect;
  const title = `${testCase.action} → ${expectation}`;
  if (testCase.type === 'normal' || typeof testCase.given === 'undefined') return title;
  const givenValues = Array.isArray(testCase.given) ? testCase.given : [testCase.given];
  return `[${givenValues.join(', ')}] ${title}`;
}

// 各 generator が buildTestLabel を受け取り、フレームワーク固有の変換をかける
// playwright.ts: buildTestLabel をそのまま使う
// xcuitest.ts: sanitizeSwiftMethodName(buildTestLabel(testCase)) を使う
```

関数名を `buildTestName` → `buildTestLabel` に変えることで「表示用ラベル」であり最終的なメソッド名ではないことを明示する。

---

### 8-2. generators/ ディレクトリ vs フラットな generator-*.ts

**結論: このプロジェクト規模ではフラット構成で十分。ただし types.ts だけは分離する。**

現在のプロジェクトの `src/core/` には:
- `generator.ts`
- `parser.ts`
- `schema.ts`
- `validator.ts`

の4ファイル。ここに `generators/` サブディレクトリを作ると import パスが深くなり（`../../core/generators/registry.js`）、小規模プロジェクトでは逆に見通しが悪くなる。

**推奨: フラット構成**

```
src/core/
  schema.ts
  parser.ts
  validator.ts
  generator-helpers.ts    ← 共通ロジック（buildTestLabel, buildComments 等）
  generator-types.ts      ← FrameworkGenerator インターフェース（単独分離）
  generator-registry.ts   ← Map + getGenerator()
  generator-playwright.ts ← 既存 generator.ts をリネーム
  generator-xcuitest.ts   ← 新規
  generator.ts            ← 後方互換 re-export のみ
```

`generator-` プレフィックスで統一することで:
- ディレクトリを掘らずにグループが自明
- import は常に `../core/generator-*.js` の形で深さが揃う
- ファイル数が増えたら（4フレームワーク以上）その時点でサブディレクトリ化を判断すれば良い

ディレクトリ分割するのは「generator ファイルが5個以上になったとき」が適切な閾値。

---

### 8-3. fileExtension だけで十分か、outputFileName が必要か

**結論: `outputFileName(screenId: string): string` をインターフェースに含めるべき。**

`fileExtension` だけでは対応できないケース:

| フレームワーク | screenId | 期待するファイル名 | 理由 |
|---|---|---|---|
| Playwright | `login-screen` | `login-screen.spec.ts` | ハイフンそのまま |
| XCUITest | `login-screen` | `LoginScreenTests.swift` | PascalCase + Tests サフィックス |
| Jest (将来) | `login-screen` | `login-screen.test.ts` | `.test.ts` サフィックス |

`fileExtension` のみの場合、generate.ts 側で以下のような条件分岐が生まれる:

```ts
// Bad: generate.ts がフレームワーク固有ルールを知っている
const fileName = framework === 'xcuitest'
  ? toPascalCase(screenId) + 'Tests.swift'
  : `${screenId}.${generator.fileExtension}`;
```

これは registry パターンの利点を損なう。`outputFileName` を interface に含めることで generate.ts 側のコードは:

```ts
// Good: フレームワーク固有ルールは generator が責務を持つ
const fileName = generator.outputFileName(screenId);
```

となり、新フレームワーク追加時に generate.ts を変更する必要がなくなる。

**推奨インターフェース（確定版）:**

```ts
export interface FrameworkGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  outputFileName(screenId: string): string;
  // fileExtension は outputFileName で吸収されるため不要
}
```

`fileExtension` は `outputFileName` の実装内部で使えば十分なので、interface からは省いてシンプルにする。
