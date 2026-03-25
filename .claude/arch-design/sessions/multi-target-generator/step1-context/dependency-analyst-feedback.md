# Dependency Analyst フィードバック

## 現状の import グラフ

```
generate.ts (commands/)
  ├── ../core/generator.ts   ← generateTestFile を直接 import
  ├── ../core/parser.ts      ← parseProject を直接 import
  ├── ../core/validator.ts   ← validate を直接 import
  └── ../utils/output.ts

generator.ts (core/)
  └── ./schema.js            ← Case / Screen / Setup 型のみ import (型のみ依存)

parser.ts (core/)
  └── ./schema.js            ← Config / Screen / Setup / それぞれの Schema import

validator.ts (core/)
  └── ./schema.js            ← Screen / Setup 型のみ import (型のみ依存)

schema.ts (core/)
  └── zod                    ← 外部ライブラリのみ (pure)
```

### 安定度評価

| モジュール | 変化頻度 | 理由 |
|---|---|---|
| schema.ts | 低 (安定) | Zod スキーマ定義のみ。ドメインモデルそのもの。フレームワーク変更の影響を受けない |
| parser.ts | 低 (安定) | YAML 読み込みと Zod バリデーション。フレームワーク非依存 |
| validator.ts | 低 (安定) | 参照整合性チェック。フレームワーク非依存 |
| generator.ts | 高 (不安定) | Playwright 固有の出力 (`@playwright/test` の import 文をハードコード) |
| generate.ts | 中 (不安定) | generator.ts を直接 import しているため、新フレームワーク追加のたびに変更が必要 |

---

## 問題点: generator.ts の直接 import

現在の `generate.ts` は `generateTestFile` を直接 import している。

```typescript
// generate.ts (現状)
import { generateTestFile } from '../core/generator.js';
```

generator の出力内容は Playwright に完全に固定されている (generator.ts:10):
```typescript
'import { test, expect } from "@playwright/test";',
```

新しい `generator-vitest.ts` や `generator-swift.ts` を追加した場合:
- `generate.ts` が各 generator を直接 import するか、条件分岐で選択するロジックを持つことになる
- フレームワーク追加のたびに `generate.ts` を変更しなければならない = 開放閉鎖原則(OCP)違反

---

## 依存方向の設計案比較

### 案A: generate.ts が各 generator を直接 import

```
generate.ts
  ├── generator-playwright.ts
  ├── generator-vitest.ts      ← 追加のたびに generate.ts を変更
  └── generator-swift.ts
```

**問題点:**
- generate.ts の変更頻度が高くなる
- フレームワーク数に比例して generate.ts が肥大化
- 新フレームワーク追加で既存コードに手を入れる必要がある（デグレリスク）

### 案B: registry/factory 経由 (推奨)

```
generate.ts
  └── generator-registry.ts   ← ここだけ知っている (安定インターフェース)
        ├── generator-playwright.ts
        ├── generator-vitest.ts
        └── generator-swift.ts   ← 追加時は registry への登録のみ
```

**メリット:**
- `generate.ts` は registry の interface だけに依存 → フレームワーク追加時に変更不要
- 各 generator は schema.ts の型だけに依存 → 独立してテスト・変更可能
- 循環依存が発生しない (全依存が一方向)

---

## 循環依存リスクの評価

**現状: 循環依存なし**

依存方向は完全に一方向:
```
generate.ts → generator.ts → schema.ts (安定)
generate.ts → parser.ts   → schema.ts (安定)
generate.ts → validator.ts → schema.ts (安定)
```

**将来リスク: registry/factory を導入する場合**

以下のパターンは循環依存を生む可能性があるため注意:

- NG: `generator-X.ts` が `generate.ts` を import する
- NG: `schema.ts` が generator の型を import する
- NG: `parser.ts` が generator に依存する

**安全な依存方向:**
```
commands/ → core/generator-registry → core/generator-X → core/schema
```

