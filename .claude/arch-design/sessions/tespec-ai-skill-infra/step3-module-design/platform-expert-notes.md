# platform-expert 補足: Step 3 未解決事項への回答

作成日: 2026-03-25
更新日: 2026-03-25（team-lead 最終確定: skills/tespec-yaml-gen/ + rules/）

---

## 確定事項（ユーザー直接回答 + 調査結果）

| 項目 | 確定値 |
|---|---|
| `--file` フラグの引数形式 | ファイルパス（`tespec validate --file screens/login.yaml`） |
| Skill ディレクトリ配置 | **`skills/tespec-yaml-gen/`（Vercel Labs skills 規約: リポジトリルート直下 `skills/` 配下）** |

---

## Vercel Labs skills 規約（最終確定 2026-03-25）

情報源: https://github.com/vercel-labs/skills（team-lead が直接参照・確定）

### 配置規約

| 項目 | 確定値 |
|---|---|
| リポジトリ内パス | `skills/tespec-yaml-gen/`（リポジトリルート直下） |
| SKILL.md フロントマター | `name` + `description` フィールド必須 |
| 自動生成ファイルの格納先 | `rules/` |
| インストールコマンド | `npx skills add` |
| インストール先（ユーザー環境） | `~/.claude/skills/tespec-yaml-gen/` |

### tespec リポジトリ内の確定パス

```
tespec/
  skills/                         ← リポジトリルート直下
    tespec-yaml-gen/
      SKILL.md                    ← 手書き（フロントマターあり）
      rules/                      ← 自動生成ターゲット
        case-schema.md
        screen-schema.md
        setup-schema.md
        validation-rules.md
```

### SKILL.md フロントマター形式

```yaml
---
name: tespec-yaml-gen
description: AI が tespec YAML を正しい形式で生成・検証するためのスキル
---
```

### 変遷の記録（参考）

| 時点 | パス | 理由 |
|---|---|---|
| 初期 | `skill/`（単層） | 誤り |
| 中間 | `skills/tespec-yaml-gen/`（ルート直下） | WebSearch 推測 |
| 一時的訂正 | `.claude/skills/tespec-yaml-gen/` + `rules/` | team-lead メッセージの解釈誤り |
| Step 4 開始時 | `skills/tespec-yaml-gen/references/` | team-lead の中間確認（references/ と記載） |
| **最終確定** | **`skills/tespec-yaml-gen/rules/`（ルート直下）** | team-lead が最終確定メッセージで明示（npx skills のソース配置規約） |

---

## 未解決事項 1: `--file` フラグの指定形式（確定済み）

**確定: ファイルパス指定（`screens/login.yaml`）**

理由:
- screen ID（`login`）指定では `config.yaml` の `screens_dir` を解決する必要があり、必ず `--config` が前提になる
- ファイルパス指定なら config.yaml が不要 — AI が単体で生成した YAML ファイルをその場で検証できる（E2 のユースケースに直結）
- 既存の `tespec validate` コマンドが `--config` 必須なのとは対照的に、`--file` は設定ファイルなしで動く独立した操作になる

**実装パターン（module-designer 提案との差分）:**

module-designer 案では `parseProject()` でプロジェクト全体をパースしてからフィルタする設計になっているが、`--file` 単体の場合は `parseProject()` が不要。

```typescript
// --file 指定時の実装
if (flags.file) {
  const filePath = path.resolve(flags.file);
  // ScreenSchema で試みる
  const result = await parseYamlFile(filePath, ScreenSchema);
  if (!result.data) {
    // SetupSchema で再試行（スキーマ自動判定）
    const result2 = await parseYamlFile(filePath, SetupSchema);
    // ...
  }
}
```

これにより `parser.ts` の `parseYamlFile` を export するだけで `--file` が完全に動作する。
`parseProject()` は呼ばない → config.yaml 不要 → AI 生成 YAML の単体検証が完結。

**注意**: `parseYamlFile` の型シグネチャは `<T>(filePath: string, schema: ZodType<T>): Promise<ParsedFileResult<T>>` だが、`ParsedFileResult` 型も export が必要。

---

## 未解決事項 2: Skill ディレクトリの配置場所（最終確定済み）

**最終確定: `.claude/skills/tespec-yaml-gen/`（Vercel Labs skills 規約）**

情報源: https://github.com/vercel-labs/skills（team-lead 提供 2026-03-25）

