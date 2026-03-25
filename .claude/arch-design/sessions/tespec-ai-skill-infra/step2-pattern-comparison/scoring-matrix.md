# Step 2b: 多軸スコアリング比較表

作成日: 2026-03-25
担当: architecture-lead（全エージェントの評価を統合）

---

## 前提: 失格パターンの除外

devils-advocate の即時失格条件を適用:

| パターン | 失格理由 |
|---------|---------|
| **Pattern 4** | schema.ts に `.describe()` 追加 → ランタイムコアへの SRP 違反（失格条件 1） |
| **Pattern 7** | ts-morph 追加 → 明確な過剰設計（Zod .shape / toJSONSchema で十分得られる情報） |

残り 8 パターン + Pattern 11（Node.js 22 `--experimental-strip-types`）の計 9 案でスコアリング。

---

## Pattern 11: Node.js 22 --experimental-strip-types（新案）

**組み合わせ**: tsx なし + B1(toJSONSchema) + E2(--file) + F2(差分チェック)

```
package.json:
  "skill:sync": "node --experimental-strip-types scripts/generate-references.ts"
  engines: { "node": ">=22.6" }

scripts/
  generate-references.ts   (schema.ts 直接 import → toJSONSchema → Markdown)

.github/workflows/
  sync-skill-refs.yml:
    - node --experimental-strip-types scripts/generate-references.ts
    - git diff → gh pr create（差分あり時のみ）
```

**特徴**:
- tsx 不要・依存追加ゼロ・schema.ts 直接 import 可能（Pattern 2/10 の利点を维持）
- Node.js 22.6+ で TypeScript ファイルを直接実行できる（型注釈のみ除去）

**注意点**:
- engines を `>=18` から `>=22.6` に上げる必要がある（既存ユーザーへの breaking change）
- `--experimental-strip-types` はまだ experimental（Node.js 22.6 で導入、23.x で安定化途上）
- CI 上は Node.js 22 固定で動作するが、ローカル開発でも Node.js >=22.6 が必要

---

## 評価軸の定義（5 軸）

| 軸 | 担当 | 説明 |
|----|------|------|
| **保守性・拡張性** | architecture-lead | schema.ts 変更への自動追従、将来の変更コスト |
| **テスト容易性** | architecture-lead | 生成スクリプト・検証機能のテストしやすさ |
| **スタック適合性** | platform-expert（評価反映） | tsx/zod/github actions との相性、Pure ESM・Node.js 18 対応 |
| **学習コスト** | platform-expert（評価反映） | 新規参入者が把握すべき概念数、ツールの一般性 |
| **シンプルさ** | devils-advocate（評価反映） | YAGNI 遵守・依存追加の最小化・既存コード変更の少なさ |

スコア: 5=最高 / 1=最低

---

## 軸ごとのスコア根拠

### 保守性・拡張性（architecture-lead）

| パターン | スコア | 根拠 |
|---------|-------|------|
| P1 (.mjs + dist経由 + E1) | 2 | build 前提の順序依存。E1 のため検証機能拡張が SKILL.md の手動更新に依存 |
| P2 (.mjs + schema-meta.json + E1) | 2 | schema-meta.json の手動同期。schema.ts 変更時に乖離が検知されない |
| P3 (tsx + toJSONSchema + E1) | 4 | schema.ts 直接 import で自動追従。E1 のため YAML 検証は将来の拡張が必要 |
| P5 (.mjs + dist経由 + E1) | 2 | P1 と同じ。dist/ 流用はランタイム成果物のねじれ |
| P6 (tsx + .claude/skills/ 直置き) | 3 | モジュール設計は良好だが、.claude/ 配置が claude-code-plugin 完全分離方針と矛盾 |
| P8 (.mjs + schema-meta.ts + dist) | 2 | tsup ビルド設定変更 + build 前提。変更箇所が多い |
| P9 (tsx + toJSONSchema + E2 + gh) | 4 | schema.ts 自動追従 + E2 で検証機能完備。冪等性なしが唯一の弱点 |
| P10 (tsx + toJSONSchema + E2 + 差分) | 5 | 自動追従 + E2 + 差分チェックで冪等性。将来の references/ 追加も容易 |
| P11 (node strip + toJSONSchema + E2) | 4 | P10 と同等の自動追従。ただし engines 制約の変更が将来の保守コストになる可能性 |

### テスト容易性（architecture-lead）

| パターン | スコア | 根拠 |
|---------|-------|------|
| P1 | 2 | .mjs スクリプトの単体テストは vitest では難しい（import.meta 等の互換性）。build 前提で CI テストも複雑 |
| P2 | 2 | schema-meta.json と schema.ts の整合性テストが必要。自動では検知できない |
| P3 | 4 | tsx でビルドせずに実行できる。vitest で schema.ts を直接 import してテスト可能 |
| P5 | 2 | dist/ 経由のため、テスト実行前に build が必要 |
| P6 | 3 | .claude/ 配置がテスト環境と混在する懸念 |
| P8 | 2 | build 前提で P5 と同等の問題 |
| P9 | 4 | P3 と同等。gh コマンドの冪等性テストは CI 環境依存だが許容範囲 |
| P10 | 5 | 生成スクリプトを vitest で単体テスト可能（tsx 実行なのでそのまま import）。--file フラグの動作もユニットテスト可能 |
| P11 | 4 | node strip でスクリプト実行できるが、Node.js 22.6 が必要。vitest での単体テストは tsx と同等 |

