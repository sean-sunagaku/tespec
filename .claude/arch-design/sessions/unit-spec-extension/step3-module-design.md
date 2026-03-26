# Step 3: モジュール詳細設計 — Module Designer

## 1. ファイル構成と責務

### 1.1 新規ファイル (4) + 新規ディレクトリ (2)

| ファイル | 責務 |
|---------|------|
| `src/core/unit-validator.ts` | Unit Spec 固有のバリデーション (内部一貫性チェック) |
| `src/core/generators/unit/vitest.ts` | vitest テストスケルトン生成 |
| `src/core/generators/unit/xctest.ts` | XCTest ユニットテストスケルトン生成 |
| `src/core/generators/screen/` | 既存 playwright.ts, xctest.ts の移動先ディレクトリ |

### 1.2 既存ファイル変更 (6) + 移動 (2)

| ファイル | 変更内容 |
|---------|---------|
| `src/core/schema.ts` | UnitCaseSchema, UnitMethodSchema, UnitSpecSchema 追加 + ConfigSchema に `units_dir` optional 追加 |
| `src/core/parser.ts` | ParsedProject に `units` 追加 + parseProject に units パース追加 |
| `src/core/generators/types.ts` | `Target` → `ScreenTarget` rename + `UnitTarget`, `UnitGenerator` 追加 |
| `src/core/generators/registry.ts` | `FrameworkGenerator` → `ScreenGenerator` rename + UNIT_REGISTRY, getUnitGenerator 追加 + import パス変更 |
| `src/commands/validate.ts` | unit-validator 呼び出し追加 + `--file` での Unit YAML 認識 |
| `src/commands/generate.ts` | unit generator 呼び出し追加 + `--unit` フラグ追加 |

**移動ファイル:**

| 移動元 | 移動先 | ロジック変更 |
|--------|--------|-------------|
| `src/core/generators/playwright.ts` | `src/core/generators/screen/playwright.ts` | なし (import パスのみ変更) |
| `src/core/generators/xctest.ts` | `src/core/generators/screen/xctest.ts` | なし (import パスのみ変更) |

### 1.3 ロジック変更なし (1)

`src/core/validator.ts` — 唯一、移動も rename もないファイル

注: `generators/screen/playwright.ts`, `generators/screen/xctest.ts` はロジック変更なしだが、移動 + `FrameworkGenerator` → `ScreenGenerator` の rename + import パス変更あり (Section 5 参照)

### 1.4 最終ディレクトリ構造

```
src/core/generators/
  types.ts                  # ScreenGenerator + UnitGenerator (共通)
  registry.ts               # SCREEN_REGISTRY + UNIT_REGISTRY (共通)
  screen/
    playwright.ts           # Screen 用 (既存、移動のみ)
    xctest.ts               # Screen 用 (既存、移動のみ)
  unit/
    vitest.ts               # Unit 用 (新規)
    xctest.ts               # Unit 用 (新規)
```

---

## 2. モジュール別詳細インターフェース

### 2.1 schema.ts — 追加部分

```typescript
// --- Unit Spec スキーマ (既存 Screen スキーマの下に追加) ---

export const UnitCaseSchema = z.object({
  action: z.string(),
  expect: z.union([z.string(), z.array(z.string())]),
  type: z.enum(['normal', 'error', 'boundary']).default('normal'),
});

export const UnitMethodSchema = z.object({
  method: z.string(),
  cases: z.array(UnitCaseSchema),
});

export const UnitSpecSchema = z.object({
  unit: z.string(),
  title: z.string(),
  methods: z.array(UnitMethodSchema),
});

// --- ConfigSchema 拡張 ---
export const ConfigSchema = z.object({
  version: z.number(),
  project: z.string(),
  screens_dir: z.string().default('./screens'),
  setups_dir: z.string().default('./setups'),
  units_dir: z.string().optional(),              // 追加: optional, default なし
});

// --- 型エクスポート ---
export type UnitCase = z.infer<typeof UnitCaseSchema>;
export type UnitMethod = z.infer<typeof UnitMethodSchema>;
export type UnitSpec = z.infer<typeof UnitSpecSchema>;
```

