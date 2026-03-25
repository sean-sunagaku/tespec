# Dependency Analyst: Step 3 依存関係定義

## 確定アーキテクチャ（P02 静的 Record Registry）の完全依存グラフ

### モジュール一覧と役割

| モジュール | 種別 | 安定度 | 役割 |
|---|---|---|---|
| `core/schema.ts` | 既存・変更なし | 最高（安定） | ドメインモデル定義。Zod スキーマ + 型 |
| `core/generator-types.ts` | 新規 | 高（安定） | `Target` 型 + `FrameworkGenerator` interface |
| `core/generator-helpers.ts` | 新規（別 PR） | 高（安定） | `buildComments` 等の共通ロジック |
| `core/generator-registry.ts` | 新規 | 中（安定） | `Record<Target, FrameworkGenerator>` + `getGenerator()` |
| `core/generators/playwright.ts` | 新規（generator.ts から移動） | 低（不安定） | Playwright 実装 |
| `core/generators/xcuitest.ts` | 新規（generator-swift.ts から移動） | 低（不安定） | XCUITest/Swift 実装 |
| `core/generator.ts` | 既存・変更あり | - | 後方互換 re-export のみ |
| `commands/generate.ts` | 既存・変更あり | - | CLI コマンド。`--target` フラグ追加 |

---

## PR1 完了後の依存グラフ（registry 接続、helpers 抽出前）

```
commands/generate.ts
  ├── core/generator-registry.ts
  │     ├── core/generator-types.ts
  │     │     └── core/schema.ts
  │     ├── core/generators/playwright.ts
  │     │     ├── core/generator-types.ts (→ schema.ts)
  │     │     └── core/schema.ts
  │     └── core/generators/xcuitest.ts
  │           ├── core/generator-types.ts (→ schema.ts)
  │           └── core/schema.ts
  ├── core/parser.ts
  │     └── core/schema.ts
  ├── core/validator.ts
  │     └── core/schema.ts
  └── utils/output.ts

core/generator.ts (後方互換 re-export)
  └── core/generators/playwright.ts
```

**注意**: PR1 段階では `buildComments` が `generators/playwright.ts` と `generators/xcuitest.ts` に重複して存在する。依存方向は正しいが重複コードが残る。

---

## PR2 完了後の依存グラフ（helpers 抽出後・最終形）

```
commands/generate.ts
  ├── core/generator-registry.ts
  │     ├── core/generator-types.ts
  │     │     └── core/schema.ts
  │     ├── core/generators/playwright.ts
  │     │     ├── core/generator-types.ts
  │     │     ├── core/generator-helpers.ts
  │     │     │     └── core/schema.ts
  │     │     └── core/schema.ts
  │     └── core/generators/xcuitest.ts
  │           ├── core/generator-types.ts
  │           ├── core/generator-helpers.ts
  │           └── core/schema.ts
  ├── core/parser.ts → core/schema.ts
  ├── core/validator.ts → core/schema.ts
  └── utils/output.ts

core/generator.ts (後方互換 re-export)
  └── core/generators/playwright.ts
```

---

## 依存ルール（禁止事項）

新フレームワーク追加時・コードレビュー時に必ず確認すること。

### 絶対禁止

| 禁止パターン | 理由 |
|---|---|
| `generators/X.ts → generator-registry.ts` | 循環依存。registry が generators を import するのに generators が registry を import すると循環する |
| `generators/X.ts → commands/generate.ts` | core が commands に依存するレイヤー逆転 |
| `generator-types.ts → generator-registry.ts` | 型定義モジュールが実装モジュールに依存する逆転 |
| `generator-helpers.ts → generator-registry.ts` | helpers が registry を知る必要はない |
| `schema.ts → generators/X.ts` | 最安定モジュールが不安定モジュールに依存する逆転 |
| `core/parser.ts → generators/X.ts` | parser はフレームワーク非依存であるべき |
| `core/validator.ts → generators/X.ts` | validator はフレームワーク非依存であるべき |

### 許可される依存

| 依存方向 | 説明 |
|---|---|
| `commands/* → core/*` | commands が core に依存するのは正しいレイヤー方向 |
| `core/generators/* → core/generator-types.ts` | 不安定 → 安定。問題なし |
| `core/generators/* → core/generator-helpers.ts` | 不安定 → 安定。問題なし |
| `core/generators/* → core/schema.ts` | 不安定 → 安定。問題なし |
| `core/generator-registry.ts → core/generators/*` | registry が generators を知る。一方向のみ |
| `core/generator-registry.ts → core/generator-types.ts` | registry が型を使用 |
| `core/generator.ts → core/generators/playwright.ts` | 後方互換 re-export。一方向 |

---

## Target 型の命名確定依頼

Step 2 成果物では `Target = 'playwright' | 'xctest'` と記載があるが、既存ファイルとの整合性を確認する。

| 項目 | 現状 | Step 2 成果物 | 確認必要 |
|---|---|---|---|
| フレームワーク識別子 | `generator-swift.ts` (ファイル名) | `'xctest'` | `xctest` / `xcuitest` / `swift` のどれ? |
| 関数名 | `generateSwiftTestFile` | - | `generators/xcuitest.ts` に移動後の export 名 |
| ファイル拡張子 | `.swift` (generator-swift.ts の慣習) | - | `fileExtension` の値 |
| `--target` フラグ値 | 未定義 | `xctest` 想定 | CLI ユーザーが入力する値 |

**推奨**: `Target = 'playwright' | 'xctest'` で統一し、ファイルは `generators/xctest.ts` とする。`generator-swift.ts` の関数は `generators/xctest.ts` に移動して export 名を `xctest` オブジェクトに統一する。

---

## 新フレームワーク追加時の変更箇所（設計検証）

将来 `jest` を追加する場合の変更ファイル:

1. `core/generators/jest.ts` — 新規作成（既存ファイルへの変更なし）
2. `core/generator-types.ts` — `Target` 型に `'jest'` を追加（1行）
3. `core/generator-registry.ts` — REGISTRY に `jest` エントリを追加（1行）

`commands/generate.ts` / `core/schema.ts` / `core/parser.ts` / `core/validator.ts` への変更は不要。OCP（開放閉鎖原則）に完全準拠。

---

## ESM import パスの注意事項

TypeScript ESM (`"type": "module"`) のため、import には `.js` 拡張子が必要。

```typescript
// core/generator-registry.ts の import 例
import type { FrameworkGenerator, Target } from './generator-types.js';
import { playwright } from './generators/playwright.js';
import { xctest } from './generators/xctest.js';
```

```typescript
// core/generators/playwright.ts の import 例
import type { FrameworkGenerator } from '../generator-types.js';
import type { Screen, Setup } from '../schema.js';
// helpers 抽出後:
import { buildComments, resolveSetupTitles } from '../generator-helpers.js';
```

`generator-registry.ts` → `generators/playwright.ts` は1階層下への参照 (`./generators/`)。
`generators/playwright.ts` → `generator-types.ts` は1階層上への参照 (`../`)。
この方向で循環依存は発生しない。
