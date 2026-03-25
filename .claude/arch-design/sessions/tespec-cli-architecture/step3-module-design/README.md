# Step 3: モジュール設計・依存関係定義（統合版）

**日付**: 2026-03-24
**採用パターン**: Layered 4層（cli → commands → core → utils）
**CLI フレームワーク**: oclif（commander から変更）

---

## 最終モジュール一覧（8ファイル）

| モジュール | 責務 | 安定度 | 依存先 |
|-----------|------|:------:|-------|
| `core/schema.ts` | Zod スキーマ + 型定義（単一定義源） | **最高** | zod のみ |
| `core/parser.ts` | YAML 読み込み → Zod 構造検証 → 型付きオブジェクト | 高 | schema, yaml, node:fs |
| `core/validator.ts` | クロスファイル参照整合性チェック（純粋関数） | 高 | schema |
| `core/generator.ts` | Playwright テストスケルトン生成（純粋関数） | 中 | schema |
| `commands/validate.ts` | oclif Command: parse → validate → 出力 | 低 | parser, validator, output |
| `commands/generate.ts` | oclif Command: parse → validate → generate → 書込 | 低 | parser, validator, generator, output |
| `utils/output.ts` | picocolors 色付き出力（4関数） | 高 | picocolors |
| `cli.ts` | oclif エントリーポイント | 最低 | @oclif/core |

---

## 依存グラフ

```
cli.ts (oclif run)
  ├── commands/validate.ts ──→ core/parser.ts ──→ core/schema.ts
  │          │               ──→ core/validator.ts ──→ core/schema.ts
  │          └────────────────→ utils/output.ts
  │
  └── commands/generate.ts ──→ core/parser.ts ──→ core/schema.ts
                           ──→ core/validator.ts ──→ core/schema.ts
                           ──→ core/generator.ts ──→ core/schema.ts
                           ──→ utils/output.ts
```

---

## 境界ルール

### parser vs validator の責務分離

| チェック | 担当 | 理由 |
|---------|------|------|
| 必須フィールド欠落、型不一致 | parser (Zod) | 単一ファイル内で完結 |
| given → setup 存在確認 | validator | 全ファイル読み込み後に判定 |
| navigates_to → screen 存在確認 | validator | 同上 |
| screen ID 重複 | validator | 複数ファイルにまたがる |
| cases 空チェック | validator | warning レベル |
| type: error 0件 | validator | warning レベル |
| type: boundary 0件 | validator | warning レベル |

**ルール**: parser がエラーを返した場合、validator を呼ばない（不完全なオブジェクトでのチェック回避）。

### commands/ の薄さの基準

**置く**: configPath デフォルト解決、--dry-run 分岐、process.exit()、core 呼び出し順序
**置かない**: YAML 構造の知識、参照整合性ロジック、テスト文字列生成、出力フォーマット

### core/ の純粋性

- `process.exit()` / `console.log` / ファイル書き込み **禁止**
- `core/parser.ts` のみファイル読み込み（I/O）を許容
- `core/validator.ts` / `core/generator.ts` は完全な純粋関数

---

## Devil's Advocate 指摘と対応

| 指摘 | 重大度 | 対応 |
|------|:------:|------|
| schema.ts を parser.ts に統合すべき | 致命 | **却下** — 将来の Skill 配布でスキーマのみ参照するユースケースあり（ADR-005） |
| generator.ts 非公開関数4本の設計時宣言は過剰 | 致命 | **採用** — 公開インターフェースのみ合意。内部実装は実装時に判断 |
| --screen オプションは v1 に必要か | 重要 | 設計書に記載があるため v1 に含める |
| validator の warning ルール2件が欠落 | 重要 | **採用** — type:error 0件 / type:boundary 0件 の warning を追加 |

---

## 詳細ファイル

- [module-designer-proposal.md](module-designer-proposal.md) — モジュール分割提案（TypeScript インターフェース付き）
- [dependency-analyst-review.md](dependency-analyst-review.md) — 依存方向レビュー（問題なし）
- [devils-advocate-review.md](devils-advocate-review.md) — YAGNI 批判（致命2件・重要2件）