**設計判断:**
- `UnitCaseSchema` は `CaseSchema` と独立。`steps` (Screen で必須) を持たない
- `expect` は Screen と同様に `string | string[]` を許容 (複数期待値の表現)
- `units_dir` は `.optional()` — 未定義なら Unit パースをスキップ (Step 2 確定事項)

### 2.2 parser.ts — 変更部分

```typescript
import {
  // 既存
  type Config, ConfigSchema, type Screen, ScreenSchema, type Setup, SetupSchema,
  // 追加
  type UnitSpec, UnitSpecSchema,
} from './schema.js';

export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];    // 追加
}

export async function parseProject(
  configPath: string,
): Promise<{ result?: ParsedProject; errors: ParseError[] }> {
  // ... 既存の config パース ...

  const configDir = path.dirname(resolvedConfigPath);
  const screensDir = path.resolve(configDir, configResult.data.screens_dir);
  const setupsDir = path.resolve(configDir, configResult.data.setups_dir);

  // units_dir は optional — 未定義ならパースをスキップ
  const unitsDir = configResult.data.units_dir
    ? path.resolve(configDir, configResult.data.units_dir)
    : undefined;

  const [screensResult, setupsResult, unitsResult] = await Promise.all([
    parseYamlDirectory(screensDir, ScreenSchema),
    parseYamlDirectory(setupsDir, SetupSchema),
    unitsDir
      ? parseYamlDirectory(unitsDir, UnitSpecSchema)
      : Promise.resolve({ items: [] as UnitSpec[], errors: [] as ParseError[] }),
  ]);

  const errors = [...screensResult.errors, ...setupsResult.errors, ...unitsResult.errors];
  if (errors.length > 0) {
    return { errors };
  }

  return {
    result: {
      config: configResult.data,
      screens: screensResult.items,
      setups: setupsResult.items,
      units: unitsResult.items,
    },
    errors: [],
  };
}
```

**設計判断:**
- `parseYamlFile` / `parseYamlDirectory` はジェネリックなのでそのまま再利用
- `unitsDir` が undefined の場合、空の結果を返す (エラーにしない)
- 3つの `parseYamlDirectory` を `Promise.all` で並列実行

### 2.3 generators/types.ts — 全体 (書き換え)

```typescript
import type { Screen, Setup, UnitSpec } from '../schema.js';

// --- Screen 系 (既存の rename) ---
export type ScreenTarget = 'playwright' | 'xctest';

export interface ScreenGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}

// --- Unit 系 (新規) ---
export type UnitTarget = 'vitest' | 'xctest';

export interface UnitGenerator {
  generate(unit: UnitSpec): string;
  fileNameFor(unitId: string): string;
}
```

**設計判断:**
- `Target` → `ScreenTarget`, `FrameworkGenerator` → `ScreenGenerator` に rename (後方互換 alias 不要, Step 2 確定事項)
- `UnitGenerator.generate` は `UnitSpec` のみ受け取る (setups 不要)
- `fileNameFor` は両 interface で同じシグネチャ (string → string)

### 2.4 generators/registry.ts — 全体 (書き換え)