registry は各 generator を import するが、generator は registry を import してはならない。

---

## 推奨インターフェース設計

generator の共通インターフェースを schema.ts に近い安定モジュールとして定義することで、各 generator が独立して実装できる。

```typescript
// core/generator-interface.ts (新設)
import type { Screen, Setup } from './schema.js';

export interface TestGenerator {
  generate(screen: Screen, setups: Setup[]): string;
  fileExtension: string;  // e.g. '.spec.ts', '.swift'
}
```

このインターフェースに依存させることで:
- `generate.ts` は `TestGenerator` 型だけを知ればよい
- 各 generator は独立実装・独立テスト可能
- registry は `Map<string, TestGenerator>` として実装できる

---

## まとめ

1. **schema.ts は最も安定** → 変更なし、他の全モジュールが依存してよい
2. **generator.ts は現在 Playwright に固定** → 抽象化が必要
3. **generate.ts の直接 import は拡張性のボトルネック** → registry 経由に変更すべき
4. **循環依存は現状なし** → registry 設計時に依存方向を一方向に保つことが重要
5. **インターフェース分離** → `TestGenerator` interface を安定モジュールとして定義することで、各フレームワーク実装の独立性を担保できる

---

## architecture-lead 設計案への依存関係フィードバック (Step1 broadcast 受領後)

### registry が commands/generate.ts に直接依存する形で問題ないか

**問題なし。推奨できる構造。**

依存方向:
```
commands/generate.ts
  └── core/generator-registry.ts   ← 直接依存 (OK)
        ├── core/generators/playwright.ts → core/schema.ts
        ├── core/generators/vitest.ts     → core/schema.ts
        └── core/generators/swift.ts     → core/schema.ts

core/generator-helpers.ts           ← generators/ から import される共通ロジック
  └── core/schema.ts
```

`commands/` が `core/` に依存するのは既存の構造と同じ方向。registry が増えても `generate.ts` は変更不要。

### generator-helpers.ts の位置と依存リスク

`generator-helpers.ts` を `core/` 直下に置き、各 generator から import する形は安全。

注意点:
- `generator-helpers.ts` は `schema.ts` のみに依存させること
- `generator-helpers.ts` が registry や generate.ts を import すると循環が生じる
- NG パターン: `playwright.ts → generator-helpers.ts → registry.ts → playwright.ts`

### generators/ ディレクトリの依存方向まとめ

```
安定 (変化しにくい)                    不安定 (変化しやすい)
schema.ts ←── generator-helpers.ts ←── generators/playwright.ts
                                   ←── generators/swift.ts
                     ↑
            generator-registry.ts ←── commands/generate.ts
```

すべての依存が「不安定 → 安定」方向。循環依存リスクなし。

### 後方互換 re-export について

`generator.ts` から `generators/playwright.ts` への re-export は依存関係上クリーン。

```typescript
// core/generator.ts (後方互換 re-export)
export { generateTestFile } from './generators/playwright.js';
```

`generate.ts` が既存の `../core/generator.js` import を維持しつつ、内部で registry を使う移行も可能。ただし過渡期に2つの参照経路が生まれるため、移行完了後は re-export を削除することを推奨。

### 懸念点: FrameworkGenerator インターフェースの置き場

インターフェース定義は `generator-registry.ts` に同居させると、generator 側が registry を import せざるを得なくなる場合がある。

推奨: インターフェースのみを持つ薄いモジュール `core/generator-types.ts` として分離する。

```
core/generator-types.ts   ← FrameworkGenerator 型のみ (schema.ts のみ依存)
core/generator-registry.ts ← generator-types.ts + generators/* を import
core/generators/playwright.ts ← generator-types.ts + generator-helpers.ts のみ import
```

こうすることで各 generator は registry を知らずに型だけに依存できる。

---

## team-lead 依頼: 4点フォーカス分析

### 1. generate.ts → registry → 各 generator の依存チェーン — registry が中間層として機能する利点とコスト