### スタック適合性（platform-expert 評価を反映）

platform-expert 確定情報:
- Pure ESM（`"type": "module"`）
- TypeScript ESM + NodeNext moduleResolution
- Node.js `>=18`
- Zod v4（`toJSONSchema()` 利用可能）
- GitHub Actions（ubuntu-latest、pnpm 使用）

| パターン | スコア | 根拠 |
|---------|-------|------|
| P1 | 3 | .mjs は Pure ESM と適合。dist/ 経由は設計的ねじれだが動作する |
| P2 | 3 | .mjs + JSON は ESM 互換。schema-meta.json の同期は手動だが動作する |
| P3 | 5 | tsx は TypeScript ESM と完全適合。toJSONSchema() は Zod v4 組み込み。CI（pnpm tsx）はシンプル |
| P5 | 3 | dist/ 経由は CI で build ステップが必要。スタック自体は適合 |
| P6 | 2 | .claude/skills/ 配置は claude-code-plugin 方式と矛盾（platform-expert 確定: ~/.claude/plugins/cache/ が正しいパス）|
| P8 | 3 | tsup.config.ts 変更が必要。既存スタックへの影響が大きい |
| P9 | 5 | P3 と同等。gh CLI は GitHub Actions でデフォルト利用可能 |
| P10 | 5 | P3/P9 と同等。差分チェック（git diff）も標準ツールのみ使用 |
| P11 | 3 | Node.js 22.6+ 必須。現在 engines: >=18 に対して制約が強すぎる。CI では Node.js 22 固定なら動作するがローカル環境で問題が出る可能性 |

### 学習コスト（platform-expert 評価を反映）

新規参入者（TypeScript 経験あり・Zod/GitHub Actions 基本知識あり）が理解するために必要な概念数。

| パターン | スコア | 根拠 |
|---------|-------|------|
| P1 | 3 | .mjs + dist 経由の説明が必要。「build してから実行」の手順を覚える必要あり |
| P2 | 3 | schema-meta.json の手動更新ルールを覚える必要あり。忘れると同期ズレ |
| P3 | 4 | tsx の役割（TypeScript ファイルを直接実行）が 1 つ増えるだけ。直感的 |
| P5 | 2 | dist/ 流用の設計ねじれが説明しにくい。「なぜ build が必要か」の理解が難しい |
| P6 | 2 | .claude/ 配置の概念 + claude-code-plugin 方式 + ローカルディレクトリ構造の説明が複雑 |
| P8 | 2 | tsup.config.ts の変更 + build 前提 + schema-meta.ts の役割の説明が必要 |
| P9 | 4 | P3 と同等。gh CLI の使い方は一般的で学習コスト低い |
| P10 | 4 | P3/P9 と同等。差分チェック（git diff --exit-code）の動作も直感的 |
| P11 | 3 | `--experimental-strip-types` の意味と Node.js バージョン制約の説明が必要。experimental という注意書きが心理的ハードルになる |

### シンプルさ（devils-advocate 評価を反映）

devils-advocate 評価（25点満点）から 5 点スケールに換算（25点→5点、5点区間で 1 点）:

| パターン | 元スコア | 換算スコア | 備考 |
|---------|---------|----------|------|
| P1 | 18/25 | 3.6 → 4 | 依存追加ゼロが強み |
| P2 | 18/25 | 3.6 → 4 | P1 と同スコア |
| P3 | 21/25 | 4.2 → 4 | 既存変更ゼロ + 継続性高 |
| P5 | 19/25 | 3.8 → 4 | build 前提で CI 複雑性 -1 |
| P6 | 19/25 | 3.8 → 4 | 保留だったが platform-expert で失格確定 |
| P8 | 17/25 | 3.4 → 3 | tsup 変更コストが高い |
| P9 | 21/25 | 4.2 → 4 | P3 と同スコア |
| P10 | 19/25 | 3.8 → 4 | validate.ts 変更あり（E2 必須コスト） |
| P11 | - | 4 | P3 と同等。但し engines 変更が軸 3 で減点。→ 3 |

※P11 の devils-advocate 評価: tsx の代替として依存追加ゼロは軸 1 が 5 点。しかし engines 変更（>=18 → >=22.6）は軸 3（既存コード変更）で 3 点相当。experimental フラグはメンテ継続性で 3 点相当。合計推定 19/25 → 4 点だが experimental の不安定性を考慮して 3 点。

---

## 多軸スコアリング比較表（最終版）

