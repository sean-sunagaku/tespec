# Step 3: モジュール設計草稿（module-designer）

作成日: 2026-03-25
前提: P02 静的 Record Registry 採用確定

---

## ファイル構成（未決事項: フラット vs サブディレクトリ）

architecture-lead への確認が保留中のため、両案を記載する。

### 案 A: フラット構成（推奨）

```
src/core/
  generator.ts            変更: 実装削除 → re-export のみ
  generator-swift.ts      変更なし（接続のみ）
  generator-types.ts      新規: FrameworkGenerator interface + Target type
  generator-registry.ts   新規: Record<Target, FrameworkGenerator> + getGenerator()
  schema.ts               変更なし
  parser.ts               変更なし
  validator.ts            変更なし

src/commands/
  generate.ts             変更: --target フラグ追加 + registry 呼び出しに変更
```

### 案 B: サブディレクトリ構成

```
src/core/
  generator.ts            変更: re-export のみ
  generator-swift.ts      変更: re-export のみ（実装は generators/xcuitest.ts へ移動）
  generator-types.ts      新規
  generator-registry.ts   新規
  generators/
    playwright.ts         新規: generator.ts から実装を移動
    xcuitest.ts           新規: generator-swift.ts から実装を移動
```

---

## 各モジュールの責務と公開インターフェース

### generator-types.ts（新規）

**責務**: フレームワーク generator の共通型契約を定義する

```ts
import type { Screen, Setup } from './schema.js';

export type Target = 'playwright' | 'xctest';

export interface FrameworkGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileExtension: string;
  fileNameFor(screenId: string): string;
}
```

**公開**: `Target`, `FrameworkGenerator`
**依存**: `schema.ts`（型のみ）
**被依存**: `generator-registry.ts`, `generator.ts`（re-export 側）, `generator-swift.ts`（wrapper 側）

---

### generator-registry.ts（新規）

**責務**: Target 文字列から FrameworkGenerator を解決する

```ts
import type { Target, FrameworkGenerator } from './generator-types.js';
import { generateTestFile } from './generator.js';
import { generateSwiftTestFile } from './generator-swift.js';

const REGISTRY: Record<Target, FrameworkGenerator> = {
  playwright: {
    generate: generateTestFile,
    fileExtension: 'spec.ts',
    fileNameFor: (screenId) => `${screenId}.spec.ts`,
  },
  xctest: {
    generate: generateSwiftTestFile,
    fileExtension: 'swift',
    fileNameFor: (screenId) => `${toSwiftClassName(screenId)}Tests.swift`,
  },
};

export function getGenerator(target: Target): FrameworkGenerator {
  return REGISTRY[target];
}

export const AVAILABLE_TARGETS = Object.keys(REGISTRY) as Target[];

function toSwiftClassName(screenId: string): string {
  return screenId
    .split(/[_\-]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
}
```

**公開**: `getGenerator`, `AVAILABLE_TARGETS`
**依存**: `generator-types.ts`, `generator.ts`（既存関数を参照）, `generator-swift.ts`（既存関数を参照）

**注意点**:
- `toSwiftClassName` は `generator-swift.ts` にも実装済みだが、`fileNameFor` は registry の責務のためここに置く
- 既存の `generateTestFile` / `generateSwiftTestFile` を直接参照することでファイル移動ゼロ

---

### generator.ts（変更: re-export のみに）

**責務**: 後方互換性のための re-export

```ts
// 後方互換 re-export
export { generateTestFile } from './generators/playwright.js'; // 案B
// または現状維持（案A では変更不要）
```

案 A（フラット）の場合: `generator.ts` 自体は変更不要。registry が直接 import する。
案 B（サブディレクトリ）の場合: 実装を `generators/playwright.ts` に移動し、re-export を残す。

---

### generate.ts の変更箇所

**追加するフラグ**:
```ts
target: Flags.string({
  char: 't',
  description: 'Target test framework',
  options: AVAILABLE_TARGETS,
  default: 'playwright',
}),
```

**変更箇所 1: import**
```ts
// Before
import { generateTestFile } from '../core/generator.js';

// After
import { getGenerator, AVAILABLE_TARGETS } from '../core/generator-registry.js';
import type { Target } from '../core/generator-types.js';
```

**変更箇所 2: generate 呼び出し**
```ts
// Before
content: generateTestFile(screen, setups),

// After
const generator = getGenerator(flags.target as Target);
// ...
content: generator.generate(screen, setups),
```

**変更箇所 3: ファイル名生成**
```ts
// Before
`${output.screenId}.spec.ts`

// After
generator.fileNameFor(output.screenId)
```

---

## 依存グラフ（案 A: フラット構成）

```
commands/generate.ts
  ├── core/generator-registry.ts
  │     ├── core/generator-types.ts
  │     │     └── core/schema.ts
  │     ├── core/generator.ts
  │     │     └── core/schema.ts
  │     └── core/generator-swift.ts
  │           └── core/schema.ts
  └── core/generator-types.ts（Target 型のみ）
```

循環依存なし。依存は常に上位 → 下位の一方向。

---

## 変更ファイルサマリ

| ファイル | 変更種別 | 変更規模 |
|---------|---------|---------|
| `src/core/generator-types.ts` | 新規作成 | 約15行 |
| `src/core/generator-registry.ts` | 新規作成 | 約25行 |
| `src/commands/generate.ts` | 変更 | +10行 / -3行 |
| `src/core/generator.ts` | 変更なし（案 A）| — |
| `src/core/generator-swift.ts` | 変更なし | — |

---

## 未決事項（architecture-lead の回答待ち）

- フラット構成（案 A）vs サブディレクトリ構成（案 B）の最終判断
- `flags.target as Target` のキャストを避ける型安全な方法（`AVAILABLE_TARGETS` での `includes` ガードを使うか）
