# Dependency Analyst Feedback: Unit Spec Extension

## 1. 現在の依存グラフ

```
commands/validate.ts ──→ core/parser.ts ──→ core/schema.ts ← zod
        │                                        ↑
        ├──→ core/schema.ts (ScreenSchema,       │
        │    SetupSchema 直接参照)                │
        ├──→ core/validator.ts ──→ core/schema.ts │
        └──→ utils/output.ts                      │
                                                   │
commands/generate.ts ──→ core/parser.ts ───────────┘
        │
        ├──→ core/generators/registry.ts ──→ generators/types.ts ──→ core/schema.ts
        │            │
        │            ├──→ generators/playwright.ts ──→ core/schema.ts
        │            └──→ generators/xctest.ts ────→ core/schema.ts
        ├──→ core/validator.ts
        └──→ utils/output.ts
```

**依存の方向**: `commands → core → schema` (一方向、循環なし)

**schema.ts が全体の root dependency** であり、以下の全モジュールがこれに依存:
- parser.ts: `Config, ConfigSchema, Screen, ScreenSchema, Setup, SetupSchema`
- validator.ts: `Screen, Setup`
- generators/types.ts: `Screen, Setup`
- generators/playwright.ts: `Case, Screen, Setup`
- generators/xctest.ts: `Case, Screen, Setup`
- commands/validate.ts: `ScreenSchema, SetupSchema`

## 2. 現在の設計の特徴

### 良い点
- **依存方向が単一方向**: commands → core → schema で循環なし
- **parser.ts がジェネリック**: `parseYamlFile<T>(path, schema: ZodType<T>)` でスキーマ非依存
- **generators/types.ts がインターフェース**: `FrameworkGenerator` で抽象化済み
- **registry.ts が静的レジストリ**: `Record<Target, FrameworkGenerator>` パターン

### 問題点・リスク
- **schema.ts がモノリシック**: Screen/Setup/Config 全てが1ファイルに同居
- **ParsedProject が Screen/Setup にハードコード**: parser.ts L16-18
- **validator.ts が Screen/Setup のみを想定**: `validate(screens, setups)` シグネチャ
- **FrameworkGenerator が Screen 専用**: `generate(screen: Screen, setups: Setup[])`
- **Config が screens_dir/setups_dir をハードコード**: units_dir 等の拡張が必要

## 3. Unit Spec 追加時の依存分析

### 3a. スキーマ層 (schema)

**推奨**: schema.ts を分割するか、Unit 用スキーマを独立ファイルにする

```
core/schema.ts          → 共通型 (Case 等) + Config + re-export
core/schema/screen.ts   → ScreenSchema, Screen
core/schema/setup.ts    → SetupSchema, Setup
core/schema/unit.ts     → UnitSchema, Unit    ← NEW
```

ただし、現在の schema.ts は 37 行と小さいため、**Unit Spec のスキーマを同ファイルに追加しても依存方向は変わらない**。分割は YAGNI の観点で 3 種類目が来たときでも遅くない。

**最小変更案**: schema.ts に `UnitSpecSchema` と `UnitSpec` 型を追加するだけ。依存方向に影響なし。

### 3b. パーサー層 (parser)

**現状**: `parseProject()` が `ParsedProject { screens, setups }` を返す。

**変更が必要な箇所**:
1. `ParsedProject` に `units: UnitSpec[]` を追加
2. `ConfigSchema` に `units_dir` を追加
3. `parseProject()` に units の parse ロジックを追加

**依存方向**: 変化なし。parser → schema の方向のまま。

**リスク**: `parseProject()` が spec type ごとに肥大化する。3 種類目で明確な問題になる。

**将来対策案**: `parseProject()` を spec type のリストでドライブする設計にしておくと安全。

```typescript
// 将来イメージ (今は実装不要)
interface SpecTypeConfig<T> {
  dirKey: keyof Config;  // 'screens_dir' | 'units_dir'
  schema: ZodType<T>;
}
```

### 3c. バリデータ層 (validator)

**現状**: `validate(screens: Screen[], setups: Setup[])` — Screen 専用ロジック。

**Unit Spec のバリデーション要件**:
- Unit 間の ID 重複チェック
- Unit 内の setup 参照チェック (given → setup)
- Screen の validator とは検証ルールが異なるはず

**推奨方針**: Unit 用の validator を別関数として切り出す

```
core/validator.ts           → validateScreens(screens, setups)  ← rename
core/unit-validator.ts      → validateUnits(units, setups)      ← NEW
```

**依存交差リスク**: Screen と Unit が同じ Setup を参照する場合、setup の存在チェックは共通処理になる。しかしこれは「両方が schema.ts の Setup 型に依存する」だけで、Screen と Unit が互いに依存することはない。

```
core/validator.ts ──→ schema.ts (Screen, Setup)
core/unit-validator.ts ──→ schema.ts (UnitSpec, Setup)
                           ↑ 共通の Setup 型を参照するが、互いに依存しない
```

### 3d. ジェネレータ層 (generators)

