# Platform Expert Feedback — Workflow 機能追加の技術スタック制約分析

## 1. oclif フラグ追加パターン（--workflow フラグ）

### 現行パターン（generate.ts を参照）

```ts
static flags = {
  config: Flags.string({ char: 'c', description: '...' }),
  screen: Flags.string({ description: '...' }),
  unit: Flags.string({ description: '...' }),
  'dry-run': Flags.boolean({ default: false }),
  target: Flags.string({ options: [...SCREEN_TARGETS], default: 'playwright' }),
};

async run(): Promise<void> {
  const { flags } = await this.parse(Generate);
  flags['dry-run'];   // boolean
  flags.target;       // string
}
```

### workflow フラグ追加時の指針

- `Flags.string({ description: '...' })` で `--workflow <id>` を追加するパターンは既存の `--screen` / `--unit` と完全に同一
- `--target` に workflow 用フレームワークを追加する場合は `options: [...SCREEN_TARGETS, ...WORKFLOW_TARGETS]` のように registry 側を拡張して渡す
- フラグ名にハイフンを含む場合（例: `workflow-dir`）は `flags['workflow-dir']` でアクセス
- `generate.ts` の `shouldGenerateScreens / shouldGenerateUnits` パターンを踏まえ、`shouldGenerateWorkflows` も同じ boolean フラグ式で追加できる
- `view.ts` に `--workflow` フラグを追加する場合も同一パターン（`Flags.string` + `this.parse`）

### 注意点

- oclif の `options` フィールドは **文字列のリテラル型推論が効かない**ため、型アサーションが必要になることがある
- `Flags.boolean` のデフォルトは `false` なので必ず `default: false` を明示する（既存コードもそうしている）

---

## 2. Zod 4 での union / discriminatedUnion パターン

### 現行スキーマ（schema.ts）

```ts
// z.union — 単純な型の OR
expect: z.union([z.string(), z.array(z.string())]),
given:  z.union([z.string(), z.array(z.string())]).optional(),

// z.enum — リテラル列挙
type: z.enum(['normal', 'error', 'boundary']).default('normal'),
```

### WorkflowStep / Workflow スキーマ設計ガイド

**ステップに種別がある場合**は `z.discriminatedUnion` が最適：

```ts
// discriminatedUnion: 判別子フィールドで型を絞る
export const WorkflowStepSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('action'),   action: z.string(), target: z.string().optional() }),
  z.object({ type: z.literal('assert'),   expect: z.union([z.string(), z.array(z.string())]) }),
  z.object({ type: z.literal('navigate'), to: z.string() }),
]);
```

**ステップに種別がない場合**（フラットな構造）は `z.object` のみで十分。

```ts
export const WorkflowStepSchema = z.object({
  action:  z.string(),
  expect:  z.union([z.string(), z.array(z.string())]).optional(),
  given:   z.union([z.string(), z.array(z.string())]).optional(),
  steps:   z.array(z.string()).min(1),
  type:    z.enum(['normal', 'error', 'boundary']).default('normal'),
});

export const WorkflowSchema = z.object({
  workflow: z.string(),          // 一意 ID
  title:    z.string(),
  steps:    z.array(WorkflowStepSchema).min(1),
});
```

### Zod 4 の注意点

- `z.infer<typeof WorkflowSchema>` で型を派生させること（既存コードの慣習どおり）
- `safeParse` を使うこと（`parser.ts` の `schema.safeParse(document.toJSON())` と統一）
- `.default()` は Zod 4 で動作確認済み（`type` フィールドに既に使用されている）
- Zod 4 では `z.object.extend()` や `z.object.merge()` が使えるが、スキーマ数が少ない場合は inline で書くほうがシンプル

---

## 3. Preact コンポーネントのビルドパイプライン（tsup browser ターゲット）

### tsup.config.ts の構成

```ts
// ターゲット 1: Node.js CLI ビルド
{
  entry: ['src/cli.ts', 'src/commands/*.ts'],
  format: ['esm'], target: 'node18', dts: true, clean: true,
}

// ターゲット 2: ブラウザバンドル（viewer client）
{
  entry: { 'viewer-client': 'src/core/viewer/client-entry.tsx' },
  format: ['esm'], outDir: 'dist/viewer', platform: 'browser', target: 'es2022',
  clean: false,   // ← Node ビルドの dist を消さないよう false
  bundle: true, minify: true,
  noExternal: ['preact'],  // preact をバンドル内に含める
  esbuildOptions(options) {
    options.jsx = 'automatic';
    options.jsxImportSource = 'preact';
  },
}
```

