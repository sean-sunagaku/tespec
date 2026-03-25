# Step 3: モジュール設計（最終版）

作成日: 2026-03-25
採用パターン: P02 静的 Record Registry

---

## 1. フラット vs サブディレクトリ: 最終決定

**案 B（フラットなまま命名変更）を採用する。**

architecture-lead が提示した2案の比較:

| 観点 | 案A: generators/ サブディレクトリ | 案B: フラット + 命名変更（採用） |
|------|--------------------------------|-------------------------------|
| 既存ファイルへの影響 | `generator.ts` / `generator-swift.ts` を移動 | リネームのみ（内容は変えない） |
| import パスの深さ | `../core/generators/playwright.js`（深くなる） | `../core/generator-playwright.js`（一定） |
| `src/core/` の見通し | generator 関連がサブディレクトリに隠れる | `generator-` プレフィックスで一覧で把握できる |
| 後方互換 re-export | 必要（`generator.ts` を re-export に変更） | 必要（同じ） |
| サブディレクトリ化の閾値 | generator 関連ファイルが 5本以上になったとき再検討 |

### 判断根拠

`generator.ts` → `generator-playwright.ts`、`generator-swift.ts` → `generator-xcuitest.ts` へのリネームは、ファイル内容を変えずに名称の一貫性を実現できる。`generators/` サブディレクトリは現状の2フレームワークには過剰で、import パスが深くなるメリットがない。

`generator.ts` と `generator-swift.ts` は後方互換 re-export として残す（テスト等の既存参照を壊さない）。

---

## 2. 最終ファイル構成

```
src/
  core/
    schema.ts                  変更なし
    parser.ts                  変更なし
    validator.ts               変更なし
    generator.ts               変更: 後方互換 re-export のみ（実装は generator-playwright.ts へ移動）
    generator-swift.ts         変更: 後方互換 re-export のみ（実装は generator-xcuitest.ts へ移動）
    generator-types.ts         新規（約15行）
    generator-registry.ts      新規（約30行）
    generator-playwright.ts    新規: generator.ts の実装をそのまま移動
    generator-xcuitest.ts      新規: generator-swift.ts の実装をそのまま移動
  commands/
    generate.ts                変更（+12行 / -3行）
```

**変更ファイル: 7本（新規4本 + 変更3本）**

---

## 3. モジュール一覧・責務・公開インターフェース

### 3-1. `src/core/generator-types.ts`（新規）

**責務**: フレームワーク generator の共通型契約を定義する。実装を持たない。

**公開インターフェース**:

```ts
import type { Screen, Setup } from './schema.js';

/** 対応フレームワークの識別子 */
export type Target = 'playwright' | 'xctest';

/** 全フレームワーク generator が実装すべき共通契約 */
export interface FrameworkGenerator {
  /** Screen と Setup[] を受け取りテストファイル文字列を返す */
  generate(screen: Screen, setups: Setup[]): string;
  /** フレームワーク固有のファイル名を返す（例: "login.spec.ts", "LoginTests.swift"） */
  fileNameFor(screenId: string): string;
}
```

**依存**: `schema.ts`（型のみ）
**被依存**: `generator-registry.ts`, `generate.ts`

---

### 3-2. `src/core/generator-registry.ts`（新規）

**責務**: `Target` 文字列から `FrameworkGenerator` を解決する。フレームワーク固有のファイル名規則をここに集約する。

**公開インターフェース**:

