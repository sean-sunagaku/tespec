# tespec AI Skill インフラ アーキテクチャ設計書

作成日: 2026-03-25
セッション: tespec-ai-skill-infra
ステータス: 確定（Step 1-3 統合）

---

## 0. 設計テーマ・背景

### テーマ

tespec（YAML ベースの画面仕様定義 → Playwright テストスケルトン生成 CLI ツール）に対して、Claude Code などの AI エージェントが正しい形式の tespec YAML を自動生成・検証できるようにする「AI Skill インフラ」を整備する。

### 背景

tespec の YAML スキーマは Zod v4 で定義されており、フィールドの必須・任意・型・制約が複雑に絡み合っている。AI が正しい YAML を生成するには:
1. スキーマの構造（フィールド定義）を AI が参照できる形で提供する
2. AI が生成した YAML を即座に検証できる手段を提供する
3. スキーマが変更された際に参照資料を自動更新する仕組みを持つ

この 3 点を Phase 1 で実装する。

### テックスタック

| 項目 | バージョン |
|------|---------|
| TypeScript | ESM（`"type": "module"`、NodeNext moduleResolution）|
| Node.js | `>=18` |
| CLI フレームワーク | oclif v4 |
| スキーマ | Zod v4（`zod@4.1.12`）|
| パッケージマネージャー | pnpm |
| バンドラー | tsup |
| テスト | vitest |
| Linter | Biome |

### Phase 構成

- **Phase 1（本設計書）**: スキーマリファレンス自動生成 + YAML 単体検証 + GitHub Actions 自動更新
- **Phase 2（後日）**: `npx skills add sean-sunagaku/tespec` による Skill 配布（sunagaku-marketplace 連携）

---

## 1. 採用パターンと ADR

### 採用パターン: Pattern 10 + E2

**Pattern 10**: tsx + Zod v4 `toJSONSchema()` + `tespec validate --file`（E2）+ GitHub Actions 差分チェック

### ADR-001: tsx を devDependency に追加する

**コンテキスト**:
`scripts/generate-references.ts` から `src/core/schema.ts` を TypeScript のまま直接 import する必要がある。

**決定**: `tsx` を devDependencies に追加する。

**代替案と棄却理由**:
- `.mjs` + dist 経由: build 前提でねじれが生じる（ランタイム成果物の流用）
- `.mjs` + schema-meta.json 手書き: 自動更新要件と相反する同期ズレリスク
- Node.js `--experimental-strip-types`: engines を `>=18` → `>=22.6` に上げる必要あり（既存ユーザーへの breaking change）+ experimental フラグの不安定性

**結果**: tsx 1 devDependency 追加のみ。ランタイム影響なし。

---

### ADR-002: `tespec validate --file` を E2 として採用する

**コンテキスト**:
AI が tespec YAML を生成する際に 2 つのユースケースがある（ユーザー回答 2026-03-25）:
- ケース A: 既存プロジェクトに screen YAML を追加する（config + setups/ 構造がある）
- ケース B: 新規単体 YAML を生成してその場で検証する（config.yaml が存在しない）

**決定**: `validate.ts` に `--file` フラグを追加する（E2）。

**代替案と棄却理由**:
- E1（SKILL.md に案内のみ）: ケース B を満たせない（config.yaml が必須になる）
- E3（独立スクリプト `scripts/validate-yaml.ts`）: `parser.ts` の export 追加コストが E2 と同じで、かつ `validate.ts` との処理重複リスクがある

**実装方針**:
- `--file` 指定時は `parseYamlFile()` を直接呼ぶ（`parseProject()` 不使用）
- config.yaml 不要 → AI 生成 YAML の単体検証が完結する

---

### ADR-003: schema.ts は変更しない（`.describe()` 禁止）

