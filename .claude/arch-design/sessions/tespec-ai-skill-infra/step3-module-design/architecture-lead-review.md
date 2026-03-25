# Step 3: architecture-lead 統合レビュー

作成日: 2026-03-25
担当: architecture-lead

---

## エージェント間の不一致を解決

### 論点: parser.ts の変更有無

| エージェント | 主張 | 根拠 |
|------------|------|------|
| module-designer | `parseYamlFile` + `ParsedFileResult<T>` を export に昇格する | `--file` 時は `parseYamlFile()` を直接呼ぶ |
| dependency-analyst | `parser.ts` は変更なし。validate.ts 内のフィルタリングで対応 | 依存グラフへの影響ゼロ |
| platform-expert | `parseYamlFile` の export が必要と明示 | ファイルパス指定で config.yaml 不要のため |

**architecture-lead 判定: module-designer + platform-expert 案を採用。`parser.ts` に軽微な変更が必要。**

理由を実コードで確認:

```
src/core/parser.ts L26-29:
  interface ParsedFileResult<T> {   ← 現在は内部型（export なし）
  ...
src/core/parser.ts L113:
  async function parseYamlFile<T>(  ← 現在は内部関数（export なし）
```

`validate.ts` の `--file` 実装方針:
- `--file` オプションあり → `parseYamlFile(filePath, ScreenSchema)` を直接呼ぶ（`parseProject()` 不使用）
- これは config.yaml が存在しない AI 生成 YAML 単体検証のユースケースを満たす必須要件

「validate.ts 内のフィルタリングで対応」（dependency-analyst 案）では config.yaml が前提になるため E2 要件を満たせない。

**確定: `parser.ts` に 2 点の変更を加える（実装は変えず、公開範囲を広げるのみ）:**

```typescript
// src/core/parser.ts
// 変更前:
interface ParsedFileResult<T> { ... }        // 内部型
async function parseYamlFile<T>(...) { ... } // 内部関数

// 変更後:
export interface ParsedFileResult<T> { ... } // export に昇格
export async function parseYamlFile<T>(...) { ... } // export に昇格
```

---

## Phase 1 確定モジュール構成

配置パス確定（2026-03-25 team-lead 通知）: Vercel Labs skills 規約に従い `skills/tespec-yaml-gen/` に変更（`.claude/` ではない）。

```
tespec/
├── scripts/
│   └── generate-references.ts        [新規] schema.ts → skills/tespec-yaml-gen/rules/*.md
├── skills/
│   └── tespec-yaml-gen/               [新規] Vercel Labs skills 規約準拠（ソースリポジトリ配置先）
│       ├── SKILL.md                   [新規・手書き] フロントマター付き
│       └── rules/                     [新規・自動生成] references/ から rules/ に変更
│           ├── case-schema.md
│           ├── screen-schema.md
│           ├── setup-schema.md
│           └── validation-rules.md
├── src/
│   ├── core/
│   │   ├── schema.ts             [変更なし]
│   │   ├── parser.ts             [軽微変更] parseYamlFile + ParsedFileResult を export
│   │   ├── generator.ts          [変更なし]
│   │   └── validator.ts          [変更なし]
│   ├── commands/
│   │   ├── validate.ts           [軽微変更] --file フラグ追加
│   │   └── generate.ts           [変更なし]
│   └── utils/
│       └── output.ts             [変更なし]
├── .github/workflows/
│   ├── ci.yml                    [変更なし]
│   └── sync-references.yml       [新規]
└── package.json                  [軽微変更] tsx devDep + skill:sync スクリプト
```

---

## 確定依存グラフ（architecture-lead 調整版）

```
Layer 0: 外部ライブラリ
  zod, @oclif/core, yaml, picocolors, node:*

Layer 1: src/core/schema.ts
  → zod のみ依存。変更なし。

Layer 2: src/core/*.ts（schema.ts 以外）
  parser.ts   → schema.ts + yaml + node:*  [parseYamlFile・ParsedFileResult を export 追加]
  generator.ts → schema.ts（変更なし）
  validator.ts → schema.ts（変更なし）
  utils/output.ts → picocolors（変更なし）

Layer 3: src/commands/*.ts
  validate.ts → parser.ts + validator.ts + output.ts + @oclif/core  [--file フラグ追加]
  generate.ts → parser.ts + validator.ts + generator.ts + output.ts（変更なし）

Layer 4: cli.ts → @oclif/core（変更なし）

Layer 5: scripts/generate-references.ts  [新規・tsx で実行]
  → src/core/schema.ts + node:fs/promises + node:path
  出力先: skills/tespec-yaml-gen/rules/*.md
  ※ 他から import されない単方向依存
```

