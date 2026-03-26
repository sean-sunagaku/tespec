# Module Designer Feedback: Unit Spec 追加に向けたモジュール分析

## 1. 現行モジュール責務マップ

| モジュール | 責務 | 凝集度 | Screen 固有度 |
|---|---|---|---|
| `schema.ts` | Zod スキーマ定義 + 型エクスポート | 高 (データ定義のみ) | **高** — CaseSchema に `navigates_to`, `steps`, `given` 等の Screen 概念が埋め込み |
| `parser.ts` | YAML 読み込み + Zod 検証 + `ParsedProject` 構築 | 高 (I/O + パース) | **中** — `parseYamlFile` / `parseYamlDirectory` は汎用だが、`parseProject` が Screen/Setup 固定 |
| `validator.ts` | Screen 間の参照整合性チェック | 高 (検証のみ) | **極高** — 全関数が Screen/Setup 前提 |
| `generators/types.ts` | `FrameworkGenerator` interface 定義 | 高 (型のみ) | **極高** — `generate(screen, setups)` シグネチャ |
| `generators/registry.ts` | Target → Generator のルックアップ | 高 (lookup のみ) | 低 (仕組み自体は汎用) |
| `generators/playwright.ts` | Playwright テストコード生成 | 高 (単一フレームワーク) | **極高** — Screen/Case 構造に密結合 |
| `generators/xctest.ts` | XCTest テストコード生成 | 高 (単一フレームワーク) | **極高** — Screen/Case 構造に密結合 |
| `commands/validate.ts` | CLI validate サブコマンド | 中 (CLI + orchestration) | **高** — Screen/Setup パスのみ |
| `commands/generate.ts` | CLI generate サブコマンド | 中 (CLI + orchestration) | **高** — Screen 用 generator のみ呼び出し |

**結論**: 既存コードは「Screen Spec 専用」として高凝集に作られている。Unit Spec を無理に既存モジュールへ混入させると凝集度が下がる。

## 2. 推奨モジュール設計: Screen / Unit 完全分離

### 2.1 新規モジュール一覧

```
src/core/
  screen/                          # 既存 Screen 系を namespace 化
    schema.ts                      # ScreenSchema, CaseSchema (既存 schema.ts から移動)
    validator.ts                   # 既存 validator.ts を移動
    generators/
      types.ts                     # ScreenGenerator interface (既存 FrameworkGenerator を rename)
      registry.ts                  # Screen 用レジストリ
      playwright.ts                # 既存のまま移動
      xctest.ts                    # 既存のまま移動
  unit/                            # 新規 Unit Spec 系
    schema.ts                      # UnitSpecSchema, UnitCaseSchema (完全独立 Zod)
    validator.ts                   # Unit 固有の参照チェック
    generators/
      types.ts                     # UnitGenerator interface
      registry.ts                  # Unit 用レジストリ (vitest, xctest)
      vitest.ts                    # vitest テストコード生成
      xctest.ts                    # XCTest ユニットテスト生成
  shared/                          # Screen/Unit 共通の薄いレイヤ
    schema.ts                      # ConfigSchema, SetupSchema (両方から参照)
    parser.ts                      # parseYamlFile, parseYamlDirectory (汎用部分)
    types.ts                       # ParseError, ParsedFileResult 等の共通型
  parser.ts                        # parseProject の上位オーケストレータ (Screen + Unit を統合)
```

### 2.2 理由: なぜ完全分離か

1. **Phase A 確定方針が「独立性優先」** — Unit Spec の Zod スキーマは Screen とは完全独立
2. **将来拡張 (screen transition spec)** — 3種類目が来たとき、同じパターンで `transition/` を追加するだけ
3. **既存 Screen 系への影響ゼロ** — Screen モジュールのコードは移動のみ、ロジック変更なし
4. **generator の二重性を自然に解決** — Screen 用と Unit 用で異なる interface を持てる

### 2.3 代替案: フラット構造 (非推奨)

```
src/core/
  screen-schema.ts
  unit-schema.ts
  screen-validator.ts
  unit-validator.ts
  generators/screen-playwright.ts
  generators/unit-vitest.ts
  ...
```

**非推奨理由**: ファイル数増加時に見通しが悪化。spec type ごとのまとまりが失われる。

## 3. 主要インターフェース設計

### 3.1 ParsedProject の拡張

```typescript
// src/core/parser.ts (上位オーケストレータ)
export interface ParsedProject {
  config: Config;
  screens: Screen[];       // 既存
  setups: Setup[];         // 既存
  units: UnitSpec[];       // 新規追加
}
```

