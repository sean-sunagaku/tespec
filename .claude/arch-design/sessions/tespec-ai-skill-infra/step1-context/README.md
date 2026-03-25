# Step 1: コンテキスト分析

作成日: 2026-03-25
担当: architecture-lead

---

## 1. プロジェクト全体像

### 何をするツールか

`tespec` は「YAML で画面仕様を書く → Playwright テストスケルトンを生成する」CLI ツール。

```
tespec validate   # YAML 構文 + クロスリファレンスをチェック
tespec generate   # Playwright テストスケルトン (.spec.ts) を生成
```

実際のプロジェクトでの使い方:

```
docs/tespec/
├── config.yaml        # version, project, screens_dir, setups_dir
├── screens/
│   ├── login.yaml     # ScreenSchema
│   └── home.yaml
└── setups/
    ├── auth.yaml      # SetupSchema
    └── seed-data.yaml
```

---

## 2. スキーマの詳細分析

### 2.1 ScreenSchema (screens/*.yaml)

```yaml
screen: home          # 必須・一意 ID（navigates_to のターゲットにもなる）
route: /              # 必須
title: ホーム画面     # 必須・テスト describe タイトルになる
cases:
  - action: 画面を開く           # 必須
    expect: 一覧が表示される      # 必須（string または string[]）
    steps:                        # 必須・min(1)
      - "use:logged_in"           # setup 参照は "use:<setup_id>" 形式
      - / にアクセスする
    given: logged_in              # 任意（string または string[]）setup の ID を参照
    target: ボタン                # 任意
    type: normal                  # 任意 normal|error|boundary default=normal
    not_expect:                   # 任意
      - 空の一覧が表示される
    navigates_to: detail          # 任意・screen ID を参照
```

### 2.2 SetupSchema (setups/*.yaml)

```yaml
setup: logged_in           # 必須・一意 ID
title: ログイン済み状態    # 必須
steps:                     # 必須（min なし）
  - テストユーザーでログイン
```

### 2.3 ConfigSchema (config.yaml)

```yaml
version: 1
project: my-project
screens_dir: ./screens    # default: ./screens
setups_dir: ./setups      # default: ./setups
```

---

## 3. バリデーションロジックの全体像

### 3.1 2 段階バリデーション

**Stage 1: YAML + Zod スキーマ検証**（`parser.ts`）
- YAML 構文エラー（行番号・カラム付き）
- Zod スキーマ違反（フィールドパス付きメッセージ）
- ファイルが存在しない場合

**Stage 2: クロスリファレンス検証**（`validator.ts`）

| チェック | レベル | 内容 |
|---------|-------|------|
| 重複 screen ID | error | 同名 screen が複数ファイルに存在 |
| given 参照 | error | given 値が setups に存在しない |
| use: 参照 | error | steps 内 `use:xxx` が setups に存在しない |
| navigates_to 参照 | error | 参照先 screen が存在しない |
| cases が空 | warning | cases 配列が 0 件 |
| error ケース欠如 | warning | type: error が 0 件 |
| boundary ケース欠如 | warning | type: boundary が 0 件 |

### 3.2 エラー情報の構造

```typescript
interface ParseError { file: string; message: string; }
interface ValidationIssue { level: 'error' | 'warning'; file: string; field: string; message: string; }
```

---

## 4. テスト生成ロジック

`generateTestFile(screen, setups)` が生成するコードの構造:

```typescript
test.describe("画面タイトル", () => {
  // 正常系は直置き
  test("action → expect", async () => {
    // Given: setup タイトル（given あり）
    // Steps:
    //   1. [use:setup_id] setup タイトル  ← setup 参照
    //   2. 通常ステップ
    // not_expect: ...
    // TODO: implement
  });

  test.describe("異常系", () => { /* error ケース */ });
  test.describe("境界値", () => { /* boundary ケース */ });
});
```

テスト名フォーマット:
- given なし: `"action → expect[0]"`
- given あり: `"[given_id,...] action → expect[0]"`

---

## 5. 技術スタック詳細

| 項目 | 内容 |
|-----|------|
| Node.js | >= 18 (ESM) |
| CLI フレームワーク | oclif v4 |
| スキーマ検証 | Zod v4 |
| YAML パーサー | yaml v2 |
| バンドラー | tsup |
| テスト | vitest |
| Lint/Format | Biome v2 |
| パッケージマネージャー | pnpm |
| CI | GitHub Actions (PR → develop ブランチ) |
| 公開パッケージ | `@sean-sunagaku/tespec` (npm, public) |

---

## 6. 機能要件（AI Skill インフラ向け）

### 6.1 AI が YAML 生成に必要な知識

AI が正しい tespec YAML を生成するには以下を把握する必要がある:

