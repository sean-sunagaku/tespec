# Platform Expert — Step 3 実装詳細ノート

作成日: 2026-03-25
担当: platform-expert
目的: P02（静的 Record Registry）を TypeScript 6.x / oclif v4 / ESM / tsup 環境で正しく実装するための具体的な注意点をまとめる

---

## 1. ファイル構成と import パスの制約

`moduleResolution: NodeNext` により、**ソースは `.ts` で書くが import パスは `.js` 拡張子が必須**。

```
src/core/
  generators/
    types.ts        → import from '../core/generators/types.js'
    registry.ts     → import from '../core/generators/registry.js'
    playwright.ts   → import from '../core/generators/playwright.js'
    xctest.ts       → import from '../core/generators/xctest.js'
  generator.ts      → 後方互換 re-export（既存テストを壊さない）
```

---

## 2. types.ts の推奨実装

`FrameworkId` を union 型ではなく `as const` 配列から導出することで、oclif `Flags.option()` との同期を自動化できる。

```typescript
// src/core/generators/types.ts
import type { Screen, Setup } from '../schema.js';

// as const 配列から型を導出 → oclif options との1箇所同期
export const FRAMEWORK_IDS = ['playwright', 'xctest'] as const;
export type FrameworkId = typeof FRAMEWORK_IDS[number];

export interface FrameworkGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileExtension: string;
  fileNameFor(screenId: string): string;
}
```

**なぜ `type FrameworkId = 'playwright' | 'xctest'` ではないか:**
- union 型だと oclif の `Flags.option({ options: [...] })` に渡す配列を別途手動で維持する必要がある
- `FRAMEWORK_IDS` を export することで `generate.ts` が `FRAMEWORK_IDS as unknown as string[]` で直接参照できる

---

## 3. registry.ts の推奨実装

```typescript
// src/core/generators/registry.ts
import type { FrameworkId, FrameworkGenerator } from './types.js';
import { playwright } from './playwright.js';
import { xctest } from './xctest.js';

// Record<FrameworkId, FrameworkGenerator> は全キーの存在をコンパイル時に強制する
const REGISTRY: Record<FrameworkId, FrameworkGenerator> = {
  playwright,
  xctest,
};

export function getGenerator(id: FrameworkId): FrameworkGenerator {
  return REGISTRY[id];
}
```

**`Record<FrameworkId, FrameworkGenerator>` の網羅性チェックの効果:**
- 新たに `FrameworkId` に `'jest'` を追加したとき、`REGISTRY` に `jest` キーがなければコンパイルエラー
- `getGenerator` の引数型が `FrameworkId` のため、存在しない ID を渡してもコンパイルエラー（runtime エラー不要）

---

## 4. playwright.ts / xctest.ts の推奨実装

```typescript
// src/core/generators/playwright.ts
import type { FrameworkGenerator } from './types.js';
import { generateTestFile } from '../generator.js'; // 既存関数をそのまま参照

export const playwright: FrameworkGenerator = {
  generate: generateTestFile,
  fileExtension: 'spec.ts',
  fileNameFor: (screenId) => `${screenId}.spec.ts`,
};
```

```typescript
// src/core/generators/xctest.ts
import type { FrameworkGenerator } from './types.js';
import { generateSwiftTestFile } from '../generator-swift.js'; // 既存関数をそのまま参照

export const xctest: FrameworkGenerator = {
  generate: generateSwiftTestFile,
  fileExtension: 'swift',
  fileNameFor: (screenId) => `${toSwiftClassName(screenId)}Tests.swift`,
};

// generator-swift.ts から移植が必要（現状は非公開関数）
function toSwiftClassName(screenId: string): string {
  return screenId
    .split(/[_\-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
```

**注意:** `toSwiftClassName` は現在 `generator-swift.ts` の非公開関数。`xctest.ts` で `fileNameFor` を実装するには:
- オプション A: `generator-swift.ts` から `export` に変更して import する
- オプション B: `xctest.ts` に直接コピーする（DRY 違反だが依存を増やさない）
- 推奨: オプション A（`export function toSwiftClassName` に変更、変更箇所1行）

---

## 5. generate.ts の変更箇所（最小変更）

```typescript
// src/commands/generate.ts の変更差分

// 追加 import
import { FRAMEWORK_IDS, type FrameworkId } from '../core/generators/types.js';
import { getGenerator } from '../core/generators/registry.js';

// flags に追加
static flags = {
  // ...既存 flags...
  framework: Flags.option({
    options: FRAMEWORK_IDS as unknown as string[],
    char: 'f',
    description: 'Test framework to generate for',
    default: 'playwright',
  })(),
};

// run() 内の変更
// 変更前:
const outputs = selectedScreens.map((screen) => ({
  screenId: screen.screen,
  content: generateTestFile(screen, setups),
}));
// ...
writeFile(path.join(outputDir, `${output.screenId}.spec.ts`), ...)

// 変更後:
const generator = getGenerator(flags.framework as FrameworkId);
const outputs = selectedScreens.map((screen) => ({
  screenId: screen.screen,
  content: generator.generate(screen, setups),
}));
// ...
writeFile(path.join(outputDir, generator.fileNameFor(output.screenId)), ...)
```

**`flags.framework as FrameworkId` のキャストについて:**
- oclif の `Flags.option()` は `default` が指定されていれば `string`（undefined なし）を返す
- `FRAMEWORK_IDS` で options を絞っているため runtime では必ず有効な値になる
- TypeScript の型システム上は `string` のままなので `as FrameworkId` が必要
- より厳密にしたい場合は `assertFrameworkId(flags.framework)` のような assertion 関数を1つ追加する

---

## 6. 後方互換 re-export（generator.ts）

既存のテストが `import { generateTestFile } from '../core/generator.js'` を使っている場合、壊れないようにする。

```typescript
// src/core/generator.ts（既存ファイルを置き換え）
// 後方互換 re-export のみ
export { generateTestFile } from './generators/playwright.js';
```

**確認ポイント:** `src/core/__test__/generator.test.ts` の import パスが `../generator` を使っているはずなので、re-export により変更不要。

---

## 7. tsup への影響

**変更不要。** 理由:

- `src/commands/generate.ts` が `registry.ts` を static import → tsup が依存チェーンで自動バンドル
- `src/core/generators/` 以下のファイルは entry に明示不要
- `format: ['esm']` / `dts: true` / `clean: true` はそのまま有効

---

## 8. vitest テストへの影響

各 generator は純粋関数 `(Screen, Setup[]) => string` のままなので既存テストは変更不要。

新規テストの追加が必要な箇所:
- `getGenerator('playwright')` が正しい generator を返すことの確認（registry 単体テスト）
- `getGenerator('xctest')` の同上
- `xctest.fileNameFor('user_profile')` が `'UserProfileTests.swift'` を返すことの確認

---

## 9. 実装順序（architecture-lead の提言に沿う）

**PR 1（接続）:**
1. `src/core/generators/types.ts` 新規作成
2. `src/core/generators/playwright.ts` 新規作成
3. `src/core/generators/xctest.ts` 新規作成（`toSwiftClassName` を generator-swift.ts から export）
4. `src/core/generators/registry.ts` 新規作成
5. `src/core/generator.ts` を後方互換 re-export に置き換え
6. `src/commands/generate.ts` に `--framework` フラグ追加

**PR 2（リファクタリング、別 PR）:**
- `buildComments` / `buildTestName` 等の重複ロジックを `generator-helpers.ts` に抽出
- `generator.ts` / `generator-swift.ts` が helpers を import するよう変更
