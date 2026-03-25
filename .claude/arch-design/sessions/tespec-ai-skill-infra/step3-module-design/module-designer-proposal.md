# Step 3: モジュール設計提案（module-designer）

作成日: 2026-03-25
採用パターン: Pattern 10 + E2

---

## 実装対象（Phase 1 確定スコープ）

1. `scripts/generate-references.ts` — schema.ts → rules/*.md 生成
2. `skills/tespec-yaml-gen/SKILL.md` — 手書き
3. `skills/tespec-yaml-gen/rules/*.md` — 自動生成出力先
4. `tespec validate --file` — validate.ts + parser.ts に軽微変更
5. `.github/workflows/sync-references.yml` — 自動再生成 → PR
6. `package.json` — tsx 追加 + `skill:sync` スクリプト追加

---

## 変更ファイル分類

### 新規作成（3ファイル）

| ファイル | 責務 | 変化の理由 |
|--------|------|----------|
| `scripts/generate-references.ts` | schema.ts → rules/*.md 生成 | Skill リファレンスのフォーマット変更 |
| `skills/tespec-yaml-gen/SKILL.md` | AI への指示・ルール・記述例 | AI 向けガイダンスの内容変更 |
| `.github/workflows/sync-references.yml` | schema.ts 変更検知 → 自動再生成 → PR | CI フロー・トリガー条件の変更 |

### 既存変更（3ファイル）

| ファイル | 変更内容 | 変化の理由 |
|--------|---------|----------|
| `src/commands/validate.ts` | `--file` フラグ追加 | 単体 YAML 検証の対応 |
| `src/core/parser.ts` | `parseYamlFile` + `ParsedFileResult<T>` を export に昇格 | `--file` 実装で直接呼び出しが必要 |
| `package.json` | tsx devDependency + `skill:sync` スクリプト追加 | ツール・スクリプト管理 |

### 変更なし

- `src/core/schema.ts` — 変更なし
- `src/core/generator.ts` — 変更なし
- `src/core/validator.ts` — 変更なし
- `src/utils/output.ts` — 変更なし
- `src/commands/generate.ts` — 変更なし

---

## 各モジュールの詳細設計

### 1. `scripts/generate-references.ts`

**責務**: `src/core/schema.ts` の Zod スキーマを読み込み、`z.toJSONSchema()` で JSON Schema に変換し、Markdown テーブル形式で `skills/tespec-yaml-gen/rules/*.md` に書き出す

**依存**:
```
scripts/generate-references.ts
  → src/core/schema.ts（CaseSchema, ScreenSchema, SetupSchema, ConfigSchema）
  → zod（toJSONSchema）
  → node:fs/promises（writeFile, mkdir）
  → node:path
```

**出力ファイル**:
```
skills/tespec-yaml-gen/rules/
  case-schema.md        ← CaseSchema のフィールド定義
  screen-schema.md      ← ScreenSchema のフィールド定義
  setup-schema.md       ← SetupSchema のフィールド定義
  config-schema.md      ← ConfigSchema のフィールド定義
```

インストール後: `npx skills add` により `~/.claude/skills/tespec-yaml-gen/` に展開される（`skills/` がソースリポジトリ配置先、`~/.claude/skills/` がインストール先）

**出力フォーマット**（各 *.md）:
```markdown
# Case スキーマ

| フィールド | 型 | 必須 | デフォルト | 制約 |
|---|---|---|---|---|
| action | string | YES | - | |
| expect | string \| string[] | YES | - | |
| steps | string[] | YES | - | 1件以上 |
| type | "normal" \| "error" \| "boundary" | YES | normal | |
| given | string \| string[] | NO | - | |
| target | string | NO | - | |
| not_expect | string[] | NO | - | |
| navigates_to | string | NO | - | |
```

**設計制約**:
- `src/core/schema.ts` のみに依存する（他の `src/` モジュールを import しない）
- 100行以内を維持する（超えたら `src/skill/` への分離を検討）
- 副作用（ファイル書き出し）はスクリプト末尾に集約する

---

### 2. `src/commands/validate.ts` の `--file` フラグ追加（E2）

**変更内容**: 単一 YAML ファイルを指定して検証できる `--file` フラグを追加する

**設計方針**（platform-expert レビュー反映 2026-03-25）:
- `--file` フラグ指定時は `parseYamlFile()` を直接呼ぶ（`parseProject()` は呼ばない）
- `config.yaml` 不要 → AI が単体で生成した YAML をその場で検証できる
- `--file` と `--config` は**排他的**（同時指定不可。`--file` は設定ファイルなしで完結する独立操作）
- `src/core/parser.ts` に `parseYamlFile` と `ParsedFileResult<T>` の export 追加が必要（**当初方針を修正**）

**`--file` フラグの実装方針**:

```
--file オプションあり:
  → parseYamlFile(filePath, ScreenSchema) を直接呼ぶ
  → 失敗時は SetupSchema で再試行（スキーマ自動判定）
  → config.yaml 不要 → AI 生成 YAML 単体検証が完結

--file オプションなし（従来通り）:
  → parseProject() でプロジェクト全体をパース
  → 全 screens に対して validate() を実行
```

**引数形式（ユーザー確定 2026-03-25）**: ファイルパス指定

```
tespec validate --file screens/login.yaml
```

**実装例**:
```typescript
if (flags.file) {
  const filePath = path.resolve(flags.file);
  const result = await parseYamlFile(filePath, ScreenSchema);
  if (!result.data) {
    // SetupSchema で再試行（スキーマ自動判定）
    const result2 = await parseYamlFile(filePath, SetupSchema);
    // ...
  }
}
```

**`parser.ts` への変更（2点）**:
```typescript
// src/core/parser.ts に追加する export
export interface ParsedFileResult<T> {  // 既存の内部型を export に昇格
  data?: T;
  errors: ParseError[];
}

export async function parseYamlFile<T>(  // 既存の内部関数を export に昇格
  filePath: string,
  schema: ZodType<T>,
): Promise<ParsedFileResult<T>> { ... }
```

**追加フラグ定義**:
```typescript
static flags = {
  config: Flags.string({ ... }),  // 既存
  file: Flags.string({
    description: 'Validate a specific screen YAML file (no config.yaml required)',
    helpValue: 'screens/login.yaml',
  }),
};
```

---

### 3. `.github/workflows/sync-references.yml`

**トリガー**: `src/core/schema.ts` への push（main ブランチ）

**permissions（必須）**:
```yaml
permissions:
  contents: write      # git push のため
  pull-requests: write # gh pr create のため
```
デフォルトは read-only のため、これがないと PR 作成で失敗する。

**ステップ**:
```yaml
steps:
  1. actions/checkout@v4
  2. pnpm/action-setup@v4 + actions/setup-node@v4
  3. pnpm install --frozen-lockfile
  4. pnpm skill:sync（= pnpm tsx scripts/generate-references.ts）
  5. git diff --exit-code skill/rules/ で差分チェック（冪等）
  6. 差分ありの場合のみ: git commit → git push → gh pr create
```

**冪等性**: `git diff --exit-code` で差分がない場合は PR 作成をスキップする。スキーマ変更がない push（コメント修正等）でも安全に実行できる。

完全な workflow YAML は `platform-expert-notes.md` に記載あり。

---

## 依存方向（最終確定）

```
scripts/generate-references.ts
  → src/core/schema.ts（Zod スキーマ）
  → zod（toJSONSchema）
  → node:fs/promises, node:path

src/commands/validate.ts
  → src/core/parser.ts（parseProject + parseYamlFile を使用）
  → src/core/validator.ts（変更なし）
  → src/utils/output.ts（変更なし）
  ※ --file 時は parseYamlFile() 直接呼び出し（parseProject() 不使用）
  ※ --file なし時は parseProject() 従来通り

src/core/parser.ts（軽微変更）
  → parseYamlFile + ParsedFileResult<T> を export に昇格（内部実装は変更なし）

src/core/*（schema.ts を除く）    → schema.ts のみ（変更なし）
src/utils/*   → 外部のみ（変更なし）
```

循環依存なし。レイヤー境界維持。

---

## 凝集度チェック

| ファイル | 単一の変化理由か | 判定 |
|--------|--------------|------|
| `scripts/generate-references.ts` | Skill リファレンスのフォーマット変更のみ | 高 |
| `skills/tespec-yaml-gen/SKILL.md` | AI 向けガイダンスの内容変更のみ | 高 |
| `.github/workflows/sync-references.yml` | CI フロー変更のみ | 高 |
| `src/commands/validate.ts` | CLI オプション変更（--file 追加） | 高（フィルタ追加は責務の自然な拡張）|
| `src/core/parser.ts` | 内部関数の公開 API 昇格（実装変更なし） | 高（責務は変わらず、公開範囲の拡大のみ）|

---

## 過剰分割チェック（devils-advocate 向け）

**分割しないことにした理由:**

1. `src/skill/` を新設しない → `generate-references.ts` が 100 行未満で収まる見込みのため、ライブラリ層とエントリポイント層に分割する必要がない
2. `validate.ts` の `--file` ロジックを別モジュールに抽出しない → フィルタリング処理は 5-10 行程度で、抽出する複雑さに達していない
3. `rules/*.md` を 1 ファイルにまとめない → スキーマごとに独立したファイルにすることで、AI が必要な情報だけを読める（トークン効率）

---

## 実装順序の推奨

依存関係を考慮した実装順（dependency-analyst + platform-expert レビュー反映 2026-03-25）:

1. `package.json` の tsx devDependency 追加（tsx がなければスクリプト実行不可）
2. `src/core/parser.ts` の `parseYamlFile` + `ParsedFileResult<T>` export 追加
3. `src/commands/validate.ts` の `--file` フラグ追加（parser.ts が前提）
4. `scripts/generate-references.ts` + `skills/tespec-yaml-gen/rules/*.md` の初回生成（動作確認）
5. `skills/tespec-yaml-gen/SKILL.md` の手書き（rules/ 内容を参照しながら作成）
6. `package.json` の `skill:sync` スクリプト追加
7. `.github/workflows/sync-references.yml` の作成（ローカルで generate-references.ts が動作確認後）

---

## 未解決事項（すべて確定済み）

| 事項 | 確定内容 | 確定日 |
|-----|---------|-------|
| `--file` の引数形式 | ファイルパス指定（`tespec validate --file screens/login.yaml`） | 2026-03-25 |
| skill ディレクトリ構造 | `skills/tespec-yaml-gen/rules/`（Vercel Labs skills 規約、team-lead 確定 2026-03-25） | 2026-03-25 |

未解決事項なし。Step 4（設計書出力）に進める状態。
