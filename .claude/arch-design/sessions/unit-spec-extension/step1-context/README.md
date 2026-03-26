# Step 1: コンテキスト分析結果 - Unit Spec 拡張

## 設計テーマ

tespec CLI に「Unit Spec」（クラス単体テスト仕様の YAML サポート）を追加する。既存の Screen Spec（画面 E2E テスト仕様）とは完全に独立した YAML フォーマットとして設計する。

---

## 機能要件

### FR-1: Unit Spec YAML スキーマ

Phase A で確定した YAML フォーマットをサポートする。

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

- トップレベルキー: `unit`（Screen の `screen` と区別）
- `methods` 配列でメソッド単位にケースをネスト
- Case レベルのフィールド: `action`, `expect`, `type`（Screen の Case と同じ enum `normal | error | boundary`）
- `title` は人間向け説明（Screen と同じ役割）

### FR-2: ファイル構成

```
docs/tespec/
├── config.yaml
├── screens/        # 既存 Screen Spec
├── setups/         # 既存 Setup
└── units/          # 新規 Unit Spec（1クラス1ファイル）
    ├── user-service.yaml
    └── payment-gateway.yaml
```

- `units/` ディレクトリに配置（config.yaml に `units_dir` を追加）

### FR-3: テスト生成ターゲット

初期から2フレームワーク対応:
- **vitest** (TypeScript) - Unit テスト用
- **XCTest** (Swift) - Unit テスト用

既存の Screen 用ジェネレーター（playwright, xctest）とは別系統のジェネレーターとして実装する。

### FR-4: CLI コマンド拡張

- `tespec validate`: Unit YAML のスキーマ検証を追加
  - `--file` で単一ファイル検証時に Unit YAML も認識する
  - プロジェクト全体検証時に `units/` ディレクトリも処理する
- `tespec generate`: Unit テストスケルトン生成を追加
  - `--type screen|unit` フラグで spec type を絞り込み
  - デフォルトでは全 spec type を処理
  - `--target` フラグの選択肢拡張（vitest, xctest の追加、または既存と別管理）

### FR-5: Unit Spec 固有のバリデーション

- `unit` ID の重複チェック
- `methods` が空でないか
- 各 method 内の `cases` が空でないか
- error/boundary タイプの欠落 warning（Screen と同様のポリシー）
- **Setup 参照は不要**（Unit Spec は given/steps/navigates_to を持たない）

---

## 非機能要件

### NFR-1: 独立性

Unit Spec の Zod スキーマは Screen Spec と**完全独立定義**する。共通 Base Schema を共有しない。

理由:
- Screen の Case は `steps`(必須), `given`, `target`, `not_expect`, `navigates_to` を持つ
- Unit の Case は `action`, `expect`, `type` のみ（Screen Case のサブセットではなく別概念）
- 共通化すると一方の変更が他方に波及し、結合度が上がる

### NFR-2: コマンドの統一性

- デフォルト動作: 全 spec type（screen + unit）を処理
- `--type` フラグで絞り込み可能
- ユーザーが spec type を意識せずに使える CLI 体験

### NFR-3: ジェネレーターの拡張性

- Screen Generator（playwright, xctest）と Unit Generator（vitest, xctest-unit）は別レジストリまたは別インターフェースとして管理
- Unit Generator のシグネチャは `(unit: UnitSpec, ...) => string` であり、Screen Generator の `(screen: Screen, setups: Setup[]) => string` とは異なる

### NFR-4: 将来拡張性

Phase A で確認済み: spec type は最大3種類程度（screen, unit, screen transition）。過度な抽象化は不要。

### NFR-5: テスト容易性

- 各 Unit Generator は純粋関数として実装
- 既存テストを壊さない

---

## 制約条件

### C-1: 技術スタック制約（既存と同一）

| カテゴリ | 使用技術 |
|---------|---------|
| 言語 | TypeScript (ESM only) |
| CLI | @oclif/core v4 |
| スキーマ検証 | Zod v4 |
| ビルド | tsup |
| テスト | vitest |
| Lint/Format | Biome |
| パッケージマネージャー | pnpm |

### C-2: ESM 制約

- `"type": "module"` 設定、import に `.js` 拡張子が必要
- oclif の commands ディスカバリー: `dist/commands/*.ts` が自動スキャン

### C-3: 既存コードへの影響最小化

- Screen Spec の Zod スキーマ（`ScreenSchema`, `CaseSchema`, `SetupSchema`）は変更しない
- 既存の `FrameworkGenerator` interface（`generate(screen, setups): string`）は変更しない
- 既存の generators/registry.ts は Screen 用として保持

### C-4: コマンド構造

- oclif v4 のコマンド構造（`src/commands/*.ts`）に従う
- 新コマンドの追加ではなく、既存コマンド（validate, generate）の拡張として実装

---

## 既存コードの構造分析

### Zod スキーマ（schema.ts）