```ts
import type { Target, FrameworkGenerator } from './generator-types.js';
import { generateTestFile } from './generator-playwright.js';
import { generateSwiftTestFile } from './generator-xcuitest.js';

const REGISTRY: Record<Target, FrameworkGenerator> = {
  playwright: {
    generate: generateTestFile,
    fileNameFor: (screenId) => `${screenId}.spec.ts`,
  },
  xctest: {
    generate: generateSwiftTestFile,
    fileNameFor: (screenId) => `${toSwiftClassName(screenId)}Tests.swift`,
  },
};

/** Target に対応する FrameworkGenerator を返す */
export function getGenerator(target: Target): FrameworkGenerator {
  return REGISTRY[target];
}

/** 有効な Target 文字列の配列。oclif の options: に渡す */
export const AVAILABLE_TARGETS: readonly Target[] = Object.keys(REGISTRY) as Target[];

/** target 文字列が有効な Target か検査する型ガード（as Target キャストを回避） */
export function isTarget(value: string): value is Target {
  return (AVAILABLE_TARGETS as readonly string[]).includes(value);
}

// registry 内部ヘルパー（別 PR で generator-xcuitest.ts と統合予定）
function toSwiftClassName(screenId: string): string {
  return screenId
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
```

**依存**: `generator-types.ts`, `generator-playwright.ts`, `generator-xcuitest.ts`
**被依存**: `generate.ts`

**設計メモ**:
- `Record<Target, ...>` の網羅性チェックにより、新 Target 追加時のエントリ漏れをコンパイルエラーで検出できる
- `toSwiftClassName` は `generator-xcuitest.ts` にも実装済みだが、`fileNameFor` の責務は registry にあるためここに置く。helpers 抽出 PR のタイミングで統合する

---

### 3-3. `src/core/generator-playwright.ts`（新規: generator.ts から実装を移動）

**責務**: Playwright テストスケルトンの生成。`generator.ts` の実装をそのまま移動する。

**公開インターフェース**:

```ts
// generator.ts の実装をそのまま移動。シグネチャは変わらない。
export function generateTestFile(screen: Screen, setups: Setup[]): string;
```

内部関数（`renderNestedGroup`, `renderCaseGroup`, `renderCase`, `buildTestName`, `buildComments`, `indentOf`, `quote`）はすべて非公開のまま維持する。

**依存**: `schema.ts`
**被依存**: `generator-registry.ts`, `generator.ts`（re-export 経由）

---

### 3-4. `src/core/generator-xcuitest.ts`（新規: generator-swift.ts から実装を移動）

**責務**: XCUITest テストスケルトンの生成。`generator-swift.ts` の実装をそのまま移動する。

**公開インターフェース**:

```ts
// generator-swift.ts の実装をそのまま移動。シグネチャは変わらない。
export function generateSwiftTestFile(screen: Screen, setups: Setup[]): string;
```

内部関数（`renderMarkedGroup`, `renderCaseGroup`, `renderCase`, `buildFuncName`, `buildComments`, `toSwiftClassName`, `sanitize`, `indentOf`）はすべて非公開のまま維持する。

**依存**: `schema.ts`
**被依存**: `generator-registry.ts`, `generator-swift.ts`（re-export 経由）

---

### 3-5. `src/core/generator.ts`（変更: 後方互換 re-export のみ）

**責務**: 既存の import パス（`'../core/generator.js'`）を壊さないための re-export。

```ts
// 実装は generator-playwright.ts に移動済み
export { generateTestFile } from './generator-playwright.js';
```

**依存**: `generator-playwright.ts`
**変更規模**: 実装削除 + re-export 1行

---

### 3-6. `src/core/generator-swift.ts`（変更: 後方互換 re-export のみ）

**責務**: 既存の import パス（`'../core/generator-swift.js'`）を壊さないための re-export。

```ts
// 実装は generator-xcuitest.ts に移動済み
export { generateSwiftTestFile } from './generator-xcuitest.js';
```

**依存**: `generator-xcuitest.ts`
**変更規模**: 実装削除 + re-export 1行

---

### 3-7. `src/commands/generate.ts`（変更）

**変更箇所 1: import の差し替え**

```ts
// Before
import { generateTestFile } from '../core/generator.js';

// After
import { getGenerator, AVAILABLE_TARGETS, isTarget } from '../core/generator-registry.js';
```

**変更箇所 2: `--target` フラグの追加**

