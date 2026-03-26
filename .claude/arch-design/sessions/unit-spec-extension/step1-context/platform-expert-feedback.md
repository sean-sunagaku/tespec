# Platform Expert Feedback: Unit Spec Extension

## 1. oclif v4 コマンド拡張パターン

### 現状
- `@oclif/core ^4.10.2` を使用
- `oclif.commands` は `./dist/commands` を指し、ファイルベースのルーティング
- 既存コマンド: `validate.ts`, `generate.ts`（`src/commands/` 直下）

### 推奨: 既存コマンドへの `--type` フラグ追加（新コマンド不要）

oclif v4 はフラグ定義が静的プロパティなので、既存の `validate` / `generate` に `--type` を追加するのが最もシンプル。

```ts
// generate.ts に追加
type: Flags.string({
  description: 'Spec type to process (screen or unit)',
  options: ['screen', 'unit'],
  // default なし → 両方処理
}),
```

**根拠:**
- oclif v4 ではサブコマンド（`generate:screen`, `generate:unit`）もファイル構成で実現可能だが、ディレクトリ構造が `commands/generate/screen.ts` になり、既存の `commands/generate.ts` と共存できない（oclif のルーティングが衝突する）
- 既存ユーザーの `tespec generate` / `tespec validate` がそのまま動く（後方互換）
- `--type` 省略時は screen + unit 両方処理（Phase A 方針どおり）

**注意点:**
- oclif v4 の `Flags.string({ options: [...] })` は入力バリデーションも自動で行う
- `--screen` フラグ（既存）は screen type のときのみ有効。`--type unit --screen xxx` のような矛盾する組み合わせはコマンド内でバリデーションする

---

## 2. Zod v4 スキーマ設計パターン

### 現状
- `zod ^4.1.12`（Zod v4 系）を使用
- Screen / Setup / Config それぞれ独立した `z.object()` で定義
- discriminated union は未使用

### 推奨: Unit Spec 用スキーマは完全独立で定義

```ts
// schema.ts に追加（ScreenSchema とは独立）
export const UnitCaseSchema = z.object({
  fn: z.string(),           // テスト対象の関数名
  desc: z.string(),         // テストの説明
  input: z.unknown().optional(),
  expected: z.unknown(),
  type: z.enum(['normal', 'error', 'boundary']).default('normal'),
});

export const UnitSpecSchema = z.object({
  unit: z.string(),         // モジュール識別子
  module: z.string(),       // import パス
  cases: z.array(UnitCaseSchema),
});
```

**根拠:**
- Zod v4 の discriminated union (`z.discriminatedUnion`) は Screen と Unit が同一ファイルにある場合に有用だが、Phase A 方針で「ディレクトリも独立（`units_dir`）」なので、パース時点でどちらのスキーマを適用するか既に確定している
- 独立スキーマの方がエラーメッセージが明快（union のエラーは分岐が多いと読みにくい）
- `z.infer<typeof UnitSpecSchema>` で型が自然に導出される

**Zod v4 固有の注意:**
- Zod v4 は `z.input` / `z.output` の型が分離されている。`.default()` を使うフィールドがある場合、パース前の型は `z.input<typeof Schema>` で取得する
- `z.unknown()` は Zod v4 で正常動作する。Unit Spec の input/expected に任意の JSON を許容するならこれが適切

---

## 3. TypeScript ESM の制約

### 現状
- `"type": "module"` + `"module": "NodeNext"` + `"moduleResolution": "NodeNext"`
- 全 import に `.js` 拡張子を明示（例: `'./schema.js'`, `'./types.js'`）
- ビルドは `tsup`（バンドラ）

### 影響と対策

1. **import パスの `.js` 拡張子**: 新規ファイル追加時も必ず `.js` を付与。`tsup` がバンドルするため実行時に問題はないが、TypeScript コンパイラの型チェック時に NodeNext が `.js` を要求する

2. **dynamic import は不要**: ジェネレータは registry.ts で静的に登録しているため、Unit 用ジェネレータも同じく静的 import + レジストリ登録で十分。lazy loading の必要はない（ジェネレータは軽量な pure function）

3. **tsup ビルド**: `tsup` は tree-shaking をサポートするので、screen のみ使うユーザーに unit ジェネレータのコードが入っても実害なし。エントリポイントの変更は不要

---

## 4. FrameworkGenerator interface の Screen/Unit 両対応

### 現状
```ts
export interface FrameworkGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}
```

### 推奨: Screen 用と Unit 用で interface を分離

```ts
// generators/types.ts
export interface ScreenGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileNameFor(screenId: string): string;
}

export interface UnitGenerator {
  generate(unit: UnitSpec): string;
  fileNameFor(unitId: string): string;
}
```

**なぜ統合 interface にしないか:**
- Screen の `generate` は `(Screen, Setup[])` の2引数、Unit は `(UnitSpec)` の1引数。無理に union にすると `generate(spec: Screen | UnitSpec, setups?: Setup[])` となり、各実装で型ガードが必要になる
- 呼び出し側（generate.ts コマンド）も `--type` で分岐済みなので、異なる interface を使い分ける方が型安全
- 既存の `FrameworkGenerator` は `ScreenGenerator` に rename するか、type alias で互換を保つ

**移行パス（互換性）:**
```ts
// 既存コードの破壊を最小化
export type FrameworkGenerator = ScreenGenerator; // 後方互換 alias
```

