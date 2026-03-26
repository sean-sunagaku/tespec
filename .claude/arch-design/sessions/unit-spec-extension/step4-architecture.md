# Unit Spec Extension: 最終アーキテクチャ設計書

## 概要

tespec CLI に「Unit Spec」（クラス単体テスト仕様の YAML サポート）を追加する。既存の Screen Spec（画面 E2E テスト仕様）とは完全に独立した YAML フォーマットとして、Flat Extension パターンで実装する。

---

## 1. Architecture Decision Records (ADR)

### ADR-1: UnitCaseSchema は CaseSchema と独立定義

- **決定**: UnitCaseSchema を CaseSchema とは共有せず、完全に独立して定義する
- **根拠**: Screen の CaseSchema は `steps`（min(1) 必須）、`given`、`target`、`not_expect`、`navigates_to` を持つ。Unit Case は `action`、`expect`、`type` のみ。omit するフィールドが5つ、残るのが3つでは実質的に別物。共有するとScreen 側の変更が Unit に波及するリスクがある
- **代替案**: CaseSchema.omit() で差分管理 (Devil's Advocate 提案) → ユーザー判断で却下
- **影響**: Unit Case にフィールドを追加する場合、Screen の CaseSchema に影響しない

### ADR-2: methods ネスト構造を採用

- **決定**: Unit YAML は `methods:` でメソッド単位にケースをネストする（B案）
- **根拠**: Phase A で確定。Unit テストではメソッド単位のグルーピングに強い慣習がある。生成コードの describe/MARK ブロックに自然にマッピングできる
- **代替案**: フラット案（Screen と同じ cases 直下）→ Phase A で不採用
- **影響**: スキーマにネスト層が1つ追加。バリデーションとジェネレーターがメソッド単位で処理

### ADR-3: `--type` フラグは追加しない

- **決定**: config.yaml の `units_dir` 有無で自動判定する。CLI に `--type` フラグは追加しない
- **根拠**: `units_dir` が config に定義されていなければ Unit は存在しない。フラグの追加は CLI の学習コストを増やすだけ
- **代替案**: `--type screen|unit` フラグで絞り込み → ユーザー判断で却下
- **影響**: `units_dir` がなければ Unit パースをスキップ。ユーザーは config の有無だけで制御可能

### ADR-4: ScreenGenerator / UnitGenerator は別 interface

- **決定**: Screen 用と Unit 用で Generator interface を分離する
- **根拠**: Screen は `generate(screen: Screen, setups: Setup[])` の2引数、Unit は `generate(unit: UnitSpec)` の1引数。入力型が根本的に異なるため、union 化は型ガードを強制し複雑化する
- **代替案**: `SpecGenerator<T>` generics で統合 (Devil's Advocate 提案) → 引数の数の違いを安全に吸収できない
- **影響**: types.ts に2つの interface を定義。registry にも2つのルックアップ関数

### ADR-5: ScreenTarget / UnitTarget は別型

- **決定**: `ScreenTarget = 'playwright' | 'xctest'`、`UnitTarget = 'vitest' | 'xctest'` として分離
- **根拠**: 無効な組み合わせ（Screen + vitest、Unit + playwright）をコンパイル時に排除可能
- **影響**: `xctest` が両方に存在するが、実装は別ファイル（Screen 用は XCUITest、Unit 用は XCTest）

### ADR-6: 後方互換 alias を残さない

- **決定**: `Target` → `ScreenTarget`、`FrameworkGenerator` → `ScreenGenerator` に一括置換。alias は不要
- **根拠**: 全て内部コード（外部公開 API ではない）。alias を残すと「どちらを使うべきか」の混乱を招く
- **影響**: types.ts, registry.ts, commands/generate.ts, generators/screen/playwright.ts, generators/screen/xctest.ts の計5ファイルで rename + screen/ 移動に伴う import パス変更

### ADR-7: units_dir は `.optional()`（デフォルトなし）

- **決定**: ConfigSchema の `units_dir` は `.optional()` とし、`.default('./units')` は使わない
- **根拠**: `.default('./units')` だと Unit を使わないプロジェクトでも `./units` ディレクトリの不在でエラーになる。`.optional()` なら未定義 = Unit なしという明快なセマンティクス
- **影響**: `parseProject` 内で `config.units_dir` が undefined ならスキップ

### ADR-8: Unit の target は `--unit-target` CLI フラグで管理

- **決定**: `--target` は Screen 専用に維持。Unit 用には `--unit-target` フラグを新設（デフォルト `vitest`）
- **根拠**: Screen の `--target` との対称性。config.yaml にフレームワーク固有設定を混ぜない。デフォルト vitest で99%のケースはフラグ指定不要
- **代替案**: config.yaml の `unit_target` フィールドで管理 (Dependency Analyst 提案) → CLI フラグの方が発見しやすく `--help` で表示される
- **影響**: ConfigSchema に `unit_target` の追加は不要。commands/generate.ts に `--unit-target` フラグ追加

### ADR-9: ValidationIssue/ValidationResult は unit-validator.ts 内で再定義

- **決定**: 既存 validator.ts から import せず、unit-validator.ts 内に同じ型を再定義する
- **根拠**: unit-validator.ts が validator.ts に一切依存しない完全独立モジュールになる。37行程度の型重複は許容範囲。3種類目追加時に共通型ファイルを抽出（Rule of Three）
- **代替案**: validator.ts から `import type` で共有 (Dependency Analyst 提案、Devil's Advocate も推奨) → 横方向依存が生まれる。軽微な差であり、ユーザーの好みで変更可
- **影響**: unit-validator.ts の依存は schema.ts のみ

### ADR-10: generators/ はサブディレクトリ分離

- **決定**: generators/ 配下を `screen/`, `unit/` サブディレクトリに分離する。既存の playwright.ts, xctest.ts は `screen/` に移動、新規の vitest.ts, xctest.ts は `unit/` に配置
- **根拠**: spec type ごとのまとまりが明確。Unit 用 xctest を `xctest.ts` と命名可能（ディレクトリで名前空間を分離）。将来の3種類目は `transition/` を追加するだけ。ユーザー判断で確定
- **代替案**: フラット構造で vitest.ts, xctest-unit.ts を追加 → ファイル移動が不要だが、spec type の区別がファイル名命名規則に依存
- **影響**: 既存の playwright.ts, xctest.ts を `screen/` に移動。import パスが `./playwright.js` → `./screen/playwright.js` に変更。registry.ts の import を更新

---

## 2. 選定パターン: Flat Extension + Type-Specific Modules

10パターンを比較し、加重スコアリングで選定。

| # | パターン | スコア | 判定 |
|---|---------|:-----:|------|
| 1 | **Flat Extension + Type-Specific Modules** | **4.80** | **選定** |
| 2 | Namespace Directory Separation | 3.40 | 不採用 |
| 3 | Generic Spec Framework | 2.80 | 不採用 |
| 4 | Shared CaseSchema + Omit/Extend | 3.90 | 不採用 |
| 5 | Monolith Merge | 3.15 | 不採用 |
| 6 | Dynamic Plugin Registry | 2.40 | 不採用 |
| 7 | Separate Command per Spec Type | 3.00 | 不採用 |
| 8 | Config-Driven Spec Type Discovery | 2.60 | 不採用 |
| 9 | Unified Interface with Adapter | 3.20 | 不採用 |
| 10 | Flat Extension + CaseSchema Shared | 4.15 | 不採用 |

---

## 3. 確定 YAML フォーマット

```yaml
unit: UserService
title: ユーザーサービス
methods:
  - method: createUser
    cases:
      - action: 有効なメールで作成
        expect: User が返る
        type: normal
      - action: 重複メールで作成
        expect: DuplicateEmailError
        type: error
      - action: メールアドレスが空文字
        expect: ValidationError
        type: boundary
  - method: deleteUser
    cases:
      - action: 存在するユーザーを削除
        expect: 正常に削除される
```

配置: `docs/tespec/units/` ディレクトリ（1クラス1ファイル）

---

## 4. ファイル構成と変更影響

### 4.1 最終ディレクトリ構造

```
src/core/
  schema.ts              # 既存 + Unit スキーマ追加 + ConfigSchema.units_dir 追加
  parser.ts              # 既存 + ParsedProject.units + parseProject 拡張
  validator.ts           # 変更なし
  unit-validator.ts      # 新規
  generators/
    types.ts             # ScreenTarget/ScreenGenerator (rename) + UnitTarget/UnitGenerator (新規)
    registry.ts          # SCREEN_REGISTRY (rename) + UNIT_REGISTRY (新規)
    screen/              # Screen 用ジェネレーター (既存ファイルを移動)
      playwright.ts      # ScreenGenerator に rename + 移動
      xctest.ts          # ScreenGenerator に rename + 移動
    unit/                # Unit 用ジェネレーター (新規)
      vitest.ts          # 新規
      xctest.ts          # 新規
src/commands/
  validate.ts            # unit-validator 呼び出し追加
  generate.ts            # --unit-target, --unit フラグ + unit generator 呼び出し追加
```

### 4.2 変更影響サマリー

| ファイル | 変更種別 | 変更内容 |
|---------|---------|---------|
| `unit-validator.ts` | **新規** | validateUnits() + 5つのチェック関数 |
| `generators/unit/vitest.ts` | **新規** | vitest テストスケルトン生成 |
| `generators/unit/xctest.ts` | **新規** | XCTest ユニットテスト生成 |
| `schema.ts` | 追記 | UnitCaseSchema, UnitMethodSchema, UnitSpecSchema + ConfigSchema.units_dir |
| `parser.ts` | 追記 | ParsedProject.units + parseProject に units パース |
| `generators/types.ts` | 追記 + rename | Target→ScreenTarget, FrameworkGenerator→ScreenGenerator + UnitTarget, UnitGenerator |
| `generators/registry.ts` | 追記 + rename + import パス変更 | getGenerator→getScreenGenerator + UNIT_REGISTRY, getUnitGenerator + screen/unit サブディレクトリからの import |
| `generators/screen/playwright.ts` | rename + 移動 | FrameworkGenerator→ScreenGenerator + generators/ → generators/screen/ に移動 |
| `generators/screen/xctest.ts` | rename + 移動 | FrameworkGenerator→ScreenGenerator + generators/ → generators/screen/ に移動 |
| `commands/validate.ts` | 追記 | unit-validator 呼び出し + --file での Unit 試行 |
| `commands/generate.ts` | 追記 + rename | --unit-target, --unit フラグ + unit generator + isTarget→isScreenTarget |
| `validator.ts` | **変更なし** | |

### 4.3 推定変更量

| 区分 | ファイル数 | 推定行数 |
|------|-----------|---------|
| 新規 | 3 | ~300行 |
| 追記 | 6 | ~150行 |
| rename のみ | 2 | ~4箇所 |
| 変更なし | 1 | 0 |
| **合計** | **12** | **~450行追加 + 18箇所 rename** |

既存530行 → 約980行。新機能として妥当な規模。

---

## 5. モジュール詳細設計

### 5.1 schema.ts（追加分）

```typescript
// --- Unit Spec スキーマ ---
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
  units_dir: z.string().optional(),  // 追加: optional, default なし
});

// --- 型エクスポート ---
export type UnitCase = z.infer<typeof UnitCaseSchema>;
export type UnitMethod = z.infer<typeof UnitMethodSchema>;
export type UnitSpec = z.infer<typeof UnitSpecSchema>;
```

### 5.2 parser.ts（変更分）

```typescript
export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];  // 追加
}

// parseProject 内:
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
```

### 5.3 generators/types.ts（全体）

```typescript
import type { Screen, Setup, UnitSpec } from '../schema.js';

// --- Screen 系 (rename) ---
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

### 5.4 generators/registry.ts（全体）

```typescript
import { playwright } from './screen/playwright.js';
import { xctest as screenXctest } from './screen/xctest.js';
import { vitest } from './unit/vitest.js';
import { xctest as unitXctest } from './unit/xctest.js';
import type { ScreenGenerator, ScreenTarget, UnitGenerator, UnitTarget } from './types.js';

// --- Screen Registry (rename) ---
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

### 5.5 unit-validator.ts（新規、全体）

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
  return { issues, hasErrors: issues.some((issue) => issue.level === 'error') };
}
```

チェック内容:
| チェック | レベル | 粒度 |
|---------|--------|------|
| `unit` ID の重複 | error | Unit 全体 |
| `methods` が空 | warning | Unit 単位 |
| method 内の `cases` が空 | warning | メソッド単位 |
| `type: error` のケースが 0 件 | warning | メソッド単位 |
| `type: boundary` のケースが 0 件 | warning | メソッド単位 |

### 5.6 generators/unit/vitest.ts（新規）

- 出力: `describe` ネストで methods グルーピング、`it` で case 記述
- ファイル名: `${unitId}.test.ts`
- normal/error/boundary を `describe` でグルーピング（Playwright generator と同じパターン）
- import パス: `../../schema.js`, `../types.js`

### 5.7 generators/unit/xctest.ts（新規）

- 出力: `MARK:` コメントでメソッドごとにセクション分け
- 関数名: `test_{method}_{action}_{expect}`
- ファイル名: `${ToSwiftClassName(unitId)}Tests.swift`
- import パス: `../../schema.js`, `../types.js`

### 5.8 commands/generate.ts（変更分）

新規フラグ:
```typescript
'unit-target': Flags.string({
  description: 'Target test framework for unit specs',
  options: [...UNIT_TARGETS],
  default: 'vitest',
}),
unit: Flags.string({
  description: 'Generate only a specific unit id',
}),
```

処理フロー:
1. 既存の Screen 生成（`--target` で ScreenTarget を使用）
2. `units.length > 0` なら Unit 生成（`--unit-target` で UnitTarget を使用）
3. `--unit <id>` で特定 Unit のみ生成可能
4. Screen と Unit の出力は同じ `--out-dir` に配置

### 5.9 commands/validate.ts（変更分）

- プロジェクト全体検証: Screen バリデーション後に `validateUnits()` を呼び出し
- `--file` 単一ファイル検証: Screen → Setup → Unit の順で試行。パスに `units/` を含む場合は Unit エラーを優先表示

---

## 6. 依存グラフ

```
commands/validate.ts
  ├──→ core/parser.ts ──→ core/schema.ts
  ├──→ core/schema.ts (UnitSpecSchema for --file)
  ├──→ core/validator.ts ──→ core/schema.ts (Screen, Setup)
  ├──→ core/unit-validator.ts ──→ core/schema.ts (UnitSpec)
  └──→ utils/output.ts

commands/generate.ts
  ├──→ core/parser.ts ──→ core/schema.ts
  ├──→ core/generators/registry.ts
  │       ├──→ generators/types.ts ──→ core/schema.ts
  │       ├──→ generators/screen/playwright.ts ──→ core/schema.ts
  │       ├──→ generators/screen/xctest.ts ──→ core/schema.ts
  │       ├──→ generators/unit/vitest.ts ──→ core/schema.ts   [NEW]
  │       └──→ generators/unit/xctest.ts ──→ core/schema.ts   [NEW]
  ├──→ core/validator.ts
  ├──→ core/unit-validator.ts [NEW]
  └──→ utils/output.ts
```

**依存方向**: `commands → core → schema` の一方向。循環依存なし。
**Screen 系と Unit 系の交差**: なし。両方が schema.ts に依存するが、互いに依存しない。

---

## 7. rename 対象一覧

`Target` → `ScreenTarget`、`FrameworkGenerator` → `ScreenGenerator` の一括置換:

| ファイル | 箇所 |
|---------|------|
| `generators/types.ts` | 定義: `Target` → `ScreenTarget`, `FrameworkGenerator` → `ScreenGenerator` |
| `generators/registry.ts` | import + 使用: `FrameworkGenerator` → `ScreenGenerator`, `Target` → `ScreenTarget`, `getGenerator` → `getScreenGenerator`, `AVAILABLE_TARGETS` → `SCREEN_TARGETS`, `isTarget` → `isScreenTarget` + import パス変更 (`./screen/playwright.js`, `./screen/xctest.js`) |
| `generators/screen/playwright.ts` | import パス変更 (`./types.js` → `../types.js`) + 型注釈: `FrameworkGenerator` → `ScreenGenerator` |
| `generators/screen/xctest.ts` | import パス変更 (`./types.js` → `../types.js`, `../schema.js` → `../../schema.js`) + 型注釈: `FrameworkGenerator` → `ScreenGenerator` |
| `commands/generate.ts` | import + 使用: `AVAILABLE_TARGETS` → `SCREEN_TARGETS`, `getGenerator` → `getScreenGenerator`, `isTarget` → `isScreenTarget` |

---

## 8. CLI 動作仕様

### validate

```bash
tespec validate                    # Screen + Unit 両方
tespec validate --file units/user-service.yaml  # Unit 単一ファイル
```

### generate

```bash
tespec generate                               # Screen(playwright) + Unit(vitest)
tespec generate --target xctest               # Screen(xctest) + Unit(vitest)
tespec generate --unit-target xctest          # Screen(playwright) + Unit(xctest)
tespec generate --screen login                # Screen の login のみ
tespec generate --unit user-service           # Unit の user-service のみ
tespec generate --dry-run                     # stdout のみ
```

### config.yaml

```yaml
version: 1
project: my-app
screens_dir: ./screens
setups_dir: ./setups
units_dir: ./units          # optional — 未定義なら Unit パースをスキップ
```

---

## 9. 実装順序

全変更は1つの PR で実施（段階的マイグレーション不要）:

1. **schema.ts**: UnitCaseSchema, UnitMethodSchema, UnitSpecSchema, ConfigSchema.units_dir 追加
2. **generators/types.ts**: rename + UnitGenerator, UnitTarget 追加
3. **generators/screen/ 作成**: playwright.ts, xctest.ts を移動 + ScreenGenerator に rename + import パス更新
4. **generators/unit/ 作成**: vitest.ts, xctest.ts を新規作成
5. **generators/registry.ts**: rename + import パス変更（screen/, unit/ サブディレクトリ）+ UNIT_REGISTRY 追加
6. **unit-validator.ts**: 新規作成
7. **parser.ts**: ParsedProject.units + parseProject 拡張
8. **commands/validate.ts, generate.ts**: コマンド層拡張
9. **テスト**: 新規モジュールのテスト + 既存テストの rename・パス反映（影響箇所のみ）