**現状の FrameworkGenerator インターフェース**:
```typescript
interface FrameworkGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}
```

**問題**: Screen にハードコードされている。Unit 用のジェネレータが必要になるが、同じインターフェースには収まらない。

**選択肢**:

#### A案: 並行インターフェース (推奨)
```
generators/types.ts
  ScreenGenerator { generate(screen, setups): string; fileNameFor(screenId): string }
  UnitGenerator   { generate(unit, setups): string; fileNameFor(unitId): string }

generators/screen-registry.ts → Record<Target, ScreenGenerator>
generators/unit-registry.ts   → Record<Target, UnitGenerator>
```

- 依存方向: 各 registry → 各 types → schema (一方向)
- Screen と Unit のジェネレータ間に依存なし
- registry も分離で、Target の追加が独立

#### B案: Union 型インターフェース
```typescript
interface FrameworkGenerator {
  generateScreen(screen: Screen, setups: Setup[]): string;
  generateUnit?(unit: UnitSpec, setups: Setup[]): string;
}
```

- 全 generator 実装が Screen と Unit 両方の型に依存 → 不必要な結合
- Unit 非対応の generator に optional メソッドが増殖
- **非推奨**

### 3e. コマンド層 (commands)

**現状**: generate.ts, validate.ts が個別に parser, validator, generators を呼ぶ。

**Unit Spec 追加後の依存**:
```
commands/validate.ts ──→ core/parser.ts
                    ├──→ core/validator.ts (screen validation)
                    ├──→ core/unit-validator.ts (unit validation)  ← NEW
                    └──→ core/schema.ts

commands/generate.ts ──→ core/parser.ts
                    ├──→ core/generators/screen-registry.ts
                    ├──→ core/generators/unit-registry.ts  ← NEW
                    ├──→ core/validator.ts
                    └──→ core/unit-validator.ts  ← NEW
```

`--type` フラグで Screen / Unit を絞り込む場合、コマンド層で分岐するだけ。core 層の依存は増えない。

## 4. Config の依存方向

**現在の ConfigSchema**:
```typescript
ConfigSchema = z.object({
  version: z.number(),
  project: z.string(),
  screens_dir: z.string().default('./screens'),
  setups_dir: z.string().default('./setups'),
});
```

**Unit 追加後**:
```typescript
ConfigSchema = z.object({
  ...existing,
  units_dir: z.string().default('./units'),  // NEW
});
```

**依存方向に影響なし**。Config は parser.ts 内でのみ消費される。コマンド層は Config を直接参照しない。

## 5. 循環依存リスク評価

| 依存パス | リスク | 理由 |
|---------|--------|------|
| Unit ↔ Screen | **なし** | 独立スキーマ、相互参照なし |
| Unit → Setup | **安全** | Screen → Setup と同じパターン |
| UnitValidator ↔ ScreenValidator | **なし** | 独立関数、共通部品は schema 型のみ |
| UnitGenerator ↔ ScreenGenerator | **なし** (A案) | registry を分離すれば交差しない |
| UnitGenerator ↔ ScreenGenerator | **あり** (B案) | Union 型で全 generator が両方に依存 |

**結論: A案 (並行インターフェース) であれば循環依存リスクはゼロ。**

## 6. 将来 3 種類目 (Screen Transition Spec) への安全性

3 種類目が追加された場合の依存追加:

```
schema.ts に TransitionSchema 追加
core/transition-validator.ts ──→ schema.ts (Transition, Screen)
generators/transition-registry.ts ──→ generators/types.ts, schema.ts
commands/* ──→ 新モジュールへの import 追加
```

**注意**: Screen Transition Spec は Screen を参照する可能性がある (`navigates_to` のようなフィールド)。このとき:
- `transition-validator.ts` が `Screen` 型を import する → 一方向依存で安全
- `Screen` が `Transition` を知る必要はない → 逆方向の依存なし

**A案のパターンに従えば、N 種類目まで線形に拡張可能。**

## 7. 推奨事項サマリー

| 層 | 推奨 | 理由 |
|---|------|------|
| Schema | schema.ts に UnitSpec を追加 (分割は 3 種類目で) | 37 行のファイル分割は過剰 |
| Parser | ParsedProject に units フィールド追加 | 一方向依存維持 |
| Validator | unit-validator.ts を新規作成 | Screen バリデーションとの結合回避 |
| Generator | A案: 並行インターフェース + registry 分離 | 循環依存ゼロ、線形拡張可能 |
| Command | --type フラグでコマンド層分岐 | core 層への影響最小化 |
| Config | units_dir フィールド追加のみ | 依存方向に影響なし |

## 8. 絶対に避けるべきパターン

1. **FrameworkGenerator を Union 型にしない** — 全 generator が全 spec type に依存する
2. **validator.ts に Unit ロジックを混ぜない** — Screen と Unit の検証ルールは異なる
3. **schema.ts で spec type 間の型参照を作らない** — Unit が Screen を import する等
4. **registry を1つにまとめない** — Screen/Unit の Target 対応状況が異なりうる