循環依存: ゼロ
3 ルール維持: 全て OK（schema.ts は外部のみ / core は commands を import しない / utils は core を import しない）

---

## 実装順序（確定版）

依存関係を考慮した安全な順序:

1. `package.json` — tsx devDependency 追加
2. `src/core/parser.ts` — `parseYamlFile` + `ParsedFileResult<T>` を export に昇格
3. `src/commands/validate.ts` — `--file` フラグ追加（parser.ts の export が前提）
4. `scripts/generate-references.ts` — schema.ts import + toJSONSchema + Markdown 生成（tsx が前提、出力先: `skills/tespec-yaml-gen/rules/`）
5. `skills/tespec-yaml-gen/rules/*.md` 初回生成（`pnpm skill:sync` で動作確認）
6. `skills/tespec-yaml-gen/SKILL.md` — 手書き（rules/ の内容を参照しながら作成）
7. `package.json` — `skill:sync` スクリプト追加
8. `.github/workflows/sync-references.yml` — ローカルで generate-references.ts が動作確認後

---

## 各モジュールの変更規模サマリー

| ファイル | 変更種別 | 規模 | 懸念点 |
|--------|---------|------|--------|
| `scripts/generate-references.ts` | 新規 | 70-90行 | 100行以内維持（超えたら src/skill/ 分離検討）|
| `skills/tespec-yaml-gen/SKILL.md` | 新規（手書き） | - | フロントマター（name/description）必須 |
| `skills/tespec-yaml-gen/rules/*.md` | 新規（自動生成） | 4ファイル | rules/ ディレクトリ（Vercel 規約。旧 references/ から変更）|
| `.github/workflows/sync-references.yml` | 新規 | 約40行 | permissions: contents/PR write が必要 |
| `src/core/parser.ts` | 軽微変更 | 2行（export 追加）| 既存テストへの影響なし（実装変更なし）|
| `src/commands/validate.ts` | 軽微変更 | 15-20行追加 | リファクタリングを同時にしない |
| `package.json` | 軽微変更 | 2行追加 | - |

---

## テスト方針（保守性・テスト容易性の観点）

### 既存テストへの影響

- `parser.ts` の変更は `export` 追加のみ。内部実装は不変。既存テスト（`__test__/generator.test.ts` 等）への影響なし。
- `validate.ts` のテストは `--file` フラグの分岐を追加テストとして書く。

### `--file` フラグのテスト追加方針

```typescript
// src/core/__test__/validate-file.test.ts に追加
// または既存テストファイルに追記
describe('validate --file', () => {
  it('有効な screen YAML を検証できる', async () => { ... });
  it('有効な setup YAML を検証できる', async () => { ... });
  it('存在しないファイルを指定するとエラーを返す', async () => { ... });
  it('Zod バリデーション失敗時にエラーを返す', async () => { ... });
});
```

### `scripts/generate-references.ts` のテスト

Phase 1 では単体テストを追加しない（devils-advocate 判定通り）。動作確認は `pnpm skill:sync` の実行と出力ファイルの目視確認で十分。Phase 2 で CI に組み込む際に追加を検討。

---

## Step 4 に向けた未解決事項

なし。全事項が確定済み:

| 事項 | 確定内容 |
|-----|---------|
| `--file` の引数形式 | ファイルパス（`tespec validate --file screens/login.yaml`） |
| Skill の配置 | `skills/tespec-yaml-gen/`（ソースリポジトリ配置先、Vercel Labs skills 規約、2026-03-25 確定） |
| rules/ ディレクトリ | `skills/tespec-yaml-gen/rules/`（旧 references/ から変更） |
| SKILL.md フロントマター | `name: tespec-yaml-gen`, `description: ...` が必須 |
| `parser.ts` の変更有無 | 変更あり（export 追加のみ、実装変更なし） |
| `src/skill/` 新設 | Phase 1 では新設しない（generate-references.ts が100行以内の間）|