```ts
static flags = {
  // ...既存フラグ（config, screen, dry-run, out-dir）...
  target: Flags.string({
    char: 't',
    description: 'Target test framework',
    options: [...AVAILABLE_TARGETS],
    default: 'playwright',
  }),
};
```

**変更箇所 3: run() 内の generator 解決（型ガードで as キャスト回避）**

```ts
// platform-expert 補足:
// Flags.string({ default: 'playwright' }) を指定すると flags.target は string 型（undefined なし）
// そのため ?? 'playwright' フォールバックは不要
if (!isTarget(flags.target)) {
  // oclif の options: バリデーションが先に弾くため実際にはここに到達しない
  printError('target', `Unknown target: ${flags.target}`);
  this.exit(1);
}
const generator = getGenerator(flags.target);
```

**変更箇所 4: generate 呼び出しとファイル名生成の差し替え**

```ts
// Before
const outputs = selectedScreens.map((screen) => ({
  screenId: screen.screen,
  content: generateTestFile(screen, setups),
}));
// ...
`${output.screenId}.spec.ts`

// After
const outputs = selectedScreens.map((screen) => ({
  screenId: screen.screen,
  content: generator.generate(screen, setups),
}));
// ...
generator.fileNameFor(output.screenId)
```

**変更規模**: +12行 / -3行

---

## 4. FrameworkGenerator interface の最終形

```ts
export interface FrameworkGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}
```

`fileExtension` は **含めない**。

### 理由

`fileExtension: string` は `fileNameFor` で完全に表現できる。generate.ts が必要としているのは「ファイル名の文字列」であり、拡張子を個別に知る必要がない。interface のメンバーを最小にすることで、新フレームワーク generator の実装負担を減らす。

---

## 5. generator-helpers.ts の切り出し範囲（別 PR で実装、今回は設計確定のみ）

### 切り出す関数（確定）

| 関数 | 移動元 | 理由 |
|------|--------|------|
| `buildTestLabel(testCase: Case): string` | `generator-playwright.ts`（旧 `buildTestName`） | フレームワーク非依存のラベル生成ロジック |
| `buildComments(testCase: Case, setupTitles: Map<string, string>, depth: number): string[]` | 両 generator（重複） | 実装が完全一致しており共通化効果が高い |
| `classifyCase(cases: Case[]): { normal: Case[]; error: Case[]; boundary: Case[] }` | 両 generator（重複） | 3行のフィルタを関数化して意図を明示 |
| `resolveSetupTitles(setups: Setup[]): Map<string, string>` | 両 generator（重複） | `new Map(setups.map(...))` を名前付き関数に |

### 切り出さない関数（各 generator が独自に持つ）

| 関数 | 理由 |
|------|------|
| `indentOf(depth)` | **インデント幅がフレームワーク依存**（Playwright: 2スペース / XCUITest: 4スペース）。共通化すると呼び出し側に `size` を渡し続ける必要があり共通化の旨みがない。各 generator のファイルトップに `const INDENT = '  '` を1行置くことで変更箇所を集約する |
| `quote(value)` | Playwright は `JSON.stringify`、XCUITest は不要。フレームワーク固有 |
| `renderCase` / `renderCaseGroup` / `renderNestedGroup` / `renderMarkedGroup` | テスト構造の記法がフレームワーク固有（`test.describe` vs `// MARK: -`） |
| `buildFuncName` | Swift メソッド名の sanitize ロジックが XCUITest 固有 |
| `toSwiftClassName` / `sanitize` | XCUITest 固有 |

### buildTestLabel の命名変更について

`buildTestName` → `buildTestLabel` に変更する。「メソッド名」ではなく「表示用ラベル」であることを明示し、XCUITest で sanitize が必要なことを関数名で示す。

各 generator での使い方:
- `generator-playwright.ts`: `buildTestLabel(testCase)` をそのままテスト名に使う
- `generator-xcuitest.ts`: `sanitizeSwiftMethodName(buildTestLabel(testCase))` で Swift メソッド名に変換