**利点:**

- `generate.ts` のフレームワーク知識をゼロにできる。`--framework` フラグの値を registry に渡すだけで、どのフレームワークが追加されても `generate.ts` は変更不要
- 新フレームワーク追加時の変更箇所が `generator-registry.ts` への1行登録と新 generator ファイルの追加のみに局所化される
- registry が「どのフレームワークが存在するか」の唯一の真実の源 (single source of truth) になり、フレームワーク一覧の取得・バリデーションが集中管理できる

**コスト:**

- モジュールが1枚増える（`generator-registry.ts` の追加）
- registry を介することで、エラーが発生したときのスタックトレースが1段深くなる
- フレームワーク数が2〜3件程度なら if/switch で十分という devils-advocate の懸念と重なる

**判断:** フレームワーク追加を繰り返す設計意図があるなら registry のコストは低い。XCUITest 1件追加が確定しているのであれば registry が正当化される。

---

### 2. 各 generator が schema.ts に直接依存する形は安定依存原則に合致しているか

**合致している。**

安定依存原則 (Stable Dependencies Principle) は「不安定なモジュールは安定したモジュールに依存すべき」という原則。

安定度の評価:
```
schema.ts        → 安定 (ドメインモデル。zod スキーマ定義のみ。外部フレームワーク変更の影響なし)
generator-X.ts   → 不安定 (フレームワークごとに異なる実装。追加・変更が頻繁に発生)
```

`generator-X.ts (不安定) → schema.ts (安定)` という依存方向は原則に完全に合致する。

逆方向 `schema.ts → generator-X.ts` になると原則違反。現状の設計では schema.ts は generator を一切 import しておらず問題なし。

また `generator-helpers.ts` も schema.ts のみに依存する設計なら同様に原則合致。

---

### 3. generator が helpers に依存する形でOKか

**OK。ただし helpers の依存先を schema.ts 限定に保つことが条件。**

```
generators/playwright.ts  (不安定)
  └── generator-helpers.ts  (中程度に安定)
        └── schema.ts  (安定)
```

この3層は「不安定 → 中間 → 安定」の一方向チェーンになっており、原則に合致する。

注意: helpers が安定であり続けるには、schema.ts 以外への依存を持たせないことが重要。

- OK: `generator-helpers.ts` が `schema.ts` の型を使って `buildTestName` / `buildComments` を実装する
- NG: `generator-helpers.ts` が `generator-registry.ts` や `generate.ts` (commands/) を import する
- NG: `generator-helpers.ts` が特定フレームワークの出力形式に関するロジックを持つ（それは各 generator の責務）

helpers の責務を「tespec ドメインの共通ロジック（テスト名生成・コメント生成・setup 参照解決）」に限定すれば、安定度は schema.ts に近いレベルを維持できる。

---

### 4. 循環依存リスクの有無

**現状: リスクなし。設計案でも適切に設計すればリスクなし。**

安全な依存グラフ（一方向）:
```
commands/generate.ts
  └── core/generator-registry.ts
        ├── core/generator-types.ts → core/schema.ts
        └── core/generators/playwright.ts
              ├── core/generator-types.ts
              └── core/generator-helpers.ts → core/schema.ts
```

循環依存が発生しうるアンチパターン（禁止事項）:

| パターン | リスク |
|---|---|
| `generators/X.ts → generator-registry.ts` | registry が generators を import する逆向き |
| `generator-helpers.ts → generator-registry.ts` | helpers が registry に依存 |
| `schema.ts → generators/X.ts` | 安定モジュールが不安定モジュールに依存 |
| `core/* → commands/generate.ts` | core が commands に依存（レイヤー逆転） |

TypeScript ESM の静的 import では循環依存はビルドエラーにならないケースがある（実行時に undefined になる）ため、コードレビューまたは `madge` 等の循環依存検出ツールを CI に組み込むことを推奨。