### WorkflowDetail.tsx 追加時の手順

1. `src/core/viewer/components/WorkflowDetail.tsx` を作成（`ScreenDetail.tsx` / `UnitDetail.tsx` と同じ場所）
2. **tsup.config.ts の変更は不要** — エントリポイント `client-entry.tsx` から import すれば自動的にバンドルされる
3. `client-entry.tsx` に以下を追加するだけ：

```ts
import { WorkflowDetail } from './components/WorkflowDetail.js';
// View 型に { type: 'workflow'; id: string } を追加
// BrowserApp の JSX に workflow ケースを追加
```

4. Biome は `src/core/viewer/client-entry.tsx` を **除外設定済み**（`!!src/core/viewer/client-entry.tsx`）のため、**client-entry.tsx への追加コードは lint チェック対象外**。コンポーネントファイル自体（`WorkflowDetail.tsx`）は lint 対象になる

### 重要制約

- **`clean: false`** は絶対に変更しない（Node ビルドの dist が消える）
- `noExternal: []` のまま（すべてバンドル対象。tree-shaking で不要なものは除去される）
- JSX ファクトリは `h` / `Fragment`（tsup 上位設定）と `automatic`（esbuildOptions）が両方指定されているが、`jsxImportSource: 'preact'` が有効なので automatic モードで動作する
- Tailwind CSS は CDN 経由（`template.ts` で HTML に埋め込み）なので、コンポーネント側は `class=` 属性をそのまま使えばよい（camelCase の `className` は不要）

---

## 4. Hono の API レスポンス拡張方法

### 現行サーバー API（server.ts）

```ts
app.get('/api/specs', (c) => {
  return c.json({
    project: currentData.config.project,
    screens:  currentData.screens,
    setups:   currentData.setups,
    units:    currentData.units,
  });
});
```

### workflow 追加時のパターン

**方法 A（推奨）**: 既存 `/api/specs` レスポンスに `workflows` フィールドを追加

```ts
app.get('/api/specs', (c) => {
  return c.json({
    project:   currentData.config.project,
    screens:   currentData.screens,
    setups:    currentData.setups,
    units:     currentData.units,
    workflows: currentData.workflows,  // ParsedProject に追加
  });
});
```

**方法 B**: `/api/workflows` エンドポイントを個別に追加

```ts
app.get('/api/workflows', (c) => {
  return c.json({ workflows: currentData.workflows });
});
```

方法 A が既存クライアントの fetch パターン（`/api/specs` 一括取得）と整合するため推奨。

### ParsedProject の拡張

`parser.ts` の `ParsedProject` interface に `workflows: WorkflowSpec[]` を追加し、`parseProject` でも並行パースする：

```ts
export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];
  workflows: WorkflowSpec[];  // 追加
}
```

`parseProject` の `Promise.all` に `workflowsResult` を追加するだけで対応できる。

---

## 5. Vitest テストパターン（fixture ベース）

### 現行パターン

```ts
// parser.test.ts — fixtureConfigPath でディレクトリ名指定
const fixturesRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../tests/fixtures',
);
function fixtureConfigPath(name: string): string {
  return path.join(fixturesRoot, name, 'config.yaml');
}
```

```
tests/fixtures/
  valid/               ← config.yaml + screens/ + setups/
  unit-parse-valid/    ← config.yaml + screens/ + units/
  invalid-schema/
  ...
```

### workflow テスト追加時の指針

1. `tests/fixtures/workflow-valid/` フィクスチャを作成
   - `config.yaml`（`workflows_dir: ./workflows` を追加）
   - `workflows/sample-workflow.yaml`

2. パーサーテスト（`parser.test.ts` に追記）：

```ts
it('parses workflows when workflows_dir is configured', async () => {
  const { result, errors } = await parseProject(fixtureConfigPath('workflow-valid'));
  expect(errors).toEqual([]);
  expect(result?.workflows).toHaveLength(1);
});
```

3. バリデーターテスト（`workflow-validator.test.ts` を新規作成）：

```ts
import { describe, expect, it } from 'vitest';
import { validateWorkflows } from '../workflow-validator.js';
```

