# Platform Expert Review: パターン A スタック適合性確認

## 結論: 適合性問題なし

パターン A（Flat Extension）は oclif v4 / Zod v4 / TypeScript ESM スタックと完全に適合する。ブロッキングイシューはゼロ。

---

## 1. ファイル配置と oclif コマンドディスカバリー

### 現在のディレクトリ構造 → パターン A 適用後

```
src/
  commands/
    validate.ts          # 既存（追記）
    generate.ts          # 既存（追記）
  core/
    schema.ts            # 既存（追記: UnitCaseSchema, UnitMethodSchema, UnitSpecSchema, ConfigSchema.units_dir）
    parser.ts            # 既存（追記: ParsedProject.units, parseProject 拡張）
    validator.ts         # 変更なし
    unit-validator.ts    # 新規
    __test__/
      generator-xctest.test.ts
      generator.test.ts
      parser.test.ts
      schema.test.ts
      validator.test.ts
      unit-validator.test.ts  # 新規テスト
      generator-vitest.test.ts       # 新規テスト
      generator-xctest-unit.test.ts  # 新規テスト
    generators/
      types.ts           # 既存（追記: UnitGenerator, ScreenTarget, UnitTarget）
      registry.ts        # 既存（追記: UNIT_REGISTRY, getUnitGenerator 等）
      playwright.ts      # 変更なし
      xctest.ts          # 変更なし
      vitest.ts          # 新規
      xctest-unit.ts     # 新規
  utils/
    output.ts            # 変更なし
```

### oclif 互換性

`oclif.commands` は `./dist/commands` を指す。パターン A は `commands/` 配下のファイル名を変更しないため、oclif のコマンドディスカバリーに影響なし。

- `validate.ts` → `tespec validate` (変更なし)
- `generate.ts` → `tespec generate` (変更なし)
- 新しいコマンドファイルは追加しない → oclif の設定変更不要

`core/` 配下のファイル追加・変更は oclif に一切関係しない（oclif は `commands/` のみスキャンする）。

---

## 2. 既存 import パスへの影響

パターン A で既存コードの import パスは一切変更不要。

### 既存の import 関係（変更なし）

| ファイル | import 元 | 影響 |
|---------|----------|------|
| `commands/generate.ts` | `../core/generators/registry.js` | 変更なし（registry.ts に export 追加するが既存 export は維持） |
| `commands/validate.ts` | `../core/schema.js`, `../core/parser.js`, `../core/validator.js` | 変更なし |
| `generators/playwright.ts` | `../schema.js`, `./types.js` | 変更なし |
| `generators/xctest.ts` | `../schema.js`, `./types.js` | 変更なし |
| `generators/registry.ts` | `./playwright.js`, `./types.js`, `./xctest.js` | 既存 import は変更なし。新規 import 追加のみ |

### 新規追加される import

| ファイル | 追加する import |
|---------|----------------|
| `commands/generate.ts` | `../core/generators/registry.js` から `getUnitGenerator`, `isUnitTarget` を追加 import |
| `commands/generate.ts` | `../core/unit-validator.js` を新規 import |
| `commands/validate.ts` | `../core/unit-validator.js` を新規 import |
| `commands/validate.ts` | `../core/schema.js` から `UnitSpecSchema` を追加 import |
| `generators/registry.ts` | `./vitest.js`, `./xctest-unit.js` を新規 import |
| `generators/types.ts` | `../schema.js` から `UnitSpec` を追加 import |

全て `.js` 拡張子付きの ESM import パターンに従う。

---

## 3. Zod v4 適合性

### ConfigSchema の `units_dir` 追加

```typescript
export const ConfigSchema = z.object({
  version: z.number(),
  project: z.string(),
  screens_dir: z.string().default('./screens'),
  setups_dir: z.string().default('./setups'),
  units_dir: z.string().default('./units'),  // 追加
});
```

**Zod v4 の挙動確認:**
- `.default('./units')` は `safeParse` 時にフィールドが `undefined` なら `'./units'` を埋める
- 既存 config.yaml に `units_dir` がなくても正常パース可能 → 後方互換あり
- `z.infer<typeof ConfigSchema>` の型は `{ ..., units_dir: string }` になる（optional ではなく string）

### UnitSpecSchema の methods ネスト