```typescript
import { playwright } from './screen/playwright.js';
import { xctest as screenXctest } from './screen/xctest.js';
import type { ScreenGenerator, ScreenTarget, UnitGenerator, UnitTarget } from './types.js';
import { vitest } from './unit/vitest.js';
import { xctest as unitXctest } from './unit/xctest.js';

// --- Screen Registry (既存 rename) ---
const SCREEN_REGISTRY: Record<ScreenTarget, ScreenGenerator> = {
  playwright,
  xctest: screenXctest,
};

export function getScreenGenerator(target: ScreenTarget): ScreenGenerator {
  return SCREEN_REGISTRY[target];
}

export const SCREEN_TARGETS: readonly ScreenTarget[] = Object.keys(SCREEN_REGISTRY) as ScreenTarget[];

export function isScreenTarget(value: string): value is ScreenTarget {
  return (SCREEN_TARGETS as readonly string[]).includes(value);
}

// --- Unit Registry (新規) ---
const UNIT_REGISTRY: Record<UnitTarget, UnitGenerator> = {
  vitest,
  xctest: unitXctest,
};

export function getUnitGenerator(target: UnitTarget): UnitGenerator {
  return UNIT_REGISTRY[target];
}

export const UNIT_TARGETS: readonly UnitTarget[] = Object.keys(UNIT_REGISTRY) as UnitTarget[];

export function isUnitTarget(value: string): value is UnitTarget {
  return (UNIT_TARGETS as readonly string[]).includes(value);
}
```

**設計判断:**
- サブディレクトリ分離により、Screen/Unit 両方の xctest を `xctest.ts` と命名可能
- import 時に `as screenXctest` / `as unitXctest` で区別
- `isScreenTarget` / `isUnitTarget` で型ガードを提供

### 2.5 unit-validator.ts — 新規

```typescript
import type { UnitSpec } from './schema.js';

export interface ValidationIssue {
  level: 'error' | 'warning';
  file: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  hasErrors: boolean;
}

export function validateUnits(units: UnitSpec[]): ValidationResult {
  const issues: ValidationIssue[] = [];

  checkDuplicateUnitIds(units, issues);
  checkEmptyMethods(units, issues);
  checkEmptyCases(units, issues);
  checkErrorTypeMissing(units, issues);
  checkBoundaryTypeMissing(units, issues);

  return {
    issues,
    hasErrors: issues.some((issue) => issue.level === 'error'),
  };
}

function checkDuplicateUnitIds(units: UnitSpec[], issues: ValidationIssue[]): void {
  const counts = new Map<string, number>();
  for (const unit of units) {
    counts.set(unit.unit, (counts.get(unit.unit) ?? 0) + 1);
  }
  for (const [unitId, count] of counts.entries()) {
    if (count > 1) {
      issues.push({
        level: 'error',
        file: toUnitFile(unitId),
        field: 'unit',
        message: `unit ID "${unitId}" が重複しています`,
      });
    }
  }
}

function checkEmptyMethods(units: UnitSpec[], issues: ValidationIssue[]): void {
  for (const unit of units) {
    if (unit.methods.length === 0) {
      issues.push({
        level: 'warning',
        file: toUnitFile(unit.unit),
        field: 'methods',
        message: 'methods が空です',
      });
    }
  }
}

function checkEmptyCases(units: UnitSpec[], issues: ValidationIssue[]): void {
  for (const unit of units) {
    for (const [methodIndex, method] of unit.methods.entries()) {
      if (method.cases.length === 0) {
        issues.push({
          level: 'warning',
          file: toUnitFile(unit.unit),
          field: `methods[${methodIndex}].cases`,
          message: `method "${method.method}" の cases が空です`,
        });
      }
    }
  }
}

function checkErrorTypeMissing(units: UnitSpec[], issues: ValidationIssue[]): void {
  for (const unit of units) {
    for (const [methodIndex, method] of unit.methods.entries()) {
      if (method.cases.length > 0 && !method.cases.some((c) => c.type === 'error')) {
        issues.push({
          level: 'warning',
          file: toUnitFile(unit.unit),
          field: `methods[${methodIndex}].cases`,
          message: `method "${method.method}" に異常系 (type: error) が 0 件`,
        });
      }
    }
  }
}

function checkBoundaryTypeMissing(units: UnitSpec[], issues: ValidationIssue[]): void {
  for (const unit of units) {
    for (const [methodIndex, method] of unit.methods.entries()) {
      if (method.cases.length > 0 && !method.cases.some((c) => c.type === 'boundary')) {
        issues.push({
          level: 'warning',
          file: toUnitFile(unit.unit),
          field: `methods[${methodIndex}].cases`,
          message: `method "${method.method}" に境界値 (type: boundary) が 0 件`,
        });
      }
    }
  }
}

function toUnitFile(unitId: string): string {
  return `units/${unitId}.yaml`;
}
```