**コンテキスト**:
スキーマのメタ情報（フィールドの説明文）を rules/*.md に含めるために `.describe()` をスキーマ定義に追加する案があった。

**決定**: schema.ts への `.describe()` 追加は禁止。`z.toJSONSchema()` で十分な情報が取得できる。

**理由**:
- schema.ts は npm パッケージのランタイムコアとして全コマンドから参照されている
- ドキュメント情報を混入させると SRP 違反かつ npm bundle の肥大化につながる
- Zod v4 の `toJSONSchema()` は `required`・`type`・`enum`・`default`・`minItems` 等を自動出力する

---

### ADR-004: scripts/ を 1 ファイルで完結させる（src/skill/ 新設なし）

**コンテキスト**:
`src/skill/references-generator.ts`（ライブラリ層）+ `scripts/sync.ts`（エントリポイント）の 2 層構造案があった。

**決定**: Phase 1 では `scripts/generate-references.ts` 単一ファイルで完結させる。

**理由**:
- `src/` 配下に置くと tsup のビルド対象に混入し `dist/` に出力されるリスクがある
- Phase 1 では他から import するユースケースが存在しない（YAGNI）
- 推定 70-90 行で収まる（100 行以内の制約を満たす）

**分離トリガー**: `scripts/generate-references.ts` が 100 行を超えた場合、または他から import が必要になった場合に `src/skill/` への分離を再検討する。

---

### ADR-005: GitHub Actions は gh pr create + 差分チェックで冪等性を確保する

**コンテキスト**:
schema.ts が変更されていない push でも workflow が動作した場合、不要な PR が量産される。

**決定**: `git diff --exit-code` で差分チェックを行い、差分がない場合は PR 作成をスキップする。

**代替案と棄却理由**:
- `peter-evans/create-pull-request` action: サードパーティ依存が増える。`gh pr create` は ubuntu-latest に組み込み済みで追加不要。

---

### ADR-006: Skill の配置は `skills/tespec-yaml-gen/`（Vercel Labs skills 規約）

**コンテキスト**:
Skill ファイルの配置パスについて複数の候補があった（`skill/`, `.claude/skills/`, `skills/tespec-yaml-gen/`）。

**決定**: リポジトリルート直下の `skills/tespec-yaml-gen/`（Vercel Labs skills 規約準拠）。

**根拠**: ユーザーが明示的に https://github.com/vercel-labs/skills を指定した（2026-03-25）。

**インストール**: `npx skills add sean-sunagaku/tespec`（Phase 2 配布時）

---

## 2. Phase 1 確定モジュール構成

```
tespec/
├── scripts/
│   └── generate-references.ts        [新規] schema.ts → skills/tespec-yaml-gen/rules/*.md
│                                      tsx で実行、70-90行、src/core/schema.ts のみに依存
│
├── skills/                            [新規] Vercel Labs skills 規約準拠
│   └── tespec-yaml-gen/
│       ├── SKILL.md                   [新規・手書き] フロントマター + AI 指示
│       └── rules/                     [新規・自動生成] generate-references.ts の出力先
│           ├── case-schema.md
│           ├── screen-schema.md
│           ├── setup-schema.md
│           └── validation-rules.md
│
├── src/
│   ├── core/
│   │   ├── schema.ts                  [変更なし] CaseSchema / ScreenSchema / SetupSchema / ConfigSchema
│   │   ├── parser.ts                  [軽微変更] parseYamlFile + ParsedFileResult<T> を export に昇格
│   │   ├── generator.ts               [変更なし]
│   │   └── validator.ts               [変更なし]
│   ├── commands/
│   │   ├── validate.ts                [軽微変更] --file フラグ追加
│   │   └── generate.ts                [変更なし]
│   └── utils/
│       └── output.ts                  [変更なし]
│
├── .github/workflows/
│   ├── ci.yml                         [変更なし]
│   └── sync-references.yml            [新規] schema.ts 変更検知 → 差分チェック → PR 作成
│
└── package.json                       [軽微変更] tsx devDep + skill:sync スクリプト追加
```

---

## 3. 依存グラフ

```
Layer 0: 外部ライブラリ
  zod@4.1.12, @oclif/core, yaml, picocolors, node:*

Layer 1: src/core/schema.ts
  → zod のみ依存。変更なし。全コアの型定義ハブ。

Layer 2: src/core/*.ts（schema.ts 以外）
  parser.ts    → schema.ts（型 + スキーマ）+ yaml + node:*
               [変更] ParsedFileResult<T> と parseYamlFile を export に昇格
  generator.ts → schema.ts（型のみ）[変更なし]
  validator.ts → schema.ts（型のみ）[変更なし]

  utils/output.ts → picocolors（独立）[変更なし]

Layer 3: src/commands/*.ts
  validate.ts → parser.ts + validator.ts + output.ts + @oclif/core
              [変更] --file フラグ追加
              --file あり: parseYamlFile() を直接呼ぶ（parseProject() 不使用）
              --file なし: parseProject() で従来通り
  generate.ts → parser.ts + validator.ts + generator.ts + output.ts [変更なし]

Layer 4: cli.ts → @oclif/core [変更なし]

Layer 5: scripts/generate-references.ts  [新規]
  → src/core/schema.ts（Zod スキーマ + toJSONSchema）
  → node:fs/promises, node:path
  実行: tsx（devDependency）
  出力: skills/tespec-yaml-gen/rules/*.md
  ※ 他からは import されない（単方向・エントリポイント専用）
```

### 依存方向の確認

| ルール | 状態 |
|--------|------|
| schema.ts は外部ライブラリのみに依存 | 維持。変更なし |
| core/* は commands/* を import しない | 維持。逆向き依存なし |
| utils/* は core/* を import しない | 維持。変更なし |

**循環依存: ゼロ。Phase 1 で新規追加される依存関係は 1 本のみ（`scripts/generate-references.ts → src/core/schema.ts`）。**

---

## 4. 実装順序

依存関係を考慮した安全な順序:

| ステップ | ファイル | 内容 | 前提 |
|---------|---------|------|------|
| 1 | `package.json` | tsx devDependency 追加 | なし |
| 2 | `src/core/parser.ts` | `ParsedFileResult<T>` + `parseYamlFile` を export に昇格 | なし |
| 3 | `src/commands/validate.ts` | `--file` フラグ追加 | ステップ 2 |
| 4 | `scripts/generate-references.ts` | schema.ts → Markdown 生成スクリプト作成 | ステップ 1 |
| 5 | `skills/tespec-yaml-gen/rules/*.md` | `pnpm skill:sync` で初回生成・動作確認 | ステップ 4 |
| 6 | `skills/tespec-yaml-gen/SKILL.md` | 手書き（rules/ の内容を参照） | ステップ 5 |
| 7 | `package.json` | `skill:sync` スクリプト追加 | ステップ 4 |
| 8 | `.github/workflows/sync-references.yml` | workflow 作成 | ステップ 5 |

---

## 5. 設計決定の記録

### 確定した設計前提

| 項目 | 確定内容 |
|------|---------|
| Skill 配置 | `skills/tespec-yaml-gen/`（Vercel Labs skills 規約、2026-03-25 ユーザー確定） |
| スキーマ抽出方式 | `z.toJSONSchema()`（Zod v4 組み込み、依存追加ゼロ） |
| YAML 検証 | E2: `tespec validate --file`（ファイルパス形式）|
| CI PR 作成 | `gh pr create` + `git diff --exit-code`（差分チェックで冪等性確保） |
| `--file` 引数形式 | ファイルパス（`tespec validate --file screens/login.yaml`）|
| `src/skill/` 新設 | Phase 1 では新設しない（100 行以内の間は scripts/ に直接置く）|
| `commands/add-skill.ts` | 不要（Claude Code Plugin 方式で代替、失格条件 2 に該当）|
| Zod バージョン | v4（`zod@4.1.12` インストール済み）|
| Node.js バージョン | `>=18`（engines 変更なし）|
| テストフレームワーク | vitest（変更なし）|
| Skill 配布方式（Phase 2）| `npx skills add sean-sunagaku/tespec`（後日対応）|

### 各変更ファイルの詳細

#### `src/core/parser.ts`（変更: export 追加のみ）

```typescript
// 変更前（内部型・内部関数）
interface ParsedFileResult<T> { data?: T; errors: ParseError[]; }
async function parseYamlFile<T>(filePath: string, schema: ZodType<T>): Promise<ParsedFileResult<T>>

// 変更後（export に昇格）
export interface ParsedFileResult<T> { data?: T; errors: ParseError[]; }
export async function parseYamlFile<T>(filePath: string, schema: ZodType<T>): Promise<ParsedFileResult<T>>
```

実装の変更なし。既存テストへの影響なし。

#### `src/commands/validate.ts`（変更: --file フラグ追加）

```typescript
static flags = {
  config: Flags.string({ char: 'c', description: 'Path to tespec config.yaml' }),  // 既存
  file: Flags.string({
    description: 'Validate a specific screen or setup YAML file (no config.yaml required)',
    helpValue: 'screens/login.yaml',
  }),  // 新規追加
};

async run(): Promise<void> {
  const { flags } = await this.parse(Validate);

  if (flags.file) {
    // --file モード: parseYamlFile() を直接呼ぶ（parseProject() 不使用）
    const filePath = path.resolve(flags.file);
    const result = await parseYamlFile(filePath, ScreenSchema);
    if (!result.data) {
      const result2 = await parseYamlFile(filePath, SetupSchema);
      // ...
    }
  } else {
    // 従来モード: parseProject() でプロジェクト全体をパース
    const configPath = resolveConfigPath(flags.config);
    const parsed = await parseProject(configPath);
    // ...
  }
}
```

#### `scripts/generate-references.ts`（新規、推定 70-90 行）

```typescript
import { toJSONSchema } from 'zod';
import { CaseSchema, ScreenSchema, SetupSchema, ConfigSchema } from '../src/core/schema.js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_DIR = path.resolve('./skills/tespec-yaml-gen/rules');

const schemas = [
  { name: 'case',       schema: CaseSchema,   title: 'Case スキーマ' },
  { name: 'screen',     schema: ScreenSchema, title: 'Screen スキーマ' },
  { name: 'setup',      schema: SetupSchema,  title: 'Setup スキーマ' },
  { name: 'validation', schema: ConfigSchema, title: 'Validation Rules' },
];

await mkdir(OUTPUT_DIR, { recursive: true });
for (const { name, schema, title } of schemas) {
  const jsonSchema = toJSONSchema(schema);
  const md = jsonSchemaToMarkdown(title, jsonSchema);
  await writeFile(path.join(OUTPUT_DIR, `${name}-schema.md`), md, 'utf8');
}
```

#### `.github/workflows/sync-references.yml`（新規、約 40 行）

```yaml
name: Sync Skill References
on:
  push:
    branches: [main]
    paths: ['src/core/schema.ts']

jobs:
  sync:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with: { version: 10 }
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm skill:sync
      - name: Check for changes
        id: diff
        run: git diff --exit-code skills/tespec-yaml-gen/rules/ || echo "changed=true" >> $GITHUB_OUTPUT
      - name: Commit and create PR
        if: steps.diff.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git checkout -b chore/sync-skill-references-${{ github.run_id }}
          git add skills/tespec-yaml-gen/rules/
          git commit -m "chore: sync skill references"
          git push origin HEAD
          gh pr create --title "chore: sync skill references" \
            --body "schema.ts の変更を skills/tespec-yaml-gen/rules/ に自動反映しました。" \
            --base main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**重要**: `permissions: contents: write` と `permissions: pull-requests: write` が必須（デフォルトは read-only のため PR 作成が失敗する）。

#### `package.json`（変更: 2 箇所追加）

```json
{
  "scripts": {
    "skill:sync": "tsx scripts/generate-references.ts"
  },
  "devDependencies": {
    "tsx": "^4.19.2"
  }
}
```

### SKILL.md の推奨セクション構成（手書き時の参考）

```
---
name: tespec-yaml-gen
description: AI が tespec YAML を正しい形式で生成・検証するためのスキル
---

## Overview
## Schemas（rules/ を参照）
## Reference Rules（given / use:xxx / navigates_to の参照規則）
## Example（最小限の完全な YAML 例）
## Validation Rules
```

### 過剰設計の禁止事項（devils-advocate 判定済み）

- `generate-references.ts` を複数ファイルに分けない（100 行以内の間は不要）
- `validate.ts` の `--file` ロジックを別モジュールに抽出しない（5-10 行程度）
- `skill:validate` 等の追加 npm scripts は不要
- `prepublishOnly` への追記は慎重に（自動実行のタイミング問題）
- reusable workflow（.github/workflows/ の共通化）は不要（1 つしかない）
- `matrix build` は不要

---

## 6. Phase 2 スコープ（参考）

Phase 1 完了後に検討する項目:

| 項目 | 内容 |
|------|------|
| Skill 配布 | `npx skills add sean-sunagaku/tespec`（Vercel Labs skills 規約） |
| `src/skill/` 分離 | `generate-references.ts` が 100 行を超えた場合 |
| `generate-references.ts` のテスト追加 | Phase 2 で CI に組み込む際に追加 |
| sunagaku-marketplace 連携 | `/plugin install tespec@sunagaku-marketplace` |

---

## 7. エージェント合意サマリー

| エージェント | 最終推奨 | 合意状態 |
|------------|---------|---------|
| architecture-lead | Pattern 10 + E2 | 確定 |
| module-designer | Pattern 10 + E2（src/skill/ 新設なし）| 確定 |
| dependency-analyst | Pattern 10（依存グラフ最小化）| 確定 |
| platform-expert | Pattern 10（gh pr create、tsx 4.x）| 確定 |
| devils-advocate | Pattern 10 + E2（E2 確定後に P3 から切り替え）| 確定 |

全エージェント一致。ブロッカーなし。
