# Step 2: アーキテクチャパターン比較（10パターン網羅）

## 比較対象パターン一覧

| # | パターン名 | カテゴリ | 概要 |
|---|-----------|---------|------|
| 1 | Flat Extension + Type-Specific Modules | 追加型 | 既存構造維持。新規ファイルをフラット追加、既存ファイルは追記のみ |
| 2 | Namespace Directory Separation | リファクタ型 | `screen/`, `unit/`, `shared/` にディレクトリ分離 |
| 3 | Generic Spec Framework | 汎用型 | `SpecType<T>` ジェネリックで spec type を抽象化 |
| 4 | Shared CaseSchema + Omit/Extend | 共有型 | CaseSchema を Screen/Unit で共有し、omit/extend で差分管理 |
| 5 | Monolith Merge | 統合型 | 既存ファイル内に Unit ロジックを直接混入 |
| 6 | Dynamic Plugin Registry | プラグイン型 | spec type をプラグインとして動的 import で登録 |
| 7 | Separate Command per Spec Type | コマンド分離型 | `validate-unit`, `generate-unit` として別コマンド追加 |
| 8 | Config-Driven Spec Type Discovery | 宣言型 | config.yaml に spec type 定義を記述、ランタイムで解釈 |
| 9 | Unified Interface with Adapter | アダプタ型 | 単一 SpecGenerator + Adapter で Screen/Unit の差異を吸収 |
| 10 | Flat Extension + CaseSchema Shared | ハイブリッド型 | パターン1 + パターン4 の組み合わせ |

---

## パターン 1: Flat Extension + Type-Specific Modules (推奨)

### 概要
既存ディレクトリ構造を一切変更せず、新規ファイルをフラット追加し、既存ファイルは追記のみで拡張する。

### 構造
```
src/core/
  schema.ts              # 既存 + UnitCaseSchema, UnitMethodSchema, UnitSpecSchema, ConfigSchema.units_dir
  parser.ts              # 既存 + ParsedProject.units, parseProject 拡張
  validator.ts           # 変更なし
  unit-validator.ts      # 新規: validateUnits()
  generators/
    types.ts             # 既存 + UnitGenerator, ScreenTarget, UnitTarget
    registry.ts          # 既存 + UNIT_REGISTRY, getUnitGenerator
    playwright.ts        # 変更なし
    xctest.ts            # 変更なし
    vitest.ts            # 新規: vitest テスト生成
    xctest-unit.ts       # 新規: XCTest ユニットテスト生成
src/commands/
  validate.ts            # 既存 + unit-validator 呼び出し追加
  generate.ts            # 既存 + unit generator 呼び出し追加
```

### 主要インターフェース

```typescript
// schema.ts (追加分)
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

// generators/types.ts (追加分)
export type ScreenTarget = 'playwright' | 'xctest';
export type UnitTarget = 'vitest' | 'xctest';
export interface UnitGenerator {
  generate(unit: UnitSpec): string;
  fileNameFor(unitId: string): string;
}

// generators/registry.ts (追加分)
const SCREEN_REGISTRY: Record<ScreenTarget, ScreenGenerator> = { playwright, xctest };
const UNIT_REGISTRY: Record<UnitTarget, UnitGenerator> = { vitest, xctest: xctestUnit };
export function getScreenGenerator(target: ScreenTarget): ScreenGenerator { ... }
export function getUnitGenerator(target: UnitTarget): UnitGenerator { ... }

// parser.ts (変更分)
export interface ParsedProject {
  config: Config; screens: Screen[]; setups: Setup[];
  units: UnitSpec[];  // 追加
}
```

### 依存グラフ
```
commands/validate.ts ──→ parser.ts ──→ schema.ts
        ├──→ validator.ts ──→ schema.ts
        ├──→ unit-validator.ts ──→ schema.ts [NEW]
        └──→ output.ts
commands/generate.ts ──→ parser.ts ──→ schema.ts
        ├──→ generators/registry.ts ──→ types.ts ──→ schema.ts
        │       ├──→ playwright.ts, xctest.ts
        │       ├──→ vitest.ts [NEW]
        │       └──→ xctest-unit.ts [NEW]
        ├──→ validator.ts, unit-validator.ts [NEW]
        └──→ output.ts
```
全依存: `commands → core → schema` 一方向。循環なし。