| パターン | 概要 | 保守性 | テスト | スタック適合 | 学習コスト | シンプルさ | 合計 | 失格 |
|---------|------|-------|-------|------------|----------|----------|------|------|
| **P1** | .mjs + dist + E1 | 2 | 2 | 3 | 3 | 4 | **14** | - |
| **P2** | .mjs + schema-meta.json + E1 | 2 | 2 | 3 | 3 | 4 | **14** | - |
| **P3** | tsx + toJSONSchema + E1 | 4 | 4 | 5 | 4 | 4 | **21** | - |
| ~~P4~~ | ~~tsx + .describe() 埋め込み~~ | - | - | - | - | - | **失格** | schema.ts SRP 違反 |
| **P5** | .mjs + dist経由 + E1 | 2 | 2 | 3 | 2 | 4 | **13** | - |
| ~~P6~~ | ~~tsx + .claude/skills/ 直置き~~ | - | - | - | - | - | **失格** | ~/.claude/skills/ 非存在 |
| ~~P7~~ | ~~tsx + ts-morph AST~~ | - | - | - | - | - | **失格** | 過剰設計 |
| **P8** | .mjs + schema-meta.ts + dist | 2 | 2 | 3 | 2 | 3 | **12** | - |
| **P9** | tsx + toJSONSchema + E2 + gh（冪等性なし） | 4 | 4 | 5 | 4 | 4 | **21** | - |
| **P10** | tsx + toJSONSchema + E2 + 差分チェック | 5 | 5 | 5 | 4 | 4 | **23** | - |
| **P11** | node strip + toJSONSchema + E2 + 差分 | 4 | 4 | 3 | 3 | 3 | **17** | - |

---

## Top 3 絞り込み

### 1位: Pattern 10（合計 23点）

```
tsx + toJSONSchema + validate --file + 差分チェック CI
```

- 全 5 軸で最高水準
- Phase 1 の 5 要件を全て満たす唯一のパターン（YAML 検証 E2 + 冪等性 + 自動追従）
- devils-advocate 最終推奨（E2 必須確定後に切り替え済み）
- module-designer 最有力、dependency-analyst 最有力、architecture-lead 最有力

**実装内容（確定）:**
```
新規: scripts/generate-references.ts
新規: .github/workflows/sync-skill-refs.yml
新規: skill/SKILL.md（手書き）
新規: skill/references/（自動生成ターゲット）
変更: src/commands/validate.ts（--file フラグ追加）
変更: package.json（"skill:sync": "tsx scripts/generate-references.ts"）
devDependencies: + tsx
```

---

### 2位: Pattern 3（合計 21点）/ Pattern 9（合計 21点）

**Pattern 3** = tsx + toJSONSchema + E1（YAML 検証は案内のみ）

Pattern 10 と同一だが YAML 検証を E1（案内のみ）にとどめたもの。
既存コード変更ゼロが強み。

**採用条件**: 「既存プロジェクトへの screen YAML 追加が主たるユースケース」と確認されれば Pattern 3 でも Phase 1 要件を満たせる可能性がある。ユーザー回答「両方ある」により E2 が確定したため、現時点では Pattern 10 の方が優位。

**Pattern 9** = tsx + toJSONSchema + E2 + gh（差分チェックなし）

Pattern 10 から `git diff` 差分チェックを省いたもの。冪等性が弱い（schema.ts が変わっていない push でも PR が作成される可能性）。

**採用条件**: CI の実行コストを気にしない、または schema.ts の変更頻度が極めて低い場合。

---

### 3位: Pattern 11（合計 17点）

tsx の代替として `--experimental-strip-types` を使う案。

**メリット**: tsx 追加ゼロ
**デメリット**:
1. engines を `>=18` → `>=22.6` に上げる必要がある（既存ユーザーへの breaking change）
2. `--experimental` フラグ（Node.js 23.x でも安定化途中）
3. CI では Node.js 22 で動くが、ローカル開発で Node.js 18/20 環境が壊れる

**結論**: tsx 1 パッケージの追加コストと比較して、engines 制約変更のコストが高い。Pattern 10 が優位。

---

## 最終推奨

**Pattern 10 を採用推奨。**

理由の優先順位:
1. Phase 1 の 5 要件を全て満たす（SKILL.md + references 自動生成 + GitHub Actions + YAML 検証 E2 + 冪等性）
2. 全エージェント（architecture-lead / module-designer / dependency-analyst / devils-advocate）が最有力と判定
3. tsx 1 つの追加コストは `devDependencies` への追加のみ。ランタイムに影響なし
4. validate.ts への `--file` フラグ追加は「フィルタリングオプション追加」であり SRP を損なわない

---

## 残り未解決論点

1. **parser.ts の変更有無**: validate.ts に `--file` フラグを追加する際、`parseYamlFile` を内部で使うか `parseProject` を改修するかでコードが変わる。module-designer 推奨は「`parseProject` を単一ファイルモードで動かす実装」（parser.ts に export 追加不要）。
2. **references/ の出力先**: tespec リポジトリの `skill/references/` か、claude-code-plugin リポジトリの `development/tespec-yaml-gen/skills/references/` か。Phase 1 では tespec リポジトリ内に生成し、Phase 2 で claude-code-plugin への連携を追加する段階的な進め方が現実的。
