# モジュール設計観点フィードバック: tespec AI Skill インフラ

作成日: 2026-03-25
担当: module-designer
最終更新: Step 1 確定反映済み

---

## 1. 既存 core/ モジュールの凝集度評価

### 各モジュールの現状

| モジュール | 変化の理由 | 凝集度評価 |
|---|---|---|
| `schema.ts` | Zod スキーマ定義（データ構造の変更） | 高 |
| `parser.ts` | YAML I/O + Zod バリデーション連携 | 高 |
| `generator.ts` | Playwright テンプレート生成ロジック | 高 |
| `validator.ts` | クロスリファレンス整合性チェック | 高 |
| `utils/output.ts` | CLI 出力フォーマット | 高 |

**判定: 既存 core/ モジュールの凝集度は適切。**

- 相互の依存方向は `commands/ → core/` の一方向で、core/ 内の相互依存はない（schema.ts からの型インポートのみ）

---

## 2. Step 1 確定スコープでの設計判断

### 確定事項

- **SKILL.md**: 手書き（AI への指示・ルール・記述例）
- **references/*.md**: schema.ts から自動生成（フィールド定義・制約・型情報）
- **生成スクリプト**: schema.ts → references/*.md を生成
- **GitHub Actions**: schema.ts 変更時に自動で references/ を再生成し PR 作成
- **バリデーション**: 既存 `tespec validate` で代替（新規スクリプト不要）

### 削除になった責務

- `add-skill` コマンド / `installer.ts`: Plugin 方式（`claude plugin install`）で配布するため不要
- `yaml-linter.ts`: 既存 `parseProject()` + `validate()` で代替可能、Phase 2 以降に先送り
- `schema-meta.ts` 手動管理: Zod v4 `z.toJSONSchema()` 公式 API で代替できるため不要

---

## 3. 確定モジュール構成（Phase 1）

```
src/
  cli.ts
  commands/
    validate.ts              （変更なし）
    generate.ts              （変更なし）
    sync.ts                  （新規: 手動実行用 references/ 再生成コマンド）
  core/
    schema.ts                （変更なし）
    parser.ts                （変更なし）
    generator.ts             （変更なし）
    validator.ts             （変更なし）
  skill/
    skill-generator.ts       （新規: schema → SKILL.md 生成）
    references-generator.ts  （新規: z.toJSONSchema() で references/*.md 生成）
  utils/
    output.ts                （変更なし）

scripts/
  sync-skill-references.ts   （新規: CI/手動実行エントリポイント）

.github/workflows/
  sync-skill-references.yml  （新規: schema.ts 変更検知 → references/ 再生成 → PR 作成）
```

### 設計原則（確定）

- `core/` は「tespec YAML の処理」に特化する（変更なし）
- `skill/` は「AI Skill インフラ」に特化する（新設）
- `commands/` は薄いオーケストレーション層のまま維持する
- 依存方向: `commands/ → core/`, `commands/ → skill/`, `skill/ → core/schema.ts`（一方向）
- `add-skill.ts` / `installer.ts` は Phase 2（sunagaku-marketplace 配布時）まで不要

---

## 4. 依存方向の最終合意

```
commands/validate.ts  → core/parser, core/validator, utils/output
commands/generate.ts  → core/parser, core/validator, core/generator, utils/output
commands/sync.ts      → skill/skill-generator, skill/references-generator, utils/output

skill/skill-generator.ts      → core/schema（型のみ）
skill/references-generator.ts → core/schema（型のみ）、zod（toJSONSchema）

scripts/sync-skill-references.ts → skill/references-generator

core/*    → schema.ts のみ（相互依存なし）
utils/*   → 外部のみ（独立）
```

循環なし、レイヤー境界維持。

---

## 5. SKILL.md / references/ の分割根拠

SKILL.md と references/*.md を別ファイルに分けるのはモジュール設計と同じ理由:

- **SKILL.md の変化の理由**: AI への指示・ルールの調整（手動編集）
- **references/*.md の変化の理由**: schema.ts のフィールド追加・変更（自動再生成）

2つの変化理由が異なるため分割が正当化される。`skill-generator.ts` と `references-generator.ts` の分割も同じ理由による。

---

## 6. 残課題（Step 2 以降）

1. **`references-generator.ts` の出力フォーマット**: JSON Schema を Markdown に変換する際の構造（platform-expert と要合意）
2. **`skill-generator.ts` の SKILL.md テンプレート構造**: AI 可読性を考慮したセクション定義（architecture-lead と要合意）
3. **`sync.ts` の `--dry-run` フラグ**: 冪等性確保のため必須
4. **GitHub Actions の PR 作成権限**: bot トークンの設定方針（platform-expert 担当）
