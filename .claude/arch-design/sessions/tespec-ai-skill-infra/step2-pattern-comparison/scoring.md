# Step 2: アーキテクチャパターン比較・スコアリング・選定

作成日: 2026-03-25
担当: arch-design チーム全員（architecture-lead 統合）

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
7. YAML 検証機能の未実装
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

**[確定] E2 採用（ユーザー回答 2026-03-25）**
理由: 「既存プロジェクトへの YAML 追加」と「新規単体ファイル生成 + その場で検証」の両方のユースケースがあるため。

### 変数 F: GitHub Actions の PR 作成方式

| 選択肢 | 冪等性 | サードパーティ依存 |
|--------|--------|-----------------|
| F1: `peter-evans/create-pull-request` action | 自動（action が管理） | あり |
| F2: `gh pr create` + `git diff` 差分チェック | 差分なければ PR 作成しない | なし |

---

## 10 パターン + Pattern 11

### Pattern 1: .mjs + dist 経由 + E1

**組み合わせ**: A1 + B1 + E1 + F2

```
scripts/generate-skill-refs.mjs  （dist/core/schema.js を import → toJSONSchema）
.github/workflows/sync-skill-refs.yml
package.json: "skill:sync": "pnpm build && node scripts/generate-skill-refs.mjs"
```

依存追加ゼロ、既存コード変更ゼロ。build 前提（2 ステップ）、E1 で検証が弱い。

---

### Pattern 2: .mjs + schema-meta.json（手動同期・依存ゼロ）

**組み合わせ**: A1変形 + B2 + E1 + F2

```
scripts/generate-skill-refs.mjs
scripts/schema-meta.json（手書き）
.github/workflows/sync-skill-refs.yml
```

依存追加ゼロ、build 不要。toJSONSchema() が使える今、schema-meta.json 手書きの採用理由が弱い。同期ズレリスク大。

---

### Pattern 3: tsx + toJSONSchema + E1（既存コード変更ゼロ）

**組み合わせ**: A2 + B1 + E1 + F2

```
scripts/generate-skill-refs.ts
.github/workflows/sync-skill-refs.yml
package.json: "skill:sync": "tsx scripts/generate-skill-refs.ts"
devDependencies: + tsx
```

tsx 追加のみ、既存コード変更ゼロ。YAML 検証は案内のみ（E1）。

---

### Pattern 4: tsx + .describe() 埋め込み ← **失格**

schema.ts に `.describe()` 追加 → ランタイムコアへの SRP 違反（失格条件 1）。

---

### Pattern 5: .mjs + dist 経由 + F1（peter-evans）

**組み合わせ**: A1 + B1 + E1 + F1

```
scripts/generate-skill-refs.mjs
.github/workflows/sync-skill-refs.yml  （peter-evans/create-pull-request action）
```

依存追加ゼロ、既存コード変更ゼロ。build 前提、サードパーティ action 依存。

---

### Pattern 6: tsx + .claude/skills/ 直置き ← **失格**

Claude Code が標準認識しない（`~/.claude/skills/` は存在しない）。platform-expert 調査で確定除外。

---

### Pattern 7: tsx + ts-morph AST ← **失格**

ts-morph は明確に過剰。Zod `.shape` / `toJSONSchema()` で十分得られる情報を AST から取る必要はない。

---

### Pattern 8: .mjs + schema-meta.ts + dist 経由

**組み合わせ**: A1 + B変形（schema-meta.ts ビルド対象）+ E1 + F2

```
src/skill-meta.ts（tsup 対象に追加）
scripts/generate-skill-refs.mjs
.github/workflows/sync-skill-refs.yml
変更: tsup.config.ts（entry 追加）
```

tsup.config.ts 変更 + build 前提。dist 流用のねじれが Pattern 5 と同問題。

---

### Pattern 9: tsx + toJSONSchema + E2（冪等性なし）

**組み合わせ**: A2 + B1 + E2 + F2（差分チェックなし）

```
scripts/generate-skill-refs.ts
.github/workflows/sync-skill-refs.yml  （差分チェックなし）
変更: src/commands/validate.ts（--file フラグ）
devDependencies: + tsx
```

Pattern 10 から `git diff` 差分チェックを省いたもの。冪等性が弱い（schema.ts が変わっていない push でも PR が作成される可能性）。

---

### Pattern 10: tsx + toJSONSchema + E2 + 差分チェック（最有力）