```typescript
export const UnitCaseSchema = z.object({
  action: z.string(),
  expect: z.union([z.string(), z.array(z.string())]),
  type: z.enum(['normal', 'error', 'boundary']).default('normal'),
});

export const UnitMethodSchema = z.object({
  method: z.string(),
  cases: z.array(UnitCaseSchema).min(1),
});

export const UnitSpecSchema = z.object({
  unit: z.string(),
  title: z.string(),
  methods: z.array(UnitMethodSchema).min(1),
});
```

**Zod v4 での確認事項:**
- ネストされた `z.object` 内の `.default()` は正常動作（UnitCaseSchema.type のデフォルト値）
- `.min(1)` は Zod v4 の `z.array()` で有効
- `z.infer<typeof UnitSpecSchema>` はネスト構造を正しく推論する

---

## 4. TypeScript ESM 固有の確認

### 新規ファイルの import パス

全て `.js` 拡張子を明示する必要がある:

```typescript
// generators/registry.ts に追加
import { vitest } from './vitest.js';
import { xctestUnit } from './xctest-unit.js';

// commands/validate.ts に追加
import { validateUnits } from '../core/unit-validator.js';

// commands/generate.ts に追加
import { validateUnits } from '../core/unit-validator.js';
```

### tsup ビルドへの影響

`tsup` はエントリポイント (`src/cli.ts`) からの依存グラフを辿ってバンドルする。新規ファイルが既存の import チェーンに接続されていれば自動的にバンドルされる。

- `vitest.ts` → `registry.ts` から import → `generate.ts` から import → `cli.ts` から到達可能
- `xctest-unit.ts` → 同上
- `unit-validator.ts` → `validate.ts` / `generate.ts` から import → `cli.ts` から到達可能

tsup の設定変更は不要。

---

## 5. generate.ts の `--target` フラグ拡張

### 現状の `--target` フラグ

```typescript
target: Flags.string({
  char: 't',
  description: 'Target test framework',
  options: [...AVAILABLE_TARGETS],  // ['playwright', 'xctest']
  default: 'playwright',
}),
```

### パターン A 適用後

`--type` フラグは追加しない（自動判定）。`--target` の `options` に `vitest` を追加する必要がある。

```typescript
target: Flags.string({
  char: 't',
  description: 'Target test framework',
  options: [...ALL_TARGETS],  // ['playwright', 'xctest', 'vitest']
  default: 'playwright',
}),
```

**oclif v4 の制約:**
- `Flags.string({ options: [...] })` は静的に定義される。`--type` に連動して動的に変更はできない
- したがって `options` には Screen + Unit の全 target を列挙し、`run()` 内で有効な組み合わせをバリデーションする

**target 解決ロジック:**

```typescript
// generate.ts の run() 内
const { screens, setups, units } = parsed.result;

// Screen 生成
if (screens.length > 0) {
  if (isScreenTarget(flags.target)) {
    const gen = getScreenGenerator(flags.target);
    // ... Screen 生成
  }
  // flags.target が 'vitest' の場合は Screen をスキップ（エラーではない）
}

// Unit 生成
if (units.length > 0) {
  if (isUnitTarget(flags.target)) {
    const gen = getUnitGenerator(flags.target);
    // ... Unit 生成
  }
  // flags.target が 'playwright' の場合は Unit をスキップ（エラーではない）
}
```

**重要な設計判断（Step 3 で要確定）:**
- `--target playwright` 指定時: Screen のみ生成、Unit はスキップ
- `--target vitest` 指定時: Unit のみ生成、Screen はスキップ
- `--target xctest` 指定時: Screen + Unit 両方生成（xctest は両方に存在）
- `--target` 省略時（default: `'playwright'`）: Screen のみ生成。Unit の default target が未定義 → **Step 3 で要議論**

### `--target` デフォルト値の問題

現在のデフォルトは `'playwright'`（Screen 専用）。Unit を自動判定で処理する方針と合わせると、`--target` 省略時に Unit が生成されないという矛盾が生じる。

**解決案:**
- A案: デフォルトを維持し、Unit は `--target vitest` で明示指定が必要
- B案: `--target` 省略時は spec type ごとにデフォルト target を適用（Screen → playwright, Unit → vitest）
- C案: `--target` を spec type ごとに別フラグにする（`--screen-target`, `--unit-target`）→ 複雑化するので非推奨

**推奨: B案** — spec type ごとのデフォルト target をコード内で定義。

```typescript
const DEFAULT_SCREEN_TARGET: ScreenTarget = 'playwright';
const DEFAULT_UNIT_TARGET: UnitTarget = 'vitest';
```