---

## 6. 依存グラフ

```
commands/generate.ts
  ├── core/generator-registry.ts
  │     ├── core/generator-types.ts
  │     │     └── core/schema.ts
  │     ├── core/generator-playwright.ts
  │     │     └── core/schema.ts
  │     └── core/generator-xcuitest.ts
  │           └── core/schema.ts
  └── core/generator-types.ts   （Target 型のみ）

core/generator.ts（re-export）
  └── core/generator-playwright.ts

core/generator-swift.ts（re-export）
  └── core/generator-xcuitest.ts
```

**循環依存**: なし。依存は常に上位 → 下位の一方向。

---

## 7. 変更サマリ

| ファイル | 種別 | 規模 | 内容 |
|---------|------|------|------|
| `src/core/generator-types.ts` | 新規 | 約15行 | FrameworkGenerator 型契約 |
| `src/core/generator-registry.ts` | 新規 | 約30行 | Target → generator 解決ロジック |
| `src/core/generator-playwright.ts` | 新規（移動） | generator.ts の実装そのまま | Playwright generator 本体 |
| `src/core/generator-xcuitest.ts` | 新規（移動） | generator-swift.ts の実装そのまま | XCUITest generator 本体 |
| `src/core/generator.ts` | 変更 | 実装削除 + re-export 1行 | 後方互換 re-export |
| `src/core/generator-swift.ts` | 変更 | 実装削除 + re-export 1行 | 後方互換 re-export |
| `src/commands/generate.ts` | 変更 | +12行 / -3行 | --target フラグ + registry 呼び出し |

**実質的な新規コード**: 約57行（`generator-types.ts` 15行 + `generator-registry.ts` 30行 + `generate.ts` 変更 12行）
`generator-playwright.ts` / `generator-xcuitest.ts` はコードの移動であり新規実装ゼロ。

---

## 8. スコープ外（別 PR で実装）

| 項目 | 対象ファイル | 内容 |
|------|------------|------|
| helpers 抽出 | `generator-helpers.ts`（新規） | `buildTestLabel`, `buildComments`, `classifyCase`, `resolveSetupTitles` |
| `buildTestName` のリネーム | `generator-playwright.ts` | `buildTestName` → `buildTestLabel` |
| `toSwiftClassName` の重複解消 | `generator-registry.ts`, `generator-xcuitest.ts` | helpers 抽出 PR で統合 |
| サブディレクトリ化 | `src/core/generators/` | generator 関連ファイルが 5本以上になったとき |

---

## 9. platform-expert 補足（実装時の注意事項）

### 9-1. フラグ名: `--target` / `-t`

oclif 慣例に従い `--target` / `-t` を採用（既に設計に反映済み）。

### 9-2. ESM `.js` 拡張子の更新漏れに注意

`moduleResolution: NodeNext` 制約により、TypeScript ソースでも import パスに `.js` 拡張子が必要。ファイルを移動・リネームした際に import 側の更新を忘れるとビルドエラーになる。

チェックリスト（この PR での変更後に確認）:
- `generator.ts` の re-export: `'./generator-playwright.js'` ← `.js` あり
- `generator-swift.ts` の re-export: `'./generator-xcuitest.js'` ← `.js` あり
- `generator-registry.ts` の import: `'./generator-playwright.js'`, `'./generator-xcuitest.js'` ← `.js` あり
- `generate.ts` の import: `'../core/generator-registry.js'` ← `.js` あり

### 9-3. `flags.target` の型は `string`（undefined なし）

`Flags.string({ default: 'playwright' })` を指定すると `flags.target` は `string` 型に推論される（`string | undefined` ではない）。`?? 'playwright'` フォールバックは不要。

```ts
// 正しい（undefined チェック不要）
if (!isTarget(flags.target)) { ... }
const generator = getGenerator(flags.target);

// 不要（default があるため到達しない）
const rawTarget = flags.target ?? 'playwright';
```
