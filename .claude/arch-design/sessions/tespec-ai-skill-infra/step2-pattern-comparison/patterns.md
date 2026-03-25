# Step 2: アーキテクチャパターン 10 案

作成日: 2026-03-25
担当: architecture-lead
最終更新: 2026-03-25（platform-expert / dependency-analyst / devils-advocate フィードバック反映後に全面刷新）

---

## Phase 1 確定スコープ（全パターン共通前提）

1. **SKILL.md**（手書き）— AI への指示・ルール・記述例
2. **references/*.md**（自動生成）— schema.ts から `toJSONSchema()` でスキーマドキュメント生成
3. **生成スクリプト**（schema.ts → references/*.md）
4. **GitHub Actions workflow**（schema.ts 変更検知 → references/ 再生成 → PR 作成）★Phase 1 必須
5. **YAML 検証機能**（AI 生成 YAML の形式チェック）★Phase 1 必須

Phase 2（後日）: sunagaku-marketplace 配布（`/plugin install tespec@sunagaku-marketplace`）

---

## 確定した設計前提（platform-expert / dependency-analyst 調査より）

| 項目 | 確定内容 |
|-----|---------|
| Skill 配布方式 | `claude-code-plugin` リポジトリに追加（tespec npm とは完全分離） |
| Skill インストール | `/plugin install tespec@sunagaku-marketplace` |
| Zod v4 `toJSONSchema()` | 利用可能・依存追加ゼロ（Zod v4 組み込み） |
| `~/.claude/skills/` | 存在しない。実パスは `~/.claude/plugins/cache/` 以下 |
| `add-skill` コマンド | **不要**（Plugin 方式で完全代替） |
| tespec npm と Skill | **完全分離**（Skill は `claude-code-plugin` リポジトリで管理） |
| SKILL.md フロントマター | `name`, `description`, `disable-model-invocation`, `allowed-tools` が必須 |

---

## 失格条件（全パターン共通）

1. schema.ts へのランタイムコード追加（`.describe()` 等）
2. `add-skill` コマンドを src/commands/ に追加
3. npm パッケージへの Skill ファイル同梱
4. 外部 API 依存
5. 既存 vitest テストの破壊
6. GitHub Actions を Phase 2 に先送り
7. YAML 検証機能の未実装（E1 案内のみが該当するかは devils-advocate 判定待ち）
8. npx 配布方式の採用

---

## 設計変数

### 変数 A: 生成スクリプトのランタイム

| 選択肢 | 依存追加 | schema.ts 直接 import |
|--------|---------|----------------------|
| A1: `.mjs`（dist/ 経由） | 0 | 不可（build 前提） |
| A2: `tsx` で `.ts` 直接実行 | tsx を devDependencies に追加 | 可 |
| A3: Node.js 22+ `--experimental-strip-types` | 0（engines 条件あり） | 可 |

### 変数 B: スキーマ情報の抽出方式

| 選択肢 | schema.ts 変更 | 依存追加 | 自動追従 |
|--------|--------------|---------|---------|
| B1: `z.toJSONSchema()` ランタイム抽出（Zod v4 組み込み） | なし | 0 | 完全自動 |
| B2: `schema-meta.json` 手書き | なし | 0 | 手動更新必要 |

※ B3(.describe()): 失格 / B4(ts-morph): 過剰 → 除外済み

### 変数 E: YAML 検証機能の実装

| 選択肢 | 既存コード変更 | AI の使いやすさ |
|--------|------------|--------------|
| E1: SKILL.md 内に案内のみ | なし | 弱い（プロジェクト全体が必要） |
| E2: `tespec validate --file` フラグ追加 | validate.ts に flag 追加 | 強い（単体ファイルで即検証） |
| E3: 独立スクリプト `scripts/validate-yaml.ts` | parser.ts に export 追加 | 中（スクリプト実行） |

### 変数 F: GitHub Actions の PR 作成方式

| 選択肢 | 冪等性 | サードパーティ依存 |
|--------|--------|-----------------|
| F1: `peter-evans/create-pull-request` action | 自動（action が管理） | あり |
| F2: `gh pr create` + `git diff` 差分チェック | 差分なければ PR 作成しない | なし |

---

## 10 パターン

### Pattern 1: 最小依存（.mjs + toJSONSchema + dist 経由 + E1）

**組み合わせ**: A1 + B1 + E1 + F2

新規追加ファイル:
- `scripts/generate-skill-refs.mjs`（dist/core/schema.js を import → toJSONSchema）
- `.github/workflows/sync-skill-refs.yml`

package.json 追加: `"skill:sync": "pnpm build && node scripts/generate-skill-refs.mjs"`

**特徴**:
- 依存追加ゼロ、既存コード変更ゼロ
- `toJSONSchema()` で schema.ts への完全自動追従
- YAML 検証は案内のみ（E1）

**注意点**: build 前提（2 ステップ）、E1 で検証が弱い

---

### Pattern 2: tsx + toJSONSchema + E2（推奨統合案）

**組み合わせ**: A2 + B1 + E2 + F2

新規追加: `scripts/generate-skill-refs.ts`, `.github/workflows/sync-skill-refs.yml`
変更: `src/commands/validate.ts`（--file フラグ）, `package.json`（skill:sync script）
devDependencies 追加: `tsx`

**特徴**:
- schema.ts 直接 import → toJSONSchema() → 完全自動追従（build 不要）
- `tespec validate --file` で AI 生成 YAML の単体検証
- 差分チェックで冪等性確保

---

### Pattern 3: tsx + toJSONSchema + E1（既存コード変更ゼロ）

**組み合わせ**: A2 + B1 + E1 + F2

Pattern 2 から YAML 検証を E1（案内のみ）に落としたもの。
tsx 追加のみ、既存コード変更ゼロ。

---

### Pattern 4: tsx + toJSONSchema + E2 + F1（peter-evans）

**組み合わせ**: A2 + B1 + E2 + F1

Pattern 2 の PR 作成を `peter-evans/create-pull-request` action に変えたもの。
サードパーティ action 依存が発生するが、workflow の `git diff` 処理が不要になる。

---

### Pattern 5: .mjs + schema-meta.json（手動同期・依存ゼロ）

**組み合わせ**: A1変形 + B2 + E1 + F2

新規追加: `scripts/generate-skill-refs.mjs`, `scripts/schema-meta.json`（手書き）, `.github/workflows/sync-skill-refs.yml`

**特徴**: 依存追加ゼロ、build 不要
**注意点**: toJSONSchema() が使える今、schema-meta.json 手書きの採用理由が弱い。同期ズレリスク大。

---

### Pattern 6: src/skill/ モジュール化（ビルド対象）

**組み合わせ**: A1（dist 経由） + B1 + E2 + F2

新規追加: `src/skill/skill-generator.ts`（tsup 対象）, `scripts/sync.mjs`, `.github/workflows/sync-skill-refs.yml`
変更: `src/commands/validate.ts`, `tsup.config.ts`（entrypoint 追加）

**特徴**: module-designer 推奨の `src/skill/` 構成を実装、TypeScript 型安全
**注意点**: build 前提、tsup.config.ts の変更が必要

---

### Pattern 7: Node.js 22 --experimental-strip-types

**組み合わせ**: A3 + B1 + E2 + F2

`"skill:sync": "node --experimental-strip-types scripts/generate-skill-refs.ts"`

**特徴**: tsx 不要・依存追加ゼロ・schema.ts 直接 import 可
**注意点**: engines >=18 を >=22.6 に上げる必要あり（breaking change）、experimental フラグ

---

### Pattern 8: tsx + toJSONSchema + E3（独立バリデーションスクリプト）

**組み合わせ**: A2 + B1 + E3 + F2

新規追加: `scripts/generate-skill-refs.ts`, `scripts/validate-yaml.ts`, `.github/workflows/sync-skill-refs.yml`
変更: `src/core/parser.ts`（parseYamlFile を export 追加）

**特徴**: YAML 検証が CLI に依存せず独立スクリプト
**注意点**: parser.ts への export 追加 + validate.ts との処理重複（dependency-analyst 指摘）

---

### Pattern 9: .mjs + dist 経由 + peter-evans（依存追加ゼロ・最小変更）

**組み合わせ**: A1 + B1 + E1 + F1

新規追加のみ: `scripts/generate-skill-refs.mjs`, `.github/workflows/sync-skill-refs.yml`
依存追加: ゼロ、既存コード変更: ゼロ

**特徴**: 最もファイル追加が少ない、YAML 検証は案内のみ
**注意点**: build 前提、サードパーティ action 依存

---

### Pattern 10: tsx + toJSONSchema + cross-repo 直接 PR

**組み合わせ**: A2 + B1 + E2 + F2（cross-repo checkout）

Pattern 2 の workflow を拡張し、生成した references/ を claude-code-plugin リポジトリに直接 PR する方式。

```yaml
- uses: actions/checkout@v4
  with:
    repository: sean-sunagaku/claude-code-plugin
    token: ${{ secrets.SKILL_REPO_TOKEN }}
    path: claude-code-plugin
- run: pnpm tsx scripts/generate-skill-refs.ts --out ./claude-code-plugin/...
```

**特徴**: 2 リポジトリ連携を完全自動化
**注意点**: SKILL_REPO_TOKEN（PAT/GitHub App）設定が必要、cross-repo 権限設定のコスト

---

## 設計変数マトリクス

| パターン | ランタイム | スキーマ抽出 | YAML 検証 | PR 作成 | 依存追加 | 既存コード変更 |
|---------|----------|------------|----------|--------|---------|------------|
| 1  | .mjs(dist) | toJSONSchema | E1(案内) | F2(差分) | 0 | なし |
| 2  | tsx | toJSONSchema | E2(--file) | F2(差分) | tsx | validate.ts |
| 3  | tsx | toJSONSchema | E1(案内) | F2(差分) | tsx | なし |
| 4  | tsx | toJSONSchema | E2(--file) | F1(action) | tsx | validate.ts |
| 5  | .mjs | schema-meta.json | E1(案内) | F2(差分) | 0 | なし |
| 6  | tsup+dist | toJSONSchema | E2(--file) | F2(差分) | 0 | validate.ts + tsup |
| 7  | node strip | toJSONSchema | E2(--file) | F2(差分) | 0(>=22.6) | validate.ts |
| 8  | tsx | toJSONSchema | E3(スクリプト) | F2(差分) | tsx | parser.ts |
| 9  | .mjs(dist) | toJSONSchema | E1(案内) | F1(action) | 0 | なし |
| 10 | tsx | toJSONSchema | E2(--file) | F2(cross-repo) | tsx | validate.ts |

---

## architecture-lead の予備評価

### 有力候補

**Pattern 2（最有力）**:
- Phase 1 の 5 要件を全て満たす
- tsx 1 追加 + validate.ts 変更 1 箇所のみ
- toJSONSchema() で schema.ts 変更に完全自動追従
- 差分チェックで冪等性確保

**Pattern 1（代替: 依存追加ゼロ優先）**:
- 依存追加ゼロ、既存コード変更ゼロ
- YAML 検証が E1（案内のみ）で Phase 1 要件を弱く満たす
- build 前提

### 除外候補

**Pattern 5**: toJSONSchema があるのに schema-meta.json 手書きは不合理。同期ズレリスク大。
**Pattern 7**: engines >=18 制約と experimental の安定性問題。
**Pattern 8**: parser.ts への export 追加 + 処理重複（dependency-analyst 指摘）。

### Pattern 1（E1）vs Pattern 2（E2）の判断ポイント

- E1: プロジェクト全体（config + screens + setups）が必要 → AI が単体 YAML 生成直後には使えない
- E2: `tespec validate --file screens/login.yaml` → 単体 YAML を即検証可能

E1 が失格条件 7「YAML 検証機能の未実装」に該当するかは devils-advocate 判定待ち。

---

## 他エージェントへの評価依頼

**devils-advocate**:
1. Pattern 2（tsx + E2）vs Pattern 1（依存追加ゼロ + E1）のシンプルさスコアを提示ください
2. E1（案内のみ）は失格条件 7「YAML 検証機能の未実装」に該当するか判定ください

**platform-expert**:
1. Pattern 10（cross-repo checkout）の PAT/GitHub App 設定難度評価
2. Pattern 7（--experimental-strip-types）の Node.js 22 安定性評価

**module-designer**:
1. E2（validate.ts への --file フラグ追加）の実装設計確認
2. Pattern 6（src/skill/ ビルド対象）の module 設計的な評価