**GitHub Actions での参照（最終版）:**
```yaml
- run: pnpm skill:sync
# 出力先: skills/tespec-yaml-gen/rules/*.md
- run: git diff --exit-code skills/tespec-yaml-gen/rules/
```

`npx skills add sean-sunagaku/tespec` でインストール可能になる（Phase 2 配布時）。

---

## `parseYamlFile` と `ParsedFileResult` の export 確認

dependency-analyst の依存グラフでは `parseYamlFile` の export のみ記載されているが、`ParsedFileResult<T>` 型も export が必要。

```typescript
// src/core/parser.ts に追加する export（2点）
export interface ParsedFileResult<T> {  // 既存の内部型
  data?: T;
  errors: ParseError[];
}

export async function parseYamlFile<T>(
  filePath: string,
  schema: ZodType<T>,
): Promise<ParsedFileResult<T>> { ... }
```

これにより `validate.ts` で型安全に `parseYamlFile` の結果を処理できる。

---

## `generate-references.ts` の具体的な実装方針

tsx で実行するため、`src/core/schema.ts` を直接 import できる。

```typescript
// scripts/generate-references.ts
import { toJSONSchema } from 'zod';
import {
  CaseSchema,
  ScreenSchema,
  SetupSchema,
  ConfigSchema,
} from '../src/core/schema.js';
import { writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUTPUT_DIR = path.resolve('./skills/tespec-yaml-gen/rules');

const schemas = [
  { name: 'case', schema: CaseSchema, title: 'Case スキーマ' },
  { name: 'screen', schema: ScreenSchema, title: 'Screen スキーマ' },
  { name: 'setup', schema: SetupSchema, title: 'Setup スキーマ' },
  { name: 'config', schema: ConfigSchema, title: 'Config スキーマ' },
];

await mkdir(OUTPUT_DIR, { recursive: true });

for (const { name, schema, title } of schemas) {
  const jsonSchema = toJSONSchema(schema);
  const md = jsonSchemaToMarkdown(title, jsonSchema);
  await writeFile(path.join(OUTPUT_DIR, `${name}-schema.md`), md, 'utf8');
  console.log(`Generated: ${name}-schema.md`);
}
```

**`jsonSchemaToMarkdown()` の変換ロジック:**
`z.toJSONSchema()` の出力から Markdown テーブルを生成する。

```typescript
function jsonSchemaToMarkdown(title: string, schema: object): string {
  const props = (schema as any).properties ?? {};
  const required = new Set((schema as any).required ?? []);

  const rows = Object.entries(props).map(([field, def]: [string, any]) => {
    const type = inferTypeString(def);       // anyOf, enum, array などを文字列化
    const isRequired = required.has(field) ? 'YES' : 'NO';
    const defaultVal = def.default ?? '-';
    const constraint = def.minItems ? `${def.minItems}件以上` : '';
    return `| ${field} | ${type} | ${isRequired} | ${defaultVal} | ${constraint} |`;
  });

  return [
    `# ${title}`,
    '',
    '| フィールド | 型 | 必須 | デフォルト | 制約 |',
    '|---|---|---|---|---|',
    ...rows,
  ].join('\n') + '\n';
}
```

**推定行数: 70-90行**（100行以内の設計制約を満たす）

---

## `package.json` への追加内容

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

tsx の最新安定版は 4.x 系（Node.js 18 対応確認済み）。

---

## GitHub Actions workflow の完全仕様

```yaml
# .github/workflows/sync-references.yml
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
        with:
          version: 10

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - run: pnpm skill:sync

      - name: Check for changes
        id: diff
        run: |
          git diff --exit-code skills/tespec-yaml-gen/rules/ || echo "changed=true" >> $GITHUB_OUTPUT

      - name: Commit and create PR
        if: steps.diff.outputs.changed == 'true'
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "github-actions[bot]@users.noreply.github.com"
          git checkout -b chore/sync-skill-references-${{ github.run_id }}
          git add skills/tespec-yaml-gen/rules/
          git commit -m "chore: sync skill rules"
          git push origin HEAD
          gh pr create \
            --title "chore: sync skill rules" \
            --body "schema.ts の変更を skills/tespec-yaml-gen/rules/ に自動反映しました。" \
            --base main
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

**行数: 約40行**（推定通り）

**ポイント:**
- `permissions: contents: write, pull-requests: write` が必要（デフォルトは read-only）
- `git diff --exit-code` で差分なければ PR 作成をスキップ（冪等性）
- branch 名に `github.run_id` を含めて重複を避ける