### 変更影響
- 新規: 3ファイル
- 追記のみ: 6ファイル
- 変更なし: validator.ts, playwright.ts, xctest.ts
- 既存テスト影響: なし

---

## パターン 2: Namespace Directory Separation

### 概要
既存コードを `screen/` に移動し、`unit/` を新規追加、共通部品を `shared/` に抽出。

### 構造
```
src/core/
  shared/                # ConfigSchema, SetupSchema, parseYamlFile, 共通型
  screen/                # 既存モジュールを移動（ロジック変更なし）
    schema.ts, validator.ts, generators/
  unit/                  # 新規 Unit Spec モジュール一式
    schema.ts, validator.ts, generators/
  parser.ts              # parseProject オーケストレータ
```

### 不採用理由
- 530行のコードベースに対し、全ファイルの import パス変更 + テスト更新が必要
- Module Designer が初期提案後に自ら撤回
- Step 1 確定方針「ディレクトリ分割なし」に反する
- Rule of Three: 3種類目が来た時点でリファクタしても遅くない

---

## パターン 3: Generic Spec Framework

### 概要
`SpecType<TSpec, TContext>` ジェネリックで spec type を宣言的に登録。parseProject がループで全 spec type を処理。

### 構造
```typescript
interface SpecType<TSpec, TContext = void> {
  schema: ZodType<TSpec>;
  dirKey: keyof Config;
  validate(specs: TSpec[], context: TContext): ValidationResult;
  generators: Record<string, SpecGenerator<TSpec, TContext>>;
}
const SPEC_TYPES = { screen: { ... }, unit: { ... } };
```

### 不採用理由
- 2種類の spec type に対して明らかに過剰設計
- Screen の `generate(screen, setups)` と Unit の `generate(unit)` で引数構造が異なり、`TContext` 型パラメータが不自然に複雑化
- 全エージェントが「汎用 spec type 機構は不要」で合意済み

---

## パターン 4: Shared CaseSchema + Omit/Extend

### 概要
既存の CaseSchema を Screen/Unit で共有し、`CaseSchema.omit({ navigates_to: true })` で Unit 用の差分を管理。

### 構造
```typescript
// Screen Case = 既存のまま
export const CaseSchema = z.object({
  action: z.string(), expect: ..., steps: z.array(z.string()).min(1),
  given: ..., target: ..., type: ..., not_expect: ..., navigates_to: ...
});

// Unit Case = CaseSchema から omit
export const UnitCaseSchema = CaseSchema.omit({
  navigates_to: true, steps: true, given: true, target: true, not_expect: true
});

export const UnitMethodSchema = z.object({
  method: z.string(),
  cases: z.array(UnitCaseSchema).min(1),
});
```

### 不採用理由
- **ユーザー判断で却下済み**: Step 1 で「CaseSchema: 独立定義」と確定
- Screen CaseSchema の `steps` は `.min(1)` で必須。omit で除外すると Unit Case から steps が消えるが、将来 Unit にも steps を追加したくなった場合に CaseSchema の制約が波及する
- omit するフィールド数が多い（navigates_to, steps, given, target, not_expect の5つ）。残るのは action, expect, type のみで、実質的には別物
- Devil's Advocate が推奨したが、他3エージェントは分離を支持

---

## パターン 5: Monolith Merge

### 概要
新規ファイルを作成せず、既存ファイル内に Unit ロジックを直接混入。validator.ts に Unit チェックを追加、types.ts の FrameworkGenerator を union 化。

### 構造
```typescript
// validator.ts に追加
export function validate(
  screens: Screen[], setups: Setup[], units?: UnitSpec[]
): ValidationResult { ... }

// types.ts を union 化
export interface FrameworkGenerator {
  generateScreen?(screen: Screen, setups: Setup[]): string;
  generateUnit?(unit: UnitSpec): string;
  fileNameFor(id: string): string;
}
```

### 不採用理由
- **凝集度の破壊**: Screen 専用として高凝集な validator.ts に Unit ロジックを混入すると責務が曖昧になる
- **Union interface の問題**: Dependency Analyst が「絶対に避けるべき」と明示。全 generator が全 spec type に依存する
- **テスト影響**: 既存テストの前提が変わる（validate のシグネチャ変更）
- **既存コード変更が多い**: validator.ts, types.ts, registry.ts, 全 generator の変更が必要