1. **ファイル構造**: config.yaml, screens/*.yaml, setups/*.yaml
2. **必須フィールド**: 各スキーマの required vs optional
3. **型制約**: union 型（string | string[]）、enum 型（normal/error/boundary）
4. **参照規則**: given → setup ID、use:xxx → setup ID、navigates_to → screen ID
5. **バリデーション警告**: 正常系のみのケースは warning になること
6. **テスト名・コメント生成ロジック**: 生成結果のプレビューを提示できる

### 6.2 AI が YAML 修正提案に必要な知識

1. **エラーメッセージのフォーマット**: `field: message` 形式
2. **クロスリファレンスの全パターン**: given, use:, navigates_to
3. **よくある間違いのパターン**: setup ID のタイポ、steps の min(1) 違反など

---

## 7. 非機能要件・制約

### 7.1 Skill 配布の制約

- **配布先**: `~/.claude/skills/` ディレクトリ（Claude Code の Skill 読み込みパス）
- **配布形式**: `SKILL.md` + `references/` ディレクトリ
- **配布方法**: `npx @sean-sunagaku/tespec add-skill` コマンド
- **ネットワーク**: npx 実行時のみネットワーク必要、Skill 使用時はオフライン

### 7.2 自動更新の制約

- **トリガー**: `schema.ts` の変更時
- **更新対象**: Skill リファレンスドキュメント + サンプル YAML + テストフィクスチャ
- **手法**: スクリプト自動実行（CI 組み込み想定）

### 7.3 バリデーションスクリプトの制約

- **CI 組み込み可能**: exit code でパス/フェイル判定
- **チェック対象**: AI が生成した YAML が tespec スキーマに適合しているか

---

## 8. 既存コードの強み・弱点

### 強み
- **スキーマが単純明快**: 4 つのスキーマ（Config, Screen, Case, Setup）のみ
- **エラーメッセージが詳細**: ファイル名 + 行番号 + フィールドパス付き
- **テストカバレッジが充実**: fixtures を使った統合テストあり
- **ESM + TypeScript で型安全**

### 弱点（AI Skill 設計への影響）
- **スキーマから自動ドキュメント生成の仕組みがない**: schema.ts を変更しても Skill リファレンスは手動更新
- **YAML サンプルが tests/fixtures に埋もれている**: AI 向けサンプルとして整理されていない
- **バリデーション警告ロジックが実装詳細に**: AI が「なぜ warning になるか」を理解するには実装コードを読む必要がある

---

## 9. 設計すべきコンポーネントの依存関係

### 9.1 依存方向（module-designer フィードバック統合済み）

```
commands/ → core/           既存・変更なし
commands/ → skill/          新規（一方向を維持）
skill/    → core/schema.ts  新規（schema のみ参照）
```

### 9.2 推奨モジュール構成（追加後）

```
src/
  cli.ts
  commands/
    validate.ts        (変更なし)
    generate.ts        (変更なし)
    add-skill.ts       (新規: Skill インストールコマンド)
    sync.ts            (新規: スキーマ変更後の自動再生成)
  core/
    schema.ts          (変更なし — ランタイムコア)
    parser.ts          (変更なし)
    generator.ts       (変更なし)
    validator.ts       (変更なし)
  skill/
    skill-generator.ts (新規: schema → SKILL.md + references/ 生成)
    schema-meta.ts     (新規: Zod 内部 API 非依存のスキーマメタ定義)
    installer.ts       (新規: Skill ファイルのコピー処理)
  utils/
    output.ts          (変更なし)
```

**設計原則:**
- `core/` は「tespec YAML 処理」専用のまま維持（変更なし）
- `skill/` を新設して「AI Skill インフラ」を分離
- `yaml-linter.ts` は最小構成に含めない（既存 parser.ts + validator.ts で代替可能）

### 9.3 データフロー

```
schema.ts (Single Source of Truth)
    │
    ├──► skill/skill-generator.ts
    │        │
    │        ├──► skills/tespec/SKILL.md
    │        ├──► skills/tespec/references/schema.md
    │        └──► skills/tespec/references/examples/
    │
    ├──► commands/add-skill.ts → skill/installer.ts
    │        │
    │        └──► ~/.claude/skills/tespec/ (インストール先)
    │
    └──► commands/sync.ts (スキーマ変更時の再生成オーケストレーション)
```

---

## 10. 設計上の重要な判断ポイント

### 判断ポイント 1: Skill の単一ファイル vs 分割構成

devils-advocate の指摘と自動更新要件の両立を考慮した上での結論:

- **案 A**: SKILL.md 1 ファイルにすべて詰め込む（今すぐシンプル、自動更新しにくい）
- **案 B**: SKILL.md（手書き） + references/（自動生成）に分割
- **推奨**: 案 B。ただし references/ の内容は最小限に絞る

理由: 自動更新を実現するには「手動管理部分」と「自動生成部分」の境界が必要。
SKILL.md = 使い方・思想（手動）、references/ = スキーマ定義・サンプル（自動生成）という分割が自然。

### 判断ポイント 2: 配布方法

- **案 A**: `tespec add-skill` oclif サブコマンド（フル実装）
- **案 B**: `scripts/install-skill.sh` シェルスクリプト + README 手順
- **推奨**: 案 B（最小構成）。配布需要が増えてから案 A に移行する

devils-advocate の指摘通り、oclif サブコマンド追加はテスト・型定義コストが高い。
まず README + スクリプトで検証する。

### 判断ポイント 3: 自動更新のトリガー（ユーザー方針: 必須）

- **案 A**: CI（GitHub Actions）で schema.ts 変更検知 → 自動再生成
- **案 B**: `pnpm run skill:sync` npm script（手動実行）
- **案 C**: git hook（pre-commit で schema.ts 変更時のみ実行）
- **推奨**: まず案 B、次に案 A へ移行

理由: schema.ts の変更頻度が低い（v0.1.0）段階では手動スクリプトで十分。
CI 連携は「手動実行が面倒になってから」が devils-advocate との合意。
ただし `skill:sync` スクリプト自体は今回のスコープに含める。

### 判断ポイント 4: スキーマ → リファレンス自動生成の方式

- **案 A**: `src/skill/schema-meta.ts` に手書きメタ情報を定義し、スクリプトで参照
- **案 B**: Zod の `.describe()` を schema.ts に埋め込む
- **案 C**: Zod 内部 API (`._def`, `.shape`) でランタイム抽出
- **推奨**: 案 A（最小構成・Zod API 非依存）

理由: 案 B は schema.ts にドキュメント責務が混入（module-designer の指摘）。
案 C は Zod v4 内部 API の不安定リスク（module-designer の指摘）。
案 A は二重管理コストがあるが、schema.ts が 38 行の現状では許容できる。

---

## 11. 未解決の問い（他エージェントへの問い）

1. **Skill の形式**: SKILL.md のフォーマット・セクション構成は何が最適か？（AI の読みやすさの観点）
2. **`~/.claude/skills/` のパス規約**: Claude Code が Skill を読み込む正確なディレクトリ構造（platform-expert 担当）
3. **`skill:sync` の具体的実装**: schema-meta.ts → references/*.md 生成のテンプレートエンジン選択
4. **バリデーションの粒度**: AI 生成 YAML の単体チェック（ScreenSchema のみ）で足りるか、config + setups も含めた全体検証が必要か

---

## 12. まとめ: 確定スコープと設計方針（最終版）

### ユーザー方針（確定）

- **全体設計**: Phase 1-3 の全体像を今回設計する（実装は段階的）
- **実装スコープ**: SKILL.md + references/ 生成 + スキーマ変更時の自動再生成 + バリデーション
- **シンプル最優先**: 最小限の仕組みで実現する

### Phase 分割（確定）

**Phase 1（今回の実装スコープ）:**

| 優先 | 成果物 | 内容 |
|------|-------|------|
| 1 | `SKILL.md`（手書き） | AI が tespec YAML を正しく書けるようにする最小コンテンツ |
| 2 | `skill/references/` | schema-meta.ts から自動生成するスキーマ定義・サンプル |
| 3 | `src/skill/schema-meta.ts` | Zod 非依存のスキーマメタ定義（手書き） |
| 4 | `src/skill/skill-generator.ts` | references/ 生成スクリプト本体 |
| 5 | `pnpm run skill:sync` | schema.ts 変更後の手動実行エントリポイント |
| 6 | 生成結果バリデーション | 既存 `parseProject()` + `validate()` を流用した CI 組み込みスクリプト |

**Phase 2（配布需要が発生してから）:**

| 成果物 | 内容 |
|-------|------|
| `tespec add-skill` コマンド | `~/.claude/skills/` へのインストール自動化 |
| npx 配布 | `npx @sean-sunagaku/tespec add-skill` |
| CI 自動更新 | GitHub Actions で schema.ts 変更検知 → 自動再生成 |

### 全体設計サマリー（Phase 1-2）

```
[schema.ts] ─── 変更時 ──► pnpm skill:sync
                                │
                    ┌───────────┴──────────────┐
                    ▼                          ▼
        src/skill/skill-generator.ts    (Phase 2: CI hook)
                    │
          ┌─────────┴──────────┐
          ▼                    ▼
  skill/SKILL.md        skill/references/
  (手書き・不変)          schema.md
                          examples/
                          validation-rules.md

  ↓ Phase 2: add-skill コマンド

~/.claude/skills/tespec/
  SKILL.md
  references/
```

### 各エージェントフィードバックの統合結果

| エージェント | 主な貢献 | 採否 |
|------------|---------|------|
| module-designer | `core/` 変更なし、`src/skill/` 新設の依存方向 | 採用 |
| devils-advocate | npx 配布は Phase 2 へ、CI 自動更新も Phase 2 へ | 採用 |
| devils-advocate | 「SKILL.md だけで十分」 | 部分採用（自動更新は Phase 1 必須のため修正）|