---

## 5. Target registry の拡張

### 現状
```ts
const REGISTRY: Record<Target, FrameworkGenerator> = { playwright, xctest };
```

### 推奨: Screen 用と Unit 用で別々のレジストリ

```ts
// registry.ts
export type ScreenTarget = 'playwright' | 'xctest';
export type UnitTarget = 'vitest' | 'xctest';
export type Target = ScreenTarget | UnitTarget;

const SCREEN_REGISTRY: Record<ScreenTarget, ScreenGenerator> = { playwright, xctest };
const UNIT_REGISTRY: Record<UnitTarget, UnitGenerator> = { vitest, xctest };

export function getScreenGenerator(target: ScreenTarget): ScreenGenerator {
  return SCREEN_REGISTRY[target];
}

export function getUnitGenerator(target: UnitTarget): UnitGenerator {
  return UNIT_REGISTRY[target];
}
```

**根拠:**
- Screen は `playwright | xctest`、Unit は `vitest | xctest`。`Target` を単一 union にすると `generate --type unit --target playwright` が型レベルでは通ってしまう
- 分離レジストリなら `--target` のバリデーションを `--type` に連動させられる
- xctest は Screen/Unit 両方で使えるが、実装は別クラス（Screen 用は UI テスト、Unit 用はロジックテスト）

**oclif フラグとの連携:**
- `--target` の `options` は動的に決まる（`--type` に依存）。oclif v4 では `options` を動的に変更できないため、`run()` 内でバリデーションする
```ts
// generate.ts の run() 内
const validTargets = flags.type === 'unit' ? UNIT_TARGETS : SCREEN_TARGETS;
if (!validTargets.includes(flags.target)) {
  printError('target', `--type ${flags.type} では --target ${flags.target} は使えません`);
  this.exit(1);
}
```

---

## 6. vitest ジェネレータの出力フォーマット

### 推奨する出力構造

```ts
import { describe, it, expect } from 'vitest';
// import { targetFunction } from './module-path';

describe('ModuleName', () => {
  it('fn: functionName - description', () => {
    // Input: ...
    // Expected: ...
    // TODO: implement
  });

  describe('異常系', () => {
    it('fn: functionName - error description', () => {
      // TODO: implement
    });
  });

  describe('境界値', () => {
    it('fn: functionName - boundary description', () => {
      // TODO: implement
    });
  });
});
```

**設計判断:**
- vitest は `describe/it` 構造（Playwright の `test.describe/test` と同じネストパターン）
- import は `vitest` から。Playwright と違い `expect` も vitest から import
- テスト対象モジュールの import はコメントアウトで出力（パスは UnitSpec の `module` フィールドから）
- `type` による normal/error/boundary のグルーピングは Playwright ジェネレータと同じパターンを踏襲
- テスト名に `fn: functionName` を含めることで、どの関数のテストか一目でわかる

**Playwright ジェネレータとのコード共有について:**
- `buildComments`, `indentOf`, `quote` などのユーティリティは共通化可能だが、現状 Playwright/XCTest 間でも共有していない
- 同じ判断で、vitest ジェネレータも独立実装が妥当（KISS）。共通化は 3 つ目以降のジェネレータ追加時に検討

---

## 7. ConfigSchema の拡張

### 推奨
```ts
export const ConfigSchema = z.object({
  version: z.number(),
  project: z.string(),
  screens_dir: z.string().default('./screens'),
  setups_dir: z.string().default('./setups'),
  units_dir: z.string().default('./units'),   // 追加
});
```

**Zod v4 の挙動:**
- `.default()` は `safeParse` 時にフィールドが `undefined` なら値を埋める
- 既存の config.yaml に `units_dir` がなくても `'./units'` が自動適用される → 後方互換あり
- `z.infer<typeof ConfigSchema>` の型に `units_dir: string` が追加される

---

## 8. parser.ts の拡張

### 推奨: `parseProject` を Unit Spec 対応に拡張

```ts
export interface ParsedProject {
  config: Config;
  screens: Screen[];
  setups: Setup[];
  units: UnitSpec[];  // 追加
}
```

- `parseYamlDirectory` は schema に依存しないジェネリック関数なので、`UnitSpecSchema` をそのまま渡せる
- `--type unit` のとき screens/setups のパースをスキップする最適化は可能だが、現時点では不要（YAGNI）

---

## まとめ: スタック制約から導かれる設計指針

| 観点 | 推奨 | 理由 |
|------|------|------|
| コマンド | 既存 validate/generate に `--type` フラグ追加 | oclif v4 のサブコマンドとの衝突回避、後方互換 |
| スキーマ | UnitSpecSchema を独立定義 | discriminated union 不要、エラーメッセージ明快 |
| Generator interface | ScreenGenerator / UnitGenerator に分離 | 引数が異なる、型安全性 |
| Registry | SCREEN_REGISTRY / UNIT_REGISTRY に分離 | target の有効範囲が type に依存 |
| ESM | 静的 import + `.js` 拡張子 | dynamic import 不要、既存パターン踏襲 |
| Config | `units_dir` を `.default('./units')` で追加 | Zod v4 の default で後方互換 |
| vitest 出力 | describe/it ネスト、Playwright と同じグルーピング | 既存パターン踏襲 |