---

## パターン 6: Dynamic Plugin Registry

### 概要
spec type をプラグインとして動的 import で登録。`src/plugins/unit/` のような構造で、ランタイムにプラグインを発見・登録。

### 構造
```typescript
// plugin-loader.ts
export async function loadPlugins(): Promise<SpecPlugin[]> {
  const pluginDirs = await readdir('./plugins');
  return Promise.all(pluginDirs.map(dir => import(`./plugins/${dir}/index.js`)));
}

interface SpecPlugin {
  name: string;
  schema: ZodType<unknown>;
  configKey: string;
  validators: ValidatorFn[];
  generators: Record<string, GeneratorFn>;
}
```

### 不採用理由
- **ESM + oclif との相性**: 動的 import はビルド時の tree-shaking を阻害し、oclif のコマンドディスカバリーとの整合性が取りにくい
- **2種類のためにプラグインシステムは過剰**: multi-target-generator セッションでも「プラグインは後回し」と判断済み
- **テスト困難**: 動的ロードはモック・スタブが複雑になる
- **純粋 Node.js 制約**: 外部プラグインの信頼性・型安全性の担保が難しい

---

## パターン 7: Separate Command per Spec Type

### 概要
`validate-unit`, `generate-unit` を別コマンドとして追加。既存コマンドは Screen 専用のまま。

### 構造
```
src/commands/
  validate.ts            # Screen 専用（変更なし）
  generate.ts            # Screen 専用（変更なし）
  validate-unit.ts       # Unit 専用（新規）
  generate-unit.ts       # Unit 専用（新規）
```

### 不採用理由
- **Phase A 確定方針に反する**: 「デフォルト全 spec type を処理」が確定しているため、コマンドを分離するとデフォルト動作が成立しない
- **oclif ルーティングの問題**: ハイフン区切りコマンドは oclif v4 でサブコマンドとして解釈される可能性がある（`validate unit` vs `validate-unit`）
- **コード重複**: config パース、エラー出力、dry-run 処理など共通ロジックの重複が大きい
- **CLI の学習コスト増**: ユーザーが4つのコマンドを覚える必要がある

---

## パターン 8: Config-Driven Spec Type Discovery

### 概要
config.yaml に spec type の定義を記述し、CLI がランタイムで解釈。新しい spec type の追加は config の変更だけで対応。

### 構造
```yaml
# config.yaml
version: 1
project: my-project
spec_types:
  screen:
    dir: ./screens
    generator: playwright
  unit:
    dir: ./units
    generator: vitest
```

```typescript
// config-driven parser
for (const [typeName, typeConfig] of Object.entries(config.spec_types)) {
  const schema = getSchemaForType(typeName);  // 型とスキーマの対応は静的
  results[typeName] = await parseYamlDirectory(typeConfig.dir, schema);
}
```

### 不採用理由
- **型安全性の喪失**: config から読んだ文字列で分岐するため、TypeScript のコンパイル時チェックが効かない
- **Zod スキーマは静的**: YAML フォーマットは config で変えられないため、結局 `getSchemaForType` 内部で静的にマッピングが必要
- **過剰な間接層**: 2種類の spec type に対し、config 解釈レイヤーを挟む意味がない
- **エラーメッセージ**: config の typo（`scren` 等）でランタイムエラーが発生し、デバッグが困難

---

## パターン 9: Unified Interface with Adapter

### 概要
単一の `SpecGenerator<T>` interface を定義し、Screen/Unit の差異は Adapter パターンで吸収。

### 構造
```typescript
// 統一 interface
interface SpecGenerator<T> {
  generate(spec: T): string;
  fileNameFor(id: string): string;
}

// Screen Adapter: setups を closure でキャプチャ
function createScreenGenerator(
  gen: FrameworkGenerator, setups: Setup[]
): SpecGenerator<Screen> {
  return {
    generate: (screen) => gen.generate(screen, setups),
    fileNameFor: gen.fileNameFor,
  };
}
```