**組み合わせ**: A2 + B1 + E2 + F2（差分チェックあり）

```
新規: scripts/generate-references.ts   （schema.ts → toJSONSchema → skill/references/*.md）
新規: .github/workflows/sync-skill-refs.yml  （差分チェック + gh pr create）
新規: skill/SKILL.md                   （手書き）
新規: skill/references/               （自動生成ターゲット）
変更: src/commands/validate.ts         （--file フラグ追加）
変更: package.json                     （"skill:sync": "tsx scripts/generate-references.ts"）
devDependencies: + tsx
```

---

### Pattern 11: Node.js 22 --experimental-strip-types（新案）

**組み合わせ**: A3 + B1 + E2 + F2

```
package.json: "skill:sync": "node --experimental-strip-types scripts/generate-references.ts"
engines: { "node": ">=22.6" }
```

tsx 不要・依存追加ゼロ。ただし engines を `>=18` から `>=22.6` に上げる必要あり（breaking change）、experimental フラグ不安定。

---

## 設計変数マトリクス

| パターン | ランタイム | スキーマ抽出 | YAML 検証 | PR 作成 | 依存追加 | 既存コード変更 | 失格 |
|---------|----------|------------|----------|--------|---------|------------|------|
| 1 | .mjs(dist) | toJSONSchema | E1(案内) | F2(差分) | 0 | なし | - |
| 2 | .mjs | schema-meta.json | E1(案内) | F2(差分) | 0 | なし | - |
| 3 | tsx | toJSONSchema | E1(案内) | F2(差分) | tsx | なし | - |
| **4** | tsx | .describe() | - | - | - | schema.ts | **失格** |
| 5 | .mjs(dist) | toJSONSchema | E1(案内) | F1(action) | 0 | なし | - |
| **6** | tsx | - | - | - | - | - | **失格** |
| **7** | tsx+ts-morph | ts-morph AST | - | - | - | - | **失格** |
| 8 | .mjs(dist) | schema-meta.ts | E1(案内) | F2(差分) | 0(build前提) | tsup.config | - |
| 9 | tsx | toJSONSchema | E2(--file) | F2(差分なし) | tsx | validate.ts | - |
| **10** | tsx | toJSONSchema | E2(--file) | F2(差分あり) | tsx | validate.ts | **最有力** |
| 11 | node strip | toJSONSchema | E2(--file) | F2(差分あり) | 0(>=22.6) | validate.ts | - |

---

## 多軸スコアリング比較表

評価軸（各 5 点満点）:

| 軸 | 担当 | 説明 |
|----|------|------|
| **保守性・拡張性** | architecture-lead | schema.ts 変更への自動追従、将来の変更コスト |
| **テスト容易性** | architecture-lead | 生成スクリプト・検証機能のテストしやすさ |
| **スタック適合性** | platform-expert | tsx/zod/github actions との相性、Pure ESM・Node.js 18 対応 |
| **学習コスト** | platform-expert | 新規参入者が把握すべき概念数、ツールの一般性 |
| **シンプルさ** | devils-advocate | YAGNI 遵守・依存追加の最小化・既存コード変更の少なさ |

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

## エージェント別スコア詳細

### 依存設計スコア（dependency-analyst 評価）

前提:
- `zod@4.1.12` インストール済み。`z.toJSONSchema()` および `.shape` は今すぐ使用可能
- 守るべき 3 ルール: (1) schema.ts は外部のみ依存 (2) core/ は commands/ を import しない (3) utils/ は core/ を import しない

| パターン | 依存設計スコア | 根拠 |
|---------|--------------|------|
| 1 | 2 | schema-meta と schema.ts の二重管理。依存が明示されない |
| 2 | 2 | JSON と schema.ts の乖離リスク。依存の暗黙化 |
| 3 | 4 | schema.ts 直接 import で依存明示。二重管理なし |
| 5 | 2 | dist/ 流用はランタイム成果物のねじれ。build 前提の隠れた順序依存 |
| 8 | 2 | Pattern 5 と同じ dist 流用の問題 |
| 9 | 4 | Pattern 3 ベース。差分チェックなしで PR 重複リスクあり |
| 10 | 5 | 依存が import で明示。冪等性あり。循環なし。最もクリーン |

### モジュール設計スコア（module-designer 評価）

評価軸: 凝集度 / 依存方向 / 境界明確さ（各 1-5）