`parseProject` は config.yaml に `units_dir` (デフォルト `./units`) を追加し、Screen/Setup/Unit を並行パースする。units_dir が存在しなくてもエラーにしない (optional directory)。

### 3.2 FrameworkGenerator の分岐

**Screen 用** (既存 interface を維持):
```typescript
// src/core/screen/generators/types.ts
export interface ScreenGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}
```

**Unit 用** (新規):
```typescript
// src/core/unit/generators/types.ts
export interface UnitGenerator {
  generate(unit: UnitSpec): string;
  fileNameFor(unitId: string): string;
}
```

Unit は Screen と違い `setups` を受け取らない (Unit Spec はセットアップ参照を持たない想定)。これが interface を分ける最大の理由。

### 3.3 Registry の設計

Screen と Unit で別レジストリを持つ。Target 型は共通で拡張:

```typescript
// src/core/shared/types.ts
export type ScreenTarget = 'playwright' | 'xctest';
export type UnitTarget = 'vitest' | 'xctest';
export type Target = ScreenTarget | UnitTarget;
```

`xctest` が両方に出現するが、生成ロジックは異なるため別実装が必要。

### 3.4 Validator の分離

**Screen validator** — 既存ロジックそのまま:
- `checkDuplicateScreenIds`
- `checkGivenReferences` (setup 参照)
- `checkStepsReferences` (use: 参照)
- `checkNavigatesToReferences` (screen 間参照)
- `checkEmptyCases`, `checkErrorTypeMissing`, `checkBoundaryTypeMissing`

**Unit validator** — 新規、Unit 固有のチェック:
- `checkDuplicateUnitIds`
- `checkEmptyTestCases`
- Unit 固有の参照チェック (Unit Spec の設計次第)

共通の `ValidationIssue` / `ValidationResult` 型は `shared/types.ts` に配置。

## 4. コマンド層への影響

### 4.1 `--type` フラグの追加

```
tespec validate                    # Screen + Unit 両方
tespec validate --type screen      # Screen のみ
tespec validate --type unit        # Unit のみ
tespec generate                    # Screen + Unit 両方 (デフォルト全処理)
tespec generate --type screen      # Screen のみ
tespec generate --type unit        # Unit のみ
```

### 4.2 `--target` のバリデーション

`--type unit --target playwright` は無効な組み合わせ。コマンド層でバリデーションが必要。

## 5. 既存コードへの具体的影響

| 既存ファイル | 変更内容 | 影響度 |
|---|---|---|
| `schema.ts` | `ConfigSchema` に `units_dir` 追加。Screen/Setup 系を `screen/schema.ts` へ移動、Config/Setup は `shared/schema.ts` へ | ファイル移動 (ロジック変更なし) |
| `parser.ts` | 汎用部分を `shared/parser.ts` へ抽出。`parseProject` に units パース追加 | 低〜中 (抽出 + 追加) |
| `validator.ts` | `screen/validator.ts` へ移動 (ロジック変更なし) | ファイル移動のみ |
| `generators/*` | `screen/generators/` へ移動 + interface 名変更 (`FrameworkGenerator` → `ScreenGenerator`) | ファイル移動 + rename |
| `commands/validate.ts` | `--type` フラグ追加、unit validator 呼び出し追加 | 中 |
| `commands/generate.ts` | `--type` フラグ追加、unit generator 呼び出し追加 | 中 |

## 6. 段階的マイグレーション戦略

1. **Phase 1**: `shared/` 作成 — 共通型と汎用パーサを抽出
2. **Phase 2**: `screen/` 作成 — 既存モジュールを移動 (全テスト通過を確認)
3. **Phase 3**: `unit/` 作成 — 新規 Unit Spec モジュールを実装
4. **Phase 4**: コマンド層に `--type` フラグ追加

Phase 1〜2 は既存機能のリファクタ、Phase 3〜4 が新機能追加。分離することで bisect やレビューが容易。

## 7. リスクと懸念点

- **ディレクトリ移動のインパクト**: import パスが全面的に変わる。ただし TypeScript の path alias や IDE の自動修正で対応可能
- **xctest の二重実装**: Screen 用と Unit 用で xctest generator が別実装になる。共通のヘルパ (`sanitize`, `toSwiftClassName`, `indentOf`) は `shared/` に抽出して DRY を維持
- **ConfigSchema の拡張**: `units_dir` を optional にすることで、Unit Spec を使わないプロジェクトへの後方互換性を確保