**設計判断:**
- `ValidationIssue` / `ValidationResult` は既存 `validator.ts` と同じ型定義 (共通化は検討したが、37行程度の重複は許容。抽出は3種類目で検討)
- error/boundary チェックは **メソッド単位** で実施 (Screen ではスクリーン単位)
- Setup 参照チェックは不要 (Unit は given/steps/navigates_to を持たない)

### 2.6 generators/unit/vitest.ts — 新規

```typescript
import type { UnitCase, UnitMethod, UnitSpec } from '../../schema.js';
import type { UnitGenerator } from '../types.js';

export const vitest: UnitGenerator = {
  generate: generateVitestFile,
  fileNameFor: (unitId) => `${unitId}.test.ts`,
};

export function generateVitestFile(unit: UnitSpec): string {
  const lines = [
    'import { describe, it, expect } from "vitest";',
    '',
    `describe(${quote(unit.title)}, () => {`,
    ...unit.methods.flatMap((method) => renderMethodGroup(method, 1)),
    '});',
  ];

  return `${lines.join('\n')}\n`;
}

function renderMethodGroup(method: UnitMethod, depth: number): string[] {
  const indent = indentOf(depth);
  const normalCases = method.cases.filter((c) => c.type === 'normal');
  const errorCases = method.cases.filter((c) => c.type === 'error');
  const boundaryCases = method.cases.filter((c) => c.type === 'boundary');

  return [
    `${indent}describe(${quote(method.method)}, () => {`,
    ...renderCaseGroup(normalCases, depth + 1),
    ...renderNestedGroup('異常系', errorCases, depth + 1),
    ...renderNestedGroup('境界値', boundaryCases, depth + 1),
    `${indent}});`,
  ];
}

function renderNestedGroup(title: string, cases: UnitCase[], depth: number): string[] {
  if (cases.length === 0) {
    return [];
  }

  const indent = indentOf(depth);

  return [
    `${indent}describe(${quote(title)}, () => {`,
    ...renderCaseGroup(cases, depth + 1),
    `${indent}});`,
  ];
}

function renderCaseGroup(cases: UnitCase[], depth: number): string[] {
  return cases.flatMap((testCase) => renderCase(testCase, depth));
}

function renderCase(testCase: UnitCase, depth: number): string[] {
  const indent = indentOf(depth);
  const innerIndent = indentOf(depth + 1);
  const expectation = Array.isArray(testCase.expect) ? testCase.expect[0] : testCase.expect;

  return [
    `${indent}it(${quote(`${testCase.action} → ${expectation}`)}, () => {`,
    `${innerIndent}// TODO: implement`,
    `${indent}});`,
  ];
}

function indentOf(depth: number): string {
  return '  '.repeat(depth);
}

function quote(value: string): string {
  return JSON.stringify(value);
}
```

**設計判断:**
- `describe` ネストで methods をグルーピング (Playwright generator と同じグルーピングパターン)
- `it` で各 case を記述 (vitest の慣習)
- ファイル名: `${unitId}.test.ts` (vitest の慣習)
- `indentOf` / `quote` は Playwright generator と同じだが、共通化しない (KISS — 3種類目で検討)

### 2.7 generators/unit/xctest.ts — 新規

```typescript
import type { UnitCase, UnitMethod, UnitSpec } from '../../schema.js';
import type { UnitGenerator } from '../types.js';

export const xctest: UnitGenerator = {
  generate: generateXCTestUnitFile,
  fileNameFor: (unitId) => `${toSwiftClassName(unitId)}Tests.swift`,
};

export function generateXCTestUnitFile(unit: UnitSpec): string {
  const lines = [
    'import XCTest',
    '',
    `final class ${toSwiftClassName(unit.unit)}Tests: XCTestCase {`,
    ...unit.methods.flatMap((method) => renderMethodGroup(method, 1)),
    '}',
  ];

  return `${lines.join('\n')}\n`;
}

function renderMethodGroup(method: UnitMethod, depth: number): string[] {
  const indent = indentOf(depth);
  const normalCases = method.cases.filter((c) => c.type === 'normal');
  const errorCases = method.cases.filter((c) => c.type === 'error');
  const boundaryCases = method.cases.filter((c) => c.type === 'boundary');

  return [
    '',
    `${indent}// MARK: - ${method.method}`,
    '',
    ...renderCaseGroup(method.method, normalCases, depth),
    ...renderMarkedGroup(method.method, '異常系', errorCases, depth),
    ...renderMarkedGroup(method.method, '境界値', boundaryCases, depth),
  ];
}

function renderMarkedGroup(
  methodName: string,
  title: string,
  cases: UnitCase[],
  depth: number,
): string[] {
  if (cases.length === 0) {
    return [];
  }

  const indent = indentOf(depth);

  return [
    '',
    `${indent}// MARK: ${methodName} - ${title}`,
    '',
    ...renderCaseGroup(methodName, cases, depth),
  ];
}

function renderCaseGroup(methodName: string, cases: UnitCase[], depth: number): string[] {
  return cases.flatMap((testCase) => renderCase(methodName, testCase, depth));
}

function renderCase(methodName: string, testCase: UnitCase, depth: number): string[] {
  const indent = indentOf(depth);
  const innerIndent = indentOf(depth + 1);
  const expectation = Array.isArray(testCase.expect) ? testCase.expect[0] : testCase.expect;

  return [
    `${indent}func ${buildFuncName(methodName, testCase)}() {`,
    `${innerIndent}// TODO: implement`,
    `${indent}}`,
  ];
}

function buildFuncName(methodName: string, testCase: UnitCase): string {
  const expectation = Array.isArray(testCase.expect) ? testCase.expect[0] : testCase.expect;
  return `test_${sanitize(methodName)}_${sanitize(testCase.action)}_${sanitize(expectation)}`;
}

function toSwiftClassName(unitId: string): string {
  return unitId
    .split(/[_-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}

function sanitize(value: string): string {
  return value.replace(/\s+/g, '_').replace(/[^\p{L}\p{N}_]/gu, '');
}

function indentOf(depth: number): string {
  return '    '.repeat(depth);
}
```

**設計判断:**
- `MARK:` コメントでメソッドごとにセクション分け (既存 screen/xctest.ts と同じパターン)
- 関数名: `test_{method}_{action}_{expect}` でメソッド名を含む (Screen 版は method がないため含まない)
- `toSwiftClassName` / `sanitize` は既存 screen/xctest.ts と同じロジックだが共通化しない (KISS)
- export 名は `xctest` (サブディレクトリで名前空間が分離されるため `xctestUnit` は不要)

### 2.8 commands/validate.ts — 変更部分

```typescript
// 追加 import
import { UnitSpecSchema } from '../core/schema.js';
import { validateUnits } from '../core/unit-validator.js';

// run() 内: 既存の Screen validation の後に追加
if (parsed.result.units.length > 0) {
  const unitValidation = validateUnits(parsed.result.units);

  for (const issue of unitValidation.issues) {
    const message = `${issue.field}: ${issue.message}`;
    if (issue.level === 'error') {
      printError(issue.file, message);
    } else {
      printWarning(issue.file, message);
    }
  }

  if (unitValidation.hasErrors) {
    this.exit(1);
  }
}

// Unit ファイルの OK 表示
for (const unit of parsed.result.units) {
  const unitFile = `units/${unit.unit}.yaml`;
  if (!errorFiles.has(unitFile)) {
    printOk(unitFile);
  }
}

// validateSingleFile(): UnitSpecSchema の試行を追加
private async validateSingleFile(inputPath: string): Promise<void> {
  const filePath = path.resolve(inputPath);

  // 1. Screen として試行
  const screenResult = await parseYamlFile(filePath, ScreenSchema);
  if (screenResult.data) { printOk(toDisplayPath(filePath)); return; }

  // 2. Setup として試行
  const setupResult = await parseYamlFile(filePath, SetupSchema);
  if (setupResult.data) { printOk(toDisplayPath(filePath)); return; }

  // 3. Unit として試行 (追加)
  const unitResult = await parseYamlFile(filePath, UnitSpecSchema);
  if (unitResult.data) { printOk(toDisplayPath(filePath)); return; }

  // エラー: パスに基づいて最適なエラーを選択
  for (const error of selectSingleFileErrors(filePath, screenResult.errors, setupResult.errors, unitResult.errors)) {
    printError(toDisplayPath(error.file), error.message);
  }
  this.exit(1);
}
```

**設計判断:**
- `--file` で Unit YAML を検証する場合、Screen → Setup → Unit の順で試行 (Step 2 引き継ぎ事項 #4)
- `selectSingleFileErrors` に unitErrors を追加し、パスに `units/` を含む場合は Unit エラーを優先表示

### 2.9 commands/generate.ts — 変更部分

```typescript
// 追加 import
import { getUnitGenerator, isUnitTarget, UNIT_TARGETS } from '../core/generators/registry.js';
import { validateUnits } from '../core/unit-validator.js';

// flags に追加
static flags = {
  // ... 既存 flags ...
  unit: Flags.string({
    description: 'Generate only a specific unit id',
  }),
  'unit-target': Flags.string({
    description: 'Target test framework for unit specs',
    options: [...UNIT_TARGETS],
    default: 'vitest',
  }),
};

// run() 内: 既存の Screen generation の後に追加
// Unit generation
if (parsed.result.units.length > 0) {
  const unitValidation = validateUnits(parsed.result.units);
  // ... validation error handling (Screen と同じパターン) ...

  if (!isUnitTarget(flags['unit-target'])) {
    printError('unit-target', `Unknown unit target: ${flags['unit-target']}`);
    this.exit(1);
  }
  const unitGenerator = getUnitGenerator(flags['unit-target']);

  const selectedUnits = flags.unit
    ? parsed.result.units.filter((u) => u.unit === flags.unit)
    : parsed.result.units;

  if (flags.unit && selectedUnits.length === 0) {
    printError('unit', `unit "${flags.unit}" が見つかりません`);
    this.exit(1);
  }

  const unitOutputs = selectedUnits.map((unit) => ({
    unitId: unit.unit,
    content: unitGenerator.generate(unit),
  }));

  if (flags['dry-run']) {
    for (const output of unitOutputs) {
      this.log(`// ${toDisplayPath(path.join(outputDir, unitGenerator.fileNameFor(output.unitId)))}`);
      this.log(output.content.trimEnd());
    }
  } else {
    await mkdir(outputDir, { recursive: true });
    await Promise.all(
      unitOutputs.map((output) =>
        writeFile(
          path.join(outputDir, unitGenerator.fileNameFor(output.unitId)),
          output.content,
          'utf8',
        ),
      ),
    );
  }
}
```

**設計判断:**
- `--target` は既存の Screen 用をそのまま維持 (既存動作を壊さない)
- `--unit-target` を新フラグとして追加 (デフォルト `vitest`)
- `--unit <id>` で特定 Unit のみ生成 (`--screen` と同じパターン)
- Screen と Unit の出力は同じ `--out-dir` に配置

---

## 3. Step 2 引き継ぎ事項の解決

| # | 事項 | 解決方法 |
|---|------|---------|
| 1 | units_dir 不在時の挙動 | `units_dir` は `.optional()` — undefined なら Unit パースをスキップ。エラーにしない |
| 2 | generate の target 解決 | `--target` は Screen 用 (既存維持)、`--unit-target` は Unit 用 (新規, デフォルト vitest) |
| 3 | Unit 用 `--unit` フラグ | `--unit <id>` で特定 Unit のみ生成 (`--screen` と同じパターン) |
| 4 | validate の単一ファイル検証 | Screen → Setup → Unit の順で試行。パスに `units/` を含む場合は Unit エラーを優先 |
| 5 | vitest/xctest-unit 出力フォーマット | Section 2.6, 2.7 で詳細定義済み |

---

## 4. 依存関係マップ

```
commands/validate.ts
  → core/parser.ts (parseProject, parseYamlFile)
  → core/schema.ts (ScreenSchema, SetupSchema, UnitSpecSchema)
  → core/validator.ts (validate) [既存, 変更なし]
  → core/unit-validator.ts (validateUnits) [新規]

commands/generate.ts
  → core/parser.ts (parseProject)
  → core/validator.ts (validate) [既存, 変更なし]
  → core/unit-validator.ts (validateUnits) [新規]
  → core/generators/registry.ts (getScreenGenerator, getUnitGenerator, ...)

core/parser.ts
  → core/schema.ts (ConfigSchema, ScreenSchema, SetupSchema, UnitSpecSchema)

core/unit-validator.ts
  → core/schema.ts (UnitSpec 型のみ)

core/generators/registry.ts
  → core/generators/types.ts (ScreenGenerator, UnitGenerator, ScreenTarget, UnitTarget)
  → core/generators/screen/playwright.ts [既存, 移動]
  → core/generators/screen/xctest.ts [既存, 移動]
  → core/generators/unit/vitest.ts [新規]
  → core/generators/unit/xctest.ts [新規]

core/generators/screen/playwright.ts
  → core/schema.ts (Screen, Setup, Case 型のみ)
  → core/generators/types.ts (ScreenGenerator 型のみ)

core/generators/screen/xctest.ts
  → core/schema.ts (Screen, Setup, Case 型のみ)
  → core/generators/types.ts (ScreenGenerator 型のみ)

core/generators/unit/vitest.ts
  → core/schema.ts (UnitSpec, UnitMethod, UnitCase 型のみ)
  → core/generators/types.ts (UnitGenerator 型のみ)

core/generators/unit/xctest.ts
  → core/schema.ts (UnitSpec, UnitMethod, UnitCase 型のみ)
  → core/generators/types.ts (UnitGenerator 型のみ)
```

**依存方向**: `commands → core → schema` の一方向。循環依存なし。新規モジュールも同じ方向に従う。

---

## 5. 既存コードの rename + 移動 影響範囲

### 5.1 rename: `Target` → `ScreenTarget`, `FrameworkGenerator` → `ScreenGenerator`

| ファイル | 変更箇所 |
|---------|---------|
| `generators/types.ts` | 定義元: `Target` → `ScreenTarget`, `FrameworkGenerator` → `ScreenGenerator` |
| `generators/registry.ts` | import + 使用箇所: `FrameworkGenerator` → `ScreenGenerator`, `Target` → `ScreenTarget` |
| `generators/screen/playwright.ts` | import + 型注釈: `FrameworkGenerator` → `ScreenGenerator` (2箇所: import 文 + export 定義) |
| `generators/screen/xctest.ts` | import + 型注釈: `FrameworkGenerator` → `ScreenGenerator` (2箇所: import 文 + export 定義) |
| `commands/generate.ts` | import + 使用箇所: `isTarget` → `isScreenTarget`, `getGenerator` → `getScreenGenerator`, `AVAILABLE_TARGETS` → `SCREEN_TARGETS` |

`commands/validate.ts` と `validator.ts` には `Target` / `FrameworkGenerator` の参照がないため影響なし。

### 5.2 移動: generators/ → generators/screen/

| 移動元 | 移動先 |
|--------|--------|
| `generators/playwright.ts` | `generators/screen/playwright.ts` |
| `generators/xctest.ts` | `generators/screen/xctest.ts` |

**import パス変更の影響:**

| ファイル | 変更前 | 変更後 |
|---------|--------|--------|
| `generators/registry.ts` | `import { playwright } from './playwright.js'` | `import { playwright } from './screen/playwright.js'` |
| `generators/registry.ts` | `import { xctest } from './xctest.js'` | `import { xctest as screenXctest } from './screen/xctest.js'` |
| `generators/screen/playwright.ts` | `import type { ... } from '../schema.js'` | `import type { ... } from '../../schema.js'` |
| `generators/screen/playwright.ts` | `import type { FrameworkGenerator } from './types.js'` | `import type { ScreenGenerator } from '../types.js'` |
| `generators/screen/xctest.ts` | `import type { ... } from '../schema.js'` | `import type { ... } from '../../schema.js'` |
| `generators/screen/xctest.ts` | `import type { FrameworkGenerator } from './types.js'` | `import type { ScreenGenerator } from '../types.js'` |

**ロジック変更:** なし。import パスと型名の rename のみ。

---

## 6. generators/ ディレクトリ構成: 2案比較

### 案 A: フラット追加 (本設計書のデフォルト)

```
src/core/generators/
  types.ts           # ScreenGenerator + UnitGenerator
  registry.ts        # SCREEN_REGISTRY + UNIT_REGISTRY
  playwright.ts      # Screen 用
  xctest.ts          # Screen 用
  vitest.ts          # Unit 用 (新規)
  xctest-unit.ts     # Unit 用 (新規)
```

**利点:**
- ファイル移動なし。既存 import パスが全て安定
- registry.ts が同一ディレクトリ内の全 generator を import — パスが短く明快
- 6ファイルという規模でサブディレクトリは過剰
- Step 1〜2 で全エージェントが合意した方針と一致

**欠点:**
- Screen 用と Unit 用の区別がファイル名の命名規則 (`xctest-unit.ts`) に依存
- 将来 3 種類目 (transition) が来ると generator ファイルが 8+ になり、見通しが悪化する可能性

### 案 B: サブディレクトリ分離

```
src/core/generators/
  types.ts           # ScreenGenerator + UnitGenerator (共通)
  registry.ts        # SCREEN_REGISTRY + UNIT_REGISTRY (共通)
  screen/
    playwright.ts    # Screen 用
    xctest.ts        # Screen 用
  unit/
    vitest.ts        # Unit 用 (新規)
    xctest.ts        # Unit 用 (新規) — xctest-unit ではなく xctest と命名可能
```

**利点:**
- spec type ごとのまとまりが明確。ディレクトリを見れば「Screen 用」「Unit 用」が一目瞭然
- Unit 用 xctest を `xctest.ts` と命名できる (ディレクトリで名前空間が分離されるため `xctest-unit.ts` という命名が不要)
- 将来 3 種類目が来たとき `transition/` を追加するだけ

**欠点:**
- 既存の `playwright.ts`, `xctest.ts` を `screen/` に移動する必要がある — import パスが変わる
- registry.ts の import パスが深くなる (`./screen/playwright.js`, `./unit/vitest.js`)
- 4ファイル (Screen 2 + Unit 2) のために2サブディレクトリは過剰
- Step 1 で Devil's Advocate が指摘した「ディレクトリ分割はリファクタのためのリファクタ」の問題が再発

### 確定: 案 B (サブディレクトリ分離) — ユーザー判断

**理由:** spec type ごとのまとまりが明確で、Screen/Unit 両方の xctest を `xctest.ts` と自然に命名できる。将来 3 種類目 (transition) が来たとき `transition/` を追加するだけで拡張可能。既存 playwright.ts, xctest.ts の移動は import パスの変更のみでロジック変更なし。