| パターン | 凝集度 | 依存方向 | 境界明確さ | 合計 | 主な理由 |
|---------|-------|---------|----------|-----|---------|
| 1 | 2 | 4 | 2 | 8 | schema-meta と .mjs の二重管理。境界不明確 |
| 2 | 3 | 4 | 3 | 10 | JSON手動管理で schema.ts との乖離リスクあり |
| 3 | 5 | 5 | 4 | 14 | schema.ts 直接 import。.shape は公開 API |
| 5 | 4 | 3 | 3 | 10 | dist 経由は設計的ねじれ（ランタイム成果物の流用）|
| 8 | 4 | 3 | 3 | 10 | build 前提の設計ねじれ（Pattern 5 と同問題）|
| 9 | 5 | 5 | 4 | 14 | Pattern 3 と同等。冪等性なしが唯一の欠点 |
| 10 | 5 | 5 | 5 | 15 | 凝集度・依存方向・境界すべて最良 |

### スタック適合性スコア（platform-expert 評価、各 1-3 点、合計 15 点満点）

評価軸: A=依存追加コスト / B=Node.js >=18 互換 / C=tsup 整合性 / D=GitHub Actions 実装コスト / E=ESM 互換性

| Pattern | A | B | C | D | E | 合計 | 判定 |
|---------|---|---|---|---|---|------|------|
| 1 | 3 | 3 | 3 | 3 | 3 | 15 | △ スタック適合は高いが設計問題あり |
| 2 | 3 | 3 | 3 | 3 | 3 | 15 | △ スタック適合は高いが JSON 手動更新運用 |
| 3 | 2 | 3 | 3 | 2 | 3 | 13 | △ tsx 追加 |
| 5 | 3 | 3 | 2 | 3 | 3 | 14 | △ build 前提 |
| 8 | 3 | 3 | 2 | 3 | 3 | 14 | △ build 前提、tsup entry 追加必要 |
| 9 | 2 | 3 | 3 | 3 | 3 | 14 | ○ tsx 追加のみ、冪等性なし |
| 10 | 2 | 3 | 3 | 3 | 3 | 14 | ◎ tsx 追加のみ、冪等性あり |

platform-expert 補足:
- `gh pr create` は ubuntu-latest に組み込み済み（追加 Action 不要）
- `GITHUB_TOKEN` は GitHub Actions デフォルト提供（secrets 追加設定不要）
- tsx は `pnpm add -D tsx` 1 コマンド、ビルド成果物に含まれない
- Zod `.shape` は `toJSONSchema()` で完全代替可能。`toJSONSchema()` の方が抽象度が高く安定

### シンプルさスコア（devils-advocate 評価）

評価軸（各 5 点満点、合計 25 点）:

| 軸 | 内容 |
|----|------|
| 軸 1: 依存追加コスト | 5=ゼロ / 4=devDeps 1 / 3=devDeps 2〜3 / 2=deps 追加 / 1=5 以上 |
| 軸 2: ファイル追加数 | 5=1〜2 本 / 4=3〜4 本 / 3=5〜7 本 / 2=8〜10 本 / 1=10 本以上 |
| 軸 3: 既存コード変更量 | 5=src/ 変更ゼロ / 4=package.json scripts のみ / 3=軽微 1〜2 本 / 2=schema.ts 変更 / 1=大幅変更 |
| 軸 4: CI 複雑性 | 5=1 ファイル完結 / 4=1 ファイル+secrets / 3=複数 job / 2=matrix / 1=外部サービス |
| 軸 5: メンテナンス継続性 | 5=自動解析で完全追従 / 4=1 箇所修正 / 3=2 箇所修正 / 2=複数手動更新 / 1=自動更新機能せず |

| 案 | 軸1 | 軸2 | 軸3 | 軸4 | 軸5 | 合計 |
|----|-----|-----|-----|-----|-----|------|
| P1 | 5 | 3 | 4 | 4 | 2 | 18 |
| P2 | 5 | 3 | 4 | 4 | 2 | 18 |
| P3 | 4 | 3 | 5 | 4 | 5 | 21 |
| P5 | 5 | 3 | 4 | 3 | 4 | 19 |
| P8 | 5 | 3 | 3 | 3 | 3 | 17 |
| P9 | 4 | 3 | 5 | 4 | 5 | 21 |
| P10 | 4 | 3 | 3 | 4 | 5 | 19 |

