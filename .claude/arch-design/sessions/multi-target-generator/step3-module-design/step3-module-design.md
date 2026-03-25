# Step 3: モジュール設計・依存関係定義

作成日: 2026-03-25
前提: P02 静的 Record Registry 採用確定

---

## 確定ファイル構成

platform-expert 案（サブディレクトリ構成）を採用。module-designer 案 A（フラット）と案 B（サブディレクトリ）の両案を比較した結果、依存関係の可読性と将来の拡張容易性からサブディレクトリ構成を採用。

```
src/core/
  schema.ts               変更なし
  parser.ts               変更なし
  validator.ts            変更なし
  generator.ts            変更: 後方互換 re-export のみに置き換え
  generator-swift.ts      変更: toSwiftClassName を export に変更（1行変更）
  generators/
    types.ts              新規: FRAMEWORK_IDS, FrameworkId, FrameworkGenerator
    playwright.ts         新規: FrameworkGenerator オブジェクト（既存関数をラップ）
    xctest.ts             新規: FrameworkGenerator オブジェクト（既存関数をラップ）
    registry.ts           新規: Record<FrameworkId, FrameworkGenerator> + getGenerator()

src/commands/
  generate.ts             変更: --framework フラグ追加 + registry 呼び出し
```

---

## 各モジュールの責務

| モジュール | 責務 | 安定度 |
|---|---|---|
| `schema.ts` | ドメインモデル定義（Zod スキーマ + 型） | 最高（変更なし） |
| `generators/types.ts` | FrameworkId 型 + FrameworkGenerator interface | 高（型変更のみ） |
| `generator.ts` | 後方互換 re-export（既存テスト保護） | - |
| `generator-swift.ts` | 既存実装（`toSwiftClassName` を export 追加） | - |
| `generators/playwright.ts` | Playwright の FrameworkGenerator 実装 | 低（実装詳細） |
| `generators/xctest.ts` | XCUITest の FrameworkGenerator 実装 | 低（実装詳細） |
| `generators/registry.ts` | Target → FrameworkGenerator の解決 | 中 |
| `commands/generate.ts` | CLI コマンド（`--framework` フラグ追加） | - |

---

## 確定依存グラフ（PR1 完了後）

```
commands/generate.ts
  ├── core/generators/types.ts     (FrameworkId 型のみ)
  │     └── core/schema.ts
  └── core/generators/registry.ts
        ├── core/generators/types.ts
        │     └── core/schema.ts
        ├── core/generators/playwright.ts
        │     ├── core/generators/types.ts
        │     └── core/generator.ts
        │           └── core/schema.ts
        └── core/generators/xctest.ts
              ├── core/generators/types.ts
              └── core/generator-swift.ts
                    └── core/schema.ts

core/generator.ts  (後方互換 re-export)
  └── core/schema.ts  (実装は変更なし、re-export のみ)
```

### 安定依存原則の検証

| 依存 | 方向 | 判定 |
|---|---|---|
| `generators/playwright.ts → generators/types.ts` | 不安定 → 安定 | OK |
| `generators/playwright.ts → generator.ts → schema.ts` | 不安定 → 安定 | OK |
| `generators/xctest.ts → generators/types.ts` | 不安定 → 安定 | OK |
| `generators/xctest.ts → generator-swift.ts → schema.ts` | 不安定 → 安定 | OK |
| `generators/registry.ts → generators/types.ts` | 中 → 安定 | OK |
| `generators/registry.ts → generators/playwright.ts` | 中 → 不安定 | ※要確認 |
| `commands/generate.ts → generators/registry.ts` | - → 中 | OK |
| `generators/types.ts → schema.ts` | 安定 → 最安定 | OK |

**`registry.ts → generators/playwright.ts` の方向について:**
registry（中程度安定）が playwright（不安定）に依存している。これは通常「安定 → 不安定」の逆方向に見えるが、registry の責務は「不安定な実装への参照を1箇所に集約する」ことであり、設計上必要な依存。generate.ts が各 generator を直接 import する代わりに registry が肩代わりすることが目的のため許容する。

---

## 確定依存グラフ（PR2 完了後・最終形）

```
commands/generate.ts
  ├── core/generators/types.ts
  └── core/generators/registry.ts
        ├── core/generators/types.ts  → core/schema.ts
        ├── core/generators/playwright.ts
        │     ├── core/generators/types.ts
        │     ├── core/generator-helpers.ts  → core/schema.ts
        │     └── core/generator.ts  → core/schema.ts
        └── core/generators/xctest.ts
              ├── core/generators/types.ts
              ├── core/generator-helpers.ts  → core/schema.ts
              └── core/generator-swift.ts  → core/schema.ts

core/generator.ts  (後方互換 re-export)
  └── core/schema.ts
```

---

## 循環依存ゼロの検証

依存グラフをトポロジカルソートして循環がないことを確認する。

ノードをレイヤー順に並べると:

