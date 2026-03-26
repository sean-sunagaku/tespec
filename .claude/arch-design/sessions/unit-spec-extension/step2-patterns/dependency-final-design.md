# Step 3: 依存関係最終設計

## 1. 最終依存グラフ

### 1a. 変更後の完全な依存グラフ

```
commands/validate.ts
  ├──→ core/parser.ts ──→ core/schema.ts ← zod
  │                           ↑
  ├──→ core/schema.ts ────────┘ (UnitSpecSchema 直接参照 for --file)
  ├──→ core/validator.ts ──→ core/schema.ts (Screen, Setup)
  ├──→ core/unit-validator.ts ──→ core/validator.ts (ValidationIssue, ValidationResult)
  │                          ──→ core/schema.ts (UnitSpec)
  └──→ utils/output.ts

commands/generate.ts
  ├──→ core/parser.ts ──→ core/schema.ts
  ├──→ core/generators/registry.ts
  │       ├──→ generators/types.ts ──→ core/schema.ts
  │       ├──→ generators/playwright.ts ──→ core/schema.ts (Screen, Setup, Case)
  │       ├──→ generators/xctest.ts ──→ core/schema.ts (Screen, Setup, Case)
  │       ├──→ generators/vitest.ts ──→ core/schema.ts (UnitSpec)      [NEW]
  │       └──→ generators/xctest-unit.ts ──→ core/schema.ts (UnitSpec) [NEW]
  ├──→ core/validator.ts
  ├──→ core/unit-validator.ts [NEW]
  └──→ utils/output.ts
```

### 1b. 依存方向の検証