**tsx の YAGNI 判定: NO（追加を支持）**

代替案はどれも問題を抱えている:
- `.mjs` + dist 経由: build 前提のねじれ
- `.mjs` + JSON 手動管理: 自動更新要件と相反する同期ズレリスク
- `--experimental-strip-types`: experimental フラグ付きで本番 CI には不安定

**devils-advocate 最終推奨（E2 確定後）:**
当初 P3（21点）を推奨したが、ユーザー回答「両方のユースケースがある」により E2 が必須と確定。P10（E2）に切り替え。validate.ts への変更は E2 が要件確定した以上の必然コストであり減点理由の重みが下がる。

---

## 議論ログ

### dependency-analyst × module-designer

- `scripts/generate-references.ts` 単一スクリプトに最終決定（src/skill/ 新設なし）
- `commands/sync.ts` は不要（oclif コマンドとして公開する必要なし）で合意
- tsx の必要性: 「TypeScript スクリプトから schema.ts を直接 import するには tsx が必要」が正しい理由

### dependency-analyst × platform-expert

- `add-skill` コマンド不要を確認。Claude Code は Git リポジトリベース配布
- zod v4 で `toJSONSchema()` 使用可能を確認
- `dist/` 経由参照（Pattern 5/8）を除外推奨。ランタイム成果物の流用はねじれ

### platform-expert × module-designer

- `src/skill/` 新設を取りやめ `scripts/` に直接置く方針に変更
  - 理由 1: `src/` 配下に置くと tsup のビルド対象に混入し `dist/` に出力されるリスク
  - 理由 2: Phase 1 では他から import するユースケースが存在しない（YAGNI）
  - 理由 3: 60-80 行の単一スクリプトで完結する
- 分離トリガー条件: `scripts/generate-references.ts` が 100 行を超えたら `src/skill/` への分離を再検討
- E3（独立スクリプト）の注意点: `parseYamlFile` を公開 API にすると変更コスト増加。E2 の `--file` フラグ実装で境界を壊さずに対応可能

### devils-advocate による E1 vs E2 論点整理

devils-advocate が問うた判断軸:
- ケース A: 既存プロジェクトに screen YAML を追加する → config + setups/ 構造がある → E1 で検証可能
- ケース B: 新規プロジェクトで YAML を 1 枚だけ生成する → E1 では検証できない → E2 が必要

**[確定] ユーザー回答: 「両方ある」→ E2 が必要と確定**

---

## 最終推奨: Pattern 10 + E2

全エージェント（architecture-lead / module-designer / dependency-analyst / devils-advocate）一致。

**理由の優先順位:**
1. Phase 1 の 5 要件を全て満たす（SKILL.md + references 自動生成 + GitHub Actions + YAML 検証 E2 + 冪等性）
2. tsx 1 追加のみ（devDependencies のみ、ランタイム影響なし）
3. validate.ts への `--file` フラグはフィルタリングオプション追加であり SRP を損なわない
4. 差分チェックで冪等性確保（schema.ts が変わっていない push では PR を作成しない）

**Pattern 11 の棄却理由:**
- engines を `>=18` → `>=22.6` に変更する必要あり（既存ユーザーへの breaking change）
- `--experimental-strip-types` フラグ（Node.js 23.x でも安定化途中）
- tsx 1 パッケージ追加コスト < engines 制約変更コスト

**確定実装内容:**

```
新規: scripts/generate-references.ts   (schema.ts → toJSONSchema → skill/references/*.md)
新規: .github/workflows/sync-skill-refs.yml  (schema.ts 変更検知 → 差分チェック → PR 作成)
新規: skill/SKILL.md                   (手書き)
新規: skill/references/               (自動生成ターゲット)
変更: src/commands/validate.ts         (--file フラグ追加)
変更: package.json                     ("skill:sync": "tsx scripts/generate-references.ts")
devDependencies: + tsx
```

---

## 未解決論点（Step 3 で解決）

1. **parser.ts の変更有無**: `--file` フラグ追加時、`parseProject` を単一ファイルモードで改修するか（module-designer 推奨）、`parseYamlFile` を export するか。

2. **references/ の出力先**: tespec リポジトリ内 `skill/references/` に生成（Phase 1）→ Phase 2 で claude-code-plugin リポジトリへ連携する段階的進め方を推奨。確定が必要。
