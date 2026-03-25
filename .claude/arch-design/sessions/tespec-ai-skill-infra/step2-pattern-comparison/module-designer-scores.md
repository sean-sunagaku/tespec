# モジュール設計スコア（module-designer 評価）

作成日: 2026-03-25
担当: module-designer

---

## 評価軸

- **凝集度**: 各モジュールが単一の変化理由を持つか（SRP 遵守）
- **依存方向**: 循環なし・一方向性維持か
- **境界明確さ**: モジュールの責務分担が直感的に理解できるか

各軸 1-5（5が最良）

---

## パターン別スコア

| パターン | 凝集度 | 依存方向 | 境界明確さ | 合計 | 主な理由 |
|---------|-------|---------|----------|-----|---------|
| 1 (.mjs + schema-meta.mjs) | 2 | 4 | 2 | 8 | schema-meta と .mjs の二重管理。境界不明確 |
| 2 (.mjs + schema-meta.json) | 3 | 4 | 3 | 10 | JSON手動管理で schema.ts との乖離リスクあり |
| 3 (tsx + Zod .shape) | 5 | 5 | 4 | 14 | schema.ts 直接 import。.shape は公開 API |
| 4 (tsx + .describe() 埋め込み) | 2 | 4 | 2 | 8 | schema.ts に SRP 違反（ドキュメント責務混入）|
| 5 (.mjs + dist 経由) | 4 | 3 | 3 | 10 | dist 経由は設計的ねじれ（ランタイム成果物の流用）|
| 6 (tsx + .claude/skills/ 直置き) | 5 | 5 | 3 | 13 | モジュール良好。.claude/ 配置の命名規約問題 |
| 7 (tsx + ts-morph AST) | 5 | 5 | 5 | 15 | 設計完璧だが ts-morph 過剰（実装コスト問題）|
| 8 (.mjs + schema-meta.ts dist 経由) | 4 | 3 | 3 | 10 | build 前提の設計ねじれ（Pattern 5 と同問題）|
| 9 (tsx + gh pr create) | 5 | 5 | 4 | 14 | Pattern 3 と同等。冪等性なしが唯一の欠点 |
| 10 (tsx + gh pr create + 差分チェック) | 5 | 5 | 5 | 15 | 凝集度・依存方向・境界すべて最良 |

---

## 推奨順位（E2 確定後）

1. **Pattern 10 + E2**（最有力）— 凝集度・依存方向・境界明確さすべて最良。差分チェックで冪等性確保。E2（--file フラグ）でユーザーの両方のユースケースを満たす
2. **Pattern 9 + E2**— Pattern 10 から差分チェックを省いたもの。PR 重複リスクがあるが設計品質は同等
3. **Pattern 3 + E2**— gh CLI の代わりに peter-evans/create-pull-request action を使用。依存追加になる点で Pattern 9/10 より劣る

E2 確定により Pattern 3 の「既存 src/ 変更ゼロ」の優位性が消え、Pattern 10 が明確に最有力となった。

---

## 除外推奨

- **Pattern 4**: `schema.ts` への SRP 違反（ドキュメント責務混入 + npm bundle 肥大化）。`schema.ts` は npm パッケージのランタイムコアとして全 commands から参照されており、ドキュメント情報を混入させるべきではない
- **Pattern 1**: schema-meta と .mjs の二重管理問題が未解決
- **Pattern 7**: ts-morph は明確に過剰。Zod .shape で十分得られる情報を AST から取る必要はない

---

## 設計変数 E（YAML 検証機能）評価

| 選択肢 | 凝集度への影響 | 境界明確さ | 推奨度 | コメント |
|--------|-------------|----------|-------|---------|
| E1: tespec validate そのまま | 影響なし | 高 | 中 | プロジェクト全体対象で AI 単体検証に不向き |
| E2: --file フラグ追加 | 低（フィルタ追加のみ） | 高 | **推奨** | `validate.ts` の自然な拡張。`parser.ts` 不変 |
| E3: 独立スクリプト | 要注意 | 中 | 条件付き | `parser.ts` 内部関数を export すると公開 API が増える |
| E4: SKILL.md 案内のみ | 影響なし | 高 | 最小限 | Phase 1「YAML 検証機能必須」要件を満たすか疑問 |

**推奨: E2（ユーザー確定 2026-03-25）**

ユーザー回答: 「既存プロジェクトへの YAML 追加」と「新規単体ファイル生成 + その場で検証」の両方のユースケースがあるため、`--file` フラグによる単体検証が必要。

`--file` フラグは `validate.ts` の責務拡張ではなく「フィルタリングオプション追加」なので凝集度を損なわない。`parser.ts` には触れない。

E3 の注意: `parseYamlFile` は現在 `parser.ts` の内部関数。公開 API にすると変更コストが増加する。`--file` フラグで `parseProject` を単一ファイルモードで動かす実装の方がモジュール境界を壊さない。

---

## Phase 1 最終モジュール構成（確定）

```
scripts/
  generate-references.ts   → schema.ts のみ依存（100行以内維持）
                             tsx で実行、z.toJSONSchema() 使用

src/commands/
  validate.ts              → --file フラグ追加（E2 採用時）

src/core/, src/utils/      → 変更なし
src/commands/              → validate.ts のみ変更（--file フラグ）
src/skill/                 → Phase 1 では新設しない

skill/
  SKILL.md                 → 手書き
  references/              → generate-references.ts の出力先

.github/workflows/
  sync-skill-refs.yml      → schema.ts 変更検知 → PR 自動作成
```

### 設計制約（明示）

1. `scripts/generate-references.ts` は `src/core/schema.ts` のみに依存する
2. 100行を超えたら `src/skill/` への分離を再検討
3. `src/commands/` は変更なし（validate.ts の --file フラグ以外）

### 依存方向

```
scripts/generate-references.ts → src/core/schema.ts（Zod .shape / toJSONSchema）
src/commands/validate.ts       → src/core/parser.ts（parseProject のみ）
                               → src/core/validator.ts
                               → src/utils/output.ts

src/core/*    → schema.ts のみ（相互依存なし）
src/utils/*   → 外部のみ（独立）
```

循環なし、レイヤー境界維持。