4. ジェネレーターテスト（`generator-workflow-playwright.test.ts`）：
   - `generator.test.ts` の inline snapshot パターンをそのまま踏襲
   - `generateWorkflowFile(workflow, setups)` を呼んで `toMatchInlineSnapshot` で検証

### vitest.config.ts の注意点

- `include: ['src/**/*.test.ts', 'tests/**/*.test.ts']` ← `.tsx` は含まれていない
- Preact コンポーネントのテストを追加する場合は `*.test.tsx` を追加する必要があるが、既存の viewer テストが `.ts` のみなので要確認
- jsdom 環境の設定は vitest.config.ts に明示されていない（デフォルト = `node`）。`@testing-library/preact` を使うテストには `environment: 'jsdom'` を追加する必要がある

---

## 6. tsup 設定での viewer client 新コンポーネント追加時の注意点（まとめ）

| 変更内容 | tsup.config.ts 変更 | 対応箇所 |
|---|---|---|
| WorkflowDetail.tsx 追加 | **不要** | client-entry.tsx で import するだけ |
| 別エントリポイント追加（例: embed モード） | **必要** | entry オブジェクトにキーを追加 |
| Preact 以外の依存追加 | **不要**（noExternal: [] で全バンドル） | package.json に依存追加のみ |
| Node.js 側に新 util 追加 | **不要** | entry の glob `src/commands/*.ts` は既存コマンドのみ。`src/core/**` は commands から import されれば自動バンドル |

### 重要な落とし穴

- `client-entry.tsx` は **Biome の lint 除外リスト**に入っている。新しいコンポーネントファイルは除外されていないので Biome が通ること（特に `class=` 属性 — Biome は React の `className` ルールを有効にしている場合がある。ただし `biome.json` の `recommended: true` のみなので、Preact の `class=` は通る可能性が高い）
- `clean: false` は viewer ビルドの必須設定。Node ビルド後に viewer ビルドが走るため、`false` にしないと Node 側の dist が消える
- viewer の `__dirname` 解決は `server.ts:11` で `fileURLToPath(import.meta.url)` を使用しており、`dist/viewer/viewer-client.js` を相対パスで解決している。新しい静的アセットを追加する場合も同じパターンで `dist/viewer/` 以下に出力する必要がある

---

## 7. Config スキーマへの workflows_dir 追加

```ts
export const ConfigSchema = z.object({
  version:       z.number(),
  project:       z.string(),
  screens_dir:   z.string().default('./screens'),
  setups_dir:    z.string().default('./setups'),
  units_dir:     z.string().optional(),
  workflows_dir: z.string().optional(),  // 追加
});
```

`units_dir` が optional で追加された既存のパターンと完全に同一。`parser.ts` でも `units_dir` の条件分岐と同じ形で実装できる。

---

## 8. 既存テストへの影響（デグレリスク）

| 既存テスト | workflow 追加後の影響 |
|---|---|
| `parser.test.ts` | `ParsedProject` に `workflows` が追加されると、既存テストの `result?.workflows` が `undefined` になる可能性 → フィクスチャ側には `workflows_dir` を追加しないので影響なし。ただし `ParsedProject` の型チェックは通る |
| `generator.test.ts` | generate コマンドの `shouldGenerate*` フラグが変わると既存ロジックに影響。慎重に条件分岐を追加 |
| viewer コンポーネントテスト | `ParsedProject` に `workflows` を追加した場合、テスト側の mock オブジェクトに `workflows: []` を追加する必要がある |

---

## 結論・推奨アプローチ

1. **スキーマ拡張**: `ConfigSchema` に `workflows_dir?: string`、新規 `WorkflowSchema` を追加（`schema.ts`）
2. **パーサー拡張**: `ParsedProject` に `workflows` フィールドを追加し、`parseProject` の `Promise.all` に追加
3. **バリデーター**: `workflow-validator.ts` を新規作成（`unit-validator.ts` と同じ構造）
4. **ジェネレーター**: `src/core/generators/workflow/playwright.ts` を作成し、`registry.ts` に登録
5. **UI コンポーネント**: `WorkflowDetail.tsx` を作成し、`client-entry.tsx` に import（tsup 変更不要）
6. **サーバー**: `/api/specs` レスポンスに `workflows` を追加
7. **コマンド**: `generate.ts` に `--workflow` フラグを追加（既存パターンの踏襲）
8. **テスト**: fixture ベース（parser）+ inline snapshot（generator）+ jsdom（コンポーネント、要 vitest.config.ts 設定追加）