`--target` 省略時は両方のデフォルトを適用。`--target xctest` 指定時は両方に xctest を適用。`--target vitest` 指定時は Unit のみ。

---

## 6. parser.ts の units_dir 不在時の挙動

### 現在の `parseYamlDirectory` のエラーハンドリング

```typescript
// ディレクトリが存在しない場合
catch (error) {
  return {
    items: [],
    errors: [{ file: directoryPath, message: 'ディレクトリが見つかりません: ...' }],
  };
}
```

現在はディレクトリ不在をエラーとして返す。しかし `units_dir` はオプショナルな性質（Unit Spec を使わないプロジェクトでは存在しない）。

**推奨:** `parseProject` 内で `units_dir` の存在チェックを行い、存在しない場合はスキップ（空配列を返す）。`parseYamlDirectory` 自体は変更しない。

```typescript
// parser.ts の parseProject 内
import { access } from 'node:fs/promises';

const unitsDir = path.resolve(configDir, configResult.data.units_dir);
let unitsResult: ParsedDirectoryResult<UnitSpec>;
try {
  await access(unitsDir);
  unitsResult = await parseYamlDirectory(unitsDir, UnitSpecSchema);
} catch {
  unitsResult = { items: [], errors: [] };  // ディレクトリなし → スキップ
}
```

---

## 7. validate.ts の `--file` 対応

### 現在の単一ファイルバリデーション

```typescript
private async validateSingleFile(inputPath: string): Promise<void> {
  const screenResult = await parseYamlFile(filePath, ScreenSchema);
  if (screenResult.data) { printOk(...); return; }
  const setupResult = await parseYamlFile(filePath, SetupSchema);
  if (setupResult.data) { printOk(...); return; }
  // 両方失敗 → エラー表示
}
```

**パターン A 適用後:** UnitSpecSchema の試行を追加する必要がある。

```typescript
private async validateSingleFile(inputPath: string): Promise<void> {
  const screenResult = await parseYamlFile(filePath, ScreenSchema);
  if (screenResult.data) { printOk(...); return; }
  const setupResult = await parseYamlFile(filePath, SetupSchema);
  if (setupResult.data) { printOk(...); return; }
  const unitResult = await parseYamlFile(filePath, UnitSpecSchema);
  if (unitResult.data) { printOk(...); return; }
  // 全失敗 → エラー表示（selectSingleFileErrors のロジック拡張が必要）
}
```

**注意:** `selectSingleFileErrors` 関数はパスに `/setups/` が含まれるかで Screen/Setup を判定している。Unit 対応では `/units/` パスの判定を追加する必要がある。

---

## 8. テスト fixture 構造

### 既存 fixture に units_dir は不要

config.yaml の `units_dir` はデフォルト `'./units'` で、ディレクトリ不在時はスキップするため、既存の fixture は一切変更不要。

### 新規 Unit Spec 用 fixture

```
tests/fixtures/
  valid-with-units/       # 新規: Screen + Unit 両方あるケース
    config.yaml
    screens/
    setups/
    units/
      user-service.yaml
  units-only/             # 新規: Unit のみのケース
    config.yaml
    units/
      calculator.yaml
```

---

## まとめ: 適合性チェックリスト

| 確認項目 | 結果 | 備考 |
|---------|------|------|
| oclif コマンドディスカバリー | OK | commands/ 配下のファイル名変更なし |
| 既存 import パス | OK | 変更なし。新規 import 追加のみ |
| ESM `.js` 拡張子 | OK | 新規ファイルも `.js` 拡張子で import |
| tsup ビルド | OK | 設定変更不要。import チェーンで自動バンドル |
| Zod v4 スキーマ | OK | `.default()`, `.min()`, ネスト構造すべて正常 |
| 後方互換（config.yaml） | OK | `units_dir` は `.default('./units')` で未指定時も安全 |
| 後方互換（CLI） | OK | 既存コマンド・フラグはそのまま動作 |
| 既存テスト | OK | 変更不要 |

### Step 3 で要確定の技術的判断

1. **`--target` デフォルト値**: spec type ごとのデフォルト target を適用する B案を推奨
2. **units_dir 不在時の挙動**: `parseProject` 内で存在チェック → スキップを推奨
3. **`--file` の UnitSpecSchema 試行**: `selectSingleFileErrors` のロジック拡張
