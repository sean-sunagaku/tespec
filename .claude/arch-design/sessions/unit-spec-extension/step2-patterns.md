# Step 2: アーキテクチャパターン比較（サマリー）

詳細は `step2-patterns/README.md` を参照。

## 10パターン網羅比較

| # | パターン | スコア | 判定 |
|---|---------|:-----:|------|
| 1 | **Flat Extension + Type-Specific Modules** | **4.80** | **選定** |
| 2 | Namespace Directory Separation | 3.40 | 不採用（リファクタコスト過大） |
| 3 | Generic Spec Framework | 2.80 | 不採用（過剰設計） |
| 4 | Shared CaseSchema + Omit/Extend | 3.90 | 不採用（ユーザー判断で却下） |
| 5 | Monolith Merge | 3.15 | 不採用（凝集度破壊） |
| 6 | Dynamic Plugin Registry | 2.40 | 不採用（ESM 相性悪い、過剰） |
| 7 | Separate Command per Spec Type | 3.00 | 不採用（Phase A 方針に反する） |
| 8 | Config-Driven Spec Type Discovery | 2.60 | 不採用（型安全性喪失） |
| 9 | Unified Interface with Adapter | 3.20 | 不採用（不要な間接層） |
| 10 | Flat Extension + CaseSchema Shared | 4.15 | 不採用（CaseSchema リファクタ必要） |

## 選定: パターン 1 — Flat Extension + Type-Specific Modules

**新規3ファイル:** unit-validator.ts, generators/vitest.ts, generators/xctest-unit.ts
**既存6ファイル追記:** schema.ts, parser.ts, generators/types.ts, generators/registry.ts, commands/validate.ts, commands/generate.ts
**変更なし:** validator.ts, generators/playwright.ts, generators/xctest.ts

### 確定した設計判断

- UnitCaseSchema: 独立定義（CaseSchema と共有しない）
- methods ネスト: 維持（B案ネスト）
- `--type` フラグ: なし（units_dir 有無で自動判定）
- Generator interface: ScreenGenerator / UnitGenerator 分離
- Target 型: ScreenTarget / UnitTarget 分離
- Registry: 1ファイル、ルックアップ関数で分離
- Validator: unit-validator.ts を新規作成
- 汎用 spec type 機構: 不要（Rule of Three）

詳細: `step2-patterns/selected-pattern.md`