### 不採用理由
- **不要な間接層**: Screen Generator の `generate(screen, setups)` を `generate(screen)` に変換するだけの Adapter は、コードを複雑にするだけで実益がない
- **setups の closure キャプチャ**: setups が generate 呼び出し時点で確定している前提が暗黙的
- **既存 interface の変更**: 既存の `FrameworkGenerator` を Adapter で包む必要があり、テストも Adapter 経由になる
- **パターン1で十分**: コマンド層で Screen/Unit を分岐するだけで同じことが実現できる

---

## パターン 10: Flat Extension + CaseSchema Shared

### 概要
パターン1（Flat Extension）のファイル構造を採用しつつ、CaseSchema は Screen/Unit で共有（パターン4のスキーマ戦略）。

### 構造
パターン1と同じファイル構成だが、schema.ts で:
```typescript
// 共有 BaseCaseSchema
const BaseCaseSchema = z.object({
  action: z.string(),
  expect: z.union([z.string(), z.array(z.string())]),
  type: z.enum(['normal', 'error', 'boundary']).default('normal'),
});

// Screen は拡張
export const CaseSchema = BaseCaseSchema.extend({
  steps: z.array(z.string()).min(1),
  given: z.union([z.string(), z.array(z.string())]).optional(),
  target: z.string().optional(),
  not_expect: z.array(z.string()).optional(),
  navigates_to: z.string().optional(),
});

// Unit はそのまま使用
export const UnitCaseSchema = BaseCaseSchema;
```

### 不採用理由
- **ユーザー判断で却下済み**: Step 1 で「CaseSchema: 独立定義」と確定
- **既存 CaseSchema のリファクタが必要**: CaseSchema を BaseCaseSchema.extend に書き換えるため、既存テストへの影響が生じる
- パターン1に比べて得られる利点（フィールド追加時の一元管理）が、コスト（既存 Screen の CaseSchema リファクタ）に見合わない
- Unit Case は action, expect, type のみで十分シンプルなため、独立定義でもメンテナンス負荷は低い

---

## 5軸スコアリングマトリクス

| パターン | 保守性 | テスト容易性 | スタック適合性 | 学習コスト | シンプルさ | 加重合計 |
|---------|:------:|:----------:|:------------:|:---------:|:---------:|:-------:|
| 1. Flat Extension | 4 | 5 | 5 | 5 | 5 | **4.80** |
| 2. Namespace Dir | 5 | 3 | 4 | 3 | 2 | 3.40 |
| 3. Generic Framework | 5 | 3 | 3 | 2 | 1 | 2.80 |
| 4. Shared CaseSchema | 3 | 4 | 5 | 4 | 4 | 3.90 |
| 5. Monolith Merge | 2 | 2 | 5 | 5 | 3 | 3.15 |
| 6. Dynamic Plugin | 5 | 2 | 2 | 2 | 1 | 2.40 |
| 7. Separate Command | 3 | 4 | 3 | 2 | 3 | 3.00 |
| 8. Config-Driven | 4 | 2 | 3 | 2 | 2 | 2.60 |
| 9. Unified Adapter | 4 | 3 | 4 | 3 | 2 | 3.20 |
| 10. Flat + Shared Case | 4 | 4 | 5 | 4 | 4 | 4.15 |

**重み**: 保守性 20%, テスト容易性 20%, スタック適合性 20%, 学習コスト(低いほど良い) 20%, シンプルさ 20%

### Top 3

1. **パターン 1: Flat Extension (4.80)** — 最小変更、最大互換性
2. **パターン 10: Flat + Shared Case (4.15)** — パターン1の変種だが CaseSchema リファクタが必要
3. **パターン 4: Shared CaseSchema (3.90)** — DRY だが既存スキーマ変更のリスク

### 選定: パターン 1

パターン1が全5軸で最もバランスが良い。特に:
- **シンプルさ**: 新しい概念やフレームワークの導入なし
- **テスト容易性**: 既存テスト影響ゼロ
- **スタック適合性**: ESM + oclif + Zod の既存パターンをそのまま踏襲

パターン10はパターン1に近いが、既存 CaseSchema のリファクタ（BaseCaseSchema 抽出）が必要であり、ユーザー判断「CaseSchema 独立定義」にも反する。