```
CaseSchema     → action, expect, steps(必須), given, target, type, not_expect, navigates_to
ScreenSchema   → screen, route, title, cases: Case[]
SetupSchema    → setup, title, steps
ConfigSchema   → version, project, screens_dir, setups_dir
```

**Unit Spec との差異ポイント:**
- Screen Case の `steps` は `.min(1)` で必須 → Unit Case には不要
- Screen は `route`(URL) が必須 → Unit には不要
- Unit は `methods` 配列でネスト構造 → Screen はフラットな `cases` 配列

### パーサー（parser.ts）

```
parseProject(configPath)
├── parseYamlFile(configPath, ConfigSchema)
├── parseYamlDirectory(screensDir, ScreenSchema)
└── parseYamlDirectory(setupsDir, SetupSchema)
```

`parseYamlDirectory` と `parseYamlFile` は schema-agnostic なジェネリック関数であり、Unit Spec でも再利用可能。

**拡張方針:** `parseProject` の戻り値 `ParsedProject` に `units: UnitSpec[]` を追加し、`parseYamlDirectory(unitsDir, UnitSpecSchema)` を並列実行に追加する。

### バリデーター（validator.ts）

```
validate(screens, setups)
├── checkDuplicateScreenIds
├── checkGivenReferences      ← Setup 参照（Unit には不要）
├── checkStepsReferences       ← Setup 参照（Unit には不要）
├── checkNavigatesToReferences ← Screen 参照（Unit には不要）
├── checkEmptyCases
├── checkErrorTypeMissing
└── checkBoundaryTypeMissing
```

Screen のバリデーションはクロスリファレンス（Screen-Setup-Screen 間の参照整合性）が中心。Unit Spec は独立しているためクロスリファレンスは不要で、スキーマレベルのバリデーション + 内部一貫性チェックのみ。

**拡張方針:** `validateUnits(units: UnitSpec[]): ValidationResult` を別関数として実装。既存 `validate` は変更しない。

### ジェネレーター（generators/）

```
types.ts     → Target = 'playwright' | 'xctest', FrameworkGenerator interface
registry.ts  → REGISTRY: Record<Target, FrameworkGenerator>, getGenerator, isTarget
playwright.ts → generate(screen, setups) → .spec.ts
xctest.ts     → generate(screen, setups) → .swift
```

既存の `FrameworkGenerator` interface は Screen 専用:
```ts
interface FrameworkGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}
```

**Unit Generator には別 interface が必要:**
```ts
interface UnitGenerator {
  generate(unit: UnitSpec): string;
  fileNameFor(unitId: string): string;
}
```

### コマンド（commands/）

- **validate.ts**: `--config` / `--file` フラグ。プロジェクト全体またはファイル単体の検証
- **generate.ts**: `--config` / `--target` / `--screen` / `--dry-run` / `--out-dir` フラグ。Screen のテスト生成

**拡張方針:**
- 両コマンドに `--type screen|unit` フラグを追加
- validate: 単一ファイル検証時に UnitSpecSchema でも試行
- generate: `--unit <id>` フラグ追加（`--screen` と同様）、Unit 用の `--target` 選択肢（vitest, xctest）

---

## 設計上のキーポイント

### 1. スキーマの完全独立

Unit Spec 用に新規の Zod スキーマを定義:

```ts
// UnitCaseSchema: Screen の CaseSchema とは別定義
UnitCaseSchema → action, expect, type(default: normal)

// UnitMethodSchema: Unit 固有のネスト構造
UnitMethodSchema → method, cases: UnitCase[]

// UnitSpecSchema: トップレベル
UnitSpecSchema → unit, title, methods: UnitMethod[]
```

CaseSchema と UnitCaseSchema は似たフィールドを持つが、意図的に独立定義とする（NFR-1）。

### 2. パーサーの再利用と拡張

`parseYamlFile<T>` / `parseYamlDirectory<T>` はジェネリックなので Unit Spec にそのまま使える。`parseProject` の拡張で `units` を追加するか、`parseUnitsDirectory` を別関数にするかは設計判断。

### 3. バリデーターの分離

Screen バリデーション（クロスリファレンス中心）と Unit バリデーション（内部一貫性中心）はチェック項目が全く異なるため、別関数として実装。

### 4. ジェネレーターの二系統管理

Screen Generator と Unit Generator は入力型が異なる（`Screen + Setup[]` vs `UnitSpec`）ため、同一 interface に統合することは型安全性を損なう。別 interface + 別 registry で管理。

### 5. target の名前空間

Screen: `playwright | xctest`
Unit: `vitest | xctest`

`xctest` が両方に存在するが、実装は異なる（Screen は XCUITest、Unit は XCTest）。名前空間を分離するか、同名で spec type 別に管理するかが設計判断ポイント。

### 6. コマンドの `--type` フラグ

デフォルトで全 spec type を処理し、`--type screen|unit` で絞り込む方針は Phase A で確定済み。コマンド内部で spec type ごとの処理を分岐させる。