```
Layer 0 (最安定): schema.ts
Layer 1 (安定):   generators/types.ts, generator-helpers.ts (PR2以降)
Layer 2 (中間):   generator.ts, generator-swift.ts
Layer 3 (実装):   generators/playwright.ts, generators/xctest.ts
Layer 4 (接続):   generators/registry.ts
Layer 5 (CLI):    commands/generate.ts
```

依存は常に Layer が小さい方向（安定方向）に向かっており、同レイヤー内での依存・逆方向の依存はゼロ。循環依存は発生しない。

---

## 依存ルール（禁止事項）

### 絶対禁止

| 禁止パターン | 理由 |
|---|---|
| `generators/X.ts → generators/registry.ts` | 循環依存を生む |
| `generators/X.ts → commands/generate.ts` | core が commands に依存するレイヤー逆転 |
| `generators/types.ts → generators/registry.ts` | 型定義が実装に依存する逆転 |
| `generator-helpers.ts → generators/registry.ts` | helpers が registry を知る必要なし |
| `schema.ts → generators/X.ts` | 最安定モジュールが不安定に依存する逆転 |
| `core/parser.ts → generators/X.ts` | parser はフレームワーク非依存であるべき |
| `core/validator.ts → generators/X.ts` | validator はフレームワーク非依存であるべき |

### 許可される依存

| 依存方向 | 説明 |
|---|---|
| `commands/* → core/*` | 正しいレイヤー方向 |
| `generators/* → generators/types.ts` | 不安定 → 安定 |
| `generators/* → generator-helpers.ts` | 不安定 → 安定 |
| `generators/* → schema.ts` | 不安定 → 最安定 |
| `generators/registry.ts → generators/playwright.ts` | registry の集約責務として許容 |
| `generator.ts → generators/playwright.ts` | 後方互換 re-export として許容（一方向） |

---

## 新フレームワーク追加時の変更箇所（OCP 検証）

`jest` を追加する場合:

1. `src/core/generators/jest.ts` — 新規作成
2. `src/core/generators/types.ts` — `FRAMEWORK_IDS` 配列に `'jest'` を追加（1行）
3. `src/core/generators/registry.ts` — `REGISTRY` に `jest` エントリ追加（1行）

**変更不要なファイル**: `commands/generate.ts` / `schema.ts` / `parser.ts` / `validator.ts` / `generator.ts` / `generator-swift.ts`

OCP（開放閉鎖原則）に完全準拠。

---

## module-designer / platform-expert 設計へのレビューコメント（dependency-analyst）

### レビュー対象: module-designer-draft.md

**案 A（フラット）vs 案 B（サブディレクトリ）の依存関係上の差異:**
- 案 A では `generator-registry.ts` が `generator.ts` と `generator-swift.ts` を直接 import する
- 案 B では `generators/registry.ts` が `generators/playwright.ts` と `generators/xctest.ts` を import し、後者が既存関数を参照する
- 依存方向はどちらも同一だが、案 B の方が「既存関数ラッパー」として責務が明確に分離されている
- **推奨: 案 B（サブディレクトリ）** — registry が既存の `generator.ts` / `generator-swift.ts` を直接知らなくて済む

**`toSwiftClassName` の重複問題:**
module-designer は registry 内に `toSwiftClassName` を再定義しているが、これは `generator-swift.ts` との重複。platform-expert の推奨（`generator-swift.ts` から export）が正しい。registry に関係のないユーティリティ関数を registry に置くべきでない。

### レビュー対象: platform-expert-impl-notes.md

**`FRAMEWORK_IDS as const` パターンへの依存関係コメント:**
`FRAMEWORK_IDS = ['playwright', 'xctest'] as const` を `types.ts` に定義し、`generate.ts` が `Flags.option({ options: FRAMEWORK_IDS })` で参照する設計は依存関係上クリーン。`generate.ts` が `types.ts` に依存するのは正しい方向。

**`generators/playwright.ts → core/generator.ts` の依存:**
platform-expert 案では `generators/playwright.ts` が `generator.ts` から `generateTestFile` を import している。これは PR1 段階では問題ないが、依存方向として `generators/` サブディレクトリが `core/` 直下の既存ファイルに依存するやや曖昧な構造になる。PR2（helpers 抽出）後は `generator.ts` 自体が不要になる可能性があるため、最終形では `generators/playwright.ts` が `generator.ts` を介さず直接実装を持つ形が望ましい。

---

## ESM import パス確認

```typescript
// commands/generate.ts
import { FRAMEWORK_IDS, type FrameworkId } from '../core/generators/types.js';
import { getGenerator } from '../core/generators/registry.js';

// core/generators/registry.ts
import type { FrameworkId, FrameworkGenerator } from './types.js';
import { playwright } from './playwright.js';
import { xctest } from './xctest.js';

// core/generators/playwright.ts
import type { FrameworkGenerator } from './types.js';
import { generateTestFile } from '../generator.js';

// core/generators/xctest.ts
import type { FrameworkGenerator } from './types.js';
import { generateSwiftTestFile, toSwiftClassName } from '../generator-swift.js';
```

すべての import パスに `.js` 拡張子を付与すること（`moduleResolution: NodeNext` 制約）。
