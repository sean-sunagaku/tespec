# Step 3: 確定依存グラフ（dependency-analyst）

作成日: 2026-03-25
採用パターン: Pattern 10 + E2

---

## Phase 1 実装対象ファイル一覧

### 新規追加ファイル

| ファイル | 種別 | 役割 |
|--------|------|------|
| `scripts/generate-references.ts` | スクリプト | schema.ts → skills/tespec-yaml-gen/rules/*.md 生成 |
| `skills/tespec-yaml-gen/SKILL.md` | 静的ドキュメント | AI への指示・ルール・記述例（手書き） |
| `skills/tespec-yaml-gen/rules/*.md` | 生成物 | Zod toJSONSchema で自動生成（npx skills 規約準拠） |
| `.github/workflows/sync-references.yml` | CI workflow | schema.ts 変更検知 → 自動再生成 → PR |

### 既存ファイルへの変更

| ファイル | 変更内容 | 変更規模 |
|--------|---------|---------|
| `src/commands/validate.ts` | `--file` フラグ追加（ファイルパス形式: `screens/login.yaml`）| 軽微 |
| `src/core/parser.ts` | `parseYamlFile` + `ParsedFileResult<T>` を export 昇格 | 軽微（export キーワード追加のみ） |
| `package.json` | tsx devDependency + `skill:sync` スクリプト追加 | 2行追加 |

### 変更なし

| ファイル | 理由 |
|--------|------|
| `src/core/schema.ts` | 参照されるのみ。変更不要 |
| `src/core/generator.ts` | 今回スコープ外 |
| `src/core/validator.ts` | validate.ts が既存のまま利用 |
| `src/commands/generate.ts` | 今回スコープ外 |
| `src/utils/output.ts` | 今回スコープ外 |
| `src/cli.ts` | 今回スコープ外 |

---

## 確定した依存グラフ

```
[外部依存]
  zod@4.1.12 ─────────────────────────────── src/core/schema.ts
  @oclif/core ─────────────────────────────── src/commands/validate.ts
  tsx (devDep, 新規追加) ──────────────────── scripts/generate-references.ts の実行環境
  node:fs/promises, node:path ─────────────── scripts/generate-references.ts

[内部依存（既存・変更なし）]
  src/core/schema.ts ← src/core/parser.ts     (型 + スキーマ)
  src/core/schema.ts ← src/core/validator.ts  (型のみ)
  src/core/parser.ts ← src/commands/validate.ts  (parseProject)
  src/core/validator.ts ← src/commands/validate.ts
  src/utils/output.ts ← src/commands/validate.ts

[内部依存（新規追加）]
  src/core/schema.ts ← scripts/generate-references.ts   (Zod スキーマ + toJSONSchema)
  src/core/parser.ts ← src/commands/validate.ts          (parseYamlFile — --file 時の直接呼び出し)

[CI 依存（コード依存なし）]
  .github/workflows/sync-references.yml
    → pnpm tsx scripts/generate-references.ts
    → git diff --exit-code skills/tespec-yaml-gen/rules/
    → gh pr create（差分あった場合のみ）
```

---

## 依存方向の確認

### 3ルールの維持

| ルール | 状態 |
|--------|------|
| schema.ts は外部ライブラリのみに依存 | 維持。変更なし |
| core/* は commands/* を import しない | 維持。逆向き依存なし |
| utils/* は core/* を import しない | 維持。変更なし |

### 新規追加による循環依存リスク

```
scripts/ → src/core/schema.ts
```

- `scripts/` は他のどこからも import されない（エントリポイント専用）
- `src/core/schema.ts` → `scripts/` への依存は存在しない
- **循環依存リスク: ゼロ**

---

## レイヤー構造（Phase 1 確定版）

```
Layer 0: 外部ライブラリ
  zod, @oclif/core, yaml, picocolors, node:*

Layer 1: src/core/schema.ts
  → zod のみに依存。全コアの型定義ハブ

Layer 2: src/core/*.ts（schema.ts 以外）
  parser.ts   → schema.ts（型 + スキーマ）+ yaml + node:*
  generator.ts → schema.ts（型のみ）
  validator.ts → schema.ts（型のみ）

  utils/output.ts → picocolors（独立）

Layer 3: src/commands/*.ts
  validate.ts → parser.ts + validator.ts + output.ts + @oclif/core
  generate.ts → parser.ts + validator.ts + generator.ts + output.ts + @oclif/core

Layer 4: cli.ts
  → @oclif/core のみ（コマンド自動検出）

Layer 5: scripts/generate-references.ts  [新規]
  → src/core/schema.ts + node:fs/promises + node:path
  ※ tsx ランタイムで実行。他から import されない
```

---

## E2 追加による変更詳細

module-designer 設計（platform-expert 指摘後の改訂版）を採用。

### 動機

`parseProject()` は `config.yaml` を必須とするため、単体の screen YAML ファイルだけを検証する `--file` モードでは直接呼び出せない。`parseYamlFile` を export 昇格させて `validate.ts` から直接呼び出す。

### parser.ts の変更（export 昇格のみ）

```typescript
// src/core/parser.ts
// 変更前: 内部関数
async function parseYamlFile<T>(...): Promise<ParsedFileResult<T>>
interface ParsedFileResult<T> { ... }

// 変更後: export 昇格
export async function parseYamlFile<T>(...): Promise<ParsedFileResult<T>>
export interface ParsedFileResult<T> { ... }
```

### validate.ts の変更（フラグ追加 + 呼び出しパス分岐）

```typescript
// src/commands/validate.ts
static flags = {
  config: Flags.string({ ... }),  // 既存
  file: Flags.string({
    description: 'Validate a specific screen YAML file',
    helpValue: 'screens/login.yaml',
  }),  // 新規追加
};
// --file あり: parseYamlFile(filePath, ScreenSchema) → validate() 直接
// --file なし: parseProject() → validate() 従来通り
```

**依存グラフへの影響:** `validate.ts` → `parser.ts` の依存エッジは既存のまま。`parseYamlFile` が追加で使われるようになるが、依存先ファイルは同じ。新しい import 行は不要。

---

## 実装順序の推奨

依存関係から逆算した安全な実装順序:

1. `package.json` — tsx devDependency 追加（後続すべての前提）
2. `src/core/parser.ts` — `parseYamlFile` + `ParsedFileResult<T>` export 昇格（validate.ts より先）
3. `src/commands/validate.ts` — `--file` フラグ追加 + `parseYamlFile` 直接呼び出し（parser.ts が前提）
4. `scripts/generate-references.ts` — schema.ts 直接 import + 初回生成動作確認（tsx が前提、出力先: skills/tespec-yaml-gen/rules/）
5. `skills/tespec-yaml-gen/SKILL.md` — 手書き（コード依存なし、いつでも可）
6. `package.json` — `skill:sync` スクリプト追加（scripts/ 動作確認後）
7. `.github/workflows/sync-references.yml` — scripts/ が動作してから

---

## 依存グラフのまとめ

**Phase 1 で新規追加される依存関係は2本:**

```
scripts/generate-references.ts → src/core/schema.ts   （新規ファイルによる新規依存）
src/commands/validate.ts → src/core/parser.ts          （既存エッジ。parseYamlFile が追加で使われるが import 先は同一）
```

`parser.ts` の export 昇格はファイル内部の変更のみで、依存グラフのエッジ数は増えません。既存の依存グラフに対して最小限の変更で Phase 1 要件をすべて満たします。