| 依存パス | 方向 | 安全性 |
|---------|------|--------|
| commands → core | 下向き | OK |
| commands → utils | 横向き | OK (utils は core に依存しない) |
| core/parser → core/schema | 下向き | OK |
| core/validator → core/schema | 下向き | OK |
| core/unit-validator → core/validator | 横向き | OK (型の再利用のみ) |
| core/unit-validator → core/schema | 下向き | OK |
| generators/* → core/schema | 上向き (generators → schema) | OK (一方向) |
| generators/registry → generators/* | 集約 | OK (一方向) |

**循環依存: なし。全パスが DAG (有向非巡回グラフ) を構成。**

### 1c. Screen 系と Unit 系の依存交差チェック

```
Screen 系: validator.ts ──→ schema.ts (Screen, Setup)
Unit 系:   unit-validator.ts ──→ schema.ts (UnitSpec)
                              ──→ validator.ts (ValidationIssue, ValidationResult のみ)
```

- unit-validator.ts は validator.ts の **型定義のみ** を import する
- validator.ts の Screen ロジックには依存しない
- Screen と Unit のロジックは交差しない

## 2. リネーム対象の完全なリスト

`Target` → `ScreenTarget`, `FrameworkGenerator` → `ScreenGenerator` の一括置換。

| ファイル | 変更内容 |
|---------|---------|
| `generators/types.ts:3` | `export type Target` → `export type ScreenTarget` |
| `generators/types.ts:5` | `export interface FrameworkGenerator` → `export interface ScreenGenerator` |
| `generators/registry.ts:2` | `import type { FrameworkGenerator, Target }` → `import type { ScreenGenerator, ScreenTarget }` |
| `generators/registry.ts:5` | `Record<Target, FrameworkGenerator>` → `Record<ScreenTarget, ScreenGenerator>` |
| `generators/registry.ts:7` | `getGenerator(target: Target): FrameworkGenerator` → `getScreenGenerator(target: ScreenTarget): ScreenGenerator` |
| `generators/registry.ts:11` | `AVAILABLE_TARGETS: readonly Target[]` → `SCREEN_TARGETS: readonly ScreenTarget[]` |
| `generators/registry.ts:13` | `isTarget(value: string): value is Target` → `isScreenTarget(value: string): value is ScreenTarget` |
| `generators/playwright.ts:2` | `import type { FrameworkGenerator }` → `import type { ScreenGenerator }` |
| `generators/playwright.ts:4` | `const playwright: FrameworkGenerator` → `const playwright: ScreenGenerator` |
| `generators/xctest.ts:2` | `import type { FrameworkGenerator }` → `import type { ScreenGenerator }` |
| `generators/xctest.ts:4` | `const xctest: FrameworkGenerator` → `const xctest: ScreenGenerator` |
| `commands/generate.ts:6` | `import { AVAILABLE_TARGETS, getGenerator, isTarget }` → `import { SCREEN_TARGETS, getScreenGenerator, isScreenTarget, ... }` |
| `commands/generate.ts:36` | `options: [...AVAILABLE_TARGETS]` → 変更 (後述: target 解決設計) |
| `commands/generate.ts:46` | `isTarget(flags.target)` → 変更 (後述) |
| `commands/generate.ts:50` | `getGenerator(flags.target)` → 変更 (後述) |

テストファイルに `Target` / `FrameworkGenerator` の直接参照はなし (確認済み)。

## 3. unit-validator.ts の依存設計

### 3a. ValidationIssue / ValidationResult の共有方法

**選択肢**:
1. validator.ts から import する (横方向依存)
2. 共通型ファイルを新設する (types.ts)
3. unit-validator.ts で再定義する

**選定: 選択肢 1 (validator.ts から import)**

理由:
- `ValidationIssue` と `ValidationResult` は汎用的な型で、Screen 固有ではない
- 共通型ファイル新設は YAGNI (2箇所でしか使わない)
- 再定義は DRY 違反

依存方向の安全性:
```
unit-validator.ts ──→ validator.ts    (型の import のみ)
unit-validator.ts ──→ schema.ts       (UnitSpec)
validator.ts ──/──→ unit-validator.ts  (逆方向なし)
```

`unit-validator.ts` が validator.ts に依存するのは型定義のみで、ロジックへの依存はない。将来 3 種類目が追加され、3つの validator が同じ型を共有する場合に types.ts への抽出を検討する (Rule of Three)。

### 3b. unit-validator.ts のインターフェース

```typescript
import type { ValidationIssue, ValidationResult } from './validator.js';
import type { UnitSpec } from './schema.js';

export function validateUnits(units: UnitSpec[]): ValidationResult;
```

- Setup を引数に取らない (Unit は Setup を参照しない)
- Screen を引数に取らない (Unit と Screen は独立)
- 戻り値は ValidationResult (validator.ts と同じ型)

## 4. generate コマンドの --target 解決設計

### 4a. 問題の定義

`--type` フラグなしの自動判定方針では、`--target` フラグが Screen と Unit の両方に適用される可能性がある。しかし:
- ScreenTarget = `playwright | xctest`
- UnitTarget = `vitest | xctest`
- `playwright` は Unit に無効、`vitest` は Screen に無効

### 4b. 選定: config.yaml で unit_target を管理

```yaml
# config.yaml
version: 1
project: my-app
screens_dir: ./screens
setups_dir: ./setups
units_dir: ./units        # optional — 未定義なら Unit パースをスキップ
unit_target: vitest       # optional — デフォルト vitest
```

**依存方向**:
```
config.yaml → ConfigSchema (schema.ts) → parser.ts → commands/generate.ts
```

- `--target` フラグは既存のまま Screen 用に維持
- Unit の target は `config.unit_target` で決定 (デフォルト `vitest`)
- コマンド層で `--target` と `config.unit_target` を独立に解決
- ScreenTarget / UnitTarget の型分離がコマンド層でも保たれる

### 4c. ConfigSchema の変更

```typescript
export const ConfigSchema = z.object({
  version: z.number(),
  project: z.string(),
  screens_dir: z.string().default('./screens'),
  setups_dir: z.string().default('./setups'),
  units_dir: z.string().optional(),                              // NEW
  unit_target: z.enum(['vitest', 'xctest']).default('vitest'),   // NEW
});
```

- `units_dir`: `.optional()` — 未定義なら Unit なし
- `unit_target`: `.default('vitest')` — units_dir が定義されている場合のデフォルト

### 4d. generate.ts の target 解決フロー

```typescript
// Screen 生成: --target フラグを使用 (既存ロジック)
if (screens.length > 0) {
  if (!isScreenTarget(flags.target)) {
    printError('target', `Screen に対して無効な target: ${flags.target}`);
    this.exit(1);
  }
  const screenGenerator = getScreenGenerator(flags.target);
  // ... Screen 生成処理
}

// Unit 生成: config.unit_target を使用 (新規ロジック)
if (units.length > 0) {
  const unitTarget = parsed.result.config.unit_target ?? 'vitest';
  const unitGenerator = getUnitGenerator(unitTarget as UnitTarget);
  // ... Unit 生成処理
}
```

- `--target` は Screen にのみ適用
- Unit の target は config から取得
- 両方の型が独立に解決される
- `--target vitest` を指定しても Screen 用として処理 → isScreenTarget で弾かれる

### 4e. --target フラグの options 更新

現在: `options: [...AVAILABLE_TARGETS]` → `['playwright', 'xctest']`

Unit 追加後も Screen 用 `--target` の options は変わらない。Unit の target は config で管理するため、CLI フラグの選択肢に `vitest` を追加する必要はない。

**ただし**: Screen がなく Unit のみのプロジェクトで `--target` のデフォルト `playwright` がエラーになる。この場合:
- Screen がない → `--target` は無視される (Screen 生成をスキップ)
- Unit の target は config から取得
- エラーにはならない

## 5. parser.ts の依存変更

### 5a. ParsedProject の拡張

```typescript
export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];  // NEW
}
```

### 5b. parseProject の分岐ロジック

```typescript
// units_dir が config に定義されている場合のみパース
const unitsDir = configResult.data.units_dir
  ? path.resolve(configDir, configResult.data.units_dir)
  : null;

const [screensResult, setupsResult, unitsResult] = await Promise.all([
  parseYamlDirectory(screensDir, ScreenSchema),
  parseYamlDirectory(setupsDir, SetupSchema),
  unitsDir ? parseYamlDirectory(unitsDir, UnitSpecSchema) : { items: [], errors: [] },
]);
```

**依存方向**: parser.ts → schema.ts に `UnitSpecSchema` の import が追加されるのみ。方向は変わらない。

## 6. registry.ts の最終設計

```typescript
import { playwright } from './playwright.js';
import type { ScreenGenerator, ScreenTarget, UnitGenerator, UnitTarget } from './types.js';
import { vitest } from './vitest.js';
import { xctest } from './xctest.js';
import { xctestUnit } from './xctest-unit.js';

// Screen Registry
const SCREEN_REGISTRY: Record<ScreenTarget, ScreenGenerator> = { playwright, xctest };

export function getScreenGenerator(target: ScreenTarget): ScreenGenerator {
  return SCREEN_REGISTRY[target];
}
export const SCREEN_TARGETS: readonly ScreenTarget[] = Object.keys(SCREEN_REGISTRY) as ScreenTarget[];
export function isScreenTarget(value: string): value is ScreenTarget {
  return (SCREEN_TARGETS as readonly string[]).includes(value);
}

// Unit Registry
const UNIT_REGISTRY: Record<UnitTarget, UnitGenerator> = { vitest, xctest: xctestUnit };

export function getUnitGenerator(target: UnitTarget): UnitGenerator {
  return UNIT_REGISTRY[target];
}
export const UNIT_TARGETS: readonly UnitTarget[] = Object.keys(UNIT_REGISTRY) as UnitTarget[];
export function isUnitTarget(value: string): value is UnitTarget {
  return (UNIT_TARGETS as readonly string[]).includes(value);
}
```

**依存グラフ**:
```
registry.ts ──→ playwright.ts ──→ schema.ts (Screen, Setup, Case)
            ──→ xctest.ts ──→ schema.ts (Screen, Setup, Case)
            ──→ vitest.ts ──→ schema.ts (UnitSpec)         [NEW]
            ──→ xctest-unit.ts ──→ schema.ts (UnitSpec)    [NEW]
            ──→ types.ts ──→ schema.ts
```

全ての矢印が一方向。registry.ts は集約点だが、逆方向の依存はない。

## 7. 変更影響サマリー

| ファイル | 変更種別 | schema.ts への依存 | 新規依存 |
|---------|---------|-------------------|---------|
| `schema.ts` | 追記 | (自身) | なし |
| `parser.ts` | 追記 | + UnitSpecSchema | なし |
| `validator.ts` | **変更なし** | Screen, Setup | なし |
| `unit-validator.ts` | **新規** | UnitSpec | → validator.ts (型のみ) |
| `generators/types.ts` | 追記 | + UnitSpec | なし |
| `generators/registry.ts` | 追記 + リネーム | (types.ts 経由) | → vitest.ts, xctest-unit.ts |
| `generators/playwright.ts` | リネーム | Screen, Setup, Case | なし |
| `generators/xctest.ts` | リネーム | Screen, Setup, Case | なし |
| `generators/vitest.ts` | **新規** | UnitSpec | → types.ts |
| `generators/xctest-unit.ts` | **新規** | UnitSpec | → types.ts |
| `commands/validate.ts` | 追記 | + UnitSpecSchema | → unit-validator.ts |
| `commands/generate.ts` | 追記 + リネーム | (registry 経由) | → unit-validator.ts |

**新規依存パス (全て一方向)**:
1. `commands/* → unit-validator.ts → schema.ts`
2. `commands/* → unit-validator.ts → validator.ts` (型のみ)
3. `registry.ts → vitest.ts → schema.ts`
4. `registry.ts → xctest-unit.ts → schema.ts`
5. `parser.ts → schema.ts` (UnitSpecSchema 追加)

**循環依存: なし。逆方向依存: なし。**
